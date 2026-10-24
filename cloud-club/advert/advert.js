// The advert: the real app, filmed full-bleed in portrait, with the advert track playing on deck 1.
// Cue times are measured from the track. Scene 1: the play button, then the real stage backdrop.
const CUE = {
  beep1: 0.25, beep2: 0.70,   // the two beeps (pure tones): the play button flashes
  welcome: 1.10,              // "welcome" starts: the black lifts off the real backdrop, sized to the button's glow
  to: 2.40,                   // the "t" of "to"
  club: 3.00,                 // "club"
  cloud: 3.25,                // "cloud"; the bass lands at 3.70
  co2: 5.00,                  // the bass hits again after the dip: CO2, the room fades in, the push begins
  logoOff: 5.45,              // the CLUB CLOUD words leave the LED screen once the CO2 is going
  drop: 16.72,                // the drop: hard cut to the decks
  closeup: 17.61,             // the big bass hit: cut in close on deck 1, then an even slide across the mixer to deck 2
  settings: 23.4,             // the SETTINGS panel pops up over the slide
  djview: 25.0,               // scene 4: DJ view, orbiting right to left round the middle of the crowd
  chat: 28.04,                // beat 64: back to the crowd camera, the live chat floods in, slow push toward the DJ
  request: 28.9,              // a song request is bought: the gold flash
  zoomFast: 30.0,             // faster push onto the LED screen, the room fades back to black
  stopAt: 31.0,               // the push stops with the backdrop back at its opening size
  endMsg: 30.6,               // AGA BORYN / LIVE SET / COMING SOON on the LED screen
  signup: 31.0,               // SIGN UP NOW under it
  musicEnd: 31.55,            // the music cuts out here (silent by 32.45); the picture carries on without it
  agaOut: 32.05,              // half a second later the AGA BORYN message fades off the LED screen...
  logoIn: 32.1,               // ...and the CLUB CLOUD logo fades in
  end: 35.6,                  // the logo holds for a few seconds, then the advert stops
};
// scene 2: lines over the push, two to a card so they read on a phone; the last sits in the breakdown
const LINES = [
  { t0: 7.0, t1: 9.5, html: "WORLD'S <b>FIRST</b><br>VIRTUAL DJ CLUB" },
  { t0: 9.8, t1: 12.0, html: 'HAVING A<br><b>HOUSE PARTY?</b>' },
  { t0: 12.3, t1: 14.5, html: 'JUMP IN AS ONE<br>OF THE <b>CROWD</b>' },
  { t0: 14.8, t1: 16.72, html: 'WANT TO BE<br>THE <b>DJ?</b>' },
  // scene 3, on the decks
  { t0: 16.72, t1: 17.61, html: 'USE OUR <b>FULLY<br>FUNCTIONAL</b><br>VIRTUAL DECKS' },
  { t0: 17.8, t1: 21.4, html: 'OR CONNECT<br>YOUR <b>REAL ONES</b>' },
  { t0: 23.4, t1: 25.0, html: 'MILLION DOLLAR<br><b>LIGHT SHOW</b>,<br>IN YOUR <b>LOUNGE</b>' },
  // scene 4, DJ view
  { t0: 25.0, t1: 26.6, html: 'THE CROWD REACTS<br>TO YOUR <b>REAL MIXING</b>' },
  { t0: 26.6, t1: 28.04, html: 'IN <b>REAL TIME</b>' },
  // scene 5, the live chat
  { t0: 28.04, t1: 28.9, html: 'ANYONE CAN<br>WATCH YOU <b>LIVE</b>' },
  { t0: 28.9, t1: 30.0, html: 'REQUEST <b>SONGS</b><br>& <b>SHOUT OUTS</b>' },
  // the end
  { t0: 31.0, t1: 99, html: 'SIGN UP NOW', small: true },
];

const el = (t, cls, parent) => { const n = document.createElement(t); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; };
document.body.classList.add('advert');

const ad = el('div', null, document.body); ad.id = 'ad';
const stage = el('div', 'adstage', ad);
const playWrap = el('div', 'adplay', stage);
playWrap.innerHTML = '<div class="b big play" data-led="0"><div class="lamp"></div><span>▶/❚❚</span></div>';
const playBtn = playWrap.firstElementChild;
const line = el('div', 'adline', ad);

// the green glow's diameter on screen; the backdrop is framed to the same circle
const glowPx = () => Math.min(innerHeight * 0.40, innerWidth * 0.68);
const fit = () => ad.style.setProperty('--s', (glowPx() / 94).toFixed(3));
addEventListener('resize', fit); fit();

