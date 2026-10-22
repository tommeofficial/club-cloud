// Cloud Club: the club seen from the DJ booth, with a crowd that reacts to the music and the mixing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const el = document.getElementById('club');
const canvas = document.getElementById('clubcv');
const hudBar = document.querySelector('#clubhud .bar i');
const hudMood = document.querySelector('#clubhud .mood');
const loadMsg = document.getElementById('clubload');
const splash = document.getElementById('splash');

const MODELS = ['models/crowd_ava.glb', 'models/crowd_leo.glb', 'models/crowd_kai.glb'];
// where the crowd stands (x, z) — the DJ looks down -Z from the booth at z = 0
const SPOTS = [[-1.25, -3.1], [0.15, -2.7], [1.45, -3.35]];
const CAMELOT = { Abm: '1A', Ebm: '2A', Bbm: '3A', Fm: '4A', Cm: '5A', Gm: '6A', Dm: '7A', Am: '8A', Em: '9A', Bm: '10A', 'F#m': '11A', Dbm: '12A',
  B: '1B', 'F#': '2B', Db: '3B', Ab: '4B', Eb: '5B', Bb: '6B', F: '7B', C: '8B', G: '9B', D: '10B', A: '11B', E: '12B' };

let renderer, scene, camera, clock, started = false, running = false, mode = 'off';
const people = [];
const flying = [];
const texts = [];
let beams = [], washes = [], ledMat, signMat, booth;
// light show state, driven by the controls under the club view
const SFX_LENGTH = { laser: 4, flame: 2, co2: 3 };
const light = { mode: 'colour', hue: 0.52, speed: 0.4, intensity: 0.75, autoHue: true, sfx: {}, dropEnergy: 0, prevBass: 0 };

const cc = () => window.__cc;
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ crowd brain
const brain = { hype: 45, clash: 0, dead: 0, blend: 0, keyBad: 0, clip: 0, bassFast: 0, bassSlow: 0, lowSince: 0, lastDrop: -99, lastBra: -99, lastDrink: -99, lastFall: -99, lastMixCheer: -99, lastBoo: -99, wrecking: false, mood: 'Waiting for music', specBuf: null, timeBuf: null };

function keyOk(a, b) {
  const x = CAMELOT[a], y = CAMELOT[b];
  if (!x || !y) return true;
  const nx = parseInt(x), ny = parseInt(y), lx = x.slice(-1), ly = y.slice(-1);
  if (x === y) return true;
  if (nx === ny) return true; // relative major/minor
  return lx === ly && (Math.abs(nx - ny) === 1 || Math.abs(nx - ny) === 11);
}

// ------------------------------------------------------------------ external input
// Lets the crowd react to a microphone or a line-in (for example a USB audio interface
// connected to real decks). Only loudness, dead air and clipping are measured here.
// Beat sync and mix quality need the app's own decks, so the crowd doesn't judge those.
let inputMode = false;
const ext = { ctx: null, analyser: null, stream: null, bufT: null, specBuf: null };

async function useInput(deviceId) {
  stopInput();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.55;
  ctx.createMediaStreamSource(stream).connect(analyser);
  Object.assign(ext, { ctx, analyser, stream, bufT: new Float32Array(analyser.fftSize), specBuf: new Float32Array(analyser.frequencyBinCount) });
  inputMode = true;
}

function stopInput() {
  if (ext.stream) ext.stream.getTracks().forEach((t) => t.stop());
  if (ext.ctx) ext.ctx.close();
  Object.assign(ext, { ctx: null, analyser: null, stream: null });
  inputMode = false;
}

function listenInput() {
  ext.analyser.getFloatFrequencyData(ext.specBuf);
  const binHz = ext.ctx.sampleRate / ext.analyser.fftSize;
  let s = 0, n = 0;
  for (let i = Math.max(1, Math.floor(40 / binHz)); i <= Math.ceil(150 / binHz); i++) { s += ext.specBuf[i]; n++; }
  const db = n ? s / n : -100;
  ext.analyser.getFloatTimeDomainData(ext.bufT);
  let pk = 0; for (const v of ext.bufT) { const a = Math.abs(v); if (a > pk) pk = a; }
  return { bass: THREE.MathUtils.clamp((db + 62) / 42, 0, 1), peak: pk };
}

