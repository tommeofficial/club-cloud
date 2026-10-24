// Club Cloud: the club seen from the DJ booth, with a crowd that reacts to the music and the mixing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SplatMesh, SplatEdit, SplatEditSdf, SplatEditSdfType, SplatEditRgbaBlendMode } from '@sparkjsdev/spark';
import { screenMaterial } from './screen.js';

const el = document.getElementById('club');
const canvas = document.getElementById('clubcv');
const hudBar = document.querySelector('#clubhud .bar i');
const hudMood = document.querySelector('#clubhud .mood');
const loadMsg = document.getElementById('clubload');
const splash = document.getElementById('splash');

const MODELS = ['models/crowd_ava.glb', 'models/crowd_leo.glb', 'models/crowd_kai.glb'];
// a scanned, rigged dancer who takes one spot at the front of the crowd
// scanned, rigged people who take spots at the front; they have the full set of moves
const FEATURED = [{ model: 'models/crowd_mia.glb', spot: 1, scale: 0.92, style: 'social' }, { model: 'models/crowd_leon.glb', spot: 2, scale: 0.94, style: 'chill' }, { model: 'models/crowd_skye.glb', spot: 3, scale: 0.92, style: 'raver' }, { model: 'models/crowd_lola.glb', spot: 4, scale: 0.92, style: 'social' }, { model: 'models/crowd_nova.glb', spot: 0, scale: 0.9, style: 'filmer' }, { model: 'models/crowd_jay.glb', spot: 5, scale: 0.94, style: 'raver' }, { model: 'models/crowd_781269e6.glb', spot: 6, scale: 0.93, style: 'raver' }, { model: 'models/crowd_26064435.glb', spot: 7, scale: 0.94, style: 'social' }, { model: 'models/crowd_34cb054a.glb', spot: 9, scale: 0.9, style: 'chill' }, { model: 'models/robot.glb', spot: 8, scale: 0.84, style: 'robot', robot: true }];
// friends stand together and turn to each other to talk, hug and high-five
const FRIENDS = [[1, 2, 3, 4], [0, 5], [6, 8], [7, 9]]; // spot 0 and 5 are a pair
const STYLES = ['raver', 'chill', 'social', 'filmer'];
const DANCES = ['dance', 'dance2', 'dance3', 'dance4', 'dance5'];
const BEAT_LOOPS = new Set(['dance', 'dance2', 'dance3', 'dance4', 'dance5', 'hype']);
// how many beats a looping clip spans, so its own tempo can be locked to the track's. The mocap dances were cut
// to a 16-beat bar; anything not listed is a short 2-beat loop from the original hand-made set.
const CLIP_BEATS = { dance: 16, dance2: 16, dance3: 16, dance4: 16, dance5: 16, hype: 16 };
const MOVES = 'models/moves.glb'; // the mocap, shared by every avatar because they all share one rig
// where the crowd stands (x, z) — the DJ looks down -Z from the booth at z = 0
// kept on the open floor: clear of the counter between the columns (z < -4.3) and the side tables (|x| > 2.2)
const SPOTS = [[-1.2, -2.6], [0.1, -2.4], [1.25, -2.7], [-0.55, -3.3], [0.7, -3.35], [-2.1, -4.4], [1.9, -4.6], [-0.9, -5.4], [0.8, -5.9], [-2.0, -6.0]];
// the venue is a gaussian splat; it is scaled to metres and placed so the floor is y = 0
// the scanned venue is kept behind a switch; the built room below lets the light show actually light the space
const USE_SPLAT = false;
const VENUE = 'models/club.spz', VENUE_SCALE = 2.5, VENUE_OFFSET = [0, 0.8625, -1.15];
// the deck UI under the view is the DJ booth, so there's no 3D table: thrown things land at the bottom edge of the view.
// The sofa pit and counter between the camera and the bar are cut out for a dance floor.
const TABLE_Y = 1.25, TABLE_Z = -0.55; // the booth table
const CAMELOT = { Abm: '1A', Ebm: '2A', Bbm: '3A', Fm: '4A', Cm: '5A', Gm: '6A', Dm: '7A', Am: '8A', Em: '9A', Bm: '10A', 'F#m': '11A', Dbm: '12A',
  B: '1B', 'F#': '2B', Db: '3B', Ab: '4B', Eb: '5B', Bb: '6B', F: '7B', C: '8B', G: '9B', D: '10B', A: '11B', E: '12B' };

let composer, bloom, renderer, scene, camera, clock, started = false, running = false, mode = 'off';
const people = [];
const flying = [];
const texts = [];
let beams = [], washes = [], ledMat, signMat;
// light show state, driven by the controls under the club view
// effects are switched on or off here; when on they fire by themselves with the music
const light = { on: true, colours: [true, true, true, true, true, true], intensity: 0.5, room: 0.45, fx: { laser: true, co2: true, blackout: true, blinders: true }, sfx: {} }; // sfx: name -> elapsed time it ends
const SFX_LENGTH = { co2: 3 };
const DROP_CHEERS = ['sounds/cheer_big.m4a', 'sounds/cheer_small.m4a', 'sounds/cheer_teens.m4a'];
const CO2_SOUND = 'sounds/co2.m4a';
// crowd voices: 'let's go' on drops; 'come on' and a boo, used sparingly and only when the crowd is really angry
const VOICES = { letsgo: ['sounds/letsgo1.m4a', 'sounds/letsgo2.m4a'], comeon: ['sounds/comeon1.m4a', 'sounds/comeon2.m4a', 'sounds/comeon3.m4a', 'sounds/comeon4.m4a'], boo: ['sounds/boo1.m4a'] };
// recorded crowd chatter, looped under everything; one of the two is picked each time the club opens
const MURMUR = ['sounds/murmur.m4a', 'sounds/murmur2.m4a'][Math.floor(Math.random() * 2)];
const auto = { blindUntil: -99, blind: 0, drop: -99, phrase: -1, laser: null, laserEnd: -1, lastPlay: -99 }; // laser: 'drop' | 'slow' | 'kick'
const PALETTE = [0x41e7ff, 0x6285ff, 0x9b5cff, 0xff3da5, 0xffb03d, 0x3dff8a];
const WHITE = new THREE.Color(0xffffff);
let veil;
function setVeil(v) {
  const on = v > 0.001;
  veil.visible = on; veil.material.opacity = Math.min(1, v);
  const solid = v >= 0.999; // fully black: nothing in the room exists yet, so the backdrop draws through the crowd and DJ
  for (const m of screen.parts) { m.renderOrder = on ? 1000 : 0; m.material.depthTest = !solid; if (m.material.transparent !== on) { m.material.transparent = on; m.material.needsUpdate = true; } }
}
let fx; // beams and CO2, drawn after the venue splat so they sit on top of it

const cc = () => window.__cc;
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ crowd brain
// hype runs 0-100 around a bored middle of 50: below is angry, above is happy
const brain = { hype: 50, lastHeard: -99, clash: 0, dead: 0, blend: 0, keyBad: 0, clip: 0, bassFast: 0, bassSlow: 0, lowSince: 0, lastDrop: -99, lastBra: -99, lastDrink: -99, lastFall: -99, lastMixCheer: -99, lastBoo: -99, wrecking: false, mood: 'Waiting for music', specBuf: null, timeBuf: null };

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
  // silence only counts as dead air once a set has started
  if (peak < 0.015 && t - brain.lastHeard < 60) brain.dead += dt; else brain.dead = Math.max(0, brain.dead - dt * 3);
  if (peak >= 0.015) brain.lastHeard = t;
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
  brain.playing = playing && brain.dead < 0.25;
  if (brain.playing) auto.lastPlay = t;
  // hype drifts toward the energy of the music, pushed by good blends and dragged by mistakes
  const target = playing ? 52 + 45 * brain.bassSlow : 50;
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
  if (brain.blend > 3 && t - brain.lastMixCheer > 12) { brain.lastMixCheer = t; someone('point', ['TUNE!', 'SMOOTH!']); const fan = pick(people.filter((q) => !q.busy && q.actions.thumbsup)); if (fan) react(fan, 'thumbsup'); }
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
    : brain.hype > 85 ? 'Going wild' : brain.hype > 70 ? 'Loving it' : brain.hype > 56 ? 'Dancing' : brain.hype > 44 ? 'Bored' : brain.hype > 25 ? 'Restless' : 'Angry';
}

// ------------------------------------------------------------------ people
function pick(a) { return a.length ? a[Math.floor(Math.random() * a.length)] : null; }
function someone(clip, lines) { const p = pick(people.filter((q) => !q.busy)); if (p) react(p, clip, lines); }
function everyone(clip, chance, lines) { for (const p of people) setTimeout(() => react(p, clip, Math.random() < chance + 0.5 ? lines : null), rnd(0, 320)); }

