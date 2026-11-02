// Live: the DJ sends the mix to a handful of listeners straight from their own browser (WebRTC, audio only).
// The first 12 listeners are peer to peer: no media passes through a server, the room's channel only carries the hand-shake (offers, answers, ICE).
// Past that, the DJ also publishes the mix once to a LiveKit room (an SFU) and everyone else listens there; the join tokens come from /api/lk, which holds a hard monthly budget.
// Every listener gets their own copy of the stream, so the DJ's upload is (bitrate x listeners): 128 kbps x 10 is about 1.3 Mbps.
//
// A listener plays the sound and hands the same stream to the club, which finds the kicks in it and runs the lights, crowd
// and screen from what that listener is actually hearing.
//
// channel: { send(payload) }, and the owner calls live.handle(event) for every event the channel delivers.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // a TURN server would help the few networks that block direct paths
const MAX_LISTENERS = 12;   // a mesh stops being comfortable past about a dozen
const BITRATE = 128000;     // bits per second per listener
const LK_SRC = 'https://cdn.jsdelivr.net/npm/livekit-client@2.15.14/dist/livekit-client.umd.js';
let lkLoad = null;
const loadLk = () => lkLoad || (lkLoad = new Promise((res, rej) => { if (window.LivekitClient) return res(window.LivekitClient); const s = document.createElement('script'); s.src = LK_SRC; s.onload = () => res(window.LivekitClient); s.onerror = () => { lkLoad = null; rej(new Error('LiveKit did not load')); }; document.head.appendChild(s); }));

// ask Opus for stereo music at our bitrate instead of its mono-voice defaults
function tuneOpus(sdp) {
  return sdp.replace(/a=fmtp:(\d+) ([^\r\n]*)/g, (line, pt, params) => (
    /useinbandfec|minptime/.test(params) && !/stereo/.test(params)
      ? `a=fmtp:${pt} ${params};stereo=1;sprop-stereo=1;maxaveragebitrate=${BITRATE}` : line));
}