// the device picker: list the inputs, then start the one picked (or back to the app's own mix)
async function openInputPicker() {
  const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
  tmp.getTracks().forEach((t) => t.stop()); // asks for permission so device names are visible
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  inputSel.innerHTML = '<option value="">Club mix (app decks)</option>';
  for (const d of inputs) inputSel.append(new Option(d.label || 'Audio input', d.deviceId));
  inputSel.hidden = false;
}

const inputSel = document.getElementById('inputSel');
document.getElementById('inputBtn')?.addEventListener('click', () => openInputPicker().catch((e) => console.warn('no input access', e)));
if (inputSel) {
  inputSel.addEventListener('change', async () => {
    if (!inputSel.value) { stopInput(); return; }
    try { await useInput(inputSel.value); } catch (e) { console.warn('input not started', e); inputSel.value = ''; stopInput(); }
  });
}

function listen() {
  if (inputMode) return listenInput();
  const m = cc().master;
  if (!m || !m.spec) return { bass: 0, peak: 0 };
  if (!brain.specBuf) { brain.specBuf = new Float32Array(m.spec.frequencyBinCount); brain.timeBuf = new Float32Array(m.spec.fftSize); }
  m.spec.getFloatFrequencyData(brain.specBuf);
  const binHz = cc().ctx.sampleRate / m.spec.fftSize;
  let s = 0, n = 0;
  for (let i = Math.max(1, Math.floor(40 / binHz)); i <= Math.ceil(150 / binHz); i++) { s += brain.specBuf[i]; n++; }
  const db = n ? s / n : -100;
  m.spec.getFloatTimeDomainData(brain.timeBuf);
  let pk = 0; for (let i = 0; i < brain.timeBuf.length; i += 2) { const v = Math.abs(brain.timeBuf[i]); if (v > pk) pk = v; }
  return { bass: THREE.MathUtils.clamp((db + 62) / 42, 0, 1), peak: pk };
}