function react(p, clip, lines, force) {
  if (!p || (p.busy && !force)) return;
  if (clip === 'fall' && p.actions.talk) clip = 'boo'; // scanned people don't keel over
  if (clip === 'laugh') return; // the laugh's lean looked wrong, so nobody does it
  const act = p.actions[clip]; if (!act) return;
  p.busy = true;
  sfx.react(clip);
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
  const target = kind === 'drink' ? new THREE.Vector3(rnd(-0.25, 0.25), 1.55, -0.25) : new THREE.Vector3(rnd(-0.4, 0.4), TABLE_Y, TABLE_Z);
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
      else { f.mesh.position.set(f.mesh.position.x, TABLE_Y + 0.01, TABLE_Z); f.mesh.rotation.set(-Math.PI / 2.4, rnd(-0.6, 0.6), 0); f.life = 9; toast('A bra landed on the decks. Perfect mix!'); }
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
// ------------------------------------------------------------------ crowd behaviour
// Everyone has a style and a mood (the crowd meter). Every few seconds each person decides what to do:
// dance (switching between their dance styles every phrase), talk to a friend, film on their phone, have a drink,
// look around, or a one-off move. The music's big moments (drops, build-ups, the DJ's kiss) trigger reactions.
const has = (p, c) => !!p.actions[c];
function holdFor(p, clip, secs, yawTo) {
  if (!has(p, clip) || p.busy) return false;
  p.hold = { name: clip, until: clock.elapsedTime + secs };
  if (yawTo) p.yawTarget = yawTo; return true;
}
function turnTo(p, q) { // yaw (relative to facing the booth) that points p at q
  const d = q.root.position.clone().sub(p.root.position);
  let a = Math.atan2(d.x, d.z) - p.face; a = Math.atan2(Math.sin(a), Math.cos(a));
  return THREE.MathUtils.clamp(a, -1.6, 1.6);
}
function chat(p, t) { // two friends turn in, one talks into the other's ear, then a laugh
  const f = (p.friends || []).find((q) => !q.busy && !q.hold);
  if (!f || !has(p, 'talk')) return false;
  const secs = rnd(4, 7);
  holdFor(p, 'talk', secs, turnTo(p, f)); p.look = f;
  if (!holdFor(f, has(f, 'listen') ? 'listen' : 'idle', secs, turnTo(f, p))) f.yawTarget = turnTo(f, p);
  f.look = p;
  setTimeout(() => { if (has(f, 'laugh') && Math.random() < 0.6) react(f, 'laugh'); else if (has(p, 'laugh') && Math.random() < 0.3) react(p, 'laugh'); }, secs * 1000 + 200);
  return true;
}
function think1(p, t, playing) {
  if (p.busy || p.hold) return;
  if (p.robot) { // the robot dances, scans the room and does the odd stiff gesture, but doesn't chat or drink
    const once = ['wave', 'point', 'handsup'].filter((c) => has(p, c));
    if (playing && brain.hype > 60 && Math.random() < 0.2 && once.length) react(p, pick(once));
    return;
  }
  const mood = brain.hype + p.bias, r = Math.random();
  const social = p.style === 'social' ? 0.45 : p.style === 'chill' ? 0.25 : 0.12;
  if (!playing) { // waiting for music: chat, drink, look about
    if (r < 0.4 + social && chat(p, t)) return;
    if (r < 0.75 && holdFor(p, pick(['drink', 'phone_check'].filter((c) => has(p, c))) || 'idle', rnd(6, 12))) return;
    if (has(p, 'lookaround')) react(p, 'lookaround');
    return;
  }
  if (mood < 44) { // bored: phones out, drinks, chatting
    if (r < 0.35 && holdFor(p, 'phone_check', rnd(5, 10))) return;
    if (r < 0.6 && holdFor(p, 'drink', rnd(6, 10))) return;
    if (r < 0.8 && chat(p, t)) return;
    if (has(p, 'lookaround')) react(p, 'lookaround');
    return;
  }
  // into it: mostly dancing, with the odd moment
  if (r < social * 0.4 && chat(p, t)) return;
  if (p.style === 'filmer' && r < 0.3 && holdFor(p, 'phone_film', rnd(4, 7))) return;
  if (r < 0.12 && holdFor(p, 'drink', rnd(4, 6))) return;
  const once = ['hairflip', 'clap', 'sing', 'wave', 'handsup'].filter((c) => has(p, c));
  if (r < 0.35 && once.length) react(p, pick(once));
}
const crowdEvents = { drop: -99, djKiss: -99, build: false };
function crowdMoments(t, playing) {
  // a drop: phones up for some, hugs and high-fives between friends
  if (brain.lastDrop !== crowdEvents.drop) {
    crowdEvents.drop = brain.lastDrop;
    for (const p of people) {
      if ((p.style === 'filmer' || Math.random() < 0.2) && !p.busy) setTimeout(() => holdFor(p, 'phone_film', rnd(5, 9)), rnd(300, 1500));
      else if (p.friends && Math.random() < 0.3) setTimeout(() => react(p, pick(['hug', 'highfive'].filter((c) => has(p, c))) || 'cheer'), rnd(600, 1500));
    }
  }
  // a build-up (bass gone quiet while the track plays): hands go up
  const build = playing && brain.lowSince > 2.5;
  if (build && !crowdEvents.build) for (const p of people) if (Math.random() < 0.5) react(p, has(p, 'handsup') ? 'handsup' : 'cheer');
  crowdEvents.build = build;
  // the DJ blew a kiss: some blow one back, others wave
  if (dj && dj.kissAt && dj.kissAt !== crowdEvents.djKiss) {
    crowdEvents.djKiss = dj.kissAt;
    for (const p of people) if (Math.random() < 0.5) setTimeout(() => react(p, has(p, 'kiss') && Math.random() < 0.5 ? 'kiss' : has(p, 'wave') ? 'wave' : 'cheer'), rnd(900, 2000));
  }
}
const _v = new THREE.Vector3(), DJ_HEAD = new THREE.Vector3(0, 1.85, 0);
function updatePeople(dt) {
  const c = cc(); if (!c) return;
  const t = clock.elapsedTime;
  const M = c.decks.find((d) => d.master && d.loaded && d.playing) || c.decks.find((d) => d.loaded && d.playing && c.chanGain(d.i) > 0.1);
  const beats = M ? (M.vpos - M.first) / M.B : null;
  const playing = !!M && brain.dead < 1;
  crowdMoments(t, playing);
  const phrase = beats != null ? Math.floor(beats / 16) : -1;
  const kickPulse = beats != null ? Math.pow(1 - (((beats % 1) + 1) % 1), 3) : 0;
  for (const p of people) {
    if (t > p.nextThink) { p.nextThink = t + rnd(3, 8); think1(p, t, playing); }
    if (p.hold && t > p.hold.until) { p.hold = null; p.yawTarget = 0; p.look = null; }
    // every new phrase, dancers may switch to another of their dances
    if (phrase !== p.phrase) { p.phrase = phrase; if (p.dances.length > 1 && Math.random() < 0.5) p.dance = pick(p.dances); }
    let want = 'idle';
    if (playing) { const e = brain.hype + p.bias; want = e > 74 && has(p, 'hype') && p.style !== 'chill' ? 'hype' : e > 48 ? p.dance || 'idle' : 'idle'; }
    if (p.hold) want = p.hold.name;
    if (!p.busy && want !== p.loopName && p.actions[want]) {
      const next = p.actions[want];
      next.reset(); next.setLoop(THREE.LoopRepeat, Infinity); next.enabled = true; next.setEffectiveWeight(1);
      next.fadeIn(0.4).play();
      if (p.loop && p.loop !== next) p.loop.fadeOut(0.4);
      p.loop = next; p.loopName = want;
    }
    if (p.loop && BEAT_LOOPS.has(p.loopName) && beats != null) {
      // drive the clip's time from the beat, over however many beats it was cut to, so everyone stays in time
      const bars = CLIP_BEATS[p.loopName] || 2, dur = p.loop.getClip().duration;
      p.loop.time = (((((beats + p.offset * bars) % bars) + bars) % bars) / bars) * dur;
      p.loop.timeScale = 0;
    } else if (p.loop) p.loop.timeScale = 1;
    // undo last frame's breathing and head turn first, so they never pile up when no clip is writing these bones
    if (p.chest && p.chestQ) p.chest.quaternion.copy(p.chestQ);
    if (p.head && p.headQ) p.head.quaternion.copy(p.headQ);
    p.mixer.update(dt);
    if (p.chest) (p.chestQ ||= new THREE.Quaternion()).copy(p.chest.quaternion);
    if (p.head) (p.headQ ||= new THREE.Quaternion()).copy(p.head.quaternion);
    // turn towards a friend when talking, drift a little on the spot, breathe, and keep an eye on the DJ
    p.yaw += (p.yawTarget - p.yaw) * Math.min(1, dt * 3);
    p.root.rotation.y = p.face + p.yaw;
    p.root.position.set(p.home.x + Math.sin(t * 0.13 + p.seed) * 0.07, 0, p.home.z + Math.cos(t * 0.11 + p.seed) * 0.07);
    if (p.chest && !p.robot) p.chest.rotateX(Math.sin(t * 1.7 + p.seed) * 0.012); // robots don't breathe
    if (p.robot && p.head && !p.busy) {
      // mechanical head: holds still, then clicks to a new angle (the DJ, or somewhere round the room when scanning)
      if (t > p.robot.nextLook) { p.robot.nextLook = t + 0.9 + Math.random() * 1.6; p.robot.lookYaw = Math.random() < 0.6 ? 0 : (Math.round(Math.random() * 4) - 2) * 0.25; }
      p.head.rotateY(p.robot.lookYaw);
    } else if (p.head && !p.busy) {
      const tgt = p.look ? p.look.root.position.clone().setY(1.6) : DJ_HEAD;
      p.head.getWorldPosition(_v);
      let a = Math.atan2(tgt.x - _v.x, tgt.z - _v.z) - p.root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
      p.head.rotateY(THREE.MathUtils.clamp(a, -0.7, 0.7) * 0.5);
    }
    updateRobot(p, t, kickPulse);
    if (p.robot && beats != null && BEAT_LOOPS.has(p.loopName)) { // whirr as it snaps into a new pose
      const half = Math.floor((beats + p.offset) * 2);
      if (half !== p.robot.half) { p.robot.half = half; if (Math.random() < 0.35) sfx.servo(); }
    }
    const on = p.loopName;
    if (p.props.phone) p.props.phone.visible = on === 'phone_film' || on === 'phone_check';
    if (p.props.cup) p.props.cup.visible = on === 'drink';
  }
}

// ------------------------------------------------------------------ scene
function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060b);
  scene.fog = new THREE.FogExp2(0x08080c, 0.045); // a little haze so the light shows
  // fixed view from the front of the room, framed like the venue photo
  camera = new THREE.PerspectiveCamera(46, 1, 0.05, 80);
  camera.position.set(0, 1.5, 0.35);
  camera.lookAt(0, 0.75, -5);
  // the advert's black veil: hides the room while the backdrop (drawn after it) stays lit
  veil = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false }));
  veil.position.z = -0.1; veil.renderOrder = 999; veil.visible = false; camera.add(veil); scene.add(camera);
  scene.add(new THREE.HemisphereLight(0x2a2f45, 0x050508, 0.35));
  const front = new THREE.DirectionalLight(0x8a96c8, 0.7); front.position.set(0, 3, 4); scene.add(front); // spill from the booth onto the crowd's faces
  if (USE_SPLAT) buildSplatVenue(); else buildRoom();
  buildBooth();
  // moving heads on the truss throw beams through the haze; washes light the floor and crowd
  fx = new THREE.Scene(); fx.add(buildCo2(), buildLasers(), buildHaze());
  for (const z of [-2.6, -6.6]) for (let i = 0; i < 4; i++) {
    const head = movingHead(-3 + i * 2, TRUSS_Y - 0.25, z);
    scene.add(head.body);
    fx.add(head.beam); beams.push(head.beam);
  }
  for (let i = 0; i < 4; i++) {
    const l = new THREE.SpotLight(PALETTE[i], 40, 14, 0.42, 0.55, 1.2);
    l.position.set(-3 + i * 2, TRUSS_Y - 0.2, -4.6); l.target.position.set(-2 + i * 1.3, 0, -3.6);
    scene.add(l, l.target); washes.push(l);
  }
}

// ------------------------------------------------------------------ the room
const ROOM = { w: 11, z0: 2.5, z1: -13.5, h: 4.4 };
const TRUSS_Y = 3.9;
function buildRoom() {
  const { w, z0, z1, h } = ROOM, d = z0 - z1, zc = (z0 + z1) / 2;
  const concrete = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.55, metalness: 0.15 });
  const wall = new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.92 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.35, metalness: 0.85 });
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  // shell
  const floor = add(new THREE.PlaneGeometry(w, d), concrete, 0, 0, zc); floor.rotation.x = -Math.PI / 2;
  const ceil = add(new THREE.PlaneGeometry(w, d), black, 0, h, zc); ceil.rotation.x = Math.PI / 2;
  add(new THREE.PlaneGeometry(w, h), wall, 0, h / 2, z1);
  add(new THREE.PlaneGeometry(w, h), wall, 0, h / 2, z0, Math.PI);
  for (const s of [-1, 1]) {
    add(new THREE.PlaneGeometry(d, h), wall, s * w / 2, h / 2, zc, -s * Math.PI / 2);
    // acoustic panels down the side walls
    for (let z = z0 - 2; z > z1 + 1; z -= 1.6) add(new THREE.BoxGeometry(0.06, 1.6, 1.3), panel, s * (w / 2 - 0.03), 2.1, z);
    // speaker stack either side of the booth
    const cab = new THREE.BoxGeometry(0.85, 0.9, 0.7), cone = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 32), tw = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 24);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.6 });
    for (let k = 0; k < 2; k++) {
      add(cab, black, s * 3.6, 0.45 + k * 0.9, -1.2);
      const c = add(k ? tw : cone, coneMat, s * 3.6, 0.45 + k * 0.9, -1.56); c.rotation.x = Math.PI / 2;
    }
    // line array hung off the truss
    for (let k = 0; k < 4; k++) { const b = add(new THREE.BoxGeometry(0.7, 0.22, 0.5), black, s * 3.9, 3.5 - k * 0.24, -2.1); b.rotation.x = k * 0.05; }
    // pillars
    add(new THREE.BoxGeometry(0.5, h, 0.5), wall, s * 3.4, h / 2, -7.6);
  }
  // truss across the ceiling
  for (const z of [-2.6, -6.6]) {
    add(new THREE.BoxGeometry(w - 0.4, 0.3, 0.3), metal, 0, TRUSS_Y, z);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, h - TRUSS_Y, 0.06), metal, s * 4.5, (h + TRUSS_Y) / 2, z);
  }
  // bar at the back: counter with a lit edge, back shelves glowing warm
  add(new THREE.BoxGeometry(6, 1.05, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.4, metalness: 0.2 }), 0, 0.525, z1 + 1.7);
  add(new THREE.BoxGeometry(6.1, 0.05, 0.9), new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.2, metalness: 0.4 }), 0, 1.07, z1 + 1.7);
  ledMat = new THREE.MeshBasicMaterial({ color: 0x2f8cff });
  add(new THREE.BoxGeometry(6, 0.03, 0.03), ledMat, 0, 0.98, z1 + 2.11);
  const glow = new THREE.MeshBasicMaterial({ color: 0x5a3418 });
  add(new THREE.PlaneGeometry(5.6, 0.9), glow, 0, 1.55, z1 + 0.02);
  const shelf = new THREE.BoxGeometry(5.6, 0.04, 0.3);
  const bottle = new THREE.CylinderGeometry(0.035, 0.04, 0.26, 10);
  for (const y of [1.2, 1.65]) {
    add(shelf, metal, 0, y, z1 + 0.16);
    for (let x = -2.6; x <= 2.6; x += 0.13 + Math.random() * 0.08) {
      const m = new THREE.MeshStandardMaterial({ color: [0x3a6a3a, 0x6a4a1a, 0x2a3a6a, 0x5a1a1a, 0x8a8a8a][Math.floor(Math.random() * 5)], roughness: 0.15, metalness: 0.1, emissive: 0x1a0d04 });
      add(bottle, m, x, y + 0.15, z1 + 0.16);
    }
  }
  const barLight = new THREE.PointLight(0xffa860, 6, 6, 1.5); barLight.position.set(0, 1.9, z1 + 1); scene.add(barLight);
  // the Club Cloud logo as a huge neon piece on the back wall, with the name written inside it
  const cv = logoCanvas();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  add(new THREE.PlaneGeometry(2.5, 2.5), signMat, 0, 3.05, z1 + 0.03);
  // fire exit signs
  const exit = new THREE.MeshBasicMaterial({ color: 0x19c25a });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.4, 0.15, 0.04), exit, s * 4.5, 2.6, z1 + 0.05);
}

