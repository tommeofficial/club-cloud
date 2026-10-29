// Club chat: messages, quick paid requests (shout-outs, song requests, tips, meet & greets), recorded shout-outs
// that play to the whole room, and 30-second meet & greet video calls with the DJ.
// Payments are not live yet: every paid option runs its full flow as a free test.
//
// Rooms: open the app plainly and you are the DJ in your own room (your username).
// Open it with ?room=<dj username> and you join that DJ's room as a fan.

import { createLive } from './live.js?v=2';

const panel = document.getElementById('chatpanel');
const log = document.getElementById('chatlog');
const input = document.getElementById('chatin');
const status = panel.querySelector('.cstatus');
const nameRow = panel.querySelector('.cname');
const djRow = panel.querySelector('.cdj');
const listenRow = panel.querySelector('.clisten');
const modal = document.getElementById('chatmodal');

const SHOUT_MAX = 15; // seconds of recording
const MEET_SECS = 30;
const PRICES = { shout: 5, song: 5, meet: 30 };
const urlRoom = new URLSearchParams(location.search).get('room');
const S = { backend: null, me: null, room: null, isDj: false, ch: null, lastSent: 0, unread: 0, requests: new Map(), meetQueue: [], call: null };

const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hue = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const setStatus = (t) => { status.textContent = t; };

// ------------------------------------------------------------------ panel
function line(html, cls = '') {
  const d = document.createElement('div'); d.className = 'cl ' + cls; d.innerHTML = html;
  log.append(d);
  while (log.childElementCount > 80) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
  if (panel.classList.contains('min')) { S.unread++; panel.querySelector('.cunread').textContent = S.unread; }
  return d;
}
const who = (name) => `<b style="color:hsl(${hue(name)} 85% 70%)">${esc(name)}</b>${S.room && name === S.room ? '<i class="djtag">DJ</i>' : ''}`;
function showMessage(m) { line(`${who(m.author)} ${esc(m.body)}`); }
function system(text, cls = 'sys') { return line(esc(text), cls); }

function setMin(min) {
  panel.classList.toggle('min', min);
  if (!min) { S.unread = 0; panel.querySelector('.cunread').textContent = ''; log.scrollTop = log.scrollHeight; }
}
panel.querySelector('.cmin').addEventListener('click', () => setMin(!panel.classList.contains('min')));
// open in the club views, tucked away in the deck and split views
// (a setting: AUTO HIDE in SETTINGS; turned off, the chat stays however you leave it)
let autoHide = true;
try { autoHide = localStorage.getItem('cc-chat-auto') !== 'off'; } catch (_) {}
const autoBtn = document.getElementById('chatAuto');
const syncAuto = () => { if (autoBtn) { autoBtn.classList.toggle('on', autoHide); autoBtn.textContent = autoHide ? 'AUTO HIDE ON' : 'AUTO HIDE OFF'; } };
autoBtn?.addEventListener('click', () => { autoHide = !autoHide; syncAuto(); try { localStorage.setItem('cc-chat-auto', autoHide ? 'on' : 'off'); } catch (_) {} });
syncAuto();
window.addEventListener('cc-view', (e) => { if (autoHide) setMin(e.detail.mode !== 'club'); });

// ------------------------------------------------------------------ connecting
async function start() {
  setStatus('connecting…');
  try {
    S.backend = await import('./backend.js');
    if (!S.backend.supabase) throw new Error('not configured');
    S.me = await S.backend.getMyProfile();
  } catch (e) { console.warn('chat offline', e); setStatus('offline'); return; }
  if (!S.me) { nameRow.hidden = false; setStatus(''); return; }
  connect();
}

nameRow.querySelector('button').addEventListener('click', claim);
nameRow.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') claim(); });
async function claim() {
  const box = nameRow.querySelector('input'), name = box.value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(name)) { system('Usernames are 3 to 30 letters, numbers or _.', 'err'); return; }
  try { S.me = await S.backend.claimUsername(name); }
  catch (e) { system(/duplicate|unique/i.test(e.message) ? 'That name is taken. Try another.' : 'Could not save that name. Try again.', 'err'); return; }
  nameRow.hidden = true;
  connect();
}