const gate = el('div', 'adgate', ad);
gate.innerHTML = '<button disabled>LOADING…</button>';
const gateBtn = gate.querySelector('button');

const CC = () => window.__cc, CL = () => window.__club;
const wait = (ok) => new Promise((res) => { const k = () => (ok() ? res() : setTimeout(k, 100)); k(); });

// sound: the advert track plays on its own into the speakers, the meters and the club's ears (so the lights and
// crowd follow it), while the decks play their own tracks with their output unplugged, so they look busy but stay silent
let deck, deck2, adBuf, adOut, src = null, running = false, at0 = 0, off0 = 0, beatGrid = { first: 0, B: 0.5 };
const VIP_FROM = 20; // deck 1 is this far into Club Cloud VIP when the advert starts, so it reads mid-track
const now = () => (running ? Math.max(0, off0 + CC().ctx.currentTime - at0 - (CC().ctx.outputLatency || 0)) : off0); // keeps going after the track ends
const decode = async (url) => CC().ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());

async function prepare() {
  await wait(() => CC() && CL() && CC().ctx);
  CC().setMode('club');                     // the club starts loading behind the black
  CL().light.adDark = true;                 // rig held dark until the reveal
  CL().light.intensity = 0.85;              // a busy show for the push
  CL().sfx.volume = 0;                      // no crowd murmur over the black opening
  CL().light.fx.blackout = false;           // the club blacks out when music stops; the end card plays on after it
  const c = CC(), m = c.master;
  const [ab, vip, glm] = await Promise.all(['advert/track.m4a', 'advert/vip.mp3', 'advert/girls-like-me.mp3'].map(decode));
  const [adAn, vipAn, glmAn] = await Promise.all([ab, vip, glm].map((b) => c.analyzeBuffer(b)));
  adBuf = ab; beatGrid = { first: adAn.first || 0, B: 60 / (adAn.bpm || 120) };
  // the decks' mix goes into a silent output: it must stay connected or the browser stops running the decks
  const mute = c.ctx.createGain(); mute.gain.value = 0;
  m.lim.disconnect(); m.lim.connect(mute); mute.connect(c.ctx.destination);
  adOut = c.ctx.createGain(); adOut.connect(m.duck); adOut.connect(m.spec); adOut.connect(m.split);
  [deck, deck2] = c.decks;
  await wait(() => deck.loaded && deck2.loaded); // the app puts its demos on the decks first; replace them
  deck.load({ id: 'ad-vip', title: 'Club Cloud VIP', artist: 'tommeofficial1', art: 'advert/vip.jpg', dur: vip.duration, ...vipAn }, vip, { pos: VIP_FROM, cue: VIP_FROM });
  const cue = glmAn.first || 0;
  deck2.load({ id: 'ad-glm', title: 'Girls Like Me (Extended Mix)', artist: 'TOMME & Aga Boryn', dur: glm.duration, ...glmAn }, glm, { pos: cue, cue });
  await wait(() => CL().ready);
  c.controls.get('m:chsel').set(5); // Beat FX on CH 2: deck 2 sits cued and paused, so the effects make no sound
  CL().setVeil(1);
  gateBtn.disabled = false; gateBtn.textContent = 'PLAY ADVERT';
  requestAnimationFrame(tick);
}
prepare();

function play(from) {
  stop(); off0 = from; at0 = CC().ctx.currentTime; running = true;
  if (from < adBuf.duration) {
    src = CC().ctx.createBufferSource(); src.buffer = adBuf; src.connect(adOut); src.start(0, from);
    src.onended = () => { src = null; deck.pause(); };
  }
  deck.seek(VIP_FROM + from); deck.play();
}
function stop() { if (running) off0 = now(); running = false; if (src) { src.onended = null; src.stop(); src = null; } deck.pause(); }

gateBtn.onclick = () => { CC().unlock(); gate.remove(); play(0); };
// for checking frames: __ad.go(2.8) jumps there paused and replays every cue up to it; __ad.play() runs on from there
window.__ad = {
  go(t) { gate.remove(); if ((t < CUE.closeup && view === 'normal') || (t < CUE.chat && view === 'club' && t >= CUE.drop)) view = ''; stop(); off0 = t; deck.seek(VIP_FROM + t); fired.clear(); CL().screen.ad = null; },
  play() { CC().unlock(); play(off0); }, pause: stop,
};

