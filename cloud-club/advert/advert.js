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
  drop: 16.72,                // the drop: scene 3 cuts to the decks here
};
// scene 2: lines over the push, two to a card so they read on a phone; the last sits in the breakdown
const LINES = [
  { t0: 7.0, t1: 9.5, html: "WORLD'S <b>FIRST</b><br>VIRTUAL DJ CLUB" },
  { t0: 9.8, t1: 12.0, html: 'HAVING A<br><b>HOUSE PARTY?</b>' },
  { t0: 12.3, t1: 14.5, html: 'JUMP IN AS ONE<br>OF THE <b>CROWD</b>' },
  { t0: 14.8, t1: 16.72, html: 'WANT TO BE<br>THE <b>DJ?</b>' },
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

let deck;
async function prepare() {
  await wait(() => CC() && CL() && CC().ctx);
  CC().setMode('club');                     // the club starts loading behind the black
  CL().light.adDark = true;                 // rig held dark until the reveal
  CL().light.intensity = 0.85;              // a busy show for the push
  CL().sfx.volume = 0;                      // no crowd murmur over the black opening
  const buf = await CC().ctx.decodeAudioData(await (await fetch('advert/track.m4a')).arrayBuffer());
  const an = await CC().analyzeBuffer(buf);
  deck = CC().decks[0];
  await wait(() => deck.loaded); // the app puts its demo on deck 1 first; replace it
  deck.load({ id: 'advert', title: '', artist: '', dur: buf.duration, ...an }, buf, { pos: 0, cue: 0 });
  await wait(() => CL().ready);
  CL().setVeil(1);
  gateBtn.disabled = false; gateBtn.textContent = 'PLAY ADVERT';
  requestAnimationFrame(tick);
}
prepare();

gateBtn.onclick = () => { CC().unlock(); gate.remove(); deck.play(); };
// scrub for checking frames: __ad.go(2.8) jumps there paused and replays every cue up to it
window.__ad = { go(t) { gate.remove(); deck.pause(); fired.clear(); ad.classList.remove('reveal'); CL().screen.ad = null; deck.seek(t); } };

// camera: starts on the back wall square on to the backdrop, lens set so the backdrop fills the glow's circle;
// from the CO2 it glides over the crowd's heads toward the booth, easing in and out, and tilts down onto the DJ
const BACK_Z = -13.1, FADE = 1.4;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;
window.__adFrame = (cam) => {
  const t = deck ? deck.vpos : 0, B = CL().BACKDROP, D = B.z - BACK_Z;
  const f0 = 2 * Math.atan((2 * B.r) * innerHeight / (2 * D * glowPx())) * 180 / Math.PI;
  const k = ease((t - CUE.co2) / (CUE.drop - CUE.co2));
  cam.position.set(lerp(0, 0.3, k), lerp(B.y, 2.4, k), lerp(BACK_Z, -4.8, k));
  cam.lookAt(0, lerp(B.y, 1.9, k), lerp(B.z, 0.5, k));
  cam.fov = lerp(f0, 54, k);
  cam.updateProjectionMatrix();
  // after the CO2 the room, the rig, the smoke and the crowd sound all come up together on one quick, smooth curve
  const f = ease((t - CUE.co2) / FADE);
  CL().setVeil(1 - f);
  CL().light.adDark = t < CUE.co2;
  CL().light.adFade = f;
  CL().sfx.volume = 0.7 * f;
  CL().screen.show = -1; // no random logo flash on the LED screen during the advert
  showLine(t);
};
let lineOn = null;
function showLine(t) {
  const L = LINES.find((l) => t >= l.t0 && t < l.t1) || null;
  if (L === lineOn) return;
  lineOn = L;
  line.classList.remove('on');
  if (L) { line.innerHTML = L.html; void line.offsetWidth; line.classList.add('on'); }
}

const say = (lines) => { CL().screen.ad = { dim: 1, lines: lines.map((l) => ({ glow: 0, px: 66, ...l })) }; };
const W = '#c9d3dc', BL = '#2fb8cc'; // the screen blooms, so the words are drawn below white
let fired = new Set();
function at(key, fn) { if (deck.vpos >= CUE[key] && !fired.has(key)) { fired.add(key); fn(); } }
function flash(ms) { playBtn.dataset.led = '1'; setTimeout(() => { playBtn.dataset.led = '0'; }, ms); }

function tick() {
  at('beep1', () => flash(170));
  at('beep2', () => flash(170));
  // one word size throughout, all caps; WELCOME is the widest word so it sets the size
  at('welcome', () => { ad.classList.add('reveal'); say([{ t: 'WELCOME', c: W, y: 280 }]); });
  at('to', () => say([{ t: 'TO', c: W, y: 280 }]));
  at('club', () => say([{ t: 'CLUB', c: W, y: 236 }])); // already where it sits once CLOUD joins it
  at('cloud', () => say([{ t: 'CLUB', c: W, y: 236 }, { t: 'CLOUD', c: BL, y: 324 }]));
  at('co2', () => CL().co2());
  at('logoOff', () => { CL().screen.ad = null; });
  requestAnimationFrame(tick);
}