async function connect() {
  S.room = urlRoom || S.me.username;
  S.isDj = S.room === S.me.username;
  djRow.hidden = !S.isDj;
  try {
    for (const m of await S.backend.loadRecentChat(S.room, 30)) showMessage(m);
  } catch (e) { setStatus('room not found'); system(`There's no room called ${S.room}.`, 'err'); return; }
  S.backend.subscribeChat(S.room, showMessage);
  S.ch = S.backend.openClubChannel(S.room, onEvent);
  setupLive();
  setStatus('');
  // you, at the top of the chat
  panel.querySelector('.cmename').textContent = '@' + S.me.username;
  panel.querySelector('.cmeroom').textContent = S.isDj ? 'DJ · your room' : `in ${S.room}'s room`;
  const av = panel.querySelector('.cav'); av.textContent = S.me.username[0].toUpperCase(); av.style.background = `hsl(${hue(S.me.username)} 85% 70%)`;
  input.disabled = false;
  // say hello: everyone in the room sees "WELCOME @name" on the big screen (if they're looking at it),
  // and the new arrival starts in the CLUB view so their first look is their own welcome
  if (!sessionStorage.getItem('cc-welcomed')) {
    sessionStorage.setItem('cc-welcomed', '1');
    document.querySelector('#tabs [data-mode=club]')?.click();
    setTimeout(() => S.ch.send({ type: 'join', name: S.me.username }), 1500);
  }
}

input.disabled = true;
panel.querySelector('.cgo').addEventListener('click', () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })));
input.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || !S.ch) return;
  const body = input.value.trim().slice(0, 200);
  if (!body) return;
  if (performance.now() - S.lastSent < 1000) { system('Slow down a little.', 'err'); return; }
  S.lastSent = performance.now();
  input.value = '';
  await send(body);
});
const send = (body) => S.backend.sendChat(S.room, S.me.username, body).catch(() => system('Message not sent. Check your connection.', 'err'));

// ------------------------------------------------------------------ modal
function ask(html, okLabel, onOk) {
  modal.innerHTML = `<div class="cbox">${html}<div class="cact"><button class="ccancel">CANCEL</button>${okLabel ? `<button class="cok">${okLabel}</button>` : ''}</div></div>`;
  modal.hidden = false;
  modal.querySelector('.ccancel').onclick = closeModal;
  if (okLabel) modal.querySelector('.cok').onclick = () => onOk(modal);
  modal.querySelector('input')?.focus();
}
function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
const testNote = '<p class="cnote">Payments aren\'t live yet, so this runs as a free test.</p>';

// ------------------------------------------------------------------ quick options
panel.querySelector('.cquick').addEventListener('click', (e) => {
  const q = e.target.closest('button')?.dataset.q; if (!q) return;
  if (!S.ch) { system('Chat is not connected yet.', 'err'); return; }
  if (q === 'shout') ask(`<h4>Shout-out · £${PRICES.shout}</h4><p>Ask the DJ for a shout-out. If they accept, you'll record up to ${SHOUT_MAX} seconds and it plays to everyone in the club, with your name on the big screen.</p>${testNote}`, 'REQUEST', () => request('shout'));
  if (q === 'song') ask(`<h4>Song request · £${PRICES.song}</h4><p class="cwarn">The DJ may not have this song, or it may not fit the set. They choose whether to play it.</p><input maxlength="80" placeholder="Artist – song">${testNote}`, 'REQUEST', (m) => {
    const t = m.querySelector('input').value.trim(); if (!t) return; request('song', t);
  });
  if (q === 'tip') ask(`<h4>Tip the DJ</h4><p>Any amount.</p><div class="cmoney">£<input type="number" min="1" max="500" step="1" value="5"></div>${testNote}`, 'SEND TIP', (m) => {
    const v = Math.round(+m.querySelector('input').value); if (!(v >= 1 && v <= 500)) return;
    closeModal(); S.ch.send({ type: 'tip', from: S.me.username, amount: v }); send(`💸 tipped £${v}`);
  });
  if (q === 'meet') ask(`<h4>Meet & greet · £${PRICES.meet}</h4><p>After the set, you'll get a ${MEET_SECS}-second video call with the DJ. Keep this page open; your camera and mic are needed when it's your turn.</p>${testNote}`, 'BOOK', () => request('meet'));
});
function request(kind, text = '') {
  closeModal();
  const id = uid();
  S.ch.send({ type: 'req', id, kind, from: S.me.username, text });
  send(kind === 'shout' ? '📣 requested a shout-out' : kind === 'song' ? `🎵 requested: ${text}` : '🎥 booked a meet & greet');
}