// the stage backdrop: the logo's two C's, about 4.4 m tall, standing behind the DJ, with a round LED screen inside them.
// It sits behind the booth camera, so it only shows from the crowd.
const screen = { cv: null, g: null, tex: null, show: -1, lastPhrase: -1, parts: [] };
function buildBackdrop() {
  const grp = new THREE.Group(); grp.position.set(0, 0, 1.75); grp.rotation.y = Math.PI; // faces the crowd
  const R = 1.95, tube = 0.13, cy = 2.32, gap = 0.1;
  const white = screen.white = new THREE.MeshStandardMaterial({ color: 0xf2fcff, emissive: 0xdff6ff, emissiveIntensity: 0.9, roughness: 0.3, fog: false });
  const blue = screen.blue = new THREE.MeshStandardMaterial({ color: 0x4cebff, emissive: 0x2fd8ff, emissiveIntensity: 1.0, roughness: 0.3, fog: false });
  const arc = (mat, start) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 18, 120, Math.PI - 2 * gap), mat); m.rotation.z = start; m.position.y = cy; grp.add(m); screen.parts.push(m); };
  arc(white, Math.PI / 2 + gap);   // left C, opening to the right
  arc(blue, -Math.PI / 2 + gap);   // right C, opening to the left
  // round LED screen inside the C's
  screen.cv = document.createElement('canvas'); screen.cv.width = screen.cv.height = 512; screen.g = screen.cv.getContext('2d');
  screen.tex = new THREE.CanvasTexture(screen.cv); screen.tex.colorSpace = THREE.SRGBColorSpace;
  screen.spec = new THREE.DataTexture(new Uint8Array(64), 64, 1, THREE.RedFormat); screen.spec.needsUpdate = true;
  screen.mat = screenMaterial(THREE, screen.tex, screen.spec);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R - 0.32, 96), screen.mat);
  disc.position.set(0, cy, -0.05); grp.add(disc); screen.parts.push(disc);
  // a dark rim around the screen and glow spilling onto the stage
  const rim = new THREE.Mesh(new THREE.RingGeometry(R - 0.32, R - 0.22, 64), new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.4 }));
  rim.position.set(0, cy, -0.04); grp.add(rim); screen.parts.push(rim);
  screen.light = new THREE.PointLight(0x41e7ff, 6, 7, 1.6); screen.light.position.set(0, cy, 0.8); grp.add(screen.light);
  scene.add(grp);
}
function updateCs(v) {
  if (!screen.white) return;
  screen.white.emissiveIntensity = 0.9 + 4 * v;
  screen.blue.emissiveIntensity = 1.0 + 4 * v;
  screen.blue.emissive.setRGB(0.18 + 0.82 * v, 0.85 + 0.15 * v, 1); // the blue C burns white at full blast
  screen.blast = v;
}
// the screen glows softly in the rig's colours on the beat; every so often it flashes the Club Cloud name
function updateScreen(t, beat, pulse, colours, step, dark) {
  if (!screen.g) return;
  const g = screen.g, S = 512, u = screen.mat.uniforms;
  const phrase = Math.floor(beat / 16);
  if (phrase !== screen.lastPhrase) { screen.lastPhrase = phrase; if (Math.random() < 0.25) screen.show = beat; }
  const showing = screen.show >= 0 && beat - screen.show < 4;
  const msg = screen.msg && performance.now() < screen.msg.until ? screen.msg : null;
  // the graphics run on the GPU: pick a look every 16 beats and crossfade into it
  if (phrase !== vis.phrase) {
    vis.phrase = phrase; u.uModeA.value = u.uModeB.value;
    const pool = brain.playing ? [0, 1, 2, 3, 4, 5] : [1, 4, 5];
    let m; do m = pool[Math.floor(Math.random() * pool.length)]; while (pool.length > 1 && m === u.uModeA.value);
    u.uModeB.value = m; vis.fadeFrom = t;
  }
  u.uMix.value = Math.min(1, (t - (vis.fadeFrom || 0)) / 1.8);
  u.uTime.value = t; u.uBeat.value = beat; u.uPulse.value = pulse; screen.lastBeat = beat;
  u.uC1.value.setHex(colours[step % colours.length]); u.uC2.value.setHex(colours[(step + 1) % colours.length]); u.uC3.value.setHex(colours[(step + 2) % colours.length]);
  u.uDark.value = dark ? 1 : 0; u.uBlast.value = screen.blast || 0;
  u.uEnergy.value += ((brain.bassFast || 0) - u.uEnergy.value) * 0.2;
  // live spectrum for the ring look
  const sb = brain.specBuf, d = screen.spec.image.data;
  for (let i = 0; i < 64; i++) { const bin = sb ? Math.floor(Math.pow(i / 64, 1.7) * sb.length * 0.45) + 2 : 0; const v = sb ? (sb[bin] + 95) / 65 : 0; d[i] = Math.max(0, Math.min(255, v * 255)); }
  screen.spec.needsUpdate = true;
  // text layer: welcome / shout-outs / tips, now playing, and the odd logo flash
  g.clearRect(0, 0, S, S);
  const cc_ = cc(), M = cc_ && cc_.decks.find((x) => x.master && x.loaded && x.playing);
  const title = M && M.t ? (M.t.title || '') : '';
  if (title && title !== vis.title) { vis.title = title; vis.trackUntil = beat + 8; vis.artist = M.t.artist || ''; }
  const font = (px) => `700 ${px}px 'Avenir Next','Barlow Semi Condensed',sans-serif`;
  const fit = (txt, px, max) => { g.font = font(px); while (g.measureText(txt).width > max && px > 20) { px -= 4; g.font = font(px); } };
  let dim = 0;
  if (!dark) {
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (screen.ad) {
      dim = screen.ad.dim ?? 0.92;
      for (const l of screen.ad.lines) { g.globalAlpha = l.a ?? 1; g.shadowBlur = l.glow ?? 26; g.shadowColor = l.c; g.fillStyle = l.c; fit(l.t, l.px, S * 0.72); g.fillText(l.t, S / 2, l.y); }
      g.globalAlpha = 1;
    } else if (msg) {
      dim = 0.75;
      g.shadowBlur = 26; g.shadowColor = '#41e7ff'; g.fillStyle = '#4cebff'; g.font = font(50); g.fillText(msg.top, S / 2, S / 2 - 44);
      g.shadowColor = '#ffffff'; g.fillStyle = '#ffffff'; fit(msg.name, 96, S * 0.8); g.fillText(msg.name, S / 2, S / 2 + 48);
    } else if (beat < vis.trackUntil && vis.title) {
      dim = 0.65;
      g.shadowBlur = 20; g.shadowColor = '#41e7ff'; g.fillStyle = '#4cebff'; g.font = font(28); g.fillText('NOW PLAYING', S / 2, S / 2 - 70);
      g.shadowColor = '#ffffff'; g.fillStyle = '#ffffff'; fit(vis.title, 62, S * 0.78); g.fillText(vis.title, S / 2, S / 2 + 8);
      if (vis.artist) { g.fillStyle = '#b8c6da'; fit(vis.artist, 32, S * 0.7); g.fillText(vis.artist, S / 2, S / 2 + 56); }
    } else if (showing) {
      const a = Math.min(1, (beat - screen.show) * 2) * Math.min(1, (4 - (beat - screen.show)) * 2);
      dim = 0.6 * a; g.globalAlpha = a;
      g.shadowBlur = 30; g.shadowColor = '#ffffff'; g.fillStyle = '#ffffff'; g.font = font(150); g.fillText('club', S / 2, S / 2 + 20);
      g.shadowColor = '#41e7ff'; g.fillStyle = '#4cebff'; g.font = font(58); g.fillText('C L O U D', S / 2, S / 2 + 100);
      g.globalAlpha = 1;
    }
    g.shadowBlur = 0;
  }
  u.uTextDim.value += (dim - u.uTextDim.value) * 0.15; // the graphics dim behind text so it reads
  screen.tex.needsUpdate = true;
  const c = new THREE.Color(colours[step % colours.length]);
  if (!dark) { screen.light.color.copy(c); screen.light.intensity = 3 + 6 * pulse; } else screen.light.intensity = 0;
  if (screen.blast > 0.05) { screen.light.color.setRGB(1, 0.95, 0.88); screen.light.intensity = 3 + 40 * screen.blast; }
}

// ---- the screen's shader lives in screen.js
const vis = { phrase: -1, title: '', trackUntil: 0, fadeFrom: 0 };

// the Club Cloud logo in neon: white C and blue C almost meeting, an inner ring, and the name inside
function logoCanvas() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const g = cv.getContext('2d'), C = 512, R = 400, gap = 0.1;
  g.lineWidth = 86; g.shadowBlur = 40;
  g.shadowColor = '#e9fbff'; g.strokeStyle = '#f2fcff';
  g.beginPath(); g.arc(C, C, R, -Math.PI / 2 - gap, Math.PI / 2 + gap, true); g.stroke();
  g.shadowColor = '#41e7ff'; g.strokeStyle = '#4cebff';
  g.beginPath(); g.arc(C, C, R, -Math.PI / 2 + gap, Math.PI / 2 - gap, false); g.stroke();
  g.lineWidth = 8; g.shadowBlur = 16; g.strokeStyle = '#3a6a96'; g.beginPath(); g.arc(C, C, 250, 0, Math.PI * 2); g.stroke();
  g.textAlign = 'center'; g.shadowBlur = 30;
  g.shadowColor = '#e9fbff'; g.fillStyle = '#f2fcff'; g.font = "700 200px 'Avenir Next','Barlow Semi Condensed',sans-serif"; g.fillText('club', C, C + 30);
  g.shadowColor = '#41e7ff'; g.fillStyle = '#4cebff'; g.font = "700 76px 'Avenir Next','Barlow Semi Condensed',sans-serif"; g.fillText('C L O U D', C, C + 130);
  return cv;
}

// the DJ booth: a riser, a table, and the controller on top, built to real sizes
let boothDecks = null; // 3D decks on the table, only shown from the crowd camera (the booth camera shows the real deck UI)
function buildBooth() {
  const { riser, tableY, tableZ } = BOOTH;
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.7 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };
  add(new THREE.BoxGeometry(3.2, riser, 2.2), black, 0, riser / 2, 0.2);
  add(new THREE.BoxGeometry(2.2, 0.05, 0.7), new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.4 }), 0, tableY - 0.025, tableZ);
  // the front the crowd sees: a gloss-black facade with angled wings, LED trim, and the logo lit in the middle
  const gloss = new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.18, metalness: 0.55 });
  const fz = tableZ - 0.36, fh = tableY + 0.02;
  add(new THREE.BoxGeometry(2.3, fh, 0.06), gloss, 0, fh / 2, fz);
  for (const sd of [-1, 1]) {
    const wing = add(new THREE.BoxGeometry(0.7, fh, 0.06), gloss, sd * 1.43, fh / 2, fz + 0.24);
    wing.rotation.y = -sd * 0.75;
    const trim = add(new THREE.BoxGeometry(0.02, fh - 0.08, 0.02), ledMat, sd * 1.14, fh / 2, fz - 0.04);
  }
  add(new THREE.BoxGeometry(2.3, 0.025, 0.025), ledMat, 0, fh - 0.02, fz - 0.04);
  add(new THREE.BoxGeometry(2.3, 0.025, 0.025), ledMat, 0, 0.04, fz - 0.04);
  const logoTex = new THREE.CanvasTexture(logoCanvas()); logoTex.colorSpace = THREE.SRGBColorSpace;
  const logo = add(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true }), 0, fh * 0.52, fz - 0.035);
  logo.rotation.y = Math.PI; // faces the crowd
  const glow = new THREE.PointLight(0x41e7ff, 1.6, 2.2, 2); glow.position.set(0, fh * 0.52, fz - 0.4); scene.add(glow);
  // simple 3D decks and mixer on the table for the crowd camera
  boothDecks = new THREE.Group(); boothDecks.visible = false;
  const body = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.4, metalness: 0.5 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.3, metalness: 0.8 });
  const ring = new THREE.MeshBasicMaterial({ color: 0x41e7ff });
  const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); boothDecks.add(m); return m; };
  for (const x of [-0.33, 0.33]) {
    put(new THREE.BoxGeometry(0.32, 0.08, 0.42), body, x, tableY + 0.04, tableZ + 0.05);
    put(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 32), plate, x, tableY + 0.09, tableZ + 0.08);
    const r_ = put(new THREE.TorusGeometry(0.113, 0.004, 8, 40), ring, x, tableY + 0.1, tableZ + 0.08); r_.rotation.x = Math.PI / 2;
    const scr = put(new THREE.PlaneGeometry(0.2, 0.08), new THREE.MeshBasicMaterial({ color: 0x1b4f8a }), x, tableY + 0.115, tableZ - 0.1); scr.rotation.x = -0.5;
  }
  put(new THREE.BoxGeometry(0.28, 0.09, 0.4), body, 0, tableY + 0.045, tableZ + 0.05);
  scene.add(boothDecks);
  buildBackdrop();
  // the controller itself is the app's real deck UI, perspective-mapped onto the table (see placeDecks)
  // a warm downlight over the booth so the DJ reads against the room
  const spot = new THREE.SpotLight(0xffd6b0, 14, 5, 0.6, 0.6, 1.4); spot.position.set(0, 3.6, 0.6); spot.target.position.set(0, 1, -0.2);
  scene.add(spot, spot.target);
}