function think(dt, t) {
  const c = cc(); if (!c) return;
  const [a, b] = c.decks;
  const aud = inputMode ? [0, 0] : c.decks.map((d, i) => (d.loaded && d.playing ? c.chanGain(i) : 0));
  const { bass, peak } = listen();
  brain.bassFast += (bass - brain.bassFast) * Math.min(1, dt * 12);
  brain.bassSlow += (bass - brain.bassSlow) * Math.min(1, dt * 0.35);
  // dead air
  if (peak < 0.015) brain.dead += dt; else brain.dead = Math.max(0, brain.dead - dt * 3);
  // the mix: both decks audible at once
  const both = !inputMode && aud[0] > 0.2 && aud[1] > 0.2;
  let wreck = false, inSync = false;
  if (both) {
    let r = a.effBpm / b.effBpm; while (r > 1.42) r /= 2; while (r < 0.7) r *= 2;
    const bpmErr = Math.abs(r - 1), ph = Math.abs(b.phaseDiff(a));
    wreck = bpmErr > 0.012 || ph > 0.1;
    inSync = bpmErr < 0.004 && ph < 0.045;
    if (wreck) brain.clash += dt * (bpmErr > 0.03 || ph > 0.25 ? 1.6 : 1); else brain.clash = Math.max(0, brain.clash - dt * 1.5);
    if (inSync) brain.blend += dt; else brain.blend = Math.max(0, brain.blend - dt * 2.5);
    if (!keyOk(a.t.key, b.t.key)) brain.keyBad += dt; else brain.keyBad = Math.max(0, brain.keyBad - dt);
  } else { brain.clash = Math.max(0, brain.clash - dt * 2); brain.blend = Math.max(0, brain.blend - dt * 1.5); brain.keyBad = Math.max(0, brain.keyBad - dt); }
  if (peak > 0.97) brain.clip += dt; else brain.clip = Math.max(0, brain.clip - dt * 2);
  // external input counts as playing when it is loud enough to hear over the room
  const playing = inputMode ? peak > 0.02 : aud[0] > 0.05 || aud[1] > 0.05;
  // hype drifts toward the energy of the music, pushed by good blends and dragged by mistakes
  const target = playing ? 30 + 62 * brain.bassSlow : 15;
  let d = (target - brain.hype) * 0.18;
  if (brain.blend > 4) d += 2.5;
  d -= Math.min(brain.clash, 6) * 2.2;
  if (brain.dead > 1.5) d -= 9;
  if (brain.keyBad > 6) d -= 1.5;
  if (brain.clip > 1) d -= 1.5;
  brain.hype = THREE.MathUtils.clamp(brain.hype + d * dt, 0, 100);

  // big drop: bass slams back after a quiet stretch
  if (brain.bassFast < 0.28) brain.lowSince += dt; else if (brain.bassFast > 0.55) {
    if (brain.lowSince > 3.5 && t - brain.lastDrop > 8 && playing) { brain.lastDrop = t; brain.hype = Math.min(100, brain.hype + 22); everyone('cheer', 0.35, ['WOOO!', 'YESSS!', 'DROP!']); }
    brain.lowSince = 0;
  }
  // a clean blend gets noticed straight away; a sustained one gets a bigger reaction
  if (brain.blend > 3 && t - brain.lastMixCheer > 12) { brain.lastMixCheer = t; someone('point', ['TUNE!', 'SMOOTH!']); }
  if (brain.blend > 8 && t - brain.lastMixCheer > 12) { brain.lastMixCheer = t; someone('cheer', ['YES DJ!']); }
  // the moment a mix goes wrong, the nearest people boo, without waiting for the clash to build
  const wreckingNow = brain.clash > 0.6;
  if (wreckingNow && !brain.wrecking && t - brain.lastBoo > 2) {
    brain.lastBoo = t;
    someone('boo', ['BOOO!', 'SYNC IT!']);
    someone('boo', ['WHAT IS THAT?']);
  }
  brain.wrecking = wreckingNow;
  // perfect, in-key blend at high hype: very rarely a bra hits the booth
  if (brain.blend > 16 && keyOk(a.t && a.t.key, b.t && b.t.key) && brain.hype > 70 && t - brain.lastBra > 45 && Math.random() < dt * 0.15) { brain.lastBra = t; throwAt('bra'); }
  // train-wrecks, clashing keys, silence
  if (brain.clash > 0.6) for (const p of people) if (Math.random() < dt * 0.9) react(p, 'boo', ['BOOO!', 'SYNC IT!', 'BOOO']);
  if (brain.keyBad > 8) for (const p of people) if (Math.random() < dt * 0.05) react(p, 'boo', ['OFF KEY!']);
  if (brain.dead > 3) for (const p of people) if (Math.random() < dt * 0.4) react(p, 'boo', ['HELLO??', 'BOOO!', 'MUSIC!']);
  if ((brain.clash > 5 || brain.dead > 5) && t - brain.lastDrink > 9 && Math.random() < dt * 0.35) { brain.lastDrink = t; throwAt('drink'); }
  if ((brain.clash > 7 || brain.dead > 8) && t - brain.lastFall > 20 && Math.random() < dt * 0.08) { brain.lastFall = t; const p = pick(people.filter((q) => !q.busy)); if (p) react(p, 'fall', ['…'], true); }
  if (brain.clip > 2) for (const p of people) if (Math.random() < dt * 0.06) say(p, 'TOO LOUD!');

  brain.mood = !playing ? (brain.dead > 3 ? 'Dead air! The crowd is turning' : 'Waiting for music')
    : brain.clash > 0.6 ? 'Train-wreck! Fix the sync'
    : brain.hype > 80 ? 'Going wild' : brain.hype > 62 ? 'Loving it' : brain.hype > 40 ? 'Dancing' : brain.hype > 22 ? 'Restless' : 'Bored';
}

// ------------------------------------------------------------------ people
function pick(a) { return a.length ? a[Math.floor(Math.random() * a.length)] : null; }
function someone(clip, lines) { const p = pick(people.filter((q) => !q.busy)); if (p) react(p, clip, lines); }
function everyone(clip, chance, lines) { for (const p of people) setTimeout(() => react(p, clip, Math.random() < chance + 0.5 ? lines : null), rnd(0, 320)); }