// ------------------------------------------------------------------ room events
let onEvent = function (ev) {
  if (ev.type === 'req') {
    S.requests.set(ev.id, ev);
    if (!S.isDj) return;
    if (ev.kind === 'meet') { S.meetQueue.push(ev.from); updateMeet(); return; }
    const d = line(`<span class="creq">${ev.kind === 'shout' ? '📣 Shout-out' : '🎵 Song'} request from ${who(ev.from)}${ev.text ? ': ' + esc(ev.text) : ''}</span><span class="cbtns"><button data-a="acc">ACCEPT</button><button data-a="skip">SKIP</button></span>`, 'req');
    d.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      d.querySelector('.cbtns').remove();
      S.ch.send({ type: a, id: ev.id, kind: ev.kind, to: ev.from, text: ev.text });
    };
  } else if (ev.type === 'acc') {
    if (ev.kind === 'song') system(`The DJ accepted ${ev.to}'s request: ${ev.text}`, 'ok');
    if (ev.kind === 'shout') { system(`The DJ accepted ${ev.to}'s shout-out. Recording…`, 'ok'); if (ev.to === S.me.username) recorder(); }
  } else if (ev.type === 'skip') {
    if (ev.to === S.me.username) system(`The DJ passed on your ${ev.kind === 'song' ? 'song request' : 'shout-out'} this time.`, 'sys');
  } else if (ev.type === 'join') {
    system(`${ev.name} joined the club`, 'sys');
    flashScreen('WELCOME', '@' + ev.name, 6000);
  } else if (ev.type === 'tip') {
    flashScreen('THANK YOU', '@' + ev.from, 5000);
  } else if (ev.type === 'shoutout') {
    playShout(ev);
  } else if (ev.type.startsWith('mg-')) meetEvent(ev);
  else if (ev.type.startsWith('lv-')) S.live && S.live.handle(ev);
};

// ------------------------------------------------------------------ ducking: mute or lower the music and crowd
function duck(music, crowd, secs = 0.3) {
  const cc = window.__cc, club = window.__club;
  if (cc && cc.master.duck) cc.master.duck.gain.setTargetAtTime(music, cc.ctx.currentTime, secs / 3);
  if (club && club.sfx.duck) club.sfx.duck(crowd);
}
function flashScreen(top, name, ms) {
  const sc = window.__club && window.__club.screen; if (!sc) return;
  sc.msg = { top, name, until: performance.now() + ms };
}

