// A four-second shot: the whole crowd dancing together in front of the bar, under the back-wall logo.
// The camera starts tight on the group and drifts slowly away from the bar; everyone stays in frame throughout.
import * as THREE from 'three';

const DUR = 4;              // seconds, then it loops so it can be watched over and over
const BAR_Z = -11.4;        // the counter's front face; the neon logo is on the wall behind it at z -13.47

// six across the front, four behind in the gaps, centred on the room: every face has a clear line to the camera,
// and the gap in the middle of the back row looks through to the bar and the logo above it
const SLOTS = [
  [-2.13, -9.82], [-1.28, -9.76], [-0.43, -9.84], [0.43, -9.78], [1.28, -9.85], [2.13, -9.80],
  [-1.70, -10.88], [-0.85, -10.94], [0.85, -10.92], [1.70, -10.86],
];
const CENTRE_Z = -10.35, HALF_W = 2.80; // the group's middle, and half its width once arms are thrown out
const Z_LIMIT = -2.1;                   // the camera must never drift back as far as the DJ booth at z 0

const CC = () => window.__cc, CL = () => window.__club;
const wait = (ok) => new Promise((res) => { const k = () => (ok() ? res() : setTimeout(k, 100)); k(); });
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;

document.head.insertAdjacentHTML('beforeend', `<style>
  body.shot #tabs, body.shot #clubhud, body.shot #chatpanel, body.shot #lightbar, body.shot #clubload, body.shot #toast, body.shot #view, body.shot #djcv { display: none !important; }
  body.shot #club { border-radius: 0 !important; box-shadow: none !important; }
</style>`);
document.body.classList.add('shot');

let t0 = 0;

async function prepare() {
  await wait(() => CC() && CL() && CC().ctx);
  CC().setMode('club');
  await wait(() => CL().ready && CL().people.length >= SLOTS.length);
  dispatchEvent(new CustomEvent('cc-cam', { detail: 'crowd' })); // the DJ belongs in the room, not on the overlay
  CL().light.adFade = 0.22;   // the house rig stays as atmosphere overhead instead of flooding the shot
  CL().light.intensity = 0.5;
  addLights();
  placeCrowd();
  t0 = CL().clock.elapsedTime;
  // the music drives the dancing: the clips are locked to its beat
  const buf = await CC().ctx.decodeAudioData(await (await fetch('advert/vip.mp3')).arrayBuffer());
  const an = await CC().analyzeBuffer(buf);
  const deck = CC().decks[0];
  await wait(() => deck.loaded);
  deck.load({ id: 'shot', title: '', artist: '', dur: buf.duration, ...an }, buf, { pos: 24, cue: 24 });
  CC().unlock(); deck.play();
}
prepare().catch((e) => console.error('shot setup failed', e));

// sexy lighting: a warm wash off the bar behind them rims every shoulder, coloured spots come in from either side,
// and a soft key from the camera side keeps faces and bodies readable. The house rig keeps moving overhead.
function addLights() {
  const scene = CL().scene;
  const spot = (colour, power, from, to, angle) => {
    const l = new THREE.SpotLight(colour, power, 24, angle, 0.65, 1.1);
    l.position.set(...from); l.target.position.set(...to);
    scene.add(l, l.target);
  };
  // narrow and aimed at the people, so the room stays dark and they are the brightest thing in it
  spot(0xffc89a, 34, [0, 3.0, BAR_Z - 0.5], [0, 1.2, CENTRE_Z - 0.2], 0.42);           // warm halo from over the bar
  spot(0xff2f9a, 30, [-4.6, 2.9, CENTRE_Z - 1.8], [-0.9, 1.45, CENTRE_Z], 0.42);       // magenta edge, left
  spot(0x2fd8ff, 30, [4.6, 2.9, CENTRE_Z - 1.8], [0.9, 1.45, CENTRE_Z], 0.42);         // cyan edge, right
  spot(0xc8d8ff, 7, [0, 2.6, CENTRE_Z + 4.2], [0, 1.45, CENTRE_Z], 0.62);              // just enough key for faces
  const glow = new THREE.PointLight(0xffa860, 5, 6, 1.8);
  glow.position.set(0, 1.85, BAR_Z - 0.5); scene.add(glow);                             // the bar's own glow behind them
}

// everyone into the huddle, facing roughly towards the camera, and staying put
function placeCrowd() {
  CL().people.forEach((p, i) => {
    const [x, z] = SLOTS[i % SLOTS.length];
    p.home = { x, z };
    p.face = Math.atan2(-x, 3.5) + ((i % 3) - 1) * 0.16; // towards the camera, each turned a little differently
    p.yaw = p.yawTarget = 0; p.look = null; p.friends = [];
    p.nextThink = Infinity;                              // no wandering off or chatting during the shot
    p.busy = false;
    const dances = p.dances.length ? p.dances : ['idle'];
    if (dances.length) { p.dances = dances; p.dance = dances[i % dances.length]; }
    p.offset = (i * 0.37) % 2;                           // spread across the beat, so it is not one drilled move
  });
}

// hold them dancing: the club would otherwise drop them back to idle whenever the hype dips
function keepDancing() {
  const t = CL().clock.elapsedTime;
  for (const p of CL().people) {
    if (!p.dance) continue;
    p.hold = { name: p.dance, until: t + 10 };
    p.nextThink = Infinity;
  }
}

// the camera: far enough back that the whole group fits at the start, then drifting further from the bar.
// The distance comes from the window's shape each frame, so nobody leaves the frame on any screen.
window.__adFrame = (cam) => {
  if (!t0) return;
  const k = ease(((CL().clock.elapsedTime - t0) % DUR) / DUR);
  // the drift runs from d0 out to the furthest the room allows, and the lens is opened just wide enough that the
  // whole group fits at d0 — the tightest point — so nobody leaves the frame on any shape of screen
  const far = Z_LIMIT - CENTRE_Z, d0 = far / 1.18;
  const halfH = Math.atan(HALF_W / d0);
  cam.fov = Math.min(74, (2 * Math.atan(Math.tan(halfH) / (innerWidth / innerHeight)) * 180) / Math.PI);
  const d = lerp(d0, far, k);
  cam.position.set(0, lerp(1.98, 2.12, k), CENTRE_Z + d);  // high enough to see the back row's bodies, not just heads
  cam.lookAt(0, lerp(1.76, 1.88, k), CENTRE_Z - 0.5);      // framed on the group and the logo, not the empty floor
  cam.updateProjectionMatrix();
  keepDancing();
};