// camera: starts on the back wall square on to the backdrop, lens set so the backdrop fills the glow's circle;
// from the CO2 it glides over the crowd's heads toward the booth, easing in and out, and tilts down onto the DJ
const BACK_Z = -13.1, FADE = 1.4;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;
// scene 4: over the DJ's shoulder, swinging from the right of the booth to the left while always looking at the middle
// of the crowd; the real controller is re-laid onto the booth table every frame so it stays stuck to it
const CROWD = { x: 0, y: 1.1, z: -3.6 }, ORBIT = { r: 4.9, h: 2.3, from: 0.42, to: -0.42 };
function djOrbit(cam, t) {
  const u = Math.min(1, Math.max(0, (t - CUE.djview) / (CUE.chat - CUE.djview)));
  const a = lerp(ORBIT.from, ORBIT.to, u);
  cam.position.set(CROWD.x + Math.sin(a) * ORBIT.r, ORBIT.h, CROWD.z + Math.cos(a) * ORBIT.r);
  cam.lookAt(CROWD.x, CROWD.y, CROWD.z);
  cam.fov = 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  dispatchEvent(new Event('cc-deckplace'));
}
// scene 5 and the end: from the crowd camera on the back wall, a slow push toward the DJ, then a faster one onto the
// LED screen that eases to a stop with the backdrop exactly the size of the play button's glow again
function endPush(cam, t) {
  const B = CL().BACKDROP, ZF = -9.0, D = B.z - ZF;
  const fF = 2 * Math.atan((2 * B.r) * innerHeight / (2 * D * glowPx())) * 180 / Math.PI;
  const P0 = [0, 3.35, BACK_Z + 0.4, 0, 1.5, -1.4, 36], P1 = [0, 3.0, -11.2, 0, 1.6, -0.4, 36], P2 = [0, B.y, ZF, 0, B.y, B.z, fF];
  const slow = Math.min(1, (t - CUE.chat) / (CUE.zoomFast - CUE.chat));
  const fast = 1 - Math.pow(1 - Math.min(1, Math.max(0, (t - CUE.zoomFast) / (CUE.stopAt - CUE.zoomFast))), 3); // eases to a stop
  const p = t < CUE.zoomFast ? P0.map((v, i) => lerp(v, P1[i], slow)) : P1.map((v, i) => lerp(v, P2[i], fast));
  cam.position.set(p[0], p[1], p[2]); cam.lookAt(p[3], p[4], p[5]); cam.fov = p[6]; cam.updateProjectionMatrix();
}

window.__adFrame = (cam) => {
  const t = now(), B = CL().BACKDROP, D = B.z - BACK_Z;
  // after the CO2 the room, the rig, the smoke and the crowd sound all come up together on one quick, smooth curve
  // ...and at the end they all go back down together, leaving only the backdrop
  const f = ease((t - CUE.co2) / FADE) * (1 - ease((t - CUE.zoomFast) / (CUE.stopAt - CUE.zoomFast)));
  CL().setVeil(1 - f);
  CL().light.adDark = t < CUE.co2 || t >= CUE.stopAt;
  CL().light.adFade = f;
  CL().sfx.volume = 0.7 * f;
  CL().screen.show = -1; // no random logo flash on the LED screen during the advert
  if (t >= CUE.chat) { endPush(cam, t); return; }
  if (t >= CUE.djview) { djOrbit(cam, t); return; }
  const f0 = 2 * Math.atan((2 * B.r) * innerHeight / (2 * D * glowPx())) * 180 / Math.PI;
  const k = ease((t - CUE.co2) / (CUE.drop - CUE.co2));
  cam.position.set(lerp(0, 0.3, k), lerp(B.y, 2.4, k), lerp(BACK_Z, -4.8, k));
  cam.lookAt(0, lerp(B.y, 1.9, k), lerp(B.z, 0.5, k));
  cam.fov = lerp(f0, 54, k);
  cam.updateProjectionMatrix();
};
let lineOn = null;
function showLine(t) {
  const L = LINES.find((l) => t >= l.t0 && t < l.t1) || null;
  if (L === lineOn) return;
  lineOn = L;
  line.classList.remove('on');
  if (L) { line.innerHTML = L.html.split('<br>').map((s) => `<span>${s}</span>`).join('<br>'); line.classList.toggle('small', !!L.small); void line.offsetWidth; line.classList.add('on'); }
}

const say = (lines) => { CL().screen.ad = { dim: 1, lines: lines.map((l) => ({ glow: 0, px: 66, ...l })) }; };
const W = '#c9d3dc', BL = '#2fb8cc'; // the screen blooms, so the words are drawn below white
let fired = new Set();
function at(key, fn) { if (now() >= CUE[key] && !fired.has(key)) { fired.add(key); fn(); } }
function flash(ms) { playBtn.dataset.led = '1'; setTimeout(() => { playBtn.dataset.led = '0'; }, ms); }