// ------------------------------------------------------------------ shout-outs: record, send, play to everyone
async function recorder() {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { system('Microphone blocked, so the shout-out could not be recorded.', 'err'); return; }
  ask(`<h4>Record your shout-out</h4><p>The music and crowd go quiet while you record. Up to ${SHOUT_MAX} seconds.</p><div class="crec"><button class="cdot" aria-label="Record"></button><span class="ctime">0:${String(SHOUT_MAX).padStart(2, '0')}</span></div>`, null);
  const btn = modal.querySelector('.cdot'), time = modal.querySelector('.ctime');
  let rec = null, chunks = [], timer = null, t0 = 0;
  const stopAll = () => { stream.getTracks().forEach((t) => t.stop()); duck(1, 1); clearInterval(timer); };
  modal.querySelector('.ccancel').onclick = () => { if (rec && rec.state === 'recording') { rec.onstop = null; rec.stop(); } stopAll(); closeModal(); };
  btn.onclick = () => {
    if (rec && rec.state === 'recording') { rec.stop(); return; }
    duck(0, 0);
    chunks = [];
    rec = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stopAll(); closeModal();
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
      S.ch.send({ type: 'shoutout', from: S.me.username, mime: blob.type, data });
    };
    rec.start(); t0 = performance.now(); btn.classList.add('on');
    timer = setInterval(() => {
      const left = Math.max(0, SHOUT_MAX - (performance.now() - t0) / 1000);
      time.textContent = '0:' + String(Math.ceil(left)).padStart(2, '0');
      if (left <= 0) rec.stop();
    }, 200);
  };
}
function playShout(ev) {
  const a = new Audio(`data:${ev.mime};base64,${ev.data}`);
  system(`📣 Shout-out from ${ev.from}`, 'ok');
  duck(0.15, 0.1, 0.6);
  a.onloadedmetadata = () => flashScreen('SHOUT OUT', '@' + ev.from, (isFinite(a.duration) ? a.duration : SHOUT_MAX) * 1000 + 2500);
  flashScreen('SHOUT OUT', '@' + ev.from, SHOUT_MAX * 1000);
  a.onended = a.onerror = () => duck(1, 1, 1.2);
  a.play().catch(() => duck(1, 1));
}

// ------------------------------------------------------------------ going live
// The DJ's button sends the mix straight from their browser to anyone in the room who presses LISTEN LIVE (see live.js).
function setupLive() {
  const goBtn = djRow.querySelector('.cgolive'), listenBtn = listenRow.querySelector('button');
  S.live = createLive({
    channel: S.ch, me: S.me.username, isDj: S.isDj,
    onState: (st) => {
      goBtn.classList.toggle('on', st.on); goBtn.textContent = st.on ? `LIVE · ${st.listeners} LISTENING` : 'GO LIVE';
      listenRow.hidden = S.isDj || (!st.on && !st.listening);
      listenBtn.classList.toggle('on', st.listening); listenBtn.textContent = st.listening ? 'STOP LISTENING' : st.full ? 'ROOM FULL, TRY LATER' : 'LISTEN LIVE';
    },
    // what a listener hears is also what their club reacts to: lights, crowd and screen follow the stream
    onListenStream: (stream) => { if (stream) window.__club?.useStream(stream); else { window.__club?.stopInput(); window.__club?.endSync(); } },
    // the DJ's beat clock and light state: the listener's club does the DJ's show
    onSync: (p) => window.__club?.applySync(p),
  });
  goBtn.onclick = () => {
    if (S.live.on) { S.live.stop(); clearInterval(S.syncTimer); system('You are off air.', 'sys'); return; }
    window.__cc?.unlock?.();
    const tap = window.__cc?.master?.tap;
    if (!tap) { system('The audio engine has not started yet. Press play on a deck first, then try again.', 'err'); return; }
    S.live.start(tap.stream); system('You are live. Everyone in the room can press LISTEN LIVE.', 'ok');
    clearInterval(S.syncTimer); S.syncTimer = setInterval(() => { if (S.live.on) S.live.sendSync(window.__club.syncPacket()); else clearInterval(S.syncTimer); }, 100);
  };
  listenBtn.onclick = () => { if (S.live.listening) S.live.leave(); else S.live.join(); };
  if (!S.isDj) setTimeout(() => S.live.ask(), 1200); // is the DJ already on air?
  addEventListener('pagehide', () => { if (S.isDj) S.live.stop(); else S.live.leave(); });
}

