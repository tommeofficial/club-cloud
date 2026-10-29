// Live: the DJ sends the mix to a handful of listeners straight from their own browser (WebRTC, audio only).
// No media passes through a server: the room's channel only carries the hand-shake (offers, answers, ICE).
// Every listener gets their own copy of the stream, so the DJ's upload is (bitrate x listeners): 128 kbps x 10 is about 1.3 Mbps.
//
// A listener plays the sound and hands the same stream to the club, which finds the kicks in it and runs the lights, crowd
// and screen from what that listener is actually hearing.
//
// channel: { send(payload) }, and the owner calls live.handle(event) for every event the channel delivers.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // a TURN server would help the few networks that block direct paths
const MAX_LISTENERS = 12;   // a mesh stops being comfortable past about a dozen
const BITRATE = 128000;     // bits per second per listener

// ask Opus for stereo music at our bitrate instead of its mono-voice defaults
function tuneOpus(sdp) {
  return sdp.replace(/a=fmtp:(\d+) ([^\r\n]*)/g, (line, pt, params) => (
    /useinbandfec|minptime/.test(params) && !/stereo/.test(params)
      ? `a=fmtp:${pt} ${params};stereo=1;sprop-stereo=1;maxaveragebitrate=${BITRATE}` : line));
}

export function createLive({ channel, me, isDj, onState = () => {}, onListenStream = () => {} }) {
  const L = {
    isDj, on: false, listening: false, full: false,
    peers: new Map(),          // DJ: listener id -> RTCPeerConnection
    stream: null,              // DJ: the mix being sent
    fanPc: null, audio: null,  // listener: the one connection to the DJ, and the element playing it
    count: () => L.peers.size,
  };
  const emit = () => onState({ on: L.on, listening: L.listening, full: L.full, listeners: L.peers.size, isDj });
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
    L.peers.clear(); L.on = false; L.stream = null; emit();
  };
  async function offerTo(fan) {
    if (L.peers.has(fan)) { L.peers.get(fan).close(); L.peers.delete(fan); }   // they pressed again: start clean
    if (L.peers.size >= MAX_LISTENERS) { send({ type: 'lv-full', to: fan }); return; }
    const pc = new RTCPeerConnection(ICE);
    L.peers.set(fan, pc);
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'lv-ice', to: fan, c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState) && L.peers.get(fan) === pc) {
        if (pc.connectionState !== 'disconnected') { pc.close(); L.peers.delete(fan); }
      }
      emit();
    };
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
    if (L.fanPc) L.fanPc.close();
    if (L.audio) { L.audio.srcObject = null; }
    L.fanPc = null; L.audio = null; L.listening = false; emit();
    onListenStream(null);
  };
  L.ask = () => { if (!isDj) send({ type: 'lv-who' }); };
  async function answerOffer(ev) {
    if (!L.listening) return;
    if (L.fanPc) L.fanPc.close();
    const pc = new RTCPeerConnection(ICE); L.fanPc = pc;
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'lv-ice', to: ev.from, c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState) && L.fanPc === pc) L.leave(); else emit(); };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      L.audio.srcObject = stream; L.audio.play().catch(() => {});
      onListenStream(stream);
    };
    await pc.setRemoteDescription(ev.sdp);
    await pc.setLocalDescription(await pc.createAnswer());
    send({ type: 'lv-answer', to: ev.from, sdp: pc.localDescription.toJSON() });
  }

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
        else if (ev.type === 'lv-bye') { const pc = L.peers.get(ev.from); if (pc) { pc.close(); L.peers.delete(ev.from); emit(); } }
      } else {
        if (ev.type === 'lv-on') { L.on = true; emit(); }
        else if (ev.type === 'lv-off') { L.on = false; L.leave(); emit(); }
        else if (ev.type === 'lv-offer') await answerOffer(ev);
        else if (ev.type === 'lv-ice' && L.fanPc) await L.fanPc.addIceCandidate(ev.c);
        else if (ev.type === 'lv-full') { L.full = true; L.leave(); L.full = true; emit(); }
      }
    } catch (e) { console.warn('live', ev.type, e); }
  };
  return L;
}