export function createLive({ channel, me, isDj, room = me, getToken = async () => null, onState = () => {}, onListenStream = () => {}, onSync = () => {} }) {
  const L = {
    isDj, on: false, listening: false, full: false,
    peers: new Map(),          // DJ: listener id -> RTCPeerConnection
    dcs: new Map(),            // DJ: listener id -> the data channel that carries beat and light timing
    stream: null,              // DJ: the mix being sent
    fanPc: null, audio: null, needsTap: false, // listener: the one connection to the DJ, and the element playing it
    count: () => L.peers.size + (L.sfuFans || 0),
    sfu: null, sfuFans: 0, sfuBusy: null, renew: null,   // the big room: the DJ's publishing connection, how many are in it, and a listener's renewal timer
  };
  const emit = () => onState({ on: L.on, listening: L.listening, full: L.full, listeners: L.peers.size + (L.sfuFans || 0), needsTap: L.needsTap, isDj });
  const playAudio = () => {
    if (!L.audio) return;
    L.audio.play().then(() => { if (L.needsTap) { L.needsTap = false; emit(); } }).catch(() => { if (!L.needsTap) { L.needsTap = true; emit(); } });
  };
  // a join token from the server (it enforces the budget and the room's cap); null if the big room is full or switched off
  async function lkToken(role) {
    const t = await getToken(); if (!t) return null;
    const r = await fetch('/api/lk', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ room, role }) });
    return r.ok ? r.json() : null;
  }
  const send = (m) => channel.send({ ...m, from: me });

  // ------------------------------------------------------------------ DJ
  L.start = (stream) => {
    if (!isDj || L.on) return;
    L.stream = stream; L.on = true;
    send({ type: 'lv-on' }); emit();
  };
  L.stop = () => {
    if (!isDj || !L.on) return;
    send({ type: 'lv-off' });
    for (const pc of L.peers.values()) pc.close();
    L.peers.clear(); L.dcs.clear(); L.on = false; L.stream = null;
    if (L.sfu) { try { L.sfu.disconnect(); } catch (_) {} L.sfu = null; L.sfuFans = 0; }
    emit();
  };
  async function offerTo(fan) {
    if (L.peers.has(fan)) { L.peers.get(fan).close(); L.peers.delete(fan); L.dcs.delete(fan); }   // they pressed again: start clean
    if (L.peers.size >= MAX_LISTENERS) { send({ type: 'lv-full', to: fan, sfu: await ensureSfu() }); return; }
    const pc = new RTCPeerConnection(ICE);
    L.peers.set(fan, pc);
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'lv-ice', to: fan, c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState) && L.peers.get(fan) === pc) {
        if (pc.connectionState !== 'disconnected') { pc.close(); L.peers.delete(fan); L.dcs.delete(fan); }
      }
      emit();
    };
    // beat and light timing ride alongside the sound: small, often, and never worth waiting for (a late packet is dropped)
    L.dcs.set(fan, pc.createDataChannel('sync', { ordered: false, maxRetransmits: 0 }));
    for (const t of L.stream.getAudioTracks()) pc.addTrack(t, L.stream);
    for (const s of pc.getSenders()) {
      const p = s.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}];
      p.encodings[0].maxBitrate = BITRATE; s.setParameters(p).catch(() => {});
    }
    const offer = await pc.createOffer();
    offer.sdp = tuneOpus(offer.sdp);
    await pc.setLocalDescription(offer);
    send({ type: 'lv-offer', to: fan, sdp: pc.localDescription.toJSON() }); emit();
  }

  // DJ: the first listener past the peer-to-peer dozen starts the big room: publish the mix once to LiveKit and everyone else listens there
  function ensureSfu() {
    if (L.sfu) return Promise.resolve(true);
    if (L.sfuBusy) return L.sfuBusy;
    return L.sfuBusy = (async () => {
      try {
        const [lk, tk] = await Promise.all([loadLk(), lkToken('dj')]);
        if (!tk || !L.on || !L.stream) return false;
        const room_ = new lk.Room(); await room_.connect(tk.url, tk.token);
        const track = L.stream.getAudioTracks()[0]; if (!track) { room_.disconnect(); return false; }
        await room_.localParticipant.publishTrack(new lk.LocalAudioTrack(track), { name: 'mix', source: 'microphone', audioPreset: { maxBitrate: BITRATE }, dtx: false, red: false });
        const count = () => { L.sfuFans = room_.remoteParticipants.size; emit(); };
        room_.on(lk.RoomEvent.ParticipantConnected, count).on(lk.RoomEvent.ParticipantDisconnected, count);
        L.sfu = room_; count(); return true;
      } catch (e) { console.warn('big room', e); return false; } finally { L.sfuBusy = null; }
    })();
  }

  // DJ: send one packet of beat and light timing to everyone who is listening
  L.sendSync = (obj) => {
    if (!L.on) return;
    const msg = JSON.stringify(obj);
    for (const dc of L.dcs.values()) if (dc.readyState === 'open') dc.send(msg);
    if (L.sfu && L.sfuFans) { try { L.sfu.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: false }); } catch (_) {} }
  };

  // ------------------------------------------------------------------ listener
  L.join = () => {
    if (isDj || L.listening) return;
    L.listening = true; L.full = false;
    // the element has to be created inside the click that called us, or the browser will not let it play
    L.audio = document.createElement('audio'); L.audio.autoplay = true; L.audio.playsInline = true;
    send({ type: 'lv-hello' }); emit();
  };
  L.leave = () => {
    if (isDj) return;
    if (L.listening) send({ type: 'lv-bye' });
    clearTimeout(L.renew); L.renew = null;
    if (L.fanPc) L.fanPc.close();
    if (L.audio) { L.audio.srcObject = null; }
    L.fanPc = null; L.audio = null; L.listening = false; L.needsTap = false; emit();
    onListenStream(null);
  };
  L.ask = () => { if (!isDj) send({ type: 'lv-who' }); };
  // listener: join the DJ's big room. The token is good for a few minutes and counted against the budget, so the page quietly rejoins before it runs out.
  async function joinSfu() {
    if (!L.listening) return;
    if (!L.fanPc) L.fanPc = { pending: true, close() {} };   // so the page knows a connection is on its way
    try {
      const [lk, tk] = await Promise.all([loadLk(), lkToken('listener')]);
      if (!tk) { L.full = true; L.leave(); L.full = true; emit(); return; }
      if (!L.listening) return;
      const room_ = new lk.Room();
      room_.on(lk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== 'audio') return;
        const stream = new MediaStream([track.mediaStreamTrack]);
        if (L.audio) { L.audio.srcObject = stream; playAudio(); }
        onListenStream(stream);
      });
      room_.on(lk.RoomEvent.DataReceived, (payload) => { try { onSync(JSON.parse(new TextDecoder().decode(payload))); } catch (_) {} });
      room_.on(lk.RoomEvent.Disconnected, () => { if (L.fanPc && L.fanPc.room === room_) L.leave(); });
      await room_.connect(tk.url, tk.token);
      const old = L.fanPc; L.fanPc = { room: room_, close: () => { try { room_.disconnect(); } catch (_) {} } };
      if (old && old.room) { old.room = null; try { old.close(); } catch (_) {} }
      clearTimeout(L.renew); L.renew = setTimeout(() => joinSfu(), Math.max(30, (tk.seconds || 900) - 25) * 1000);
      emit();
    } catch (e) { console.warn('big room', e); L.full = true; L.leave(); L.full = true; emit(); }
  }
  async function answerOffer(ev) {
    if (!L.listening) return;
    if (L.fanPc) L.fanPc.close();
    const pc = new RTCPeerConnection(ICE); L.fanPc = pc;
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'lv-ice', to: ev.from, c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState) && L.fanPc === pc) L.leave(); else emit(); };
    pc.ondatachannel = (e) => { e.channel.onmessage = (m) => { try { onSync(JSON.parse(m.data)); } catch (_) {} }; };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      L.audio.srcObject = stream; playAudio();
      onListenStream(stream);
    };
    await pc.setRemoteDescription(ev.sdp);
    await pc.setLocalDescription(await pc.createAnswer());
    send({ type: 'lv-answer', to: ev.from, sdp: pc.localDescription.toJSON() });
  }
  // Safari may refuse delayed audio after an auto-join. This is called by a real
  // user tap, so the listener can recover without leaving and reconnecting.
  L.resume = () => playAudio();

  // ------------------------------------------------------------------ events from the room's channel
  L.handle = async (ev) => {
    if (!ev || !ev.type || !ev.type.startsWith('lv-') || ev.from === me) return;
    if (ev.to && ev.to !== me) return;
    try {
      if (isDj) {
        if (ev.type === 'lv-who' && L.on) send({ type: 'lv-on' });
        else if (ev.type === 'lv-hello' && L.on) await offerTo(ev.from);
        else if (ev.type === 'lv-answer') { const pc = L.peers.get(ev.from); if (pc) await pc.setRemoteDescription(ev.sdp); }
        else if (ev.type === 'lv-ice') { const pc = L.peers.get(ev.from); if (pc) await pc.addIceCandidate(ev.c); }
        else if (ev.type === 'lv-bye') { const pc = L.peers.get(ev.from); if (pc) { pc.close(); L.peers.delete(ev.from); L.dcs.delete(ev.from); emit(); } }
      } else {
        if (ev.type === 'lv-on') { L.on = true; emit(); }
        else if (ev.type === 'lv-off') { L.on = false; L.leave(); emit(); }
        else if (ev.type === 'lv-offer') await answerOffer(ev);
        else if (ev.type === 'lv-ice' && L.fanPc) await L.fanPc.addIceCandidate(ev.c);
        else if (ev.type === 'lv-full') { if (ev.sfu) await joinSfu(); else { L.full = true; L.leave(); L.full = true; emit(); } }
      }
    } catch (e) { console.warn('live', ev.type, e); }
  };
  return L;
}