function react(p, clip, lines, force) {
  if (!p || (p.busy && !force)) return;
  const act = p.actions[clip]; if (!act) return;
  p.busy = true;
  act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.timeScale = 1;
  act.fadeIn(0.15).play();
  if (p.loop) p.loop.fadeOut(0.15);
  const dur = act.getClip().duration * 1000 + (clip === 'fall' ? 3200 : 0);
  if (lines) say(p, pick(lines));
  if (clip === 'throw') setTimeout(() => launch(p, p.throwing || 'drink'), 380);
  clearTimeout(p.timer);
  p.timer = setTimeout(() => { act.fadeOut(0.35); p.busy = false; p.loopName = null; }, dur);
}

function throwAt(kind) {
  const p = pick(people.filter((q) => !q.busy)); if (!p) return;
  p.throwing = kind;
  react(p, 'throw', kind === 'bra' ? ['FOR YOU DJ!', '😍'] : ['TERRIBLE!', 'BOOO!', 'GET OFF!']);
}

function launch(p, kind) {
  const hand = p.hand ? p.hand.getWorldPosition(new THREE.Vector3()) : p.root.position.clone().add(new THREE.Vector3(0, 1.7, 0));
  const target = kind === 'drink' ? new THREE.Vector3(rnd(-0.25, 0.25), 1.55, -0.25) : new THREE.Vector3(rnd(-0.4, 0.4), 1.0, -0.45);
  const T = kind === 'drink' ? 0.75 : 0.95;
  const g = -9.8;
  const v = new THREE.Vector3((target.x - hand.x) / T, (target.y - hand.y - 0.5 * g * T * T) / T, (target.z - hand.z) / T);
  const mesh = kind === 'drink' ? makeCup() : makeBra();
  mesh.position.copy(hand);
  scene.add(mesh);
  flying.push({ mesh, v, kind, t: 0, T, spin: new THREE.Vector3(rnd(-8, 8), rnd(-6, 6), rnd(-8, 8)), done: false });
}

function makeCup() {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.12, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xff2a3a, roughness: 0.5, side: THREE.DoubleSide }));
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.042, 14), new THREE.MeshStandardMaterial({ color: 0xffb53c, emissive: 0x6a3a00, roughness: 0.2 }));
  liquid.rotation.x = -Math.PI / 2; liquid.position.y = 0.04;
  g.add(cup, liquid);
  return g;
}
function makeBra() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.45, side: THREE.DoubleSide });
  for (const x of [-0.07, 0.07]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); c.position.x = x; c.rotation.x = Math.PI / 2; g.add(c); }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.007, 6, 30, Math.PI), m); strap.rotation.z = Math.PI; strap.position.y = 0.02; g.add(strap);
  return g;
}

function updateFlying(dt) {
  for (const f of flying) {
    if (f.done) { f.life -= dt; if (f.life <= 0) { scene.remove(f.mesh); f.dead = true; } continue; }
    f.t += dt;
    f.v.y += -9.8 * dt;
    f.mesh.position.addScaledVector(f.v, dt);
    f.mesh.rotation.x += f.spin.x * dt; f.mesh.rotation.y += f.spin.y * dt; f.mesh.rotation.z += f.spin.z * dt;
    if (f.t >= f.T) {
      f.done = true;
      if (f.kind === 'drink') { splashHit(); scene.remove(f.mesh); f.dead = true; }
      else { f.mesh.position.set(f.mesh.position.x, 1.0, -0.42); f.mesh.rotation.set(-Math.PI / 2.4, rnd(-0.6, 0.6), 0); f.life = 9; toast('A bra landed on the booth. Perfect mix!'); }
    }
  }
  for (let i = flying.length - 1; i >= 0; i--) if (flying[i].dead) flying.splice(i, 1);
}