// ------------------------------------------------------------------ meet & greets: 30-second video calls after the set
function updateMeet() {
  const b = djRow.querySelector('button');
  b.textContent = `START MEET & GREETS (${S.meetQueue.length})`;
  b.disabled = !S.meetQueue.length || !!S.call;
}
djRow.querySelector('button').addEventListener('click', () => nextMeet());
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function callWindow(other) {
  ask(`<h4>Meet & greet with ${esc(other)}</h4><div class="cvid"><video class="vthem" autoplay playsinline></video><video class="vme" autoplay playsinline muted></video></div><div class="ctime cbig">${MEET_SECS}</div>`, null);
  modal.querySelector('.ccancel').textContent = 'END CALL';
  modal.querySelector('.ccancel').onclick = () => endCall(true);
}
async function newCall(other) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
  const pc = new RTCPeerConnection(ICE);
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  pc.onicecandidate = (e) => { if (e.candidate) S.ch.send({ type: 'mg-ice', to: other, from: S.me.username, c: e.candidate.toJSON() }); };
  pc.ontrack = (e) => { const v = modal.querySelector('.vthem'); if (v) v.srcObject = e.streams[0]; };
  S.call = { pc, stream, other, timer: null };
  callWindow(other);
  modal.querySelector('.vme').srcObject = stream;
  return pc;
}
function startClock() {
  const t0 = performance.now(), el = () => modal.querySelector('.ctime');
  S.call.timer = setInterval(() => {
    const left = Math.max(0, MEET_SECS - (performance.now() - t0) / 1000);
    if (el()) el().textContent = Math.ceil(left);
    if (left <= 0) endCall(true);
  }, 250);
}
function endCall(tell) {
  if (!S.call) return;
  if (tell) S.ch.send({ type: 'mg-end', to: S.call.other, from: S.me.username });
  clearInterval(S.call.timer); S.call.pc.close(); S.call.stream.getTracks().forEach((t) => t.stop());
  S.call = null; closeModal();
  if (S.isDj) { updateMeet(); if (S.meetQueue.length) system(`${S.meetQueue.length} meet & greet${S.meetQueue.length > 1 ? 's' : ''} left.`, 'sys'); }
}
async function nextMeet() {
  if (S.call || !S.meetQueue.length) return;
  const fan = S.meetQueue.shift(); updateMeet();
  try {
    const pc = await newCall(fan);
    await pc.setLocalDescription(await pc.createOffer());
    S.ch.send({ type: 'mg-offer', to: fan, from: S.me.username, sdp: pc.localDescription.toJSON() });
  } catch (e) { system('Camera or mic blocked, so the call could not start.', 'err'); endCall(false); }
}
async function meetEvent(ev) {
  if (ev.to !== S.me.username) return;
  try {
    if (ev.type === 'mg-offer') {
      const pc = await newCall(ev.from);
      await pc.setRemoteDescription(ev.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      S.ch.send({ type: 'mg-answer', to: ev.from, from: S.me.username, sdp: pc.localDescription.toJSON() });
      startClock();
    } else if (ev.type === 'mg-answer' && S.call) { await S.call.pc.setRemoteDescription(ev.sdp); startClock(); }
    else if (ev.type === 'mg-ice' && S.call) await S.call.pc.addIceCandidate(ev.c);
    else if (ev.type === 'mg-end') endCall(false);
  } catch (e) { console.warn('meet & greet', e); system('The video call dropped.', 'err'); endCall(false); }
}


// ------------------------------------------------------------------ the crowd in the chat
// 30 pretend regulars who chat about what's going on in the club. They only exist on this screen (nothing is saved),
// so the chat never feels empty, and they react to the music, the crowd meter, drops, mixes, shout-outs and tips.
const BOTS = ['jess_raves', 'tomtom', 'maya.k', 'big_dave', 'lils', 'kieran_x', 'sophie_b', 'ravequeen', 'danny_d', 'chloe', 'marcus99', 'bex', 'nina_loves_house', 'joe_bloggs', 'aisha', 'callum', 'freddie_f', 'priya', 'olliej', 'hannah_h', 'zara', 'lukey', 'gemma', 'rhys', 'tash', 'jamie_t', 'ellie_m', 'mo', 'sam_s', 'kat'];
const SAY = {
  waiting: ['where is the music 😂', 'is this thing on?', 'waiting for the DJ…', 'any minute now 👀', 'come on then DJ', 'who\'s the DJ tonight?', 'hellooo anyone there', 'just got here, what did I miss', 'love this club already', 'the lights are sick', 'get the first tune on!!', 'quiet in here innit', 'bar\'s open at least 🍸', 'ready to dance 💃', 'mic check?', 'this logo is so clean', 'who\'s coming out tonight', 'hope we get some house tonight', 'drop something big first', 'tapping my foot already'],
  dead: ['where is the music??', 'music stopped?', 'DJ fell asleep 😴', 'uhh hello??', 'dead air 💀', 'did the laptop crash 😭', 'bring it back!!', 'what happened', 'awkward silence', 'press play pls', 'nooo it stopped', 'technical difficulties 😂', 'is it just me or is it silent', 'DJ come back', 'we\'re waiting…', 'tumbleweed', 'the crowd is turning', 'boooo silence', 'someone check the cables', 'not the vibe'],
  bored: ['bit flat this', 'need more energy', 'play something faster', 'yawn', 'getting a drink brb', 'this is ok i guess', 'pick it up DJ', 'more bass pls', 'meh', 'when does it get good', 'bit slow tonight', 'need a banger', 'switch it up', 'checking my phone ngl', 'is this the warm up?', 'come on', 'needs a drop', 'zzz', 'louder!!', 'not feeling this one'],
  dancing: ['this is nice', 'vibing 🙂', 'ok this is good', 'love this one', 'nice groove', 'yes DJ', 'feeling it', 'proper tune', 'smooth', 'good vibes tonight', 'lights are going off', 'shoes off time', 'love the transitions', 'what\'s this track?', 'id?', 'decent this', 'head nodding', 'getting into it now', 'dancing at my desk', 'this DJ knows'],
  hyped: ['🔥🔥🔥', 'TUNE', 'GO ON DJ', 'this is insane', 'LETS GOOO', 'banger after banger', 'best set ever', 'I can\'t stop dancing', 'ABSOLUTE SCENES', 'unreal', 'the crowd is going mad', 'rewind!!', 'YES YES YES', 'hands in the air 🙌', 'need this on spotify', 'goosebumps', 'DJ of the year', 'ELECTRIC', 'can\'t breathe 😂', 'this is the one'],
  drop: ['DROP 🔥', 'OMG THAT DROP', 'WOOOO', 'here we gooo', 'I SCREAMED', 'LETS GOOO', 'the CO2!!!', 'MENTAL', 'that hit different', 'WHAT A DROP', '🙌🙌🙌', 'lasers!!!', 'my ears 😂', 'felt that in my chest', 'yesss', 'GOOSEBUMPS', 'BOOM', 'the whole place jumped', 'SCENES', 'wait for it… YES'],
  wreck: ['yikes 😬', 'that mix tho', 'off beat!!', 'sync it!!', 'ouch', 'that hurt my ears', 'trainwreck 🚂', 'nooo', 'clashing', 'DJ what was that', 'my ears 😭', 'messy', 'beat match pls', 'rough', 'eek', 'not the cleanest', 'sounds like two songs fighting', 'oof', 'recover it!!', 'wobbly'],
  mix: ['smooth mix', 'clean transition', 'didn\'t even notice the switch', 'seamless 👌', 'nice blend', 'how did you do that', 'perfect timing', 'butter', 'those two together 🤌', 'great mixing', 'skill', 'love that blend', 'proper DJ', 'flawless', 'so smooth', 'class', 'that mix 🔥', 'beatmatched perfectly', 'wow', 'teach me'],
  shout: ['aww 🥰', 'shout out!!', 'legend', 'big up', 'hahaha love it', '❤️', 'iconic', 'heard that!!', 'nice one', 'famous now 😂', 'who\'s that??', 'mine next pls', 'cute', 'ahh so good', 'hello!!', 'loool', 'respect', 'yesss', 'superstar', 'hi mum'],
  tip: ['generous!!', 'big tipper 💸', 'legend', 'nice one', 'respect', 'deserved', 'DJ eating tonight', 'king/queen', 'love that', 'supporting the arts 😂'],
};
const bot = { next: 6, prevMood: '', prevDrop: -99, prevBlend: 0, prevDead: 0, lastReq: 0 };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const botName = () => pick(BOTS);
function botSay(kind) { line(`${who(botName())} ${esc(pick(SAY[kind]))}`, 'bot'); }
function botBurst(kind, n, spread = 2500) { for (let i = 0; i < n; i++) setTimeout(() => botSay(kind), 300 + Math.random() * spread); }
setInterval(() => {
  const club = window.__club; if (!club || !club.brain) return;
  const b = club.brain, now = performance.now() / 1000;
  // moments get a burst of replies
  if (b.lastDrop !== bot.prevDrop) { bot.prevDrop = b.lastDrop; botBurst('drop', 4 + Math.floor(Math.random() * 4)); bot.next = now + 6; return; }
  if (b.clash > 2 && now > bot.next - 3) { botBurst('wreck', 2); bot.next = now + 7; return; }
  if (b.blend > 6 && bot.prevBlend <= 6) { botBurst('mix', 2); }
  bot.prevBlend = b.blend;
  if (b.dead > 3 && bot.prevDead <= 3) { botBurst('dead', 3); bot.next = now + 6; }
  bot.prevDead = b.dead;
  if (now < bot.next) return;
  // otherwise the odd line, more often when the crowd is up
  const kind = !b.playing && b.dead < 1 ? (b.lastHeard < 0 ? 'waiting' : 'dead') : b.dead > 1 ? 'dead' : b.hype > 72 ? 'hyped' : b.hype > 54 ? 'dancing' : 'bored';
  botSay(kind);
  bot.next = now + (kind === 'hyped' ? 2 + Math.random() * 3 : kind === 'dancing' ? 4 + Math.random() * 5 : 6 + Math.random() * 8);
  // now and then a pretend fan tips or asks for a song, so the DJ side has something to accept
  if (b.playing && now - bot.lastReq > 70 && Math.random() < 0.15) {
    bot.lastReq = now;
    const n = botName();
    if (Math.random() < 0.5) { line(`${who(n)} 💸 tipped £${pick([2, 3, 5, 5, 10, 20])}`, 'bot'); setTimeout(() => botSay('tip'), 1500); }
    else if (S.isDj) onEvent({ type: 'req', id: uid(), kind: 'song', from: n, text: pick(['Fred again.. – Delilah', 'Peggy Gou – (It Goes Like) Nanana', 'Calvin Harris – Feel So Close', 'Daft Punk – One More Time', 'Chase & Status – Baddadan', 'Disclosure – Latch', 'Mall Grab – Pool Party', 'Swedish House Mafia – Don\'t You Worry Child']) });
  }
}, 700);
// how many are here: the pretend regulars plus anyone who's joined
let here = 24 + Math.floor(Math.random() * 7);
const showCount = () => { panel.querySelector('.ccount').textContent = `${here} here`; };
showCount();
// pretend fans arrive now and then, and get the same welcome
setInterval(() => { if (Math.random() < 0.5) { const n = botName(); here++; showCount(); onEvent({ type: 'join', name: n }); setTimeout(() => line(`${who(n)} ${esc(pick(['hiii 👋', 'just got here!', 'what did I miss', 'evening all', 'lets gooo', 'hey everyone']))}`, 'bot'), 2500); } }, 75000);
// shout-outs and tips get replies too
const _onEvent = onEvent;
onEvent = (ev) => { _onEvent(ev); if (ev.type === 'shoutout') botBurst('shout', 3, 4000); if (ev.type === 'tip') botBurst('tip', 2, 2500); };

window.__chat = { S }; // for testing from the console
start();