// a moving head: yoke and head on the truss, with a soft beam that fades along its length
const beamMat = () => new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(1, 1, 1) }, opacity: { value: 0 } },
  vertexShader: 'varying float vy; varying vec3 vn; varying vec3 vv; void main(){ vy = uv.y; vn = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vv = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 color; uniform float opacity; varying float vy; varying vec3 vn; varying vec3 vv; void main(){ float edge = pow(abs(dot(vn, vv)), 1.6); float along = pow(vy, 1.8); gl_FragColor = vec4(color * opacity * edge * along, 1.0); }',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function movingHead(x, y, z) {
  const body = new THREE.Group(); body.position.set(x, y, z);
  const dark = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.5, metalness: 0.6 });
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.2), dark); yoke.position.y = 0.15; body.add(yoke);
  const pan = new THREE.Group(); body.add(pan);
  const tilt = new THREE.Group(); pan.add(tilt);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 20), dark); tilt.add(can);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshBasicMaterial({ color: 0xffffff })); lens.rotation.x = Math.PI / 2; lens.position.y = -0.151; tilt.add(lens);
  // beam: an open cone hanging down from the lens (uv.y is 1 at the lens, 0 at the far end)
  const geo = new THREE.CylinderGeometry(0.06, 0.75, 8, 32, 1, true); geo.translate(0, -4.15, 0);
  const beam = new THREE.Mesh(geo, beamMat());
  beam.userData = { pan, tilt, lens, x, y, z };
  beam.material.color = beam.material.uniforms.color.value; // so the light show can treat it like a normal material
  Object.defineProperty(beam.material, 'opacity', { get() { return this.uniforms.opacity.value; }, set(v) { this.uniforms.opacity.value = v; } });
  return { body, beam };
}

function buildSplatVenue() {
  const venue = new SplatMesh({ url: VENUE });
  venue.scale.setScalar(VENUE_SCALE); venue.position.set(...VENUE_OFFSET);
  const cut = new SplatEdit({ rgbaBlendMode: SplatEditRgbaBlendMode.MULTIPLY, softEdge: 0.01 });
  const box = new SplatEditSdf({ type: SplatEditSdfType.BOX, opacity: 0 });
  box.position.set(0, -0.15, -0.2); box.scale.set(1.3, 0.4, 2.2); // splat units
  cut.addSdf(box); cut.add(box); venue.add(cut); // parent the box so it follows the venue scale
  scene.add(venue);
  venue.initialized.then(() => findRoomLights(venue));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.3 * VENUE_SCALE, 2.65 * VENUE_SCALE), new THREE.MeshStandardMaterial({ color: 0x2a1012, roughness: 0.35, metalness: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, -0.425 * VENUE_SCALE + VENUE_OFFSET[2]); scene.add(floor);
  signMat = new THREE.MeshBasicMaterial({ transparent: true });
  ledMat = new THREE.MeshBasicMaterial({ color: 0x2f8cff });
}

async function loadCrowd() {
  const loader = new GLTFLoader();
  const [gltfs, stars, moves] = await Promise.all([
    Promise.all(MODELS.map((u) => loader.loadAsync(u))),
    Promise.all(FEATURED.map((f) => loader.loadAsync(f.model).catch(() => null))),
    loader.loadAsync(MOVES).then((g) => g.animations).catch(() => []),
  ]);
  SPOTS.forEach(([x, z], i) => {
    const fi = FEATURED.findIndex((f, k) => f.spot === i && stars[k]);
    const star = fi >= 0 ? FEATURED[fi] : null;
    if (!star) return; // only the scanned, rigged people; the old blocky dancers are retired
    const src = star ? stars[fi] : gltfs[i % gltfs.length];
    const root = SkeletonUtils.clone(src.scene);
    root.position.set(x, 0, z);
    const face = Math.atan2(-x, -z); // face the booth (models face +Z)
    root.rotation.y = face;
    root.scale.setScalar(star ? star.scale : rnd(0.96, 1.04));
    root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    scene.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    // the shared mocap wins where it exists; the character's own clips cover everything it does not replace
    for (const clip of [...src.animations, ...moves]) actions[clip.name] = mixer.clipAction(clip);
    const bone = (re) => { let b = null; root.traverse((o) => { if (o.isBone && re.test(o.name)) b = o; }); return b; };
    const hand = bone(/hand[._]?R/i), handL = bone(/hand[._]?L/i);
    const p = { root, mixer, actions, hand, handL, head: bone(/^head$/i), chest: bone(/^chest$/i), loop: null, loopName: null, busy: false,
      bias: rnd(-10, 10), offset: rnd(-0.06, 0.06), home: new THREE.Vector3(x, 0, z), face, yaw: 0, yawTarget: 0, seed: rnd(0, 100),
      style: star ? star.style : pick(STYLES), dances: DANCES.filter((d) => actions[d]), dance: null, phrase: -1, hold: null, nextThink: rnd(2, 8), look: null, props: {} };
    p.dance = pick(p.dances);
    addProps(p);
    if (star.robot && p.head) { scene.updateMatrixWorld(true); p.robot = buildRobotHead(p.head, p); p.dances = p.dances.filter((d) => d !== 'dance3' || true); }
    p.spot = i;
    people.push(p);
  });
  const at = (i) => people.find((q) => q.spot === i);
  FRIENDS.forEach((g) => g.forEach((i) => { const p = at(i); if (p) p.friends = g.map(at).filter((q) => q && q !== p); }));
}

// ------------------------------------------------------------------ the robot's head
// The Club Cloud logo as a head: a glossy white C and a glowing cyan C wrapped round a dark glass dome, with a round
// LED face inside. The face is a shader: its eyes and mouth follow the crowd meter (angry, bored, dancing, buzzing),
// it blinks, bounces on the beat, and flashes heart eyes on a drop.
function buildRobotHead(bone, p) {
  const g = new THREE.Group();
  const ws = bone.getWorldScale(new THREE.Vector3()).x;
  g.scale.setScalar(1 / ws); g.position.set(0, 0.21 / ws, 0.01 / ws); // sits on the neck mount
  const R = 0.14;
  // glass dome: a slightly flattened sphere, dark and glossy
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0x04060a, roughness: 0.05, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 }));
  dome.scale.set(1, 1, 0.82); g.add(dome);
  // the two C's, wrapped round the head like the logo: white on the left, cyan on the right, small gaps top and bottom
  const gap = 0.16, tube = 0.027, cr = R + 0.026;
  const whiteC = new THREE.MeshPhysicalMaterial({ color: 0xf4fbff, roughness: 0.12, clearcoat: 1, emissive: 0xdff6ff, emissiveIntensity: 0.25 });
  const cyanC = new THREE.MeshPhysicalMaterial({ color: 0x4cebff, roughness: 0.15, clearcoat: 1, emissive: 0x2fd8ff, emissiveIntensity: 0.9 });
  const arc = (mat, start) => { const m = new THREE.Mesh(new THREE.TorusGeometry(cr, tube, 20, 80, Math.PI - 2 * gap), mat); m.rotation.z = start; g.add(m); return m; };
  arc(whiteC, Math.PI / 2 + gap); arc(cyanC, -Math.PI / 2 + gap);
  // the face's text layer: the Club Cloud logo, or @name for a shout-out
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  // the LED face, drawn like the big screen: fine dot grid, scanlines, soft-edged shapes and glow
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 }, uMood: { value: 0 }, uBlink: { value: 0 }, uKick: { value: 0 }, uScan: { value: -1 }, uLook: { value: new THREE.Vector2() },
      uCol: { value: new THREE.Color(0x4cebff) }, uShow: { value: 0 }, uText: { value: tex }, uSpecAmt: { value: 0 }, uSpec: { value: screen.spec },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime, uMood, uBlink, uKick, uScan, uShow, uSpecAmt; uniform vec2 uLook; uniform vec3 uCol; uniform sampler2D uText, uSpec;
      float sdBox(vec2 p, vec2 b, float r){ vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      // eyes: flat, narrow and level (calm, focused); bored lowers the lids, angry slants a brow in
      float eye(vec2 p, float side){
        float bored = 1.0 - smoothstep(0.1, 0.3, abs(uMood + 0.05)), angry = smoothstep(-0.3, -0.65, uMood);
        float h = mix(0.1, 0.03, max(bored * 0.75, uBlink));
        float d = sdBox(p, vec2(0.2, h), min(h, 0.06));
        float brow = p.y - (0.03 + side * p.x * 0.45);
        return mix(d, max(d, brow), angry);
      }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        if (length(p) > 1.0) discard;
        vec2 q = p + uLook * 0.07 + vec2(0.0, -0.015 * uKick);
        float d = 1e3;
        float core = 1e3; for (int i = 0; i < 2; i++) { float side = i == 0 ? -1.0 : 1.0; vec2 e = q - vec2(side * 0.37, 0.16); e.y -= side * 0.18 * e.x; /* inner corners slightly lower: a little stern */ float de = eye(e, side); d = min(d, de); core = min(core, length((e - vec2(-uLook.x * 0.06, 0.0)) * vec2(1.0, 2.2)) - 0.05); }
        // mouth: one level line, short and still; tightens when angry
        vec2 m = q - vec2(0.0, -0.36);
        d = min(d, sdBox(m, vec2(0.3 - 0.08 * smoothstep(-0.3, -0.7, uMood), 0.032), 0.032));
        // bright inside the shapes with a hotter centre in each eye, and a soft glow round them
        float face = smoothstep(0.02, 0.0, d) * (0.75 + 0.6 * smoothstep(0.03, -0.02, core)) + exp(-max(d, 0.0) * 18.0) * 0.45;
        // when hyped, a bright scan band slides across the eyes on the beat
        float band = smoothstep(0.08, 0.0, abs(p.x - (fract(uTime * 0.6) * 2.4 - 1.2))) * smoothstep(0.4, 0.75, uMood) * step(d, 0.02);
        vec3 col = uCol * (face * 1.4 + band * 1.5);
        // the logo or a name takes over the face sometimes
        vec4 tx = texture2D(uText, vUv);
        col = mix(col, tx.rgb * 1.6, uShow * tx.a + uShow * 0.0);
        col *= 1.0 - uShow * (1.0 - tx.a) * 0.9;
        // drops: a quick spectrum burst instead of a face
        float k = abs(p.x) * 0.98, v = texture2D(uSpec, vec2(k, 0.5)).r;
        float bar = step(abs(fract((p.x + 1.0) * 9.0) - 0.5), 0.36) * step(abs(p.y), 0.05 + v * 0.7);
        col = mix(col, uCol * bar * 1.6 + uCol * 0.05, uSpecAmt);
        // idle shimmer: a faint band of data noise drifting down now and then
        float sh = step(0.985, hash(floor(p.y * 30.0) + floor(uTime * 12.0))) * smoothstep(0.1, 0.0, abs(p.y - (1.0 - fract(uTime * 0.15) * 2.0)));
        col += uCol * sh * 0.25;
        // the scan line: a bright horizontal line that sweeps the face top to bottom when it scans the room
        col += vec3(0.7, 1.0, 1.0) * smoothstep(0.03, 0.0, abs(p.y - uScan)) * step(-1.0, uScan);
        // LED dots and scanlines, then a dark glass base
        vec2 cell = fract(vUv * 120.0) - 0.5; float pix = smoothstep(0.6, 0.2, length(cell));
        col *= 0.3 + 0.9 * pix;
        col *= 0.9 + 0.1 * sin(vUv.y * 760.0);
        col += vec3(0.008, 0.015, 0.025) * pix;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 64), mat);
  face.position.z = R * 0.83; g.add(face);
  // a light sheen that sweeps across the glass now and then
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(0.035, R * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  sheen.position.z = R * 0.84; sheen.rotation.z = 0.35; g.add(sheen);
  // a glowing collar where the head meets the neck
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.01, 12, 48), new THREE.MeshBasicMaterial({ color: 0x4cebff }));
  collar.rotation.x = Math.PI / 2; collar.position.y = -R * 0.98; g.add(collar);
  bone.add(g);
  // the body: glossier, so it catches the moving lights, and its glow lines pulse with the beat
  const bodyMats = [];
  p.root.traverse((o) => { if (o.isMesh && o.material && o.material.emissiveMap) { o.material.roughness = 0.18; o.material.metalness = 0.75; o.material.envMapIntensity = 1.4; bodyMats.push(o.material); } });
  return { mat, tex, cv, sheen, bodyMats, nextBlink: 2, blinkT: 0, drop: brain.lastDrop, dropT: -99, shown: '', nextScan: 6, scanT: -99, nextLook: 0, lookYaw: 0 };
}
function robotText(r, top, name) {
  const g = r.cv.getContext('2d'), S = 256; g.clearRect(0, 0, S, S);
  g.textAlign = 'center'; g.fillStyle = '#ffffff';
  if (name) {
    g.fillStyle = '#4cebff'; g.font = "700 30px 'Avenir Next','Barlow Semi Condensed',sans-serif"; g.fillText(top, S / 2, S / 2 - 22);
    g.fillStyle = '#ffffff'; let fs = 52; g.font = `700 ${fs}px 'Avenir Next','Barlow Semi Condensed',sans-serif`;
    while (g.measureText(name).width > S * 0.84 && fs > 18) { fs -= 3; g.font = `700 ${fs}px 'Avenir Next','Barlow Semi Condensed',sans-serif`; }
    g.fillText(name, S / 2, S / 2 + 30);
  } else {
    g.font = "700 76px 'Avenir Next','Barlow Semi Condensed',sans-serif"; g.fillText('club', S / 2, S / 2 + 10);
    g.fillStyle = '#4cebff'; g.font = "700 28px 'Avenir Next','Barlow Semi Condensed',sans-serif"; g.fillText('C L O U D', S / 2, S / 2 + 50);
  }
  r.tex.needsUpdate = true;
}
function updateRobot(p, t, pulse) {
  const r = p.robot; if (!r) return;
  const u = r.mat.uniforms;
  u.uTime.value = t;
  u.uMood.value += (THREE.MathUtils.clamp((brain.hype - 50) / 40, -1, 1) - u.uMood.value) * 0.05;
  if (t > r.nextBlink) { r.blinkT = t; r.nextBlink = t + 3 + Math.random() * 5; }
  u.uBlink.value = Math.max(0, 1 - Math.abs(t - r.blinkT - 0.08) / 0.08) * (brain.hype < 45 ? 1 : 1);
  u.uKick.value = pulse;
  u.uCol.value.setHex(brain.hype < 30 ? 0xff4a5a : 0x4cebff); // the face goes red when the crowd turns
  // drops: a spectrum burst for a couple of seconds
  if (brain.lastDrop !== r.drop) { r.drop = brain.lastDrop; r.dropT = t; }
  u.uSpecAmt.value += ((t - r.dropT < 2 ? 1 : 0) - u.uSpecAmt.value) * 0.2;
  // the logo in time with the big screen, or @name with the big screen's welcome / shout-out
  const msg = screen.msg && performance.now() < screen.msg.until ? screen.msg : null;
  const logo = screen.show >= 0 && (screen.lastBeat || 0) - screen.show < 4;
  const want = msg ? 'm:' + msg.top + msg.name : logo ? 'logo' : '';
  if (want !== r.shown) { r.shown = want; if (msg) robotText(r, msg.top, msg.name); else if (logo) robotText(r); }
  u.uShow.value += ((want ? 1 : 0) - u.uShow.value) * 0.15;
  // now and then it scans the room: a line sweeps its face while its head turns in steps
  if (t > r.nextScan) { r.scanT = t; r.nextScan = t + 10 + Math.random() * 12; }
  const sp = (t - r.scanT) / 1.4;
  u.uScan.value = sp < 1 ? 1 - sp * 2 : -2;
  // a sheen across the glass every few seconds
  const sh = ((t * 0.25) % 1) * 3 - 1;
  r.sheen.position.x = sh * 0.14; r.sheen.material.opacity = sh > -0.6 && sh < 0.6 ? 0.07 * (1 - Math.abs(sh) / 0.6) : 0;
  for (const m of r.bodyMats) m.emissiveIntensity = 0.6 + 1.2 * pulse;
}

