// The advert: a timed film over the app, driven by advert/track.m4a.
// Cue times are measured from the track; scene 1 only for now.
const CUE = {
  beep1: 0.22, beep2: 0.72,   // the two beeps the play button flashes on
  welcome: 2.57,              // she says "welcome" — the button becomes the LED screen
  to: 3.16,                   // "to"
  club: 3.69,                 // "club", on the first bass hit
  cloud: 4.05,                // "cloud"
  end: 5.4,
};

const el = (t, cls, parent) => { const n = document.createElement(t); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; };

const ad = el('div', null, document.body); ad.id = 'ad';
const stage = el('div', 'adstage', ad);
const playWrap = el('div', 'adplay', stage);
playWrap.innerHTML = '<div class="b big play" data-led="0"><div class="lamp"></div><span>▶/❚❚</span></div>';
const playBtn = playWrap.firstElementChild;
const ring = el('div', 'adring', stage);
ring.innerHTML = `<svg class="adcs" viewBox="-2.1 -2.1 4.2 4.2" aria-hidden="true"><defs><radialGradient id="adscr" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#0e2a40"/><stop offset=".7" stop-color="#061220"/><stop offset="1" stop-color="#03080f"/></radialGradient><filter id="adglw" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".09" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle r="1.73" fill="#0a0b0e"/><circle r="1.63" fill="url(#adscr)"/><g filter="url(#adglw)" fill="none" stroke-width=".26" stroke-linecap="butt"><path d="M-0.1947 -1.9403A1.95 1.95 0 0 0 -0.1947 1.9403" stroke="#F2FCFF"/><path d="M0.1947 -1.9403A1.95 1.95 0 0 1 0.1947 1.9403" stroke="#4CEBFF"/></g></svg>`;
const words = el('div', 'adwords', stage);

const fit = () => ad.style.setProperty('--s', (Math.min(innerHeight * 0.40, innerWidth * 0.68) / 94).toFixed(3));
addEventListener('resize', fit); fit();

const audio = new Audio('advert/track.m4a');
audio.preload = 'auto';

const gate = el('div', 'adgate', ad);
gate.innerHTML = '<button>PLAY ADVERT</button>';
gate.querySelector('button').onclick = () => { gate.remove(); audio.play(); run(); };

// Scene 1: the play button flashes on the beeps, becomes the LED screen ring, then the words land.
function setLed(on) { playBtn.dataset.led = on ? '1' : '0'; }
function flash(dur) { setLed(true); setTimeout(() => setLed(false), dur); }

let fired = new Set();
function at(key, fn) { if (audio.currentTime >= CUE[key] && !fired.has(key)) { fired.add(key); fn(); } }

function run() {
  const tick = () => {
    at('beep1', () => flash(170));
    at('beep2', () => flash(170));
    at('welcome', () => { stage.classList.add('toring'); words.innerHTML = '<b>welcome</b>'; });
    at('to', () => { words.innerHTML = '<b>welcome</b><b>to</b>'; });
    at('club', () => { words.innerHTML = '<b class="cc">club</b>'; });
    at('cloud', () => { words.innerHTML = '<b class="cc">club <i>cloud</i></b>'; });
    if (audio.currentTime < CUE.end + 2) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