function splashHit() {
  splash.style.setProperty('--sx', rnd(35, 65) + '%'); splash.style.setProperty('--sy', rnd(30, 55) + '%');
  splash.innerHTML = Array.from({ length: 26 }, () => { const s = rnd(4, 18); return `<i style="left:${rnd(15, 85)}%;top:${rnd(10, 80)}%;width:${s}px;height:${s * rnd(1, 1.8)}px"></i>`; }).join('');
  splash.classList.add('hit');
  requestAnimationFrame(() => requestAnimationFrame(() => splash.classList.remove('hit')));
  toast('Drink to the face. The crowd hates this mix.');
}
function toast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600); }

// floating speech text above heads
function say(p, line) {
  if (!line) return;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const g = cv.getContext('2d');
  g.font = "800 46px 'Barlow Semi Condensed', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(line, 128, 48);
  const bad = /BOO|SYNC|TERRIBLE|GET OFF|HELLO|MUSIC|OFF KEY|LOUD/.test(line);
  g.fillStyle = bad ? '#ff5a5a' : '#ffe14a'; g.fillText(line, 128, 48);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.9, 0.34, 1);
  sp.position.copy(p.root.position).add(new THREE.Vector3(rnd(-0.1, 0.1), 2.05, 0));
  scene.add(sp);
  texts.push({ sp, life: 1.6 });
}
function updateTexts(dt) {
  for (const x of texts) { x.life -= dt; x.sp.position.y += dt * 0.35; x.sp.material.opacity = Math.min(1, x.life / 0.5); if (x.life <= 0) { scene.remove(x.sp); x.sp.material.map.dispose(); x.sp.material.dispose(); } }
  for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);
}

// keep each person on the right loop, locked to the master deck's beat
function updatePeople(dt) {
  const c = cc(); if (!c) return;
  const M = c.decks.find((d) => d.master && d.loaded && d.playing) || c.decks.find((d) => d.loaded && d.playing && c.chanGain(d.i) > 0.1);
  const beats = M ? (M.vpos - M.first) / M.B : null;
  for (const p of people) {
    let want = 'idle';
    if (M && brain.dead < 1) want = brain.hype + p.bias > 66 ? 'hype' : brain.hype + p.bias > 30 ? 'dance' : 'idle';
    if (!p.busy && want !== p.loopName) {
      const next = p.actions[want];
      next.reset(); next.setLoop(THREE.LoopRepeat, Infinity); next.enabled = true; next.setEffectiveWeight(1);
      next.fadeIn(0.35).play();
      if (p.loop && p.loop !== next) p.loop.fadeOut(0.35);
      p.loop = next; p.loopName = want;
    }
    if (p.loop && (p.loopName === 'dance' || p.loopName === 'hype') && beats != null) {
      // clips are 2 beats long; drive their time from the beat so everyone moves on the beat
      const dur = p.loop.getClip().duration;
      const ph = (((beats + p.offset) % 2) + 2) % 2 / 2;
      p.loop.time = ph * dur;
      p.loop.timeScale = 0;
    } else if (p.loop) p.loop.timeScale = 1;
    p.mixer.update(dt);
  }
}