// which part of the app is on screen; switching only when it changes, so scrubbing back and forth works
let view = 'club';
function setView(v) { if (v === view) return; view = v; CC().setMode(v); }
// scene 3 close-up: a box the height of the controller plus a little air, as wide as the screen's shape allows,
// sliding evenly from deck 1 to deck 2 (stage coordinates are the app's 1840 x 964 controller drawing)
function deckGlide(t) {
  const h = 1000, w = h * innerWidth / innerHeight, x0 = 260, x1 = 1920 - w - 180; // middle of deck 1 to middle of deck 2, slowly
  const k = Math.min(1, Math.max(0, (t - CUE.closeup) / (CUE.djview - CUE.closeup))); // constant speed
  CC().zoomBox([lerp(x0, x1, k), 290, w, h]);
}

// scene 3 hands on the mixer, timed to when each control is in frame during the glide; all on CH 2 so nothing is heard
const EQ = { id: 'm:eq22', t0: 21.6, t1: 22.5 };                      // CH2 LOW: cut, then back up a touch
const FXW = { t0: 22.6, pick: 22.8, t1: 23.1, on: 23.25 };            // Beat FX wheel: pick REVERB, then FX ON
const ECHO = FX_IDX(10), REVERB = FX_IDX(4);
function FX_IDX(n) { return [12, 10, 8, 6, 4, 2, 0, 1, 3, 5, 7, 9, 11, 13].indexOf(n); } // app.js FX_SEQ
let eqShown = false, wheel = 0;
function hands(t) {
  const c = CC(), eq = c.controls.get(EQ.id), sel = c.controls.get('m:fxsel'), on = c.controls.get('m:fxon');
  const u = (t - EQ.t0) / (EQ.t1 - EQ.t0);
  eq.set(u <= 0 ? 0.5 : u >= 1 ? 0.62 : u < 0.55 ? lerp(0.5, 0.12, ease(u / 0.55)) : lerp(0.12, 0.62, ease((u - 0.55) / 0.45)));
  const inEq = u > 0 && u < 1;
  if (inEq && !eqShown) { c.bubble.show(eq); eqShown = true; }
  if (!inEq && eqShown) { c.bubble.flash(eq); eqShown = false; }
  const r = sel.el.getBoundingClientRect(), p = { ax: r.left + r.width / 2, ay: r.top + r.height / 2 };
  const w = t < FXW.t0 ? 0 : t < FXW.t1 ? 1 : 2;
  if (w !== wheel) {
    if (w === 0) { c.optWheel.close(false); sel.set(ECHO); }
    if (w >= 1 && wheel === 0) c.optWheel.open(sel, p);
    if (w === 2) { if (!c.optWheel.ctrl) c.optWheel.open(sel, p); c.optWheel.pick = REVERB; c.optWheel.close(true); }
    wheel = w;
  }
  if (w === 1 && t >= FXW.pick) { // the finger slides round to REVERB
    const n = sel.steps, a = ((-150 + 300 * (REVERB + 0.5) / n) * Math.PI) / 180;
    c.optWheel.move({ ax: c.optWheel.cx + Math.sin(a) * 100, ay: c.optWheel.cy - Math.cos(a) * 100 });
  }
  const fxOn = t >= FXW.on;
  if (c.fx.on !== fxOn) { c.fx.on = fxOn; if (fxOn) { on.el.classList.add('dn'); setTimeout(() => on.el.classList.remove('dn'), 160); } }
}

// the app's own SETTINGS panel (lights, intensity, auto FX, crowd), popped up big over the slide
const lm = document.getElementById('lightmenu');
let lmOn = false;
function settingsPanel(on) { if (on === lmOn) return; lmOn = on; lm.hidden = !on; lm.classList.toggle('adshow', on); }

// scene 5: the app's live chat panel, big in the middle; comments arrive faster than anyone could read, then a song request
const CHAT = [['bassbaby', 'THIS DROP 🔥🔥'], ['lou.mix', 'who is this DJ?? 😍'], ['dj_kev', 'tune!!'], ['saffy', 'hiya from Manchester 👋'],
  ['nightowl', 'HOUSE PARTY VIBES'], ['jess', '🙌🙌🙌'], ['tunde', 'wheel it up!!'], ['ella.b', 'omg the lights'], ['ravekid', 'LETS GOOO'],
  ['kat', 'shout out to my girls 💕'], ['danny', 'been waiting all week for this'], ['priya', '🔥'], ['leo', 'this is unreal'],
  ['sam_k', '👏👏'], ['zoe', 'vibes are immaculate'], ['finn', 'REWIND'], ['amira', 'hallo from Berlin 🇩🇪'], ['josh', 'sending this to the group chat'],
  ['mia', '🎶🎶'], ['ollie', 'best night in'], ['nina', "DJ you're a legend"], ['marco', 'turn it uppp'], ['bex', 'cant stop dancing'], ['ash', '💯']];