// a phone in the right hand (screen glowing) and a cup in the left, shown only while they're being used
function addProps(p) {
  if (p.hand && p.actions.phone_film) {
    const phone = new THREE.Group();
    phone.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.009), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.3, metalness: 0.6 })));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshBasicMaterial({ color: 0xbfe6ff })); scr.position.z = -0.0051; scr.rotation.y = Math.PI; phone.add(scr);
    phone.scale.setScalar(1 / p.root.scale.x); phone.position.set(0, 0.09, -0.02); phone.visible = false;
    p.hand.add(phone); p.props.phone = phone;
  }
  if (p.handL && p.actions.drink) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xd8e4ef, roughness: 0.15, transparent: true, opacity: 0.55 }));
    cup.scale.setScalar(1 / p.root.scale.x); cup.position.set(0, 0.08, -0.04); cup.visible = false;
    p.handL.add(cup); p.props.cup = cup;
  }
}

// zooming the club view moves the camera with the decks: in is tighter and looks down towards the booth
let clubZoom = 1; // the club view is fixed at the close-up from the booth
// which camera the club uses: 'booth' (over the DJ's shoulder) or 'crowd' (on the back wall, looking at the booth)
let camView = 'booth';
try { if (localStorage.getItem('cc-cam') === 'crowd') camView = 'crowd'; } catch (_) {}
function setCamView(v) {
  camView = v;
  try { localStorage.setItem('cc-cam', v); } catch (_) {}
  // from the booth the DJ is drawn on her own layer over the deck UI; from the crowd she stands in the room so people can pass in front
  if (dj) (v === 'crowd' ? scene : djScene).add(dj.root);
  djCanvas.style.visibility = v === 'crowd' ? 'hidden' : '';
  if (boothDecks) boothDecks.visible = v === 'crowd';
  aimCamera();
}
window.addEventListener('cc-cam', (e) => setCamView(e.detail));
// the DJ stands in the booth in the same room as the crowd, so everything shares one scale
let dj = null;
const BOOTH = { riser: 0.25, tableY: 1.2, tableZ: -0.55 }; // DJ stands at x 0, z 0 on the riser
const DECKS = { w: 0.95, z: -0.51 }; // the controller on the table: width in metres, centre z (depth follows the UI's shape)
// the DJ is drawn on her own transparent canvas above the real deck UI, so she stays in front of the decks
const djCanvas = document.createElement('canvas');
djCanvas.id = 'djcv';
(el.parentNode || document.body).appendChild(djCanvas);
let djRenderer = null, djScene = null;

