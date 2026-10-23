// The advert: the real app, filmed full-bleed in portrait, with the advert track playing on deck 1.
// Cue times are measured from the track. Scene 1: the play button, then the real stage backdrop.
const CUE = {
  beep1: 0.22, beep2: 0.72,   // the play button flashes on the two beeps
  welcome: 2.57,              // "welcome": the black lifts off the real backdrop, sized to the button's glow
  to: 3.16,                   // "to"
  club: 3.69,                 // "club", on the first bass hit
  cloud: 4.05,                // "cloud"
};

const el = (t, cls, parent) => { const n = document.createElement(t); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; };
document.body.classList.add('advert');

const ad = el('div', null, document.body); ad.id = 'ad';
const stage = el('div', 'adstage', ad);
const playWrap = el('div', 'adplay', stage);
playWrap.innerHTML = '<div class="b big play" data-led="0"><div class="lamp"></div><span>▶/❚❚</span></div>';
const playBtn = playWrap.firstElementChild;

// the green glow's diameter on screen; the backdrop is framed to the same circle
const glowPx = () => Math.min(innerHeight * 0.40, innerWidth * 0.68);
const fit = () => ad.style.setProperty('--s', (glowPx() / 94).toFixed(3));
addEventListener('resize', fit); fit();

const gate = el('div', 'adgate', ad);
gate.innerHTML = '<button disabled>LOADING…</button>';
const gateBtn = gate.querySelector('button');

const CC = () => window.__cc, CL = () => window.__club;
const wait = (ok) => new Promise((res) => { const k = () => (ok() ? res() : setTimeout(k, 100)); k(); });

let deck;
async function prepare() {
  await wait(() => CC() && CL() && CC().ctx);
  CC().setMode('club');                     // the club starts loading behind the black
  CL().light.adDark = true;                 // rig held dark until the reveal
  const buf = await CC().ctx.decodeAudioData(await (await fetch('advert/track.m4a')).arrayBuffer());
  const an = await CC().analyzeBuffer(buf);
  deck = CC().decks[0];
  await wait(() => deck.loaded); // the app puts its demo on deck 1 first; replace it
  deck.load({ id: 'advert', title: 'Club Cloud', artist: '', dur: buf.duration, ...an }, buf, { pos: 0, cue: 0 });
  await wait(() => CL().ready);
  CL().setVeil(1);
  gateBtn.disabled = false; gateBtn.textContent = 'PLAY ADVERT';
  requestAnimationFrame(tick);
}
prepare();

gateBtn.onclick = () => { CC().unlock(); gate.remove(); deck.play(); };
// scrub for checking frames: __ad.go(2.8) jumps there paused and replays every cue up to it
window.__ad = { go(t) { gate.remove(); deck.pause(); fired.clear(); ad.classList.remove('reveal'); CL().screen.ad = null; deck.seek(t); } };

// camera: on the back wall, square on to the backdrop, with the lens set so the backdrop fills the glow's circle
const BACK_Z = -13.1;
window.__adFrame = (cam) => {
  const B = CL().BACKDROP, D = B.z - BACK_Z, H = innerHeight;
  cam.position.set(0, B.y, BACK_Z);
  cam.lookAt(0, B.y, B.z);
  cam.fov = 2 * Math.atan((2 * B.r) * H / (2 * D * glowPx())) * 180 / Math.PI;
  cam.updateProjectionMatrix();
};

const say = (lines) => { CL().screen.ad = { dim: 1, lines: lines.map((l) => ({ glow: 0, ...l })) }; };
const W = '#c9d3dc', BL = '#2fb8cc'; // the screen blooms, so the words are drawn below white
let fired = new Set();
function at(key, fn) { if (deck.vpos >= CUE[key] && !fired.has(key)) { fired.add(key); fn(); } }
function flash(ms) { playBtn.dataset.led = '1'; setTimeout(() => { playBtn.dataset.led = '0'; }, ms); }

function tick() {
  at('beep1', () => flash(170));
  at('beep2', () => flash(170));
  at('welcome', () => { ad.classList.add('reveal'); say([{ t: 'welcome', c: W, px: 104, y: 290 }]); });
  at('to', () => say([{ t: 'welcome', c: W, px: 104, y: 250 }, { t: 'to', c: W, px: 104, y: 352 }]));
  at('club', () => say([{ t: 'club', c: W, px: 150, y: 300 }]));
  at('cloud', () => say([{ t: 'club', c: W, px: 150, y: 262 }, { t: 'C L O U D', c: BL, px: 62, y: 342 }]));
  requestAnimationFrame(tick);
}