const PRE = 8; // comments already in the chat when it fades in
const REQ = { at: PRE + 3, who: 'mo_beats', song: 'Girls Like Me (Extended Mix)' }; // the request lands among the comments
const cp = document.getElementById('chatpanel'), clog = document.getElementById('chatlog');
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7); // chat.js's name colours
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const flashEl = el('div', 'adbuyflash', ad); flashEl.textContent = '🎵 SONG REQUEST · £5';
let chatOn = false, chatN = 0, buyShown = false;
function liveChat(t) {
  const on = t >= CUE.chat && t < CUE.zoomFast + 0.25;
  if (on !== chatOn) { chatOn = on; cp.classList.toggle('adshow', on); cp.classList.remove('min'); clog.innerHTML = ''; chatN = 0; cp.querySelector('.cmename').textContent = 'Live from Club Cloud'; }
  const want = on ? Math.min(CHAT.length + 1, PRE + Math.floor((t - CUE.chat) / 0.3) + 1) : 0; // a few already there, then one every 0.3s
  if (want < chatN) { clog.innerHTML = ''; chatN = 0; }
  while (chatN < want) {
    const d = document.createElement('div');
    if (chatN === REQ.at) {
      d.className = 'cl req adin adbuy';
      d.innerHTML = `<span class="creq">🎵 Song request from <b style="color:hsl(${hue(REQ.who)} 85% 70%)">${REQ.who}</b>: ${esc(REQ.song)} · £5</span>`;
    } else {
      const [who, msg] = CHAT[chatN > REQ.at ? chatN - 1 : chatN];
      d.className = chatN < PRE ? 'cl' : 'cl adin';
      d.innerHTML = `<b style="color:hsl(${hue(who)} 85% 70%)">${esc(who)}</b> ${esc(msg)}`;
    }
    clog.append(d); chatN++; clog.scrollTop = clog.scrollHeight;
  }
  const buy = t >= CUE.request && t < CUE.request + 1.4;
  if (buy !== buyShown) { buyShown = buy; flashEl.classList.toggle('on', buy); }
}

// the end card on the LED screen: AGA BORYN / LIVE SET / COMING SOON, fading off once the music has stopped,
// then the CLUB CLOUD logo fading in where it sat in the opening
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function endCard(t) {
  if (t < CUE.endMsg) return;
  if (t < CUE.agaOut + 0.4) {
    const a = 1 - clamp01((t - CUE.agaOut) / 0.4);
    say([{ t: 'AGA BORYN', c: W, y: 196, px: 46, a }, { t: 'LIVE SET', c: BL, y: 276, px: 46, a }, { t: 'COMING SOON', c: W, y: 356, px: 46, a }]);
  } else {
    const a = clamp01((t - CUE.logoIn - 0.35) / 0.5);
    say([{ t: 'CLUB', c: W, y: 236, a }, { t: 'CLOUD', c: BL, y: 324, a }]);
  }
}

function tick() {
  const t = now();
  if (adBuf) CL().light.adBeat = (t - beatGrid.first) / beatGrid.B;
  ad.classList.toggle('reveal', t >= CUE.welcome);
  if (deck) {
    setView(t < CUE.drop ? 'club' : t < CUE.djview ? 'normal' : t < CUE.chat ? 'djview' : 'club');
    liveChat(t);
    settingsPanel(t >= CUE.settings && t < CUE.djview);
    if (view === 'normal' && t >= CUE.closeup) deckGlide(t);
    if (t >= CUE.drop && t < CUE.djview) hands(t);
    showLine(t);
  }
  at('beep1', () => flash(170));
  at('beep2', () => flash(170));
  // one word size throughout, all caps; WELCOME is the widest word so it sets the size
  at('welcome', () => { say([{ t: 'WELCOME', c: W, y: 280 }]); });
  at('to', () => say([{ t: 'TO', c: W, y: 280 }]));
  at('club', () => say([{ t: 'CLUB', c: W, y: 236 }])); // already where it sits once CLOUD joins it
  at('cloud', () => say([{ t: 'CLUB', c: W, y: 236 }, { t: 'CLOUD', c: BL, y: 324 }]));
  at('co2', () => CL().co2());
  at('logoOff', () => { CL().screen.ad = null; });
  endCard(t);
  if (running && t >= CUE.end) stop();
  requestAnimationFrame(tick);
}