// ------------------------------------------------------------------ scene
function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060b);
  scene.fog = new THREE.FogExp2(0x070a14, 0.075);
  camera = new THREE.PerspectiveCamera(58, 1, 0.05, 80);
  camera.position.set(0, 1.78, 0.35);
  camera.lookAt(0, 1.15, -4);
  scene.add(new THREE.HemisphereLight(0x5a6aa8, 0x0a0a12, 0.55));
  const key = new THREE.DirectionalLight(0xbfd6ff, 0.9); key.position.set(1, 4, 2); scene.add(key);
  // floor & room
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x0b0d14, roughness: 0.35, metalness: 0.3 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ color: 0x0a0c16, roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), wallM); back.position.set(0, 5, -11); scene.add(back);
  for (const x of [-7, 7]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), wallM); w.position.set(x, 5, -2); w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(w); }
  // neon Cloud Club sign on the back wall
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  g.shadowColor = '#41e7ff'; g.shadowBlur = 30; g.fillStyle = '#e9fbff';
  g.font = "700 150px 'Avenir Next','Barlow Semi Condensed',sans-serif"; g.textAlign = 'center'; g.fillText('cloud', 560, 150);
  g.fillStyle = '#41e7ff'; g.font = "700 64px 'Avenir Next','Barlow Semi Condensed',sans-serif"; g.fillText('C L U B', 560, 226);
  g.lineWidth = 22; g.strokeStyle = '#e9fbff'; g.beginPath(); g.arc(170, 128, 70, Math.PI * 0.6, Math.PI * 1.4); g.stroke();
  g.strokeStyle = '#41e7ff'; g.beginPath(); g.arc(196, 128, 70, -Math.PI * 0.4, Math.PI * 0.4); g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), signMat); sign.position.set(0, 4.3, -10.9); scene.add(sign);
  // LED strip along the back wall
  ledMat = new THREE.MeshBasicMaterial({ color: 0x2f8cff });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(22, 0.08, 0.05), ledMat); strip.position.set(0, 2.6, -10.85); scene.add(strip);
  // DJ booth edge in the foreground
  booth = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.9), new THREE.MeshStandardMaterial({ color: 0x0e0f13, roughness: 0.6 }));
  top.position.set(0, 0.97, 0.05); booth.add(top);
  const front = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.95, 0.06), new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.5, metalness: 0.4 }));
  front.position.set(0, 0.5, -0.4); booth.add(front);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.02, 0.02), ledMat); lip.position.set(0, 1.0, -0.42); booth.add(lip);
  scene.add(booth);
  // moving beams and coloured washes
  const beamGeo = new THREE.ConeGeometry(0.55, 7, 24, 1, true); beamGeo.translate(0, -3.5, 0);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.MeshBasicMaterial({ color: [0x41e7ff, 0x6285ff, 0xff3da5, 0x41e7ff, 0x6285ff, 0xff3da5][i], transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const b = new THREE.Mesh(beamGeo, m);
    b.position.set(-5 + i * 2, 6.2, -6.5);
    b.userData.base = m.color.clone();
    scene.add(b); beams.push(b);
  }
  for (let i = 0; i < 3; i++) {
    const l = new THREE.SpotLight([0x41e7ff, 0xff3da5, 0x6285ff][i], 30, 16, 0.5, 0.6, 1.2);
    l.position.set(-3 + i * 3, 6, -1); l.target.position.set(-1.2 + i * 1.2, 0, -3.2);
    l.userData.base = l.color.clone();
    scene.add(l, l.target); washes.push(l);
  }
}

async function loadCrowd() {
  const loader = new GLTFLoader();
  const gltfs = await Promise.all(MODELS.map((u) => loader.loadAsync(u)));
  SPOTS.forEach(([x, z], i) => {
    const src = gltfs[i % gltfs.length];
    const root = SkeletonUtils.clone(src.scene);
    root.position.set(x, 0, z);
    root.rotation.y = Math.atan2(-x, -z);  // face the booth (models face +Z)
    root.scale.setScalar(rnd(0.96, 1.04));
    root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    scene.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const clip of src.animations) actions[clip.name] = mixer.clipAction(clip);
    let hand = null; root.traverse((o) => { if (o.isBone && /hand[._]?R/i.test(o.name)) hand = o; });
    people.push({ root, mixer, actions, hand, loop: null, loopName: null, busy: false, bias: rnd(-10, 10), offset: rnd(-0.06, 0.06) });
  });
}

function resize() {
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.3 ? 68 : 56;
  camera.updateProjectionMatrix();
}