// perspective-map the deck UI (#view) onto the top of the booth table, using the club camera
function placeDecks() {
  const view = document.getElementById('view');
  if (!view) return;
  view.style.visibility = mode === 'club' && camView === 'crowd' ? 'hidden' : '';
  if (mode !== 'club' || !camera || camView === 'crowd') return;
  const vw = view.offsetWidth, vh = view.offsetHeight, w = el.clientWidth, h = el.clientHeight;
  if (!vw || !vh || !w || !h) return;
  const d = DECKS.w * vh / vw, y = BOOTH.tableY + 0.003;
  const far = DECKS.z - d / 2, near = DECKS.z + d / 2;
  const pts = [[-DECKS.w / 2, far], [DECKS.w / 2, far], [DECKS.w / 2, near], [-DECKS.w / 2, near]].map(([x, z]) => {
    const p = new THREE.Vector3(x, y, z).project(camera);
    return [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h];
  });
  view.style.transform = quadMatrix(vw, vh, pts);
}
// CSS matrix3d that maps a w x h box onto four screen points (top-left, top-right, bottom-right, bottom-left)
function quadMatrix(w, h, q) {
  const adj = (m) => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
  const mul = (a, b) => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c.push(s); } return c; };
  const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const basis = (p) => { const m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1]; const v = mv(adj(m), [p[3][0], p[3][1], 1]); return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); };
  const t = mul(basis(q), adj(basis([[0, 0], [w, 0], [w, h], [0, h]])));
  const n = t.map((x) => x / t[8]);
  return `matrix3d(${[n[0], n[3], 0, n[6], n[1], n[4], 0, n[7], 0, 0, 1, 0, n[2], n[5], 0, n[8]].map((x) => x.toFixed(9)).join(',')})`;
}
window.addEventListener('cc-deckplace', () => placeDecks());
function aimCamera() {
  if (!camera) return;
  const w = el.clientWidth, h = el.clientHeight;
  if (camView === 'crowd') {
    // mounted on the back wall under the logo, looking over the crowd at the booth
    camera.fov = w / h < 1.3 ? 36 : 28;
    camera.position.set(0, 3.35, ROOM.z1 + 0.4);
    camera.lookAt(0, 1.5, -1.4);
  } else {
    // third-person, just behind and above the DJ's shoulder, looking over the decks at the crowd
    camera.fov = w / h < 1.3 ? 62 : 50;
    camera.position.set(0.5, 2.3, 1.25);
    camera.lookAt(-0.1, 1.0, -4);
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(); // placeDecks projects through the camera, so it must already be in its new spot
  placeDecks();
}
window.addEventListener('cc-clubzoom', (e) => { clubZoom = e.detail; aimCamera(); });

function resize() {
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  djCanvas.hidden = mode === 'off';
  for (const k of ['left', 'top', 'width', 'height']) djCanvas.style[k] = el.style[k];
  if (djRenderer) { djRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); djRenderer.setSize(w, h, false); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  laserRes(w, h);
  camera.aspect = w / h;
  aimCamera();
  camera.updateProjectionMatrix();
}

// the moving heads run one look at a time, changing every 8 beats: chases and still downlights when it's calm,
// sweeps and fans when the crowd is up, and always a sweep or fan on a drop
const look = { name: 'sweep', block: -1 };
function pickLook(beat, drop) {
  const block = Math.floor(beat / 8);
  if (block === look.block) return;
  look.block = block;
  const hot = brain.hype > 62, r = Math.random();
  look.name = drop ? (r < 0.6 ? 'sweep' : 'fan')
    : hot ? ['sweep', 'sweep', 'fan', 'pairs', 'chase', 'pingpong'][Math.floor(r * 6)]
    : ['down', 'chase', 'pingpong', 'pairs', 'sweep'][Math.floor(r * 5)];
}
function lights(t, dt) {
  const c = cc(); const M = c && (c.decks.find((d) => d.master && d.playing) || c.decks.find((d) => d.playing));
  const beat = light.adBeat != null ? light.adBeat : M ? ((M.vpos - M.first) / M.B) : t * 2; // the advert supplies its own track's beat
  const pulse = M ? Math.pow(1 - (((beat % 1) + 1) % 1), 3) : 0.3;
  const k = light.intensity;
  // intensity sets how fast the rig moves and how hard it reacts to bass and drops, not how bright it is
  const energy = Math.min(1, brain.bassFast * (0.6 + 1.4 * k));
  const drop = t - brain.lastDrop < 0.5 + 2.5 * k;
  autoFx(t, beat);
  // blackout: the music cut out mid-set, so the rig goes dark until it comes back
  const cut = light.fx.blackout && !brain.playing && t - auto.lastPlay < 30; // the music cut out mid-set
  const hitOn = light.fx.blinders && beat < auto.blindUntil;            // a blinder hit on a drop
  const scrDark = !light.on || cut || hitOn;
  const dark = scrDark || !!light.adDark; // the advert can hold the rig dark while the screen still plays
  const F = light.adFade ?? 1; // the advert fades the whole rig in
  const pal = PALETTE.filter((_, i) => light.colours[i]);
  const colours = pal.length ? pal : PALETTE;
  const step = Math.floor(beat / Math.max(1, Math.round(8 - 6 * k))); // colour changes every 8 beats at low intensity, every 2 at high
  const speed = 0.4 + 1.6 * k;
  const strobe = drop && ((beat * 4) % 1 + 1) % 1 < 0.35;
  pickLook(beat, drop);
  beams.forEach((b, i) => {
    if (dark) { b.material.opacity = 0; b.userData.lens.material.color.setRGB(0.02, 0.02, 0.02); return; }
    // pan and tilt the head, and swing the beam with it; the look decides how
    const u = b.userData, mirror = i % 2 ? -1 : 1, col = i % 4, row = Math.floor(i / 4);
    const base = 0.12 + (0.25 + 0.5 * energy) * (0.5 + 0.5 * pulse) * (brain.hype / 100 + 0.3);
    let P = 0, T = 0, lvl = base;
    const b4 = Math.floor(beat) % 4, b8 = Math.floor(beat) % 8;
    switch (look.name) {
      case 'down': lvl = 0.3 + 0.25 * pulse; break;                                          // all straight down, still
      case 'chase': lvl = (row ? 3 - b4 : b4) === col ? 0.75 : 0; break;                      // one at a time along the row, rows opposite ways
      case 'pingpong': { const p = b8 < 4 ? b8 : 7 - b8; lvl = p === col ? 0.75 : 0; break; } // back and forth along the row
      case 'pairs': lvl = (Math.floor(beat) % 2) === (col % 2) ? 0.6 * (0.4 + 0.6 * pulse) : 0; break; // alternate pairs on each beat
      case 'fan': P = (col - 1.5) * 0.32; T = 0.38; lvl = 0.25 + 0.5 * pulse; break;          // still fan out over the crowd
      default:                                                                                 // sweeping
        P = mirror * Math.sin(beat * Math.PI / 4 * speed + i * 0.8) * 0.7;
        T = 0.3 + Math.cos(beat * Math.PI / 8 * speed + i * 0.6) * 0.35;
    }
    u.pan.rotation.y = P; u.tilt.rotation.x = T;
    b.position.set(u.x, u.y, u.z); b.rotation.set(T, P, 0, 'YXZ');
    b.material.color.setHex(colours[(look.name === 'sweep' ? i + step : step) % colours.length]);
    if (strobe) b.material.color.lerp(WHITE, 0.6);
    b.material.opacity = (lvl + (strobe ? 0.5 : 0)) * F;
    u.lens.material.color.copy(b.material.color).multiplyScalar(0.4 + b.material.opacity);
  });
  washes.forEach((l, i) => {
    l.target.position.x = Math.sin(beat * Math.PI / 4 * speed + i * 2) * 1.6;
    if (dark) { l.intensity = 0; return; }
    l.color.setHex(colours[(i * 2 + step) % colours.length]);
    l.intensity = (12 + 40 * energy * (0.6 + 0.4 * pulse) + (strobe ? 60 : 0)) * F;
  });
  if (dark) ledMat.color.setRGB(0.04, 0.04, 0.04);
  else ledMat.color.setHex(colours[step % colours.length]).multiplyScalar(0.45 + 0.55 * pulse);
  // the haze picks up whatever colour the rig is throwing
  haze.forEach((h, i) => {
    h.material.color.setHex(colours[(i + step) % colours.length]).multiplyScalar(dark ? 0 : (0.05 + 0.08 * energy + (strobe ? 0.08 : 0)) * F);
    h.position.x = Math.sin(t * 0.05 + i * 2) * 0.8;
  });
  // the giant C's double as blinders: they blast white on a hit, strobe on a drop, and stay glowing through a blackout
  const flick = ((beat * 4) % 1 + 1) % 1 < 0.5 ? 1 : 0.15;
  const want = !light.on || !light.fx.blinders ? 0 : hitOn ? 1 : cut ? 0.25 : drop ? 0.8 * flick : 0;
  auto.blind = want > auto.blind ? want : Math.max(want, auto.blind - dt * 3);
  updateCs(auto.blind);
  updateScreen(t, beat, pulse, colours, step, scrDark);
  updateLasers(t, beat, dark);
  updateCo2(dt, t);
}

// decides when the effects fire: CO2 on big drops, lasers at random on drops, breakdowns or locked to the kick
function autoFx(t, beat) {
  if (brain.lastDrop !== auto.drop) {
    auto.drop = brain.lastDrop;
    if (light.fx.co2) { light.sfx.co2 = t + SFX_LENGTH.co2; sfx.co2(); }
    sfx.drop();
    // sometimes the drop lands as a blinder hit: the rig blacks out and only the blinders blast the crowd
    if (light.fx.blinders && Math.random() < 0.35) auto.blindUntil = beat + 1.5;
    if (light.fx.laser && Math.random() < 0.6) { auto.laser = Math.random() < 0.5 ? 'drop' : 'cone'; auto.laserEnd = beat + 8 + 8 * Math.floor(Math.random() * 2); }
  }
  if (auto.laser && beat > auto.laserEnd) auto.laser = null;
  const phrase = Math.floor(beat / 16);
  if (phrase !== auto.phrase) {
    auto.phrase = phrase;
    if (light.fx.laser && !auto.laser && brain.playing) {
      const breakdown = brain.bassFast < 0.25;
      if (breakdown && Math.random() < 0.45) { auto.laser = Math.random() < 0.5 ? 'slow' : 'sheet'; auto.laserEnd = beat + 16; }
      else if (!breakdown && Math.random() < 0.18) { auto.laser = 'kick'; auto.laserEnd = beat + 8; }
    }
  }
  if (!light.fx.laser) auto.laser = null;
}

// ------------------------------------------------------------------ lasers
// Lasers are drawn as screen-space lines: a hair-thin bright core the same width all the way along, with a faint glow.
// Fan beams fire out of the logo circle over the crowd; a curtain of vertical beams drops just in front of the booth.
const LZ = { cx: 0, cy: 2.32, cz: 1.75, R: 1.95 }; // the logo circle behind the DJ
const FAN = 10, CURTAIN = 9, EXTRA = 40, LASER_COLS = [0x3dff5a, 0x3dff5a, 0x3dff5a, 0x3d9bff];
const laser = { geo: null, core: null, glow: null, pos: new Float32Array((FAN + CURTAIN + EXTRA) * 6), col: new Float32Array((FAN + CURTAIN + EXTRA) * 6) };
function buildLasers() {
  const g = new THREE.Group();
  laser.geo = new LineSegmentsGeometry();
  laser.geo.setPositions(laser.pos); laser.geo.setColors(laser.col);
  const mat = (w, o) => new LineMaterial({ linewidth: w, vertexColors: true, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, worldUnits: false });
  laser.core = new LineSegments2(laser.geo, mat(1.6, 1)); laser.glow = new LineSegments2(laser.geo, mat(6, 0.14));
  laser.core.frustumCulled = laser.glow.frustumCulled = false;
  laser.core.visible = laser.glow.visible = false;
  g.add(laser.glow, laser.core);
  return g;
}
function laserRes(w, h) { for (const m of [laser.core, laser.glow]) if (m) m.material.resolution.set(w, h); }
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function updateLasers(t, beat, dark) {
  if (!laser.core) return;
  const mode = dark ? null : auto.laser;
  laser.core.visible = laser.glow.visible = !!mode;
  if (!mode) return;
  const P = laser.pos, C = laser.col, c = new THREE.Color();
  const hit = Math.pow(1 - (((beat % 1) + 1) % 1), 3);
  let k = 0;
  // each beam is brightest at the source and thins out into the haze towards the far end
  const seg = (a, b, col, lvl, fade = 0.2) => { a.toArray(P, k * 6); b.toArray(P, k * 6 + 3); c.setHex(col).multiplyScalar(lvl * (light.adFade ?? 1)); c.toArray(C, k * 6); c.multiplyScalar(fade).toArray(C, k * 6 + 3); k++; };
  const sheetMode = mode === 'sheet', coneMode = mode === 'cone';
  // fan: emitters spaced round the circle, firing horizontally out over the crowd towards the back wall
  for (let i = 0; i < FAN; i++) {
    if (sheetMode || coneMode) { seg(_a.set(0, 0, 0), _a, 0, 0); continue; }
    const f = i / (FAN - 1) - 0.5, ang = Math.PI * 0.15 + (i / (FAN - 1)) * Math.PI * 0.7; // across the top of the circle
    _a.set(LZ.cx + Math.cos(ang) * LZ.R * (i % 2 ? 1 : -1) * 0.98, LZ.cy + Math.sin(ang) * LZ.R * 0.98, LZ.cz - 0.1);
    let yaw, pitch, lvl;
    if (mode === 'slow') { yaw = f * 0.7 + Math.sin(t * 0.35 + f * 2) * 0.25; pitch = -0.04 - 0.04 * Math.sin(t * 0.25 + i); lvl = 0.7; }
    else if (mode === 'kick') { yaw = f * (0.25 + 0.6 * hit); pitch = -0.03 - 0.05 * hit; lvl = 0.25 + 0.75 * hit; }
    else { yaw = f * 0.9 + Math.sin(t * 2.4 + f * 3) * 0.35; pitch = -0.02 - 0.1 * Math.abs(Math.sin(t * 1.8 + i * 0.5)); lvl = 1; }
    _b.set(Math.sin(yaw), Math.sin(pitch), -Math.cos(yaw)).normalize().multiplyScalar(17).add(_a);
    seg(_a, _b, LASER_COLS[i % LASER_COLS.length], lvl);
  }
  // curtain: vertical beams from the ceiling to the floor just in front of the booth, chasing across on the beat
  for (let i = 0; i < CURTAIN; i++) {
    const x = -1.6 + (i / (CURTAIN - 1)) * 3.2, z = BOOTH.tableZ - 0.85;
    const n = Math.floor(beat), last = CURTAIN - 1;
    let chase = mode === 'slow' ? 0.4 + 0.4 * Math.sin(t * 1.2 - i * 0.6) : mode === 'kick' ? hit : 0.5 + 0.5 * Math.sin(beat * Math.PI * 2 - i * 0.9);
    // when the moving heads are chasing, the curtain joins in: one beam at a time, back and forth, or alternating
    if (look.name === 'chase') chase = n % CURTAIN === i ? 1 : 0;
    else if (look.name === 'pingpong') { const p = n % (2 * last); chase = (p <= last ? p : 2 * last - p) === i ? 1 : 0; }
    else if (look.name === 'pairs') chase = n % 2 === i % 2 ? 0.8 * (0.4 + 0.6 * hit) : 0;
    const sway = mode === 'drop' ? Math.sin(t * 3 + i) * 0.15 : 0;
    _a.set(x, TRUSS_Y - 0.1, z); _b.set(x + sway, 0.02, z);
    seg(_a, _b, i % 3 === 1 ? 0x3d9bff : 0x3dff5a, Math.max(0, chase), 0.55);
  }
  // sheet: one emitter at the top of the circle sweeps a flat plane of light over the crowd's heads
  // cone: a ring of beams from the centre of the circle spins into a tunnel pointing at the crowd
  for (let i = 0; i < EXTRA; i++) {
    if (sheetMode) {
      const f = i / (EXTRA - 1) - 0.5, pitch = -0.06 - 0.05 * Math.sin(t * 0.4);
      _a.set(LZ.cx, LZ.cy + LZ.R - 0.1, LZ.cz - 0.15);
      _b.set(Math.sin(f * 1.5), Math.sin(pitch), -Math.cos(f * 1.5)).normalize().multiplyScalar(17).add(_a);
      seg(_a, _b, 0x3dff5a, 0.32, 0.15);
    } else if (coneMode) {
      const ang = (i / EXTRA) * Math.PI * 2 + t * 1.6, spread = 0.11 + 0.03 * hit;
      _a.set(LZ.cx, LZ.cy, LZ.cz - 0.15);
      _b.set(Math.cos(ang) * spread, Math.sin(ang) * spread - 0.05, -1).normalize().multiplyScalar(17).add(_a);
      seg(_a, _b, i % 4 === 0 ? 0x3d9bff : 0x3dff5a, 0.45 + 0.4 * hit, 0.18);
    } else seg(_a.set(0, 0, 0), _a, 0, 0);
  }
  laser.geo.setPositions(P); laser.geo.setColors(C);
}

// ------------------------------------------------------------------ haze
const haze = [];
function buildHaze() {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  for (let i = 0; i < 60; i++) {
    const px = Math.random() * 256, py = Math.random() * 256, r = 30 + Math.random() * 70;
    const gr = x.createRadialGradient(px, py, 0, px, py, r);
    gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(cv);
  for (const z of [-2, -4.5, -7.5]) {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), m); p.position.set(0, 2, z);
    g.add(p); haze.push(p);
  }
  return g;
}

// ------------------------------------------------------------------ room lights
// the wall lamps and bar glow are baked into the splat; they are kept dim so the rig stands out
let roomLights = null; // { mesh, idx: Uint32Array, cols: Float32Array }
function findRoomLights(mesh) {
  const ps = mesh.packedSplats, idx = [], cols = [];
  ps.forEachSplat((i, c, s, q, o, col) => {
    const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
    const wall = Math.abs(c.x) > 1.2 && c.y > 0.05;
    const bar = Math.abs(c.x) < 0.55 && c.z < -1.75 && c.y > -0.35 && c.y < 0.55;
    if ((wall || bar) && lum > 0.45) { idx.push(i); cols.push(col.r, col.g, col.b); }
  });
  roomLights = { mesh, idx: Uint32Array.from(idx), cols: Float32Array.from(cols) };
  setRoom(light.room);
}
function setRoom(f) {
  light.room = f;
  if (!roomLights) return;
  const ps = roomLights.mesh.packedSplats, col = new THREE.Color();
  roomLights.idx.forEach((i, n) => {
    const s = ps.getSplat(i);
    col.setRGB(roomLights.cols[n * 3] * f, roomLights.cols[n * 3 + 1] * f, roomLights.cols[n * 3 + 2] * f);
    ps.setSplat(i, s.center, s.scales, s.quaternion, s.opacity, col);
  });
  ps.needsUpdate = true;
}

