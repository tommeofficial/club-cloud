// The website: the club's stage backdrop and LED screen on their own, big in the middle, looping through every look.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { screenMaterial } from './screen.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// ------------------------------------------------------------ the screen (same build as the club's backdrop)
const R = 1.95, TUBE = 0.13, GAP = 0.1, OUTER = R + TUBE;   // metres; OUTER is the backdrop's outer edge
const PALETTE = [0x41e7ff, 0x6285ff, 0x9b5cff, 0xff3da5, 0xffb03d, 0x3dff8a];
const BPM = 124, LOOK_BEATS = 16, FADE_S = 1.8;            // a new look every 16 beats, crossfading like the club

const canvas = document.getElementById('cv');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // keep the C's true to the logo colours
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050a);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

const grp = new THREE.Group(); scene.add(grp);
const white = new THREE.MeshBasicMaterial({ color: 0xdde8f0 }), blue = new THREE.MeshBasicMaterial({ color: 0x4cebff });
const arc = (mat, start) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 18, 120, Math.PI - 2 * GAP), mat); m.rotation.z = start; grp.add(m); };
arc(white, Math.PI / 2 + GAP);   // left C
arc(blue, -Math.PI / 2 + GAP);   // right C
const textCv = document.createElement('canvas'); textCv.width = textCv.height = 512; // nothing written on it: the sign-up sits there
const textTex = new THREE.CanvasTexture(textCv);
const spec = new THREE.DataTexture(new Uint8Array(64), 64, 1, THREE.RedFormat); spec.needsUpdate = true;
const mat = screenMaterial(THREE, textTex, spec), u = mat.uniforms;
const disc = new THREE.Mesh(new THREE.CircleGeometry(R - 0.32, 96), mat); disc.position.z = -0.05; grp.add(disc);
const rim = new THREE.Mesh(new THREE.RingGeometry(R - 0.32, R - 0.22, 64), new THREE.MeshBasicMaterial({ color: 0x0a0b0e })); rim.position.z = -0.04; grp.add(rim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.7); composer.addPass(bloom);
composer.addPass(new OutputPass());

// fit: the backdrop as big as the page allows, a little above centre so the links fit underneath
const root = document.documentElement;
function fit() {
  const w = innerWidth, h = innerHeight;
  const d = Math.min(w * 0.88, h * 0.6), cy = h * (w < h ? 0.4 : 0.41);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  camera.aspect = w / h;
  const half = (camera.fov * Math.PI) / 360, dist = (2 * OUTER * h) / (d * 2 * Math.tan(half));
  const lift = ((h / 2 - cy) / h) * 2 * dist * Math.tan(half); // world units to move the backdrop up by
  camera.position.set(0, -lift, dist); camera.lookAt(0, -lift, 0); camera.updateProjectionMatrix();
  root.style.setProperty('--cx', w / 2 + 'px'); root.style.setProperty('--cy', cy + 'px'); root.style.setProperty('--d', d + 'px');
  const tag = document.getElementById('tag'), top = cy + d / 2 + 20;
  root.style.setProperty('--tag', top + 'px');
  root.style.setProperty('--below', Math.min(h - 56, top + tag.offsetHeight + 12) + 'px');
}
addEventListener('resize', fit); fit();

// the loop: a steady beat drives the kick, colours step every 8 beats, the six looks take turns in order
const clock = new THREE.Clock(), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
let look = -1, fadeFrom = 0;
function frame() {
  const t = clock.getElapsedTime(), beat = (t * BPM) / 60, pulse = still ? 0.3 : Math.pow(1 - (beat % 1), 3);
  const n = Math.floor(beat / LOOK_BEATS);
  if (n !== look) { look = n; u.uModeA.value = u.uModeB.value; u.uModeB.value = n % 6; fadeFrom = t; }
  u.uMix.value = Math.min(1, (t - fadeFrom) / FADE_S);
  u.uTime.value = t; u.uBeat.value = beat; u.uPulse.value = pulse;
  u.uEnergy.value = 0.45 + 0.35 * Math.sin(t * 0.4) * Math.sin(t * 0.13);
  const step = Math.floor(beat / 8);
  u.uC1.value.setHex(PALETTE[step % 6]); u.uC2.value.setHex(PALETTE[(step + 1) % 6]); u.uC3.value.setHex(PALETTE[(step + 2) % 6]);
  // a made-up spectrum for the ring look: low end jumps on the kick, the top shimmers
  const d = spec.image.data;
  for (let i = 0; i < 64; i++) { const k = i / 64; d[i] = Math.max(0, Math.min(255, 255 * ((0.75 - k * 0.5) * (0.45 + 0.55 * pulse * (1 - k)) + 0.18 * Math.sin(t * 3 + i * 0.7) * Math.sin(t * 1.7 + i * 0.31)))); }
  spec.needsUpdate = true;
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------ sign up: the button becomes an email bar
const su = document.getElementById('signup'), openBtn = su.querySelector('.su-open'), form = su.querySelector('.su-form');
const email = form.querySelector('input'), done = form.querySelector('button'), msg = su.querySelector('.su-msg'), err = su.querySelector('.su-err');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
openBtn.onclick = () => { openBtn.hidden = true; form.hidden = false; email.focus(); };
form.onsubmit = async (e) => {
  e.preventDefault();
  const v = email.value.trim().toLowerCase();
  if (!EMAIL.test(v) || v.length > 254) { err.textContent = 'That email doesn’t look right.'; err.hidden = false; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
  err.hidden = true; done.disabled = true; done.textContent = '…';
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/signups`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email: v, source: 'website' }),
    });
    if (!r.ok && r.status !== 409) throw new Error('status ' + r.status); // 409: already signed up, which is fine
    form.hidden = true; msg.innerHTML = 'YOU’RE ON THE LIST<small>We’ll email you when Club Cloud opens.</small>'; msg.hidden = false;
  } catch (_) {
    err.textContent = 'Couldn’t sign you up just now. Please try again.'; err.hidden = false;
    done.disabled = false; done.textContent = 'SIGN UP';
  }
};

// ------------------------------------------------------------ invite early: the password lets people into the app
const gate = document.getElementById('gate'), gForm = gate.querySelector('form'), pw = gForm.querySelector('input');
const gBtn = gForm.querySelector('button'), gErr = gate.querySelector('.err'), card = gate.querySelector('.card');
const openGate = () => { gate.hidden = false; gErr.textContent = ''; pw.value = ''; pw.focus(); };
const closeGate = () => { gate.hidden = true; document.querySelector('#below .invite').focus(); };
document.querySelector('#below .invite').onclick = openGate;
gate.querySelector('.x').onclick = closeGate;
gate.onclick = (e) => { if (e.target === gate) closeGate(); };
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !gate.hidden) closeGate(); });
gForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!pw.value) return;
  gBtn.disabled = true; gErr.textContent = '';
  try {
    const r = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw.value }) });
    if (r.ok) { location.href = '/app'; return; }
    gErr.textContent = r.status === 401 ? 'Wrong password.' : 'Something went wrong. Please try again.';
  } catch (_) { gErr.textContent = 'Something went wrong. Please try again.'; }
  gBtn.disabled = false;
  card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  pw.select();
};
if (new URLSearchParams(location.search).has('invite')) openGate(); // sent here from /app without access