function lights(t) {
  const c = cc(); const M = c && (c.decks.find((d) => d.master && d.playing) || c.decks.find((d) => d.playing));
  const beat = M ? ((M.vpos - M.first) / M.B) : t * 2;
  const pulse = M ? Math.pow(1 - (((beat % 1) + 1) % 1), 3) : 0.3;
  const energy = brain.bassFast;

  // Drop detection: bass drops back in after a quiet stretch → spike dropEnergy
  const bassNow = energy;
  const bassDelta = bassNow - light.prevBass;
  if (bassDelta > 0.18 && brain.lowSince > 1.0) light.dropEnergy = 1.0; // sudden bass hit after quiet
  else light.dropEnergy = Math.max(0, light.dropEnergy - 0.016); // decay
  light.prevBass = bassNow;

  // Reactive intensity: base from user slider, boosted by drop spikes and bass energy
  const reactMult = light.intensity * (1 + light.dropEnergy * 1.8 + energy * 0.6);
  const clampedMult = Math.min(reactMult, 2.2);

  const on = (name) => (light.sfx[name] || 0) > t;
  const laser = on('laser'), flame = on('flame'), co2 = on('co2');
  const mode = light.mode;
  const dark = mode === 'blackout';
  // Auto-cycling hue when no palette colour locked
  const hue = light.autoHue ? (((beat / 16) % 1 + 1) % 1 * 0.3 + 0.52) : light.hue;
  const tint = !dark ? new THREE.Color().setHSL(hue, 1, 0.5) : null;
  const flashRate = 1 + light.speed * 7 + light.dropEnergy * 4;
  const flashOn = ((beat * flashRate) % 1 + 1) % 1 < (0.2 + light.dropEnergy * 0.3);
  const level = dark ? 0 : mode === 'strobe' ? (flashOn ? 1 : 0.03) : 1;

  beams.forEach((b, i) => {
    if (laser) {
      const lspeed = 1 + light.dropEnergy * 3;
      b.rotation.z = Math.sin(t * 5 * lspeed + i * 1.3) * 1.1;
      b.rotation.x = Math.cos(t * 3.7 * lspeed + i) * 0.5;
      b.material.color.set(0x7dff7a);
      b.material.opacity = dark ? 0 : 0.55 + light.dropEnergy * 0.35;
      return;
    }
    const swingSpeed = 1 + light.dropEnergy * 2 + energy * 0.5;
    b.rotation.z = Math.sin(beat * Math.PI / 4 * swingSpeed + i) * (0.55 + light.dropEnergy * 0.5);
    b.rotation.x = Math.cos(beat * Math.PI / 8 * swingSpeed + i * 0.7) * 0.35 + 0.15;
    b.material.color.copy(tint || b.userData.base);
    b.material.opacity = (0.03 + 0.22 * level * clampedMult) * (dark ? 0 : 1);
  });

  washes.forEach((l, i) => {
    const swingSpeed = 1 + light.dropEnergy * 2 + energy * 0.5;
    l.target.position.x = Math.sin(beat * Math.PI / 4 * swingSpeed + i * 2) * (1.6 + light.dropEnergy * 0.8);
    if (flame) {
      l.color.set(0xff7a1a);
      l.intensity = (40 + 30 * Math.sin(t * 31 + i * 2)) * clampedMult;
    } else if (dark) {
      l.intensity = 0;
    } else if (tint) {
      l.color.copy(tint);
      const baseInt = mode === 'strobe' ? 70 : 35;
      l.intensity = baseInt * level * clampedMult;
    } else {
      l.color.copy(l.userData.base);
      l.intensity = (12 + 50 * energy * (0.6 + 0.4 * pulse)) * clampedMult;
    }
  });

  if (laser) ledMat.color.set(0x7dff7a);
  else if (dark) ledMat.color.setRGB(0.04, 0.04, 0.04);
  else if (tint) ledMat.color.copy(tint).multiplyScalar((0.4 + 0.6 * level) * Math.min(clampedMult, 1.5));
  else ledMat.color.setHSL(hue, 1, 0.45 + 0.25 * pulse);
  signMat.opacity = dark ? 0.15 : Math.min(1, 0.75 + 0.25 * pulse + light.dropEnergy * 0.25);

  const co2Left = Math.max(0, (light.sfx.co2 || 0) - t);
  scene.fog.density = 0.075 + (co2 ? 0.25 * co2Left / SFX_LENGTH.co2 : 0) + light.dropEnergy * 0.04;
}

function setLight(mode) {
  light.mode = mode;
  document.querySelectorAll('#lightmenu [data-light]').forEach((b) => b.classList.toggle('on', b.dataset.light === mode));
}

function fireSfx(name) {
  light.sfx[name] = (clock ? clock.elapsedTime : 0) + SFX_LENGTH[name];
}