// ------------------------------------------------------------------ CO2 cannons
// two jets in the top corners spray down and in, then the cloud drifts and fades
const CO2_MAX = 2600;
const co2 = { pts: null, pos: null, vel: null, life: null, max: null, size: null, alpha: null };
// two cannons on the front edge of the stage, either side of the booth, blasting up and out over the front of the crowd
const NOZZLES = [
  { p: new THREE.Vector3(-1.45, 0.95, -1.15), d: new THREE.Vector3(0.15, 0.55, -0.82).normalize() },
  { p: new THREE.Vector3(1.45, 0.95, -1.15), d: new THREE.Vector3(-0.15, 0.55, -0.82).normalize() },
];
// a soft cloudy puff (layered blobs, not a hard disc) so the jet reads as gas
function smokeTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  for (let k = 0; k < 26; k++) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * 28, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, rad = 18 + Math.random() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(cv);
}
// CO2 is drawn as soft fog puffs: tight and dense at the nozzle, billowing wider and fading as the jet slows and sinks
function buildCo2() {
  const g = new THREE.BufferGeometry();
  co2.pos = new Float32Array(CO2_MAX * 3); co2.vel = new Float32Array(CO2_MAX * 3);
  co2.life = new Float32Array(CO2_MAX); co2.max = new Float32Array(CO2_MAX).fill(1);
  co2.size = new Float32Array(CO2_MAX); co2.alpha = new Float32Array(CO2_MAX);
  g.setAttribute('position', new THREE.BufferAttribute(co2.pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(co2.size, 1));
  g.setAttribute('alpha', new THREE.BufferAttribute(co2.alpha, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: 'attribute float size; attribute float alpha; varying float va; uniform float scale; void main(){ va = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    uniforms: { scale: { value: 600 }, map: { value: smokeTexture() } },
    fragmentShader: 'uniform sampler2D map; varying float va; void main(){ vec4 c = texture2D(map, gl_PointCoord); if (c.a < 0.01) discard; gl_FragColor = vec4(vec3(0.78, 0.8, 0.84), c.a * va); }',
    transparent: true, depthWrite: false,
  });
  co2.pts = new THREE.Points(g, m); co2.pts.frustumCulled = false;
  const grp = new THREE.Group(); grp.add(co2.pts);
  // the cannons themselves: short black barrels angled up and out
  const barrel = new THREE.CylinderGeometry(0.07, 0.09, 0.42, 16), mat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4, metalness: 0.7 });
  for (const n of NOZZLES) { const c = new THREE.Mesh(barrel, mat); c.position.copy(n.p).addScaledVector(n.d, -0.2); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.d); grp.add(c); }
  return grp;
}
function updateCo2(dt, t) {
  if (!co2.pts) return;
  co2.pts.material.uniforms.scale.value = (renderer ? renderer.domElement.height : 600) * 0.9;
  const firing = (light.sfx.co2 || 0) > t;
  let spawn = firing ? Math.round(dt * 600) : 0;
  const drag = Math.exp(-2.8 * dt);
  for (let i = 0; i < CO2_MAX; i++) {
    const j = i * 3;
    if (co2.life[i] <= 0) {
      if (spawn <= 0) { co2.alpha[i] = 0; continue; }
      spawn--;
      const n = NOZZLES[i % 2], sp = rnd(10, 14);
      co2.pos[j] = n.p.x; co2.pos[j + 1] = n.p.y; co2.pos[j + 2] = n.p.z;
      co2.vel[j] = (n.d.x + rnd(-0.07, 0.07)) * sp; co2.vel[j + 1] = (n.d.y + rnd(-0.07, 0.07)) * sp; co2.vel[j + 2] = (n.d.z + rnd(-0.07, 0.07)) * sp;
      co2.life[i] = co2.max[i] = rnd(2.2, 3.4);
    }
    co2.life[i] -= dt;
    if (co2.life[i] <= 0) { co2.alpha[i] = 0; continue; }
    const age = 1 - co2.life[i] / co2.max[i]; // 0 at the nozzle, 1 when it's gone
    // slows down fast, churns, and the cold gas sinks
    co2.vel[j] = co2.vel[j] * drag + rnd(-1, 1) * 2.2 * dt;
    co2.vel[j + 1] = co2.vel[j + 1] * drag + rnd(-1, 1) * 1.2 * dt - 1.1 * dt; // cold gas sinks back down onto the crowd
    co2.vel[j + 2] = co2.vel[j + 2] * drag + rnd(-1, 1) * 2.2 * dt;
    co2.pos[j] += co2.vel[j] * dt; co2.pos[j + 1] = Math.max(0.1, co2.pos[j + 1] + co2.vel[j + 1] * dt); co2.pos[j + 2] += co2.vel[j + 2] * dt;
    co2.size[i] = Math.min(1.3, 0.18 + 1.4 * Math.pow(age, 0.6));
    co2.alpha[i] = Math.min(1, age * 10) * Math.pow(1 - age, 1.2) * 0.32 * (light.adFade ?? 1);
  }
  for (const k of ['position', 'size', 'alpha']) co2.pts.geometry.attributes[k].needsUpdate = true;
}

// ------------------------------------------------------------------ sounds
// Crowd and effects are synthesised (no sample files): a murmur bed that rises with the hype, cheers and whistles,
// boos, and the hiss of the CO2. They play on their own audio context so the crowd's ears never hear them.
const sfx = (() => {
  let ac = null, out = null, noise = null, bed = null, on = true, vol = 0.5, duckV = 1;
  const samples = [], voices = {};
  let co2Buf = null, murmurBuf = null, whistleBuf = null;
  const last = {};
  const ready = () => {
    if (!on) return false;
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return false; }
      out = ac.createGain(); out.gain.value = on ? vol : 0; out.connect(ac.destination);
      // a little room reverb on every crowd sound so it sits in the club rather than on top of it
      const len = Math.floor(ac.sampleRate * 1.8), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < ac.sampleRate * 0.012 ? i / (ac.sampleRate * 0.012) : 1); }
      const verb = ac.createConvolver(), wet = ac.createGain(), tone = ac.createBiquadFilter();
      const pre = ac.createDelay(0.2), body = ac.createBiquadFilter();
      verb.buffer = ir; wet.gain.value = 0.34;
      pre.delayTime.value = 0.026;                 // the room answers a moment after the sound, which reads as distance
      body.type = 'highpass'; body.frequency.value = 260;  // keep the tail out of the bass, so the music stays clear
      tone.type = 'lowpass'; tone.frequency.value = 4200;  // darker than the source, like a real room
      out.connect(pre).connect(body).connect(verb).connect(tone).connect(wet).connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // recorded crowd cheers for the drops
      fetch(MURMUR).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((buf) => { murmurBuf = buf; }).catch(() => {});
      fetch('sounds/whistle.m4a').then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((buf) => { whistleBuf = buf; }).catch(() => {});
      for (const [k, list] of Object.entries(VOICES)) {
        voices[k] = [];
        for (const u of list) fetch(u).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((buf) => voices[k].push(buf)).catch(() => {});
      }
      fetch(CO2_SOUND).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((buf) => { co2Buf = buf; }).catch(() => {});
      for (const u of DROP_CHEERS) fetch(u).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((buf) => samples.push(buf)).catch(() => {});
    }
    if (ac.state === 'suspended') ac.resume();
    return ac.state !== 'closed';
  };
  // somewhere left or right in the room; every one-shot gets a place rather than sitting dead centre
  const place = (pan) => { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(out); return p; };
  const rndPan = (w = 0.8) => (Math.random() * 2 - 1) * w;
  const src = () => { const n = ac.createBufferSource(); n.buffer = noise; n.loop = true; n.playbackRate.value = 0.8 + Math.random() * 0.4; return n; };
  const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); };
  const throttle = (k, gap) => { const n = performance.now(); if (n - (last[k] || 0) < gap) return false; last[k] = n; return true; };
  // a crowd shout: band-passed noise swell plus a handful of voices gliding up ("woo")
  function cheer(size = 1) {
    if (!ready()) return;
    const t = ac.currentTime + 0.02;
    for (const side of [-1, 1]) { // two separate swells, one each side, so the shout has width
      const n = src(), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1000 + Math.random() * 260; bp.Q.value = 0.6;
      n.connect(bp).connect(g).connect(place(side * (0.55 + Math.random() * 0.25)));
      env(g, t, 0.18, 0.1 * size, 0.5 * size, 1.4); n.start(t); n.stop(t + 3 * size);
    }
    for (let i = 0; i < 4 + 4 * size; i++) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), v = ac.createGain(), s0 = t + Math.random() * 0.4;
      o.type = 'sawtooth'; const base = 220 + Math.random() * 260;
      o.frequency.setValueAtTime(base, s0); o.frequency.exponentialRampToValueAtTime(base * (1.4 + Math.random() * 0.4), s0 + 0.35);
      f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 4;
      o.connect(f).connect(v).connect(place(rndPan(0.92))); env(v, s0, 0.06, 0.022, 0.25, 0.5); o.start(s0); o.stop(s0 + 1.2);
    }
  }
  function whistle() {
    if (!ready()) return;
    if (whistleBuf) { // the recorded celebration whistle, a touch late and slightly varied in pitch
      // like a real whistler: a single blast, a quick double, three fast ones in a second, or three spread out.
      // Each blast is cut short by the next; only the last one rings out in full.
      const gaps = pick([[0], [0, 0.4], [0, 0.33, 0.66], [0, 0.8, 1.6]]);
      const t0 = ac.currentTime + 0.15 + Math.random() * 0.3, rate = 0.96 + Math.random() * 0.08, wp = rndPan(0.75);
      gaps.forEach((gap, k) => {
        const b = ac.createBufferSource(), g = ac.createGain(), t = t0 + gap;
        b.buffer = whistleBuf; b.playbackRate.value = rate;
        b.connect(g).connect(place(wp)); g.gain.setValueAtTime(0.26, t);
        const next = gaps[k + 1];
        b.start(t);
        if (next != null) { const end = t0 + next; g.gain.setValueAtTime(0.26, end - 0.04); g.gain.linearRampToValueAtTime(0, end); b.stop(end + 0.01); }
      });
      return;
    }
    for (let k = 0; k < 2; k++) {
      const t = ac.currentTime + 0.1 + k * 0.45 + Math.random() * 0.1, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(2300, t); o.frequency.linearRampToValueAtTime(3300, t + 0.12); o.frequency.linearRampToValueAtTime(2700, t + 0.32);
      o.connect(g).connect(place(rndPan(0.7))); env(g, t, 0.02, 0.03, 0.22, 0.12); o.start(t); o.stop(t + 0.5);
    }
  }
  // one voice from the crowd: slightly varied pitch, somewhere left or right in the room
  function voice(kind, delay = 0, maxLen = 3) {
    const list = voices[kind]; if (!ready() || !list || !list.length) return false;
    const t = ac.currentTime + 0.02 + delay, b = ac.createBufferSource(), g = ac.createGain(), pan = ac.createStereoPanner();
    b.buffer = list[Math.floor(Math.random() * list.length)]; b.playbackRate.value = 0.94 + Math.random() * 0.12;
    pan.pan.value = rndPan(0.85);
    b.connect(g).connect(pan).connect(out);
    const len = Math.min(b.buffer.duration, maxLen);
    g.gain.setValueAtTime(0.34, t); g.gain.setValueAtTime(0.34, t + len - 0.3); g.gain.linearRampToValueAtTime(0, t + len);
    b.start(t); b.stop(t + len + 0.05);
    return true;
  }
  // a servo: a short whirring pitch-sweep, for the robot's snapping moves
  function servo() {
    if (!ready()) return;
    const t = ac.currentTime + 0.01, o = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain(), f = 380 + Math.random() * 180;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.7, t + 0.09); o.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.14);
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 3;
    o.connect(bp).connect(g).connect(place(rndPan(0.6))); env(g, t, 0.01, 0.018, 0.08, 0.06); o.start(t); o.stop(t + 0.2);
  }
  function boo() {
    if (!ready()) return;
    const t = ac.currentTime + 0.02;
    for (let i = 0; i < 6; i++) {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), v = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = 105 + Math.random() * 60;
      lfo.frequency.value = 4 + Math.random() * 2; lg.gain.value = 4; lfo.connect(lg).connect(o.frequency);
      lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 2;
      const s0 = t + Math.random() * 0.25;
      o.connect(lp).connect(v).connect(place(rndPan(0.85))); env(v, s0, 0.15, 0.026, 0.6, 0.6); o.start(s0); lfo.start(s0); o.stop(s0 + 1.6); lfo.stop(s0 + 1.6);
    }
  }
  function co2() {
    if (!ready()) return;
    const t = ac.currentTime + 0.02;
    if (co2Buf) { // the recorded blast from each cannon: one either side of the stage, a hair apart
      for (const side of [-1, 1]) {
        const b = ac.createBufferSource(), g = ac.createGain(), t0 = t + (side < 0 ? 0 : 0.018);
        b.buffer = co2Buf; b.playbackRate.value = side < 0 ? 1 : 0.99;
        b.connect(g).connect(place(side * 0.72));
        env(g, t0, 0.02, 0.17, SFX_LENGTH.co2 - 0.6, 0.6); b.start(t0); b.stop(t0 + SFX_LENGTH.co2 + 0.2);
      }
      return;
    }
    for (const side of [-1, 1]) {
      const n = src(), hp = ac.createBiquadFilter(), g = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1800;
      n.connect(hp).connect(g).connect(place(side * 0.72));
      env(g, t, 0.04, 0.1, SFX_LENGTH.co2 - 0.6, 0.6); n.start(t); n.stop(t + SFX_LENGTH.co2 + 0.2);
    }
  }
  return {
    react(clip) {
      if ((clip === 'cheer' || clip === 'hype') && throttle('cheer', 1500)) cheer(clip === 'hype' ? 0.6 : 1);
      else if (clip === 'boo' && throttle('boo', 2200)) boo();
    },
    drop() {
      if (!throttle('drop', 4000) || !ready()) return;
      whistle();
      if (Math.random() < 0.6) voice('letsgo', 0.2 + Math.random() * 0.4);
      if (!samples.length) { cheer(1.6); return; }
      // the first few seconds of a recorded cheer, faded out
      const t = ac.currentTime + 0.02, n = ac.createBufferSource(), g = ac.createGain();
      n.buffer = samples[Math.floor(Math.random() * samples.length)];
      n.connect(g).connect(out); env(g, t, 0.15, 0.5, 4.5, 2.5); n.start(t); n.stop(t + 7.5);
    },
    unlock() { ready(); },
    co2,
    servo() { if (throttle('servo', 180)) servo(); },
    // the room murmur: quiet while waiting, louder and brighter as the crowd gets into it
    bed(playing, hype) {
      if (!ac || !on) return;
      // as the crowd turns: first someone gets fed up and shouts 'come on' (restless), then boos once it's really bad
      if (hype < 18) { if (Math.random() < 0.004 && throttle('angry', 12000)) voice('boo', 0, 3); }
      else if (hype < 38 && Math.random() < 0.003 && throttle('angry', 14000)) voice('comeon', 0, 3);
      if (!bed || (murmurBuf && !bed.real)) {
        if (bed) bed.n.stop();
        // the recorded murmur once it has loaded, filtered noise until then
        const n = murmurBuf ? ac.createBufferSource() : src(), bp = ac.createBiquadFilter(), g = ac.createGain();
        if (murmurBuf) { n.buffer = murmurBuf; n.loop = true; bp.type = 'lowpass'; bp.frequency.value = 6000; }
        else { bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.5; }
        g.gain.value = 0;
        const wide = ac.createDelay(0.05); wide.delayTime.value = 0.013; // a few milliseconds apart reads as a wide room
        n.connect(bp).connect(g);
        g.connect(place(-0.62));
        g.connect(wide).connect(place(0.62));
        n.start(0, murmurBuf ? Math.random() * murmurBuf.duration : 0); bed = { n, g, bp, real: !!murmurBuf };
      }
      // chatter fills the room while waiting; under the music it ducks right down and rises with the hype
      const level = bed.real ? (playing ? 0.05 + 0.12 * hype / 100 : 0.35) : (playing ? 0.015 + 0.05 * hype / 100 : 0.012);
      bed.g.gain.setTargetAtTime(level, ac.currentTime, 0.8);
      if (!bed.real) bed.bp.frequency.setTargetAtTime(600 + 500 * hype / 100, ac.currentTime, 1);
    },
    set on(v) { on = v; if (out) out.gain.setTargetAtTime(v ? vol * duckV : 0, ac.currentTime, 0.1); },
    duck(v) { duckV = v; if (out) out.gain.setTargetAtTime(on ? vol * v : 0, ac.currentTime, 0.1); },
    set volume(v) { vol = v * 0.7; if (out && on) out.gain.setTargetAtTime(vol * duckV, ac.currentTime, 0.05); },
    get volume() { return vol / 0.7; },
    get on() { return on; },
  };
})();
// browsers only allow sound after a click or tap
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

function setLight(on) {
  light.on = on;
  syncLightMenu();
}

// lights, effects and sound live in the SETTINGS menu next to LIBRARY
const SPEAKER_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
const lightMenu = document.getElementById('lightmenu');
function syncLightMenu() {
  if (!lightMenu) return;
  lightMenu.querySelector('[data-lm=power]').classList.toggle('on', light.on);
  lightMenu.querySelector('[data-lm=power]').textContent = light.on ? 'ON' : 'OFF';
  lightMenu.querySelectorAll('[data-col]').forEach((b) => b.classList.toggle('on', light.colours[+b.dataset.col]));
  lightMenu.querySelector('[data-lm=all]').classList.toggle('on', light.colours.every(Boolean));
  lightMenu.querySelectorAll('[data-fx]').forEach((b) => b.classList.toggle('on', light.fx[b.dataset.fx]));
  const m = lightMenu.querySelector('[data-lm=mute]'); m.classList.toggle('muted', !sfx.on);
  m.innerHTML = sfx.on ? SPEAKER_ON : SPEAKER_OFF; m.title = sfx.on ? 'Mute crowd sound' : 'Unmute crowd sound';
}
if (lightMenu) {
  lightMenu.querySelector('.swatches').insertAdjacentHTML('afterbegin', PALETTE.map((c, i) => `<button data-col="${i}" style="--c:#${c.toString(16).padStart(6, '0')}" title="Colour ${i + 1}"></button>`).join(''));
  const btn = document.querySelector('#tabs [data-act=lights]');
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); lightMenu.hidden = !lightMenu.hidden; btn.classList.toggle('on', !lightMenu.hidden); });
  document.addEventListener('pointerdown', (e) => { if (!lightMenu.hidden && !e.target.closest('#lightmenu, [data-act=lights]')) { lightMenu.hidden = true; if (btn) btn.classList.remove('on'); } });
  lightMenu.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lm === 'power') setLight(!light.on);
    else if (b.dataset.lm === 'all') { const all = light.colours.every(Boolean); light.colours.fill(!all); if (all) light.colours[0] = true; }
    else if (b.dataset.col) {
      const i = +b.dataset.col;
      light.colours[i] = !light.colours[i];
      if (!light.colours.some(Boolean)) light.colours[i] = true; // always keep at least one colour
    } else if (b.dataset.fx) light.fx[b.dataset.fx] = !light.fx[b.dataset.fx];
    else if (b.dataset.lm === 'mute') sfx.on = !sfx.on;
    syncLightMenu();
  });
  lightMenu.querySelector('#lightIntensity').addEventListener('input', (e) => { light.intensity = e.target.value / 100; });
  const vol = lightMenu.querySelector('#crowdVol');
  try { const v = localStorage.getItem('cc-crowd-vol'); if (v != null) vol.value = v; } catch (_) {}
  sfx.volume = vol.value / 100;
  vol.addEventListener('input', () => { sfx.volume = vol.value / 100; if (!sfx.on && vol.value > 0) { sfx.on = true; syncLightMenu(); } try { localStorage.setItem('cc-crowd-vol', vol.value); } catch (_) {} });
  syncLightMenu();
}

// ------------------------------------------------------------------ online room
// The backend loads on demand, so the crowd and mixer still work if Supabase is down.
let room = null; // { name, author, backend, lastPush, unsub }
// roomName: the room to publish to and chat in. author: the signed-in user's profile username.
async function connectRoom(roomName, author) {
  const backend = await import('./backend.js').catch((e) => { console.warn('backend unavailable', e); return null; });
  if (!backend || !backend.supabase) return false;
  await backend.ensureSession();
  if (room) room.unsub();
  room = { name: roomName, author, backend, lastPush: -99, unsub: () => {} }; // chat itself lives in chat.js
  return true;
}

function pushRoomState(t) {
  if (!room || t - room.lastPush < 2) return;
  room.lastPush = t;
  room.backend.publishRoomState(room.name, { state: 'LIVE-PUBLIC', hype: brain.hype, mood: brain.mood })
    .catch((e) => console.warn('room state not saved', e));
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
  lights(t, dt);
  sfx.bed(brain.playing, brain.hype);
  if (window.__adFrame) window.__adFrame(camera, dt, t);
  composer.render();
  updateDj(dt, t);
  // two-sided meter: grows left from the middle when angry, right when happy
  const hv = brain.hype;
  hudBar.style.left = Math.min(hv, 50) + '%';
  hudBar.style.width = Math.abs(hv - 50) + '%';
  hudBar.className = hv < 50 ? 'bad' : 'good';
  if (hudMood.textContent !== brain.mood) hudMood.textContent = brain.mood;
}

async function loadDj() {
  const src = await new GLTFLoader().loadAsync('models/dj.glb');
  const root = src.scene;
  root.rotation.y = Math.PI; // facing the crowd, back to the camera
  root.scale.setScalar(0.9); // about 1.7 m
  root.position.set(0, BOOTH.riser, 0);
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  djRenderer = new THREE.WebGLRenderer({ canvas: djCanvas, alpha: true, antialias: true });
  djRenderer.outputColorSpace = THREE.SRGBColorSpace; djRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  djScene = new THREE.Scene();
  djScene.add(new THREE.HemisphereLight(0x2a2f45, 0x050508, 0.6));
  const front = new THREE.DirectionalLight(0x8a96c8, 0.7); front.position.set(0, 3, 4); djScene.add(front);
  const spot = new THREE.SpotLight(0xffd6b0, 14, 5, 0.6, 0.6, 1.4); spot.position.set(0, 3.6, 0.6); spot.target.position.set(0, 1, -0.2); djScene.add(spot, spot.target);
  const rim = new THREE.DirectionalLight(0xff4fa3, 1.2); rim.position.set(0, 3, -4); djScene.add(rim);
  djScene.add(root);
  resize();
  setTimeout(() => setCamView(camView));
  const mixer = new THREE.AnimationMixer(root), actions = {};
  for (const clip of src.animations) actions[clip.name] = mixer.clipAction(clip);
  for (const n of ['wave', 'hype', 'kiss']) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce); actions[n].clampWhenFinished = true; }
  dj = { root, mixer, actions, now: null, busy: false, next: 8, drop: brain.lastDrop };
  mixer.addEventListener('finished', (e) => {
    const back = brain.playing ? 'play' : 'idle';
    e.action.crossFadeTo(actions[back].reset().setEffectiveWeight(1).play(), 0.4, false);
    dj.now = back; dj.busy = false;
  });
  aimCamera();
}
function djPlay(name, fade = 0.35) {
  const next = dj.actions[name]; if (!next) return;
  next.reset().setEffectiveWeight(1).play();
  if (dj.now && dj.now !== name) dj.actions[dj.now].crossFadeTo(next, fade, false);
  dj.now = name;
}
// she works the decks, and every so often waves or hypes the crowd, or turns round and blows a kiss to the camera
function updateDj(dt, t) {
  if (!dj) return;
  if (!dj.busy) {
    if (brain.lastDrop !== dj.drop) { dj.drop = brain.lastDrop; dj.busy = true; djPlay('hype'); }
    else if (brain.playing && t > dj.next) {
      dj.next = t + rnd(12, 25);
      const r = Math.random();
      const move = r < 0.5 ? 'wave' : r < 0.78 ? 'hype' : 'kiss';
      if (move === 'kiss') dj.kissAt = t + 1.4; // the crowd reacts once she's turned round
      dj.busy = true; djPlay(move);
    } else {
      const want = brain.playing ? 'play' : 'idle';
      if (dj.now !== want) djPlay(want, 0.5);
    }
  }
  dj.mixer.update(dt);
  if (camView !== 'crowd') djRenderer.render(djScene, camera);
}

async function start() {
  if (started) return;
  started = true;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  clock = new THREE.Clock();
  buildScene();
  // bloom: the brightest things (lasers, neon C's, the screen, blinders, lenses) bleed light like they do through real haze
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const fxPass = new RenderPass(fx, camera); fxPass.clear = false; fxPass.clearDepth = false; composer.addPass(fxPass);
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.86); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  resize();
  try { await loadCrowd(); await loadDj(); resize(); loadMsg.hidden = true; }
  catch (e) { console.warn('crowd failed to load', e); loadMsg.textContent = 'The crowd could not load. Check your connection and reopen CLUB.'; }
}

window.addEventListener('cc-view', (e) => {
  mode = e.detail.mode;
  placeDecks();
  djCanvas.hidden = mode === 'off';
  if (mode === 'off') { running = false; return; }
  start().then(() => { resize(); if (!running) { running = true; clock.getDelta(); frame(); } });
  requestAnimationFrame(() => renderer && resize());
});
window.addEventListener('resize', () => { if (renderer && mode !== 'off') resize(); });
window.__club = { setVeil, get scene() { return scene; }, get clock() { return clock; }, co2: () => { light.sfx.co2 = clock.elapsedTime + SFX_LENGTH.co2; sfx.co2(); }, get camera() { return camera; }, get ready() { return !!dj; }, BACKDROP: { y: 2.32, z: 1.75, r: 2.08 }, look, screen, auto, sfx, chat: (i) => chat(people[i], clock.elapsedTime), hold: (i, c, s) => holdFor(people[i], c, s), tick: (dt, t) => { think(dt, t); updatePeople(dt); updateFlying(dt); updateTexts(dt); }, brain, people, light, setLight, connectRoom, react: (i, c) => react(people[i], c, ['TEST'], true), throwAt };