const lightMenu = document.getElementById('lightmenu');
if (lightMenu) {
  lightMenu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.light) { setLight(b.classList.contains('on') ? '' : b.dataset.light); }
    if (b.dataset.sfx) fireSfx(b.dataset.sfx);
  });
  // Intensity slider
  const intSlider = lightMenu.querySelector('#lmIntensity');
  if (intSlider) intSlider.addEventListener('input', (e) => { light.intensity = e.target.value / 100; });
  // Palette swatches
  lightMenu.querySelector('#lmPalette')?.addEventListener('click', (e) => {
    const sw = e.target.closest('span[data-hue]');
    if (!sw) return;
    lightMenu.querySelectorAll('.palette span').forEach((s) => s.classList.remove('sel'));
    sw.classList.add('sel');
    const h = parseInt(sw.dataset.hue, 10);
    if (h < 0) { light.autoHue = true; }
    else { light.autoHue = false; light.hue = h / 360; }
  });
  setLight('colour');
}

// ------------------------------------------------------------------ online room
// The backend loads on demand, so the crowd and mixer still work if Supabase is down.
let room = null; // { name, author, backend, lastPush, unsub }
const chatLog = document.getElementById('chatlog');
const chatIn = document.getElementById('chatin');

function showChat(m) {
  if (!chatLog) return;
  const line = document.createElement('div');
  const who = document.createElement('b');
  who.textContent = m.author + ': ';
  line.append(who, document.createTextNode(m.body));
  chatLog.append(line);
  while (chatLog.childElementCount > 60) chatLog.firstElementChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
}

// roomName: the room to publish to and chat in. author: the signed-in user's profile username.
async function connectRoom(roomName, author) {
  const backend = await import('./backend.js').catch((e) => { console.warn('backend unavailable', e); return null; });
  if (!backend || !backend.supabase) return false;
  await backend.ensureSession();
  if (room) room.unsub();
  for (const m of await backend.loadRecentChat(roomName)) showChat(m);
  room = { name: roomName, author, backend, lastPush: -99, unsub: backend.subscribeChat(roomName, showChat) };
  return true;
}

function pushRoomState(t) {
  if (!room || t - room.lastPush < 2) return;
  room.lastPush = t;
  room.backend.publishRoomState(room.name, { state: 'LIVE-PUBLIC', hype: brain.hype, mood: brain.mood })
    .catch((e) => console.warn('room state not saved', e));
}

if (chatIn) {
  chatIn.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !room) return;
    const body = chatIn.value;
    chatIn.value = '';
    await room.backend.sendChat(room.name, room.author, body).catch((err) => console.warn('chat not sent', err));
  });
}

function frame() {
  if (!running) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  think(dt, t);
  pushRoomState(t);
  updatePeople(dt);
  updateFlying(dt);
  updateTexts(dt);
  lights(t);
  // a little camera sway with the beat
  camera.position.x = Math.sin(t * 0.4) * 0.05;
  renderer.render(scene, camera);
  hudBar.style.width = brain.hype.toFixed(0) + '%';
  hudBar.style.backgroundPosition = -(brain.hype / 100) * 200 + 'px 0';
  if (hudMood.textContent !== brain.mood) hudMood.textContent = brain.mood;
}

async function start() {
  if (started) return;
  started = true;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  clock = new THREE.Clock();
  buildScene();
  resize();
  try { await loadCrowd(); loadMsg.hidden = true; }
  catch (e) { console.warn('crowd failed to load', e); loadMsg.textContent = 'The crowd could not load. Check your connection and reopen CLUB.'; }
}

window.addEventListener('cc-view', (e) => {
  mode = e.detail.mode;
  if (mode === 'off') { running = false; return; }
  start().then(() => { resize(); if (!running) { running = true; clock.getDelta(); frame(); } });
  requestAnimationFrame(() => renderer && resize());
});
window.addEventListener('resize', () => { if (renderer && mode !== 'off') resize(); });
window.__club = { tick: (dt, t) => { think(dt, t); updatePeople(dt); updateFlying(dt); updateTexts(dt); }, brain, people, light, setLight, fireSfx, connectRoom, react: (i, c) => react(people[i], c, ['TEST'], true), throwAt };
