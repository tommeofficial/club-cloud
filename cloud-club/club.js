// Club Cloud: the club seen from the DJ booth, with a crowd that reacts to the music and the mixing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { cTubeGeometry } from './logo3d.js?v=1';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SplatMesh, SplatEdit, SplatEditSdf, SplatEditSdfType, SplatEditRgbaBlendMode } from '@sparkjsdev/spark';
import { screenMaterial, ledCopyMaterial } from './screen.js?v=9';
import { createBeatTracker } from './beattrack.js?v=4';

const el = document.getElementById('club');
const canvas = document.getElementById('clubcv');
const hudBar = document.querySelector('#clubhud .bar i');
const hudMood = document.querySelector('#clubhud .mood');
const loadMsg = document.getElementById('clubload');
const splash = document.getElementById('splash');

const MODELS = ['models/crowd_ava.glb', 'models/crowd_leo.glb', 'models/crowd_kai.glb'];
// a scanned, rigged dancer who takes one spot at the front of the crowd
// scanned, rigged people who take spots at the front; they have the full set of moves
const FEATURED_SCANNED = [{ model: 'models/crowd_mia.glb', sex: 'f', spot: 1, scale: 0.92, style: 'social' }, { model: 'models/crowd_leon.glb', sex: 'm', spot: 2, scale: 0.94, style: 'chill' }, { model: 'models/crowd_skye.glb', sex: 'f', spot: 3, scale: 0.92, style: 'raver' }, { model: 'models/crowd_lola.glb', sex: 'f', spot: 4, scale: 0.92, style: 'social' }, { model: 'models/crowd_nova.glb', sex: 'f', spot: 0, scale: 0.9, style: 'filmer' }, { model: 'models/crowd_jay.glb', sex: 'm', spot: 5, scale: 0.94, style: 'raver' }, { model: 'models/crowd_781269e6.glb', sex: 'm', spot: 6, scale: 0.93, style: 'raver' }, { model: 'models/crowd_white_mixamo.glb', sex: 'm', spot: 7, scale: 0.94, style: 'social' }, { model: 'models/crowd_34cb054a.glb', sex: 'f', spot: 9, scale: 0.9, style: 'chill' }, { model: 'models/dj.glb', sex: 'f', spot: 8, scale: 0.9, style: 'raver', rename: { play: 'dance4', idle: 'idle', hype: 'hype', wave: 'handsup', kiss: 'clap' } }];
// friends stand together and turn to each other to talk, hug and high-five
// the built characters (free MPFB bodies, 5 outfits each in several colours). They share one set of moves with the scanned crowd (the same skeleton), so they carry no animation of their own.
const BUILT = [
  { model: 'models/crowd_g01.glb?v=2', sex: 'f', spot: 10, scale: 1, style: 'raver', shared: true, hip: 1.0 },
  { model: 'models/crowd_b01.glb?v=2', sex: 'm', spot: 11, scale: 1, style: 'chill', shared: true, hip: 1.1658 },
  { model: 'models/crowd_g02.glb?v=2', sex: 'f', spot: 12, scale: 1, style: 'social', shared: true, hip: 0.9719 },
  { model: 'models/crowd_b02.glb?v=2', sex: 'm', spot: 13, scale: 1, style: 'raver', shared: true, hip: 1.0952 },
  { model: 'models/crowd_g03.glb?v=2', sex: 'f', spot: 14, scale: 1, style: 'chill', shared: true, hip: 0.972 },
  { model: 'models/crowd_b03.glb?v=2', sex: 'm', spot: 15, scale: 1, style: 'social', shared: true, hip: 1.1771 },
  { model: 'models/crowd_g04.glb?v=2', sex: 'f', spot: 16, scale: 1, style: 'raver', shared: true, hip: 1.0051 },
  { model: 'models/crowd_b04.glb?v=2', sex: 'm', spot: 17, scale: 1, style: 'raver', shared: true, hip: 1.1545 },
  { model: 'models/crowd_g05.glb?v=2', sex: 'f', spot: 18, scale: 1, style: 'social', shared: true, hip: 1.0051 },
  { model: 'models/crowd_b05.glb?v=2', sex: 'm', spot: 19, scale: 1, style: 'social', shared: true, hip: 1.2047 },
  { model: 'models/crowd_g06.glb?v=2', sex: 'f', spot: 20, scale: 1, style: 'raver', shared: true, hip: 0.989 },
  { model: 'models/crowd_b06.glb?v=2', sex: 'm', spot: 21, scale: 1, style: 'chill', shared: true, hip: 1.1471 },
  { model: 'models/crowd_g07.glb?v=2', sex: 'f', spot: 22, scale: 1, style: 'social', shared: true, hip: 1.0314 },
  { model: 'models/crowd_b07.glb?v=2', sex: 'm', spot: 23, scale: 1, style: 'raver', shared: true, hip: 1.1828 },
  { model: 'models/crowd_g08.glb?v=2', sex: 'f', spot: 24, scale: 1, style: 'chill', shared: true, hip: 0.9719 },
  { model: 'models/crowd_b08.glb?v=2', sex: 'm', spot: 25, scale: 1, style: 'social', shared: true, hip: 1.1004 },
  { model: 'models/crowd_g09.glb?v=2', sex: 'f', spot: 26, scale: 1, style: 'raver', shared: true, hip: 0.9838 },
  { model: 'models/crowd_b09.glb?v=2', sex: 'm', spot: 27, scale: 1, style: 'raver', shared: true, hip: 1.1073 },
  { model: 'models/crowd_g10.glb?v=2', sex: 'f', spot: 28, scale: 1, style: 'social', shared: true, hip: 1.0796 },
  { model: 'models/crowd_b10.glb?v=2', sex: 'm', spot: 29, scale: 1, style: 'social', shared: true, hip: 1.1702 }
];
const LITE_EARLY = /[?&]lite\b/.test(location.search) || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const PX_CAP = +new URLSearchParams(location.search).get('px') || 1.75;   // ?px=1 renders at 1x (for capturing smooth footage)
const HOUSE = new URLSearchParams(location.search).get('house');   // ?house=<id>: the 24/7 Club Cloud room, where the robot is the DJ
const FEATURED = (LITE_EARLY ? FEATURED_SCANNED : FEATURED_SCANNED.concat(BUILT));
const FRIENDS = [[1, 2, 3, 4], [0, 5], [6, 8], [7, 9], [10, 11], [12, 13, 14], [15, 16], [17, 18], [19, 20], [21, 22, 23], [24, 25], [26, 27], [28, 29]]; // spot 0 and 5 are a pair
const STYLES = ['raver', 'chill', 'social', 'filmer'];
const DANCES = ['dance', 'dance2', 'dance3', 'dance4', 'dance5'];
const RESTS = ['idle', 'lookaround', 'talk']; // what people do between songs, so nobody stands in step
// the dance floor's repertoire. Measured from the mocap: dance4 and dance5 are the small, low two-step grooves (feet
// close and open, little arm), dance3 a shuffle, dance the wide hip-hop bounce, dance2 the big hip-swinging house move.
// The two-step is what most people do most of the time; the wide hip-hop is kept to the lads and the hip-swinging one to the girls.
const TIERS = {
  calm: { m: ['dance4', 'dance4', 'dance4', 'dance5'], f: ['dance4', 'dance4', 'dance4', 'dance5'] },
  mid:  { m: ['dance4', 'dance4', 'dance3', 'dance5'], f: ['dance4', 'dance4', 'dance3', 'dance2'] },
  high: { m: ['dance4', 'dance4', 'dance3', 'dance'], f: ['dance4', 'dance4', 'dance3', 'dance2'] },
};
const BEAT_LOOPS = new Set(['dance', 'dance2', 'dance3', 'dance4', 'dance5', 'hype']); // 2-beat clips locked to the music
// where the crowd stands (x, z) — the DJ looks down -Z from the booth at z = 0
// kept on the open floor: clear of the counter between the columns (z < -4.3) and the side tables (|x| > 2.2)
const SPOTS = [[-1.2, -2.6], [0.1, -2.4], [1.25, -2.7], [-0.55, -3.3], [0.7, -3.35], [-2.1, -4.4], [1.9, -4.6], [-0.9, -5.4], [0.8, -5.9], [-2.0, -6.0],
  // 20 more places for the new built characters (10 girls and 10 guys)
  [1.91, -3.64], [1.72, -5.92], [-0.13, -5.35], [0.19, -3.96], [-2.14, -2.7], [2.07, -2.69], [-2.14, -3.52], [-0.79, -4.35], [0.81, -2.16], [-1.77, -5.24], [1.21, -3.93], [0.71, -4.61], [-1.21, -3.48], [-1.32, -6.25], [-0.54, -6.25], [1.21, -5.36], [2.01, -5.28], [-1.4, -4.65], [-0.57, -2.22], [0.32, -6.39]];
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
const light = { on: true, colours: [true, true, true, true, true, true], intensity: 0.5, style: 'energetic', room: 0.45, fx: { laser: true, co2: true, blackout: true, blinders: true }, sfx: {} }; // sfx: name -> elapsed time it ends
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
// A listener of a live broadcast follows the DJ's own club: the DJ sends the beat clock and the light and effect state, so the lights, camera cuts,
// crowd and screen agree with the DJ's exactly. The listener's own beat tracker only measures the small network delay (when the kicks that arrive
// in the sound land against the DJ's clock), so the lights fall on the kicks the listener actually hears.
const remote = { on: false, p: null, rx: 0, line: null, off: 0, samples: 0, prevDrop: 1e9, co2: false };
const wrap = (x) => x - Math.round(x);
const lineBeat = (now) => remote.line.b + (now - remote.line.rx0) / 1000 * remote.p.bpm / 60;
const remoteBeat = (now = performance.now()) => lineBeat(now) + remote.off;
function applySync(p) {
  const now = performance.now(); remote.p = p; remote.rx = now;
  if (!remote.line || !remote.on) { remote.line = { b: p.beat, rx0: now }; remote.on = true; remote.samples = 0; remote.off = 0; remote.prevDrop = 1e9; return; }
  const pred = lineBeat(now), eps = p.beat - pred;
  remote.line = Math.abs(eps) > 0.4 ? { b: p.beat, rx0: now } : { b: pred + eps * 0.12, rx0: now }; // smooth out network jitter; jump if the DJ's clock leapt
}
function endSync() { remote.on = false; remote.line = null; }
const live = createBeatTracker();
live.hook = (now, at) => { // a kick has been heard: where did it land on the DJ's clock?
  if (!remote.on || !remote.line) return;
  const perf = performance.now() - (now - at) * 1000, e = Math.round(lineBeat(perf)) - lineBeat(perf);
  if (remote.samples === 0) remote.off = e;
  else { const d = wrap(e - remote.off); if (Math.abs(d) < 0.3) remote.off += d * 0.1; }
  remote.samples++;
}; // finds the tempo and keeps the beat for a mic / line-in, where there is no beat grid

async function useInput(deviceId) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  return useStream(stream, true);
}
// a stream from anywhere: a mic, or a DJ's live broadcast that this listener is hearing (owned: we may stop its tracks)
async function useStream(stream, owned = false) {
  stopInput();
  const ctx = new AudioContext(); ctx.resume().catch(() => {});
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.55;
  const src = ctx.createMediaStreamSource(stream); src.connect(analyser);
  let node = null; // kicks are found on the audio thread, where no sample can be skipped
  try {
    await ctx.audioWorklet.addModule('onset-worklet.js?v=3');
    node = new AudioWorkletNode(ctx, 'onset');
    node.port.onmessage = (e) => live.kickAt(ctx.currentTime, e.data.at);
    const mute = ctx.createGain(); mute.gain.value = 0; src.connect(node); node.connect(mute).connect(ctx.destination);
  } catch (e) { console.warn('worklet unavailable, timing kicks per frame', e); }
  Object.assign(ext, { owned, node, ctx, analyser, stream, bufT: new Float32Array(analyser.fftSize), specBuf: new Float32Array(analyser.frequencyBinCount) });
  live.reset();
  inputMode = true;
}

function stopInput() {
  if (ext.stream && ext.owned) ext.stream.getTracks().forEach((t) => t.stop());
  if (ext.ctx) ext.ctx.close();
  Object.assign(ext, { node: null, ctx: null, analyser: null, stream: null });
  live.reset();
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
  if (inputMode) { if (ext.node) live.advance(ext.ctx.currentTime); else live.updateWave(dt, t, ext.bufT, ext.ctx.sampleRate); } // kicks are timed from the raw samples
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
  if (peak > 0.02) brain.lastLoud = t;
  const playing = inputMode ? t - (brain.lastLoud ?? -9) < 0.6 : aud[0] > 0.05 || aud[1] > 0.05; // a mic is playing while it was loud a moment ago
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
  if (remote.on) { /* the DJ's club says when builds and drops happen */ } else if (brain.bassFast < 0.28) brain.lowSince += dt; else if (brain.bassFast > 0.55) {
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
  if (brain.clash > 0.6) for (const p of people) if (Math.random() < dt * 0.35) react(p, 'boo', Math.random() < 0.5 ? ['BOOO!', 'SYNC IT!', 'BOOO'] : null);
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
// the whole crowd reacts, but not in one frame: the move rolls through the room, and only some people shout, each at their own moment
function everyone(clip, chance, lines) {
  for (const p of people) {
    setTimeout(() => react(p, clip, null), rnd(0, 1800));
    if (lines && Math.random() < chance) setTimeout(() => say(p, pick(lines)), rnd(300, 3800));
  }
}

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
const crowdEvents = { drop: -99, djKiss: -99, build: false, lasers: false };
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
  if (build && !crowdEvents.build) for (const p of people) if (Math.random() < 0.5) setTimeout(() => react(p, has(p, 'handsup') ? 'handsup' : 'cheer'), rnd(0, 2200));
  crowdEvents.build = build;
  // the lasers come in: hands go up across the floor, a few at a time, and stay up for a while
  const lasersOn = playing && !!auto.laser;
  if (lasersOn && !crowdEvents.lasers) {
    for (const p of people) {
      if (p.robot || !has(p, 'handsup')) continue;
      const chance = p.style === 'chill' ? 0.3 : p.style === 'filmer' ? 0.35 : 0.75;
      if (Math.random() < chance) setTimeout(() => { if (auto.laser) holdFor(p, 'handsup', rnd(4, 9)); }, rnd(150, 1400));
    }
  }
  crowdEvents.lasers = lasersOn;
  // the DJ blew a kiss: some blow one back, others wave
  if (dj && dj.kissAt && dj.kissAt !== crowdEvents.djKiss) {
    crowdEvents.djKiss = dj.kissAt;
    for (const p of people) if (Math.random() < 0.5) setTimeout(() => react(p, has(p, 'kiss') && Math.random() < 0.5 ? 'kiss' : has(p, 'wave') ? 'wave' : 'cheer'), rnd(900, 2000));
  }
}
const _v = new THREE.Vector3(), DJ_HEAD = new THREE.Vector3(0, 1.85, 0);
// pick a move that fits the music: energy (and tempo) set how big, the dancer's own sex which of the big ones they use
function chooseDance(p, bpm) {
  const e = brain.hype + p.bias + (bpm > 138 ? 8 : bpm < 108 ? -10 : 0);
  const tier = e > 72 ? 'high' : e > 56 ? 'mid' : 'calm';
  const pool = (TIERS[tier][p.sex] || TIERS[tier].m).filter((d) => p.dances.includes(d) && d !== p.dance);
  return pool.length ? pick(pool) : p.dance;
}
function applyRemote(t) {
  if (remote.on && performance.now() - remote.rx > 1500) endSync(); // the DJ's packets stopped: back to following the sound
  if (!remote.on) return;
  const p = remote.p, el = (performance.now() - remote.rx) / 1000, beat = remoteBeat(), perBeat = p.bpm / 60;
  brain.playing = p.playing; brain.hype = p.hype; brain.bassFast = p.bf; brain.bassSlow = p.bs; brain.lowSince = p.low + el;
  const dropAge = p.drop + el; brain.lastDrop = t - dropAge; auto.drop = brain.lastDrop;
  if (brain.playing) auto.lastPlay = t;
  light.style = p.style; light.intensity = p.k; light.on = p.on; Object.assign(light.fx, p.fx);
  for (let i = 0; i < light.colours.length; i++) light.colours[i] = !!p.col[i];
  look.name = p.look; look.block = Math.floor(beat / 8);
  auto.laser = p.laser; auto.laserEnd = beat + p.laserLeft - el * perBeat; auto.blindUntil = beat + p.blindLeft - el * perBeat;
  if (dropAge < remote.prevDrop - 0.5) sfx.drop();   // a fresh drop on the DJ's side
  remote.prevDrop = dropAge;
  if (p.co2 - el > 0.3) { if (!remote.co2) { remote.co2 = true; light.sfx.co2 = t + p.co2 - el; sfx.co2(); } } else remote.co2 = false;
}
// what the DJ sends: everything a listener's club needs to do the same show
function syncPacket() {
  const t = clock.elapsedTime;
  return { beat: curBeat, bpm: curBpm, playing: brain.playing, hype: brain.hype, bf: brain.bassFast, bs: brain.bassSlow, low: brain.lowSince, drop: t - brain.lastDrop,
    style: light.style, k: light.intensity, col: light.colours.map(Boolean), on: light.on, fx: { ...light.fx }, look: look.name,
    laser: auto.laser || null, laserLeft: auto.laser ? Math.max(0, auto.laserEnd - curBeat) : 0, blindLeft: Math.max(0, auto.blindUntil - curBeat), co2: Math.max(0, (light.sfx.co2 || 0) - t) };
}
// In the standing poses (idle, look around, talk) the scanned bodies let their hands drift in and overlap in front of the
// body, which reads as crossed arms. Swing both upper arms a little out from the sides, eased in and out so nothing pops.
const SPREAD_CLIPS = new Set(['idle', 'lookaround', 'talk']);
const _sq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _ax = new THREE.Vector3(), _lv = new THREE.Vector3(), _rv = new THREE.Vector3();
function spreadArms(p, dt) {
  if (!p.armL || !p.armR) return;
  p.spread += ((SPREAD_CLIPS.has(p.loopName) && !p.busy ? 1 : 0) - p.spread) * Math.min(1, dt * 4);
  if (p.spread < 0.01) return;
  if (p.armSide == null) {
    p.root.updateMatrixWorld(true); p.armL.getWorldPosition(_lv); p.armR.getWorldPosition(_rv);
    p.armSide = p.root.worldToLocal(_lv).x > p.root.worldToLocal(_rv).x ? 1 : -1;
    p.foreL = p.armL.children.find((c) => c.isBone); p.foreR = p.armR.children.find((c) => c.isBone); p.armAng = 0.26;
  }
  _ax.set(0, 0, 1).applyQuaternion(p.root.quaternion);
  const swing = (bone, side, ang) => {
    _sq.setFromAxisAngle(_ax, side * ang);
    bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.premultiply(_pq.clone().invert().multiply(_sq).multiply(_pq));
  };
  const apply = () => {
    const ang = p.armAng * p.spread;
    swing(p.armL, p.armSide, ang); swing(p.armR, -p.armSide, ang);
    if (p.foreL && p.foreR) { swing(p.foreL, p.armSide, ang * 0.6); swing(p.foreR, -p.armSide, ang * 0.6); }
  };
  apply();
  // if the hands still end up together, open the arms a little more until they clear; relax again when they do
  if (p.hand && p.handL) {
    p.root.updateMatrixWorld(true); p.hand.getWorldPosition(_lv); p.handL.getWorldPosition(_rv);
    const gap = _lv.distanceTo(_rv);
    if (gap < 0.22) p.armAng = Math.min(0.8, p.armAng + dt * 1.2);
    else if (gap > 0.32) p.armAng = Math.max(0.26, p.armAng - dt * 0.4);
  }
}

let lastBeats = null, lastKick = 0;   // the beat this frame, for the DJ
function updatePeople(dt) {
  const c = cc(); if (!c) return;
  const t = clock.elapsedTime;
  const M = c.decks.find((d) => d.master && d.loaded && d.playing) || c.decks.find((d) => d.loaded && d.playing && c.chanGain(d.i) > 0.1);
  const lockedIn = inputMode && !M && live.conf > 0.4;
  const beats = remote.on ? remoteBeat() : M ? (M.vpos - M.first) / M.B : lockedIn ? live.beat : null;
  const playing = inputMode || remote.on ? brain.playing : !!M && brain.dead < 1;
  crowdMoments(t, playing);
  const phrase = beats != null ? Math.floor(beats / 16) : -1;
  const tempo = remote.on ? remote.p.bpm : M ? 60 / M.B : inputMode ? live.bpm : 125; // slow tunes get the easy grooves, fast ones the big moves
  const kickPulse = beats != null ? Math.pow(1 - (((beats % 1) + 1) % 1), 3) : 0;
  lastBeats = beats; lastKick = kickPulse;
  for (const p of people) {
    if (t > p.nextThink) { p.nextThink = t + rnd(3, 8); think1(p, t, playing); }
    if (p.hold && t > p.hold.until) { p.hold = null; p.yawTarget = 0; p.look = null; }
    // every new phrase, dancers may switch to another of their dances
    if (phrase !== p.phrase) { p.phrase = phrase; if (p.dances.length > 1 && Math.random() < 0.5) p.dance = chooseDance(p, tempo); }
    if (!playing && t > (p.restUntil || 0)) { p.restUntil = t + rnd(8, 20); if (p.rests.length > 1 && Math.random() < 0.5) p.rest = pick(p.rests); }
    let want = p.rest || 'idle';
    if (playing) {
      // the crowd follows the lights setting: chill is a mellow sway (no big moves), energetic as before, rave is the whole room going off
      const vibe = light.style === 'chill' ? -22 : light.style === 'rave' ? 14 : 0;
      const e = brain.hype + p.bias + vibe, mellow = light.style === 'chill', wild = light.style === 'rave';
      want = e > 74 && has(p, 'hype') && (wild || (p.style !== 'chill' && !mellow)) ? 'hype' : e > 48 ? p.dance || p.rest : p.rest;
    }
    if (p.hold) want = p.hold.name;
    if (!p.busy && want !== p.loopName && p.actions[want]) {
      const next = p.actions[want];
      next.reset(); next.setLoop(THREE.LoopRepeat, Infinity); next.enabled = true; next.setEffectiveWeight(1);
      if (!BEAT_LOOPS.has(want)) next.time = Math.random() * next.getClip().duration;
      next.fadeIn(0.4).play();
      if (p.loop && p.loop !== next) p.loop.fadeOut(0.4);
      p.loop = next; p.loopName = want;
    }
    if (p.loop && BEAT_LOOPS.has(p.loopName) && beats != null) {
      // drive the clip's time from the beat so everyone stays on it, each from their own place in the move
      const dur = p.loop.getClip().duration, bars = dur > 3 ? 16 : 2;
      p.loop.time = (((((beats + p.phase + p.offset) % bars) + bars) % bars) / bars) * dur;
      p.loop.timeScale = 0;
    } else if (p.loop) p.loop.timeScale = 1;
    // undo last frame's breathing and head turn first, so they never pile up when no clip is writing these bones
    if (p.chest && p.chestQ) p.chest.quaternion.copy(p.chestQ);
    if (p.head && p.headQ) p.head.quaternion.copy(p.headQ);
    p.mixer.update(dt);
    spreadArms(p, dt);
    if (p.chest) (p.chestQ ||= new THREE.Quaternion()).copy(p.chest.quaternion);
    if (p.head) (p.headQ ||= new THREE.Quaternion()).copy(p.head.quaternion);
    // turn towards a friend when talking, drift a little on the spot, breathe, and keep an eye on the DJ
    p.yaw += (p.yawTarget - p.yaw) * Math.min(1, dt * 3);
    p.root.rotation.y = p.face + p.yaw;
    p.root.position.set(p.home.x + Math.sin(t * 0.13 + p.seed) * 0.07, 0, p.home.z + Math.cos(t * 0.11 + p.seed) * 0.07);
    if (BEAT_LOOPS.has(p.loopName) && kickPulse != null) { // everyone hits the kick: a little drop through the knees and a chest punch, harder when the room is up
      const hit = kickPulse * (0.5 + brain.hype / 100);
      p.root.position.y -= 0.035 * hit; if (p.chest) p.chest.rotateX(0.07 * hit);
    }
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
  buildBeamLights();
}

// ------------------------------------------------------------------ the room
const ROOM = { w: 11, z0: 2.5, z1: -13.5, h: 4.4 };
// LED light bars down both side walls: white on the left of the crowd's view (like the logo's white C), cyan on the right, each in segments so they can chase and flash with the rig.
const sideBars = { segs: [], N: 14 };
// (no housing or trim lights round the side screens any more: the LED screens are the whole thing)
function buildSideBar(side) {}
// Side screens. The main screen is drawn once a frame into a small texture (no text, no dots, see updateScreen), and these only show windows of it
// through their own LED pixel grid: they copy the main screen's look, colours and beat, and cost almost nothing.
function buildSideCopies() {
  const tex = screen.rt.texture, { w, z0, z1 } = ROOM;
  // a long, thin LED screen down each side wall: a narrow slice through the middle of the main screen, mirrored on the other wall
  const zA = z0 - 1.5, zB = z1 + 1.5, L = zA - zB, H = 0.6, CELL = 0.035;
  for (const side of [-1, 1]) {
    const mat = ledCopyMaterial(THREE, tex, { rect: side < 0 ? [0.2, 0.46, 0.6, 0.08] : [0.8, 0.46, -0.6, 0.08], grid: [L / CELL, H / CELL] });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, H), mat);
    m.position.set(side * (w / 2 - 0.122), 2.2, (zA + zB) / 2); m.rotation.y = -side * Math.PI / 2; scene.add(m);
  }
  // C-shaped LED screens: arcs of the same ring (radius and thickness) as the logo they sit beside, showing the main screen's picture, two each side of the DJ's round screen and two each side of the bar logo.
  // Each arc is the near ~115 degrees of its ring, on the logo's flat cut, opening towards the logo (as drawn: the DJ's ring is 4.16 m across, the bar logo's 2.16 m).
  const PITCH = 3.26 / 150, CUT = 0.54, TUBE = 0.875;                        // CUT: how far across its ring the arc is cut off (0 would be a half ring); TUBE: inner/outer radius, as the logo's
  const cScreen = (out, x, y, z, faceBack, keepLeft) => {
    const mat = ledCopyMaterial(THREE, tex, { rect: [0.22, 0.22, 0.56, 0.56], grid: [2 * out / PITCH, 2 * out / PITCH], ring: [TUBE, CUT, keepLeft ? 1 : -1], mode: 1, gain: 1.3 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * out, 2 * out), mat);
    mesh.position.set(x, y, z); if (faceBack) mesh.rotation.y = Math.PI; scene.add(mesh);
  };
  for (const v of [-1, 1]) {            // v: -1 the left of each wall as you face it, +1 the right
    DJ_C.forEach((cx, i) => cScreen(2.08, -v * cx, 2.32, z0 - 0.09 - i * 0.01, true, v < 0));      // DJ wall (you face it looking along +z, so its left is world +x)
    BAR_C.forEach((cx, i) => cScreen(1.08, v * cx, 3.05, z1 + 0.06 + i * 0.01, false, v < 0));      // bar wall
  }
}
const DJ_C = [1.48, 3.17], BAR_C = [1.30, 2.85];   // ring centres out from the middle of the wall: the inner and outer C either side
// tall towers either side of the stage, so the bars are in shot from the crowd too (white left, cyan right), chasing upwards
function buildSideTower(side) {
  const N = 12, h = 3.5, seg = h / N, x = side * 3.95, z = 1.55, base = side > 0 ? new THREE.Color(0xf2fcff) : new THREE.Color(0x4cebff);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, h + 0.2, 0.16), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6, metalness: 0.4 }));
  post.position.set(x, 0.1 + h / 2 + 0.1, z); scene.add(post);
  for (let i = 0; i < N; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(0.25) });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, seg - 0.05, 0.05), mat);
    m.position.set(x, 0.2 + seg * (i + 0.5), z - 0.09); scene.add(m);
    sideBars.segs.push({ mat, base, i: N - 1 - i, side });         // the flash runs up the tower
  }
}
const _fr = (v) => ((v % 1) + 1) % 1;
// called every frame from the light show: brightness per segment follows the music
function updateSideBars(beat, chill, strobe, dark, hit, drop, pulse, F) {
  const N = sideBars.N, playing = brain.playing;
  for (const sg of sideBars.segs) {
    const off = sg.side > 0 ? 0 : 0.5;                                        // white and cyan answer each other, half a beat apart
    let lvl;
    if (dark) lvl = hit ? 1 : 0.03;                                           // blackout: nearly out, but a blinder hit flares them
    else if (!playing) lvl = 0.2 + 0.12 * Math.sin(beat * 0.6 + sg.i * 0.35); // waiting for music: a slow glow down the bar
    else if (chill) lvl = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(beat * Math.PI / 4 - sg.i * 0.4)); // chill: a slow wave travelling down
    else lvl = 0.12 + 0.88 * Math.pow(1 - _fr(beat + off - sg.i * 0.07), 3);                   // a flash on each beat that runs down the bar
    if (!dark && playing) { if (strobe) lvl = _fr(beat * 4 + (sg.side > 0 ? 0 : 0.5)) < 0.5 ? 1 : 0.1; else if (drop) lvl = Math.max(lvl, 0.8); }
    if (hit) lvl = 1;
    sg.mat.color.copy(sg.base).multiplyScalar(Math.min(1.4, lvl * (F ?? 1)));
  }
}

const TRUSS_Y = 3.9;
function buildRoom() {
  const { w, z0, z1, h } = ROOM, d = z0 - z1, zc = (z0 + z1) / 2;
  const concrete = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.28, metalness: 0.35 });
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
    // (the speaker stacks and the hung speakers that stood either side of the booth are gone: they hid the big side C screens)
    // pillars
    add(new THREE.BoxGeometry(0.5, h, 0.5), wall, s * 3.4, h / 2, -7.6);
    buildSideBar(s);
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
  const arc = (mat, side) => { const m = new THREE.Mesh(cTubeGeometry(R, tube, gap, side), mat); m.position.y = cy; grp.add(m); screen.parts.push(m); };
  arc(white, -1);   // left C, opening to the right: ends cut flat and parallel
  arc(blue, 1);     // right C, opening to the left
  // round LED screen inside the C's
  screen.cv = document.createElement('canvas'); screen.cv.width = screen.cv.height = 1024;   // drawn at 2x so the logo and titles stay crisp
  screen.g = screen.cv.getContext('2d');
  screen.tex = new THREE.CanvasTexture(screen.cv); screen.tex.colorSpace = THREE.SRGBColorSpace;
  screen.spec = new THREE.DataTexture(new Uint8Array(64), 64, 1, THREE.RedFormat); screen.spec.needsUpdate = true;
  screen.mat = screenMaterial(THREE, screen.tex, screen.spec);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R - 0.32, 96), screen.mat);
  // the shared copy of the main screen (a texture the side screens read from)
  screen.rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
  screen.rtScene = new THREE.Scene(); screen.rtScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), screen.mat)); screen.rtCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3); screen.rtCam.position.z = 1;
  buildSideCopies();
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
function updateScreen(t, beat, pulse, colours, step, dark, flash) {
  if (!screen.g) return;
  const g = screen.g, S = 512, u = screen.mat.uniforms;
  const phrase = Math.floor(beat / 16);
  if (phrase !== screen.lastPhrase) { screen.lastPhrase = phrase; if (Math.random() < 0.25) screen.show = beat; }
  if (brain.lastDrop !== screen.lastDrop) { screen.lastDrop = brain.lastDrop; screen.show = beat; } // the name lands on every drop
  const idleLogo = !brain.playing;
  const showing = idleLogo || (screen.show >= 0 && beat - screen.show < 4);
  const msg = screen.msg && performance.now() < screen.msg.until ? screen.msg : null;
  // the graphics run on the GPU: pick a look every 16 beats and crossfade into it
  const build = brain.playing && brain.lowSince > 2.5;
  if (phrase !== vis.phrase || build !== vis.build) {
    vis.phrase = phrase; vis.build = build; u.uModeA.value = u.uModeB.value;
    // the look follows the moment: rushing tunnels and warps on a build, the grid and bars when it's hot, slow ones in a lull
    const pool = !brain.playing ? [1, 4, 5, 6, 8] : build ? [2, 0, 4] : brain.hype > 62 ? [0, 2, 3, 6, 7, 5, 8] : [1, 3, 4, 5, 6, 7, 8];
    let m; do m = pool[Math.floor(Math.random() * pool.length)]; while (pool.length > 1 && m === u.uModeA.value);
    u.uModeB.value = m; vis.fadeFrom = t;
  }
  u.uMix.value = Math.min(1, (t - (vis.fadeFrom || 0)) / 1.8);
  u.uTime.value = t; u.uBeat.value = beat; u.uPulse.value = pulse; screen.lastBeat = beat;
  u.uC1.value.setHex(colours[step % colours.length]); u.uC2.value.setHex(colours[(step + 1) % colours.length]); u.uC3.value.setHex(colours[(step + 2) % colours.length]);
  u.uDark.value = dark ? 1 : 0; u.uBlast.value = screen.blast || 0;
  { const want = flash ? 1 : 0.58; u.uBright.value += (want - u.uBright.value) * (want > u.uBright.value ? 0.6 : 0.12); }   // full brightness only on strobes and blinder hits, otherwise a steady lower level
  u.uEnergy.value += ((brain.bassFast || 0) - u.uEnergy.value) * 0.2;
  if (screen.rt) {   // draw the main screen's picture into the shared copy for the side screens
    const prev = renderer.getRenderTarget(); u.uCopy.value = 1;
    renderer.setRenderTarget(screen.rt); renderer.render(screen.rtScene, screen.rtCam); renderer.setRenderTarget(prev); u.uCopy.value = 0;
  }
  // live spectrum for the ring look
  const sb = inputMode ? ext.specBuf : brain.specBuf, d = screen.spec.image.data;
  for (let i = 0; i < 64; i++) { const bin = sb ? Math.floor(Math.pow(i / 64, 1.7) * sb.length * 0.45) + 2 : 0; const v = sb ? (sb[bin] + 95) / 65 : 0; d[i] = Math.max(0, Math.min(255, v * 255)); }
  screen.spec.needsUpdate = true;
  // text layer: welcome / shout-outs / tips, now playing, and the odd logo flash
  g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, S, S);
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
      const a = idleLogo ? 1 : Math.min(1, (beat - screen.show) * 2) * Math.min(1, (4 - (beat - screen.show)) * 2);
      dim = 0.6 * a; g.globalAlpha = a;
      // the logo's own wordmark (the C's are the LED screens either side): crisp, with only a hair of glow so the dots keep their edges
      g.shadowBlur = 5; g.shadowColor = '#ffffff'; g.fillStyle = '#f2fcff'; g.font = font(190); g.fillText('club', S / 2, S / 2 + 28);
      g.shadowColor = '#41e7ff'; g.fillStyle = '#4cebff'; g.font = font(72); g.fillText('C L O U D', S / 2, S / 2 + 118);
      g.globalAlpha = 1;
    }
    g.shadowBlur = 0;
  }
  u.uTextDim.value += (dim - u.uTextDim.value) * 0.15; // the graphics dim behind text so it reads
  screen.tex.needsUpdate = true;
  const c = new THREE.Color(colours[step % colours.length]);
  if (!dark) { screen.light.color.copy(c); screen.light.intensity = 3 + 6 * pulse; } else screen.light.intensity = 0;
  if (screen.blast > 0.05) { screen.light.color.setRGB(1, 0.95, 0.88); screen.light.intensity = 3 + 16 * screen.blast; }
}

// ---- the screen's shader lives in screen.js
const vis = { phrase: -1, title: '', trackUntil: 0, fadeFrom: 0 };

// the Club Cloud logo in neon: white C and blue C almost meeting, an inner ring, and the name inside
function logoCanvas() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const g = cv.getContext('2d'), C = 512, R = 400, gap = 0.1;
  g.lineWidth = 86; g.shadowBlur = 40;
  const hx = R * Math.sin(gap);   // the two C's end on flat, parallel cuts either side of the middle
  const half = (side, fill, glow) => { g.save(); g.beginPath(); side < 0 ? g.rect(0, 0, C - hx, 1024) : g.rect(C + hx, 0, 1024, 1024); g.clip(); g.shadowColor = glow; g.strokeStyle = fill; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.stroke(); g.restore(); };
  half(-1, '#f2fcff', '#e9fbff'); half(1, '#4cebff', '#41e7ff');
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
  fragmentShader: 'uniform vec3 color; uniform float opacity; varying float vy; varying vec3 vn; varying vec3 vv; void main(){ float edge = pow(abs(dot(vn, vv)), 1.6); float along = pow(vy, 1.8); gl_FragColor = vec4(color * opacity * edge * along * 0.7, 1.0); }',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function movingHead(x, y, z) {
  const body = new THREE.Group(); body.position.set(x, y, z);
  const dark = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.38, metalness: 0.55, emissive: 0x0a0c10 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a505c, roughness: 0.22, metalness: 0.9, emissive: 0x0a0c10 });
  const accent = new THREE.MeshBasicMaterial({ color: 0x2fa8d8 }); // small glowing details so the shape reads in the dark
  // clamp on the truss and a round base the yoke turns on
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.11), metal); clamp.position.y = 0.275; body.add(clamp);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 8, 20), metal); hook.position.y = 0.3; hook.rotation.y = Math.PI / 2; body.add(hook);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.09, 28), dark); base.position.y = 0.2; body.add(base);
  const pan = new THREE.Group(); pan.position.y = 0.15; body.add(pan);                       // turns about the upright axis
  const tilt = new THREE.Group(); tilt.position.y = -0.15; pan.add(tilt);                    // nods between the yoke's arms, at the head's centre
  // the U-shaped yoke: a bar across the top and an arm either side, with a pivot cap where the head hangs
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.04, 0.09), dark); bar.position.y = 0.025; pan.add(bar);
  for (const sd of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.27, 0.075), dark); arm.position.set(sd * 0.178, -0.1, 0); pan.add(arm);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.17, 0.006), accent); strip.position.set(sd * 0.197, -0.08, 0.04); pan.add(strip);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.022, 24), metal); cap.rotation.z = Math.PI / 2; cap.position.set(sd * 0.19, -0.15, 0); pan.add(cap);
  }
  // the head: a tapered body with a domed back, and a dark bezel round the lens; no glowing rings, only the beam
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.128, 0.27, 32), dark); can.position.y = -0.005; tilt.add(can);
  const domeBack = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), dark); domeBack.position.y = 0.13; domeBack.scale.y = 0.55; tilt.add(domeBack);
  for (const k of [-1, 0, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.236, 0.012, 0.012), metal); fin.position.set(0, 0.03 + k * 0.045, 0); fin.scale.z = 1; tilt.add(fin); }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.1285, 0.004, 6, 48), accent); band.rotation.x = Math.PI / 2; band.position.y = -0.1;   // (not added: a real head has no glowing band, just the beam)
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.024, 12, 40), metal); bezel.rotation.x = Math.PI / 2; bezel.position.y = -0.148; tilt.add(bezel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.007, 8, 48), new THREE.MeshBasicMaterial({ color: 0x111111 })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.135;   // (not added: no LED ring round the lens)
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.092, 28), new THREE.MeshBasicMaterial({ color: 0xffffff })); lens.rotation.x = Math.PI / 2; lens.position.y = -0.151; tilt.add(lens);
  // beam: an open cone hanging down from the lens (uv.y is 1 at the lens, 0 at the far end)
  const geo = new THREE.CylinderGeometry(0.06, 0.75, 8, 32, 1, true); geo.translate(0, -4.15, 0);
  const beam = new THREE.Mesh(geo, beamMat());
  beam.userData = { pan, tilt, lens, ring, x, y, z };
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

// The built characters carry no moves of their own: one shared set (models/crowd_clips.glb, written from the same skeleton), with the hips' travel scaled to each body's height.
function sharedClips(star, donor) {
  if (!donor) return [];
  return donor.animations.map((clip) => {
    const c = clip.clone();
    for (const t of c.tracks) if (t.name === 'mixamorigHips.position') for (let i = 0; i < t.values.length; i++) t.values[i] *= star.hip;
    return c;
  });
}

async function loadCrowd() {
  const loader = new GLTFLoader();
  const total = MODELS.length + FEATURED.length + 1; let done = 0; // the loading screen's bar
  const tick = (p) => p.finally(() => loadMsg.querySelector('.ldbar')?.style.setProperty('--p', Math.min(1, ++done / total)));
  const sharedDonor = FEATURED.some((f) => f.shared) ? await loader.loadAsync('models/crowd_clips.glb?v=2').catch(() => null) : null; // the built characters' shared moves
  const [gltfs, stars] = await Promise.all([Promise.all(MODELS.map((u) => tick(loader.loadAsync(u)))), Promise.all(FEATURED.map((f) => tick(loader.loadAsync(f.model)).catch(() => null)))]);
  SPOTS.forEach(([x, z], i) => {
    const fi = FEATURED.findIndex((f, k) => f.spot === i && stars[k]);
    const star = fi >= 0 ? FEATURED[fi] : null;
    if (!star) return; // only the scanned, rigged people; the old blocky dancers are retired
    const src = star ? stars[fi] : gltfs[i % gltfs.length];
    const anims = star.shared ? sharedClips(star, sharedDonor) : star.rename ? src.animations.map((c) => { const k = c.clone(); k.name = star.rename[c.name] || c.name; return k; }) : src.animations;
    const root = SkeletonUtils.clone(src.scene);
    root.position.set(x, 0, z);
    const face = Math.atan2(-x, -z); // face the booth (models face +Z)
    root.rotation.y = face;
    root.scale.setScalar(star ? star.scale : rnd(0.96, 1.04));
    root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    scene.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const clip of anims) if (clip.name !== 'listen') actions[clip.name] = mixer.clipAction(clip);   // 'listen' (Old Man Idle) crossed the arms, which looked creepy
    const bone = (re) => { let b = null; root.traverse((o) => { if (o.isBone && re.test(o.name)) b = o; }); return b; };
    const hand = bone(/^(hand[._]?R|mixamorigRightHand)$/i), handL = bone(/^(hand[._]?L|mixamorigLeftHand)$/i);
    const armL = bone(/^mixamorigLeftArm$/i), armR = bone(/^mixamorigRightArm$/i);
    const p = { root, mixer, actions, hand, handL, armL, armR, spread: 0, head: bone(/^(head|mixamorigHead)$/i), chest: bone(/^(chest|mixamorigSpine2)$/i), loop: null, loopName: null, busy: false,
      bias: rnd(-10, 10), offset: rnd(-0.2, 0.2), phase: (i * 3 + Math.floor(rnd(0, 2))) % 16, /* each a little off the beat, from their own place in the move */ home: new THREE.Vector3(x, 0, z), face, yaw: 0, yawTarget: 0, seed: rnd(0, 100),
      style: star ? star.style : pick(STYLES), dances: DANCES.filter((d) => actions[d] && (d !== 'dance' || anims.some((c) => c.name === d && c.duration > 3))), dance: null, /* the old hand-made 'dance' is a stiff side-to-side shuffle: only the mocap one is kept */ phrase: -1, hold: null, nextThink: rnd(2, 8), look: null, props: {} };
    p.sex = star ? star.sex || 'm' : pick(['m', 'f']);
    p.dances = p.dances.filter((d) => d !== (p.sex === 'f' ? 'dance' : 'dance2')); // the wide hip-hop bounce is the lads', the hip-swinging house move the girls'
    p.dance = p.dances.includes('dance4') ? 'dance4' : pick(p.dances);
    p.rests = RESTS.filter((r) => actions[r]); p.rest = pick(p.rests) || 'idle';
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
  const arc = (mat, side) => { const m = new THREE.Mesh(cTubeGeometry(cr, tube, gap, side, 100, 16), mat); g.add(m); return m; };
  arc(whiteC, -1); arc(cyanC, 1);
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
try { const v = localStorage.getItem('cc-cam'); if (v === 'crowd' || v === 'pan') camView = v; } catch (_) {}
function setCamView(v) {
  camView = v;
  try { localStorage.setItem('cc-cam', v); } catch (_) {}
  // from the booth the DJ is drawn on her own layer over the deck UI; from the crowd she stands in the room so people can pass in front
  if (dj) (v !== 'booth' ? scene : djScene).add(dj.root);
  djCanvas.style.visibility = v !== 'booth' ? 'hidden' : '';
  if (boothDecks) boothDecks.visible = v !== 'booth';
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
  view.style.visibility = mode === 'club' && camView !== 'booth' ? 'hidden' : '';
  if (mode !== 'club' || !camera || camView !== 'booth') return;
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
  if (camView === 'pan') {
    camera.fov = w / h < 1.3 ? 48 : 32; // CLUB 2: updatePanCam moves it every frame (a longer lens: it shoots from the walls)
  } else if (camView === 'crowd') {
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
// CLUB 2: a camera that drifts between shots on the beat: a new shot every 16 beats, every 8 when the crowd is flying
const PAN = { shot: -1, start: -999, len: 64, drift: false, dolly: 0 };
const mix_ = THREE.MathUtils.lerp;
// Camera B is a club's own cameras: mounted high on the walls and the bar-wall truss, on a long lens, never down in the crowd. Wide and medium shots, with a slow pan from high up.
const PAN_SHOTS = [
  (k) => [[mix_(-1.5, 1.5, k), 3.6, -12.6], [0, 1.7, 0]],                                                              // high at the bar wall, wide on the whole stage
  (k) => [[mix_(-4.2, 4.2, k), 3.8, -11.4], [mix_(2.4, -2.4, k), 1.6, -1.0]],                                          // the pan: high across the back of the room, sweeping the stage
  (k) => [[-5.0, 3.3, mix_(-7.5, -6.3, k)], [mix_(0.8, -0.4, k), 1.5, -0.5]],                                          // left wall mount, high, looking at the stage
  (k) => [[5.0, 3.3, mix_(-7.5, -6.3, k)], [mix_(-0.8, 0.4, k), 1.5, -0.5]],                                           // right wall mount
  (k) => [[mix_(-4.6, -3.8, k), 2.7, 1.6], [0, 1.4, -4.2]],                                                            // by the stage, high, looking down the room over the crowd
  (k) => [[mix_(-4.4, -3.6, k), 2.4, 0.4], [0, 1.7, 0]],                                                               // the DJ from the side, at a distance
  (k) => { const a = mix_(-0.9, 0.9, k); return [[Math.sin(a) * 4.6, 3.6, -3.8 - Math.cos(a) * 4.4], [0, 1.0, -3.8]]; }, // high arc round the back of the floor
];
// The auto camera follows the lights setting. Chill: fixed shots with a very slow push in or pull out, a new angle every 32 bars. Energetic: a new angle every 16 or 32 bars, some slow pans and a gentle zoom.
// Rave: the same cuts, but it pans more often and moves a little more. Cuts always land on the first beat of a bar.
function updatePanCam(beat) {
  const chill = light.style === 'chill', rave = light.style === 'rave';
  if (beat >= PAN.start + PAN.len || beat < PAN.start) {                    // time for a new shot (or the track jumped back)
    PAN.start = Math.floor(beat / 4) * 4; PAN.len = chill ? 128 : Math.random() < 0.5 ? 64 : 128;
    let n; do n = Math.floor(Math.random() * PAN_SHOTS.length); while (n === PAN.shot || (chill && n === 1));   // the sweeping high pan is not a chill shot
    PAN.shot = n; PAN.drift = chill ? false : n === 1 || Math.random() < (rave ? 0.75 : 0.45);
    PAN.dolly = (Math.random() < 0.5 ? -1 : 1) * (chill ? 0.3 : rave ? 0.2 : 0.15);
  }
  const prog = Math.min(1, (beat - PAN.start) / PAN.len);
  const [pos, look] = PAN_SHOTS[PAN.shot](PAN.drift ? prog : 0.5);
  const f = PAN.dolly * (prog - 0.5);                                         // slow zoom: moves along the line of sight, in or out
  camera.position.set(pos[0] + (look[0] - pos[0]) * f, pos[1] + (look[1] - pos[1]) * f, pos[2] + (look[2] - pos[2]) * f); camera.lookAt(look[0], look[1], look[2]);
}
window.addEventListener('cc-clubzoom', (e) => { clubZoom = e.detail; aimCamera(); });

// adaptive sharpness: if the frame rate sags the picture renders at a lower resolution, and climbs back when there is headroom
let pxAuto = 1, pxMs = 0, pxN = 0, pxLast = 0;
function adaptPx() {
  const now = performance.now(); if (pxLast) { pxMs += Math.min(200, now - pxLast); pxN++; } pxLast = now;
  if (pxN < 90) return;
  const avg = pxMs / pxN; pxMs = 0; pxN = 0;
  if (avg > 27 && pxAuto > 0.5) { pxAuto = Math.max(0.5, pxAuto * 0.85); resize(); }
  else if (avg < 15 && pxAuto < 1) { pxAuto = Math.min(1, pxAuto * 1.1); resize(); }
}
function resize() {
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  djCanvas.hidden = mode === 'off';
  for (const k of ['left', 'top', 'width', 'height']) djCanvas.style[k] = el.style[k];
  if (djRenderer) { djRenderer.setPixelRatio(Math.max(0.6, Math.min(window.devicePixelRatio || 1, PX_CAP) * pxAuto)); djRenderer.setSize(w, h, false); }
  renderer.setPixelRatio(Math.max(0.6, Math.min(window.devicePixelRatio || 1, PX_CAP) * pxAuto));
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
// a small picture of the club for the home screen: taken right after a frame is drawn, so the canvas still holds it
let snapReq = null;
function snapshot() { return new Promise((res) => { if (!renderer || mode !== 'club') { res(null); return; } snapReq = res; setTimeout(() => { if (snapReq === res) { snapReq = null; res(null); } }, 2000); }); }
let curBeat = 0, curBpm = 120; // the beat the rig is running on, shared with the camera and sent to listeners
let buildStart = null; // the beat a build-up began on
function pickLook(beat, drop) {
  const block = Math.floor(beat / 8);
  if (block === look.block) return;
  look.block = block;
  const hot = brain.hype > 62, r = Math.random();
  // chill: no chases or flashing pairs, just slow sweeps, fans and downlights that glow
  if (light.style === 'chill' || (brain.playing && brain.lowSince > 9)) { look.name = ['sweep', 'sweep', 'fan', 'down'][Math.floor(r * 4)]; return; }
  if (light.style === 'rave') { look.name = drop ? 'sweep' : ['chase', 'pingpong', 'pairs', 'chase', 'sweep'][Math.floor(r * 5)]; return; }
  look.name = drop ? (r < 0.6 ? 'sweep' : 'fan')
    : hot ? ['sweep', 'sweep', 'fan', 'pairs', 'chase', 'pingpong'][Math.floor(r * 6)]
    : ['down', 'chase', 'pingpong', 'pairs', 'sweep'][Math.floor(r * 5)];
}
function lights(t, dt) {
  const c = cc(); const M = c && (c.decks.find((d) => d.master && d.playing) || c.decks.find((d) => d.playing));
  const locked = remote.on || (inputMode && !M && live.conf > 0.4); // the DJ's clock, or a mic whose beat has been found
  const bpmNow = remote.on ? remote.p.bpm : M ? 60 / M.B : locked ? live.bpm : 120;
  curBpm = bpmNow;
  const beat = light.adBeat != null ? light.adBeat : remote.on ? remoteBeat() : M ? ((M.vpos - M.first) / M.B) : locked ? live.beat : t * 2; // the advert supplies its own track's beat
  curBeat = beat;
  // the rig follows the song: a build-up (the bass drops out) tightens and whitens the beams, a long lull softens everything
  // into a glow whatever the style, and the drop lands as a blast
  const buildAmt = brain.playing && brain.lowSince > 2.5 ? Math.min(1, (brain.lowSince - 2.5) / 8) : 0;
  if (buildAmt > 0) { if (buildStart == null) buildStart = beat; } else buildStart = null;
  // a build runs in whole bars: on the last beat and a half before the next 8-beat mark the whole rig stops dead and goes black (beams, washes, side screens, strobes, lasers), so the drop lands out of the dark
  const toMark = buildStart == null ? 9 : 8 - ((((beat - buildStart) % 8) + 8) % 8);
  const preDrop = buildAmt > 0.55 && beat - buildStart >= 8 && toMark < 1.5;
  const lull = brain.playing && brain.lowSince > 9;
  const chill = light.style === 'chill' || lull;
  const rave = light.style === 'rave' && !lull;
  const dropHit = t - brain.lastDrop < 0.25;
  // energetic punches on every kick; chill breathes slowly over two bars instead
  const pulse = chill ? 0.5 + 0.5 * Math.sin(beat * Math.PI / 4) : (M || locked) ? Math.pow(1 - (((beat % 1) + 1) % 1), 3) : inputMode ? THREE.MathUtils.clamp((brain.bassFast - brain.bassSlow * 0.85) * 3.5, 0, 1) : 0.3;
  const k = light.intensity;
  // intensity sets how fast the rig moves and how hard it reacts to bass and drops, not how bright it is
  const energy = Math.min(1, brain.bassFast * (0.6 + 1.4 * k));
  const drop = t - brain.lastDrop < 0.5 + 2.5 * k;
  if (!remote.on) autoFx(t, beat); // on a listener's screen the DJ's club makes these choices
  // blackout: the music cut out mid-set, so the rig goes dark until it comes back
  const cut = light.fx.blackout && !brain.playing && t - auto.lastPlay < 30; // the music cut out mid-set
  const hitOn = !chill && light.fx.blinders && beat < auto.blindUntil;            // a blinder hit on a drop
  const scrDark = !light.on || cut || hitOn;
  const dark = scrDark || !!light.adDark; // the advert can hold the rig dark while the screen still plays
  // like a real rig: it eases down and slows through a build or a breakdown (nearly out just before the drop), then snaps to full the instant the drop lands
  const calmWant = preDrop ? 0 : (drop || dropHit) ? 1 : buildAmt > 0.15 ? 0.14 + 0.22 * buildAmt : lull ? 0.18 : 1;
  light.calm = calmWant > (light.calm ?? 1) ? ((drop || dropHit) ? 1 : Math.min(calmWant, (light.calm ?? 1) + dt * 0.5)) : Math.max(calmWant, (light.calm ?? 1) - dt * (preDrop ? 6 : 0.9));
  const calm = light.calm;
  const F = (light.adFade ?? 1) * calm; // the advert fades the whole rig in
  const pal = PALETTE.filter((_, i) => light.colours[i]);
  const colours = pal.length ? pal : PALETTE;
  const step = Math.floor(beat / Math.max(1, Math.round(8 - 6 * k))); // colour changes every 8 beats at low intensity, every 2 at high
  const speed = (0.4 + 1.6 * k) * (chill ? 0.35 : 1) * (preDrop ? 0 : 0.25 + 0.75 * calm);   // frozen in the blackout
  const strobe = !chill && !preDrop && ((drop && ((beat * 4) % 1 + 1) % 1 < 0.35)
    || (rave && energy > 0.45 && ((beat % 4) + 4) % 4 > 3 && ((beat * 2) % 1 + 1) % 1 < 0.4)      // rave: a burst on the last beat of every bar
    );
  pickLook(beat, drop);
  beams.forEach((b, i) => {
    if (dark) { b.material.opacity = 0; b.userData.lens.material.color.setRGB(0.02, 0.02, 0.02); b.userData.ring.material.color.setRGB(0.03, 0.03, 0.03); return; }
    // pan and tilt the head, and swing the beam with it; the look decides how
    const u = b.userData, mirror = i % 2 ? -1 : 1, col = i % 4, row = Math.floor(i / 4);
    const base = chill ? 0.3 + 0.2 * pulse + 0.15 * energy : 0.12 + (0.25 + 0.5 * energy) * (0.5 + 0.5 * pulse) * (brain.hype / 100 + 0.3);
    let P = 0, T = 0, lvl = base;
    const b4 = Math.floor(beat) % 4, b8 = Math.floor(beat) % 8;
    const lk = buildAmt > 0.15 && !chill ? 'fan' : look.name;
    switch (lk) {
      case 'down': lvl = chill ? base : 0.3 + 0.25 * pulse; break;                                          // all straight down, still
      case 'chase': lvl = (row ? 3 - b4 : b4) === col ? 0.75 : 0; break;                      // one at a time along the row, rows opposite ways
      case 'pingpong': { const p = b8 < 4 ? b8 : 7 - b8; lvl = p === col ? 0.75 : 0; break; } // back and forth along the row
      case 'pairs': lvl = (Math.floor(beat) % 2) === (col % 2) ? 0.6 * (0.4 + 0.6 * pulse) : 0; break; // alternate pairs on each beat
      case 'fan': P = (col - 1.5) * 0.32 * (1 - 0.7 * buildAmt) + (chill ? Math.sin(beat * Math.PI / 16 + col) * 0.12 : 0); T = 0.38 - 0.3 * buildAmt; lvl = chill ? base : 0.25 + 0.5 * pulse + 0.5 * buildAmt; break;          // still fan out over the crowd
      default:                                                                                 // sweeping
        P = mirror * Math.sin(beat * Math.PI / 4 * speed + i * 0.8) * 0.7;
        T = 0.3 + Math.cos(beat * Math.PI / 8 * speed + i * 0.6) * 0.35;
    }
    u.pan.rotation.y = P; u.tilt.rotation.x = T;
    b.position.set(u.x, u.y, u.z); b.rotation.set(T, P, 0, 'YXZ');
    const hex = colours[(lk === 'sweep' ? i + step : step) % colours.length];
    if (chill) b.material.color.lerp(_col.setHex(hex), Math.min(1, dt * 1.2)); // colours melt into each other
    else b.material.color.setHex(hex);
    if (strobe) b.material.color.lerp(WHITE, 0.6);
    if (buildAmt > 0) b.material.color.lerp(WHITE, 0.6 * buildAmt);
    if (rave && !strobe) lvl *= 0.6; // rave keeps the heads low and lets the lasers carry it
    b.material.opacity = preDrop ? 0 : (lvl + (strobe ? 0.5 : 0) + (dropHit ? 0.8 : 0)) * F;
    u.lens.material.color.copy(b.material.color).multiplyScalar(0.4 + b.material.opacity);
    u.ring.material.color.copy(b.material.color).multiplyScalar(0.25 + 1.2 * b.material.opacity);
  });
  washes.forEach((l, i) => {
    l.target.position.x = Math.sin(beat * Math.PI / 4 * speed + i * 2) * 1.6;
    if (dark) { l.intensity = 0; return; }
    const hex = colours[(i * 2 + step) % colours.length];
    if (chill) l.color.lerp(_col.setHex(hex), Math.min(1, dt * 1.2)); else l.color.setHex(hex);
    l.intensity = ((chill ? 22 + 18 * pulse + 12 * energy : rave ? 8 + 18 * energy + (strobe ? 70 : 0) : 12 + 40 * energy * (0.6 + 0.4 * pulse) + (strobe ? 60 : 0)) * (1 - 0.5 * buildAmt) + (dropHit ? 90 : 0)) * (preDrop ? 0.05 : 1) * F;
  });
  updateSideBars(beat, chill, strobe, dark || preDrop, hitOn, drop, pulse, F);
  if (dark) ledMat.color.setRGB(0.04, 0.04, 0.04);
  else ledMat.color.setHex(colours[step % colours.length]).multiplyScalar(0.45 + 0.55 * pulse);
  // the haze picks up whatever the rig is throwing, shaft by shaft
  updateAtmos(t, colours, step, Math.min(1, energy + 0.5 * buildAmt + (dropHit ? 0.5 : 0)), strobe, dark, F);
  // the giant C's double as blinders: they blast white on a hit, strobe on a drop, and stay glowing through a blackout
  const flick = ((beat * 4) % 1 + 1) % 1 < 0.5 ? 1 : 0.15;
  const want = !light.on || !light.fx.blinders ? 0 : hitOn ? 1 : cut ? 0.25 : drop ? (chill ? 0.3 : 0.8 * flick) : 0;
  auto.blind = want > auto.blind ? want : Math.max(want, auto.blind - dt * 3);
  updateCs(auto.blind);
  if (bloom) bloom.strength = (LITE ? 0.6 : 0.75) * (1 - 0.6 * auto.blind); // a blinder hit blows out enough on its own: ease the glow so the crowd stays visible
  updateScreen(t, beat, pulse, colours, step, scrDark, strobe || hitOn);
  updateLasers(t, beat, dark || calm < 0.2);
  updateCo2(dt, t);
}

// CO2 goes off on most drops, but only once a song: a deck's track is the song; with no deck (a stream, a mix) it is once every few minutes
function co2ThisDrop(t) {
  const c = cc(), M = c && (c.decks.find((d) => d.master && d.playing) || c.decks.find((d) => d.playing));
  const song = M && M.t ? (M.t.id || M.t.title || 'deck') : null;
  const fresh = song ? song !== auto.co2Song : t - (auto.co2At ?? -999) > 200;
  if (!fresh || Math.random() > 0.85) return false;
  auto.co2Song = song; auto.co2At = t; return true;
}
// decides when the effects fire: CO2 on big drops, lasers at random on drops, breakdowns or locked to the kick
function autoFx(t, beat) {
  if (brain.lastDrop !== auto.drop) {
    auto.drop = brain.lastDrop;
    if (light.fx.co2 && co2ThisDrop(t)) { light.sfx.co2 = t + SFX_LENGTH.co2; sfx.co2(); }
    sfx.drop();
    // sometimes the drop lands as a blinder hit: the rig blacks out and only the blinders blast the crowd
    if (light.fx.blinders && Math.random() < 0.35) auto.blindUntil = beat + 1.5;
    if (light.fx.laser && Math.random() < 0.6) { auto.laser = Math.random() < 0.5 ? 'drop' : 'cone'; auto.laserEnd = beat + 8 + 8 * Math.floor(Math.random() * 2); }
  }
  if (auto.laser && beat > auto.laserEnd) auto.laser = null;
  if (light.style === 'rave' && light.fx.laser && brain.playing && !auto.laser) { auto.laser = ['drop', 'kick', 'cone', 'drop'][Math.floor(Math.random() * 4)]; auto.laserEnd = beat + 16; }
  const phrase = Math.floor(beat / 16);
  if (phrase !== auto.phrase) {
    auto.phrase = phrase;
    if (light.fx.laser && !auto.laser && brain.playing) {
      const breakdown = brain.bassFast < 0.25;
      if (breakdown && Math.random() < 0.45) { auto.laser = Math.random() < 0.5 ? 'slow' : 'sheet'; auto.laserEnd = beat + 16; }
      else if (!breakdown && Math.random() < 0.18) { auto.laser = 'kick'; auto.laserEnd = beat + 8; }
    }
  }
  if ((light.style === 'chill' || (brain.playing && brain.lowSince > 9)) && auto.laser && auto.laser !== 'slow' && auto.laser !== 'sheet') auto.laser = Math.random() < 0.5 ? 'slow' : 'sheet';
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
  laser.core = new LineSegments2(laser.geo, mat(1.6, 1)); laser.glow = new LineSegments2(laser.geo, mat(LITE ? 6 : 8, 0.14));
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
  if (atmos.dots) atmos.dots.visible = !!mode;
  if (!mode) return;
  const P = laser.pos, C = laser.col, c = new THREE.Color();
  const hit = Math.pow(1 - (((beat % 1) + 1) % 1), 3);
  let k = 0, nd = 0;
  // each beam is brightest at the source and thins out into the haze towards the far end
  const seg = (a, b, col, lvl, fade = 0.2) => { const hitWall = lvl > 0.01 && clipToRoom(a, b); a.toArray(P, k * 6); b.toArray(P, k * 6 + 3); c.setHex(col).multiplyScalar(lvl * (light.adFade ?? 1)); c.toArray(C, k * 6); if (hitWall && atmos.dots) { b.toArray(atmos.dotPos, nd * 3); c.toArray(atmos.dotCol, nd * 3); nd++; } c.multiplyScalar(fade).toArray(C, k * 6 + 3); k++; };
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
  // real lasers shimmer as they cut through moving haze
  laser.core.material.opacity = 0.82 + 0.18 * Math.random();
  laser.glow.material.opacity = 0.12 + 0.06 * Math.sin(t * 23) * Math.sin(t * 7.3);
  if (atmos.dots) { atmos.dots.geometry.setDrawRange(0, nd); for (const a of ['position', 'color']) atmos.dots.geometry.attributes[a].needsUpdate = true; }
}

// ------------------------------------------------------------------ atmosphere
// Real club light only reads because there is haze in the air: the beams, washes and lasers are drawn through it,
// the beams throw pools of light on the floor, and the CO2 sinks into a low fog. Phones get a lighter version.
const LITE = /[?&]lite\b/.test(location.search) || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
const MAX_SHAFTS = 12; // light shafts the haze knows about: the moving heads first, then the washes

// 3D value noise, a few octaves: the drifting body of the haze
const NOISE_GLSL = `
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm3(vec3 p){ float v = 0.0, a = 0.55; for (int i = 0; i < 3; i++){ v += a * n3(p); p = p * 2.1 + 7.3; a *= 0.5; } return v; }
  float hazeAt(vec3 p, float t){
    float d = fbm3(p * 0.34 + vec3(t * 0.022, t * 0.011, -t * 0.017));
    d = 0.22 + 1.05 * d * d;
    return d * mix(1.0, 0.6, smoothstep(2.6, 4.4, p.y));   // it pools a little lower than the ceiling
  }`;

// the haze itself: slices facing the camera at increasing depths, each sampling the noise at its own point in the
// room and adding the light of every shaft that passes nearby. Viewed from any angle it reads as one volume.
const atmos = { group: null, slices: [], uni: null, pools: [], spots: [], dots: null, dotPos: null, dotCol: null, dotN: 0 };
function buildHaze() {
  const n = LITE ? 9 : 22;
  const uni = atmos.uni = {
    uTime: { value: 0 }, uTint: { value: new THREE.Color(0, 0, 0) }, uN: { value: 0 },
    uO: { value: Array.from({ length: MAX_SHAFTS }, () => new THREE.Vector3()) },
    uD: { value: Array.from({ length: MAX_SHAFTS }, () => new THREE.Vector3(0, -1, 0)) },
    uC: { value: Array.from({ length: MAX_SHAFTS }, () => new THREE.Color(0, 0, 0)) },
    uR: { value: Array.from({ length: MAX_SHAFTS }, () => new THREE.Vector3(0.06, 0.086, 8)) }, // start radius, spread, length
    uBox0: { value: new THREE.Vector3(-ROOM.w / 2, 0, ROOM.z1) }, uBox1: { value: new THREE.Vector3(ROOM.w / 2, ROOM.h, ROOM.z0) },
  };
  const vs = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const fs = `${NOISE_GLSL}
    #define M ${MAX_SHAFTS}
    uniform float uTime, uWeight; uniform int uN; uniform vec3 uTint, uBox0, uBox1;
    uniform vec3 uO[M], uD[M], uC[M], uR[M];
    varying vec3 vW;
    void main(){
      if (any(lessThan(vW, uBox0)) || any(greaterThan(vW, uBox1))) discard;   // only inside the room
      float dens = hazeAt(vW, uTime);
      vec3 col = uTint;
      for (int i = 0; i < M; i++){
        if (i >= uN) break;
        vec3 rp = vW - uO[i]; float t = dot(rp, uD[i]);
        if (t <= 0.0 || t >= uR[i].z) continue;
        float r = uR[i].x + uR[i].y * t, rad = length(rp - uD[i] * t);
        float g = 1.0 - smoothstep(r * 0.15, r * 1.2, rad);
        col += uC[i] * g * g / (1.0 + t * 0.32);
      }
      gl_FragColor = vec4(col * dens * uWeight, 1.0);
    }`;
  const g = atmos.group = new THREE.Group();
  const plane = new THREE.PlaneGeometry(2, 2);
  for (let i = 0; i < n; i++) {
    const a = i / (n - 1), d = 0.7 * Math.pow(17 / 0.7, a);              // closer slices are packed tighter
    const next = 0.7 * Math.pow(17 / 0.7, Math.min(1, (i + 1) / (n - 1)));
    const m = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: { ...uni, uWeight: { value: Math.max(0.15, next - d) * (LITE ? 0.16 : 0.12) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const s = new THREE.Mesh(plane, m); s.userData.d = d; s.frustumCulled = false; s.renderOrder = -1;
    g.add(s); atmos.slices.push(s);
  }
  g.add(buildPools(), buildLaserDots());
  return g;
}
// keep the slices in front of the camera, each just big enough to fill the view at its depth
function syncHaze() {
  if (!atmos.group || !camera) return;
  camera.updateMatrixWorld();
  const k = Math.tan((camera.fov * Math.PI) / 360) * 1.08;
  for (const s of atmos.slices) {
    const d = s.userData.d, h = d * k;
    s.position.copy(camera.position).add(_v.set(0, 0, -d).applyQuaternion(camera.quaternion));
    s.quaternion.copy(camera.quaternion);
    s.scale.set(h * camera.aspect, h, 1);
  }
}

// pools of light where the beams meet the floor: an ellipse stretched by how low the beam is raking
const poolMat = () => new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(0, 0, 0) } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 color; varying vec2 vU; void main(){ float r = length(vU) * 2.0; float a = pow(max(0.0, 1.0 - r), 1.8); gl_FragColor = vec4(color * a, 1.0); }',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
});
function buildPools() {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat());
    m.rotation.order = 'YXZ'; m.visible = false; g.add(m); atmos.pools.push(m);
  }
  return g;
}
// beam spotlights so the colour actually lands on people as the heads sweep over them (desktop only: they cost)
function buildBeamLights() {
  if (LITE) return;
  for (let i = 0; i < 8; i++) {
    const l = new THREE.SpotLight(0xffffff, 0, 13, 0.13, 0.65, 1.3);
    scene.add(l, l.target); atmos.spots.push(l);
  }
}

// laser hit dots: a sharp spot of light wherever a beam meets a wall, the ceiling or the floor
function buildLaserDots() {
  const n = FAN + CURTAIN + EXTRA;
  atmos.dotPos = new Float32Array(n * 3); atmos.dotCol = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(atmos.dotPos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(atmos.dotCol, 3));
  g.setDrawRange(0, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 600 } },
    vertexShader: 'attribute vec3 color; varying vec3 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(0.09 * scale / -mv.z, 2.0, 40.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2) + 0.9 * pow(max(0.0, 1.0 - r * 3.0), 2.0); gl_FragColor = vec4(vC * a, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  atmos.dots = new THREE.Points(g, m); atmos.dots.frustumCulled = false;
  return atmos.dots;
}
// shorten a laser to where it first meets the room, and remember where it hit
function clipToRoom(a, b) {
  const lo = [-ROOM.w / 2 + 0.06, 0.02, ROOM.z1 + 0.06], hi = [ROOM.w / 2 - 0.06, ROOM.h - 0.03, ROOM.z0 - 0.06];
  const d = [b.x - a.x, b.y - a.y, b.z - a.z], p = [a.x, a.y, a.z];
  let tMin = 1;
  for (let k = 0; k < 3; k++) {
    if (d[k] > 1e-6) tMin = Math.min(tMin, (hi[k] - p[k]) / d[k]);
    else if (d[k] < -1e-6) tMin = Math.min(tMin, (lo[k] - p[k]) / d[k]);
  }
  if (tMin < 1 && tMin > 0) b.set(a.x + d[0] * tMin, a.y + d[1] * tMin, a.z + d[2] * tMin);
  return tMin <= 1;
}

const _o = new THREE.Vector3(), _dir = new THREE.Vector3(), _col = new THREE.Color();
// every frame: feed the haze the shafts of light, place the floor pools, and point the beam lights
function updateAtmos(t, colours, step, energy, strobe, dark, F) {
  if (!atmos.uni) return;
  const u = atmos.uni; u.uTime.value = t;
  // a faint glow of the rig's colour through the whole room, brighter on the drops
  const amb = dark ? 0 : (0.018 + 0.03 * energy + (strobe ? 0.035 : 0)) * F;
  u.uTint.value.setHex(colours[step % colours.length]).lerp(_col.setRGB(0.6, 0.62, 0.7), 0.45).multiplyScalar(amb);
  let n = 0;
  beams.forEach((b, i) => {
    b.updateMatrixWorld(true);
    _o.set(0, -0.15, 0).applyMatrix4(b.matrixWorld);
    _dir.set(0, -1, 0).transformDirection(b.matrixWorld);
    const lvl = dark ? 0 : b.material.opacity;
    if (n < MAX_SHAFTS) {
      u.uO.value[n].copy(_o); u.uD.value[n].copy(_dir);
      u.uC.value[n].copy(b.material.color).multiplyScalar(lvl * 0.9);
      u.uR.value[n].set(0.06, 0.086, 8.2); n++;
    }
    // floor pool
    const pool = atmos.pools[i];
    if (pool) {
      const tHit = _dir.y < -0.05 ? -_o.y / _dir.y : Infinity;
      pool.visible = lvl > 0.01 && tHit < 8.2;
      if (pool.visible) {
        const r = (0.06 + 0.086 * tHit) * 1.15, rake = Math.min(3, 1 / Math.max(0.33, -_dir.y));
        pool.position.set(_o.x + _dir.x * tHit, 0.012, _o.z + _dir.z * tHit);
        pool.rotation.set(-Math.PI / 2, Math.atan2(_dir.x, _dir.z), 0);
        pool.scale.set(r * 2, r * 2 * rake, 1);
        pool.material.uniforms.color.value.copy(b.material.color).multiplyScalar(lvl * 0.55 / (1 + tHit * 0.08));
      }
    }
    const sp = atmos.spots[i];
    if (sp) {
      sp.position.copy(_o); sp.target.position.copy(_o).addScaledVector(_dir, 6);
      sp.color.copy(b.material.color); sp.intensity = lvl * 60;
    }
  });
  // the washes are wide soft cones from the truss: they light the haze too
  for (const l of washes) {
    if (n >= MAX_SHAFTS) break;
    _dir.copy(l.target.position).sub(l.position).normalize();
    u.uO.value[n].copy(l.position); u.uD.value[n].copy(_dir);
    u.uC.value[n].copy(l.color).multiplyScalar(dark ? 0 : l.intensity * 0.0038);
    u.uR.value[n].set(0.12, Math.tan(l.angle) * 0.85, 7.5); n++;
  }
  u.uN.value = n;
  if (atmos.dots) atmos.dots.material.uniforms.scale.value = renderer ? renderer.domElement.height : 600;
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
const co2 = { fog: null, pts: null, pos: null, vel: null, life: null, max: null, size: null, alpha: null };
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
  co2.size = new Float32Array(CO2_MAX); co2.alpha = new Float32Array(CO2_MAX); co2.fog = new Uint8Array(CO2_MAX);
  g.setAttribute('position', new THREE.BufferAttribute(co2.pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(co2.size, 1));
  g.setAttribute('alpha', new THREE.BufferAttribute(co2.alpha, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: 'attribute float size; attribute float alpha; varying float va; uniform float scale; void main(){ va = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    uniforms: { scale: { value: 600 }, map: { value: smokeTexture() }, uTint: { value: new THREE.Color(0.78, 0.8, 0.84) } },
    fragmentShader: 'uniform sampler2D map; uniform vec3 uTint; varying float va; void main(){ vec4 c = texture2D(map, gl_PointCoord); if (c.a < 0.01) discard; gl_FragColor = vec4(uTint, c.a * va); }',
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
  // the gas takes on the colour of the light passing through it
  const tint = co2.pts.material.uniforms.uTint.value;
  tint.setRGB(0.8, 0.8, 0.82); if (beams[0] && beams[0].material.opacity > 0.02) tint.lerp(beams[0].material.color, 0.3);
  for (let i = 0; i < CO2_MAX; i++) {
    const j = i * 3;
    if (co2.life[i] <= 0) {
      if (spawn <= 0) { co2.alpha[i] = 0; continue; }
      spawn--;
      const n = NOZZLES[i % 2], sp = rnd(10, 14);
      co2.pos[j] = n.p.x; co2.pos[j + 1] = n.p.y; co2.pos[j + 2] = n.p.z;
      co2.vel[j] = (n.d.x + rnd(-0.07, 0.07)) * sp; co2.vel[j + 1] = (n.d.y + rnd(-0.07, 0.07)) * sp; co2.vel[j + 2] = (n.d.z + rnd(-0.07, 0.07)) * sp;
      co2.life[i] = co2.max[i] = rnd(2.2, 3.4); co2.fog[i] = 0;
    }
    co2.life[i] -= dt;
    if (co2.life[i] <= 0) { co2.alpha[i] = 0; continue; }
    let age = 1 - co2.life[i] / co2.max[i]; // 0 at the nozzle, 1 when it's gone
    // once it has sunk to knee height it stops being a jet and spreads out into a low fog that lingers
    if (!co2.fog[i] && age > 0.4 && co2.pos[j + 1] < 0.55) { const x = rnd(2.5, 4.5); co2.fog[i] = 1; co2.life[i] += x; co2.max[i] += x; age = 1 - co2.life[i] / co2.max[i]; }
    if (co2.fog[i]) {
      const f = Math.exp(-1.2 * dt);
      co2.vel[j] = co2.vel[j] * f + rnd(-1, 1) * 0.6 * dt; co2.vel[j + 1] = co2.vel[j + 1] * 0.5 * f; co2.vel[j + 2] = co2.vel[j + 2] * f + rnd(-1, 1) * 0.6 * dt;
      co2.pos[j] += co2.vel[j] * dt; co2.pos[j + 1] = Math.max(0.12, co2.pos[j + 1] + co2.vel[j + 1] * dt - 0.04 * dt); co2.pos[j + 2] += co2.vel[j + 2] * dt;
      co2.size[i] = Math.min(2.2, co2.size[i] + dt * 0.35);
      co2.alpha[i] = Math.min(0.16, co2.alpha[i] + dt) * Math.min(1, co2.life[i] / 1.5) * (light.adFade ?? 1);
      continue;
    }
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
    // (the synthesized gliding "woo" voices were removed: they sounded like a scream)
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
  lightMenu.querySelectorAll('[data-fx]').forEach((b) => b.classList.toggle('on', light.fx[b.dataset.fx]));
  lightMenu.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('on', light.style === b.dataset.style));
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
    else if (b.dataset.style) { light.style = b.dataset.style; try { localStorage.setItem('cc-light-style', light.style); } catch (_) {} }
    else if (b.dataset.lm === 'mute') sfx.on = !sfx.on;
    syncLightMenu();
  });
  try { const st = localStorage.getItem('cc-light-style'); if (st === 'chill' || st === 'energetic' || st === 'rave') light.style = st; } catch (_) {}
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
  const backend = await import('./backend.js?v=2').catch((e) => { console.warn('backend unavailable', e); return null; });
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
  adaptPx();
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  think(dt, t);
  applyRemote(t);
  pushRoomState(t);
  updatePeople(dt);
  updateFlying(dt);
  updateTexts(dt);
  lights(t, dt);
  sfx.bed(brain.playing, brain.hype);
  if (camView === 'pan' && mode === 'club') updatePanCam(curBeat);
  if (window.__adFrame) window.__adFrame(camera, dt, t);
  syncHaze();
  composer.render();
  if (snapReq) { const r = snapReq; snapReq = null; try { const cv = document.createElement('canvas'); cv.width = 224; cv.height = 126; cv.getContext('2d').drawImage(renderer.domElement, 0, 0, 224, 126); r(cv.toDataURL('image/jpeg', 0.55)); } catch (_) { r(null); } }
  updateDj(dt, t);
  // two-sided meter: grows left from the middle when angry, right when happy
  const hv = brain.hype;
  hudBar.style.left = Math.min(hv, 50) + '%';
  hudBar.style.width = Math.abs(hv - 50) + '%';
  hudBar.className = hv < 50 ? 'bad' : 'good';
  if (hudMood.textContent !== brain.mood) hudMood.textContent = brain.mood;
}

async function loadDj() {
  const src = await new GLTFLoader().loadAsync('models/robot.glb');
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
  {   // the robot has the crowd's moves, not a DJ's: work the decks with the two-step, hype on drops, put its hands up and clap now and then
    const A = { ...actions };
    for (const k of Object.keys(actions)) delete actions[k];
    Object.assign(actions, { play: A.dance4 || A.dance, idle: A.idle, hype: A.hype || A.dance2, wave: A.handsup || A.cheer, kiss: A.clap || A.cheer });
    for (const k of Object.keys(actions)) if (!actions[k]) delete actions[k];
  }
  for (const n of ['wave', 'hype', 'kiss']) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce); actions[n].clampWhenFinished = true; }
  dj = { root, mixer, actions, now: null, busy: false, next: 8, drop: brain.lastDrop };
  {   // give it the Club Cloud head: glass dome, the logo's two C's and the LED face
    let head = null; root.traverse((o) => { if (o.isBone && /^(head|mixamorigHead)$/i.test(o.name)) head = o; });
    root.updateMatrixWorld(true);
    if (head) { dj.pseudo = { root, head }; dj.pseudo.robot = buildRobotHead(head, dj.pseudo); }
  }
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
  if (dj.pseudo && dj.now === 'play' && lastBeats != null && dj.actions.play) {   // the robot's two-step stays on the beat
    const a = dj.actions.play, dur = a.getClip().duration, bars = dur > 3 ? 16 : 2;
    a.time = (((((lastBeats % bars) + bars) % bars) / bars) * dur); a.timeScale = 0;
  } else if (dj.pseudo && dj.actions.play) dj.actions.play.timeScale = 1;
  dj.mixer.update(dt);
  if (dj.pseudo) updateRobot(dj.pseudo, t, lastKick);
  if (camView === 'booth') djRenderer.render(djScene, camera);
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
  bloom = LITE ? new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.86) : new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.55, 0.82); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  resize();
  try { await loadCrowd(); await loadDj(); try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); } catch (_) {} loadMsg.querySelector('.ldbar')?.style.setProperty('--p', 1); resize(); loadMsg.hidden = true; }   // shaders are compiled now too, so the first frame has no hitch
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
// Load the club in the background while someone is on the decks, so CLUB opens straight away. It waits for the page to settle and for an idle moment,
// and does nothing until then so the decks come first.
const preloadClub = () => { if (!started && mode === 'off') start().catch((e) => console.warn('club preload', e)); };
const whenIdle = () => (window.requestIdleCallback ? window.requestIdleCallback(preloadClub, { timeout: 6000 }) : setTimeout(preloadClub, 3000));
if (document.readyState === 'complete') setTimeout(whenIdle, 1500); else addEventListener('load', () => setTimeout(whenIdle, 1500));
window.addEventListener('resize', () => { if (renderer && mode !== 'off') resize(); });
window.__club = { snapshot, live, remote, useInput, useStream, stopInput, applySync, endSync, syncPacket, setVeil, get scene() { return scene; }, get clock() { return clock; }, co2: () => { light.sfx.co2 = clock.elapsedTime + SFX_LENGTH.co2; sfx.co2(); }, get camera() { return camera; }, get ready() { return !!dj; }, BACKDROP: { y: 2.32, z: 1.75, r: 2.08 }, look, screen, auto, sfx, chat: (i) => chat(people[i], clock.elapsedTime), hold: (i, c, s) => holdFor(people[i], c, s), tick: (dt, t) => { think(dt, t); updatePeople(dt); updateFlying(dt); updateTexts(dt); }, brain, people, light, setLight, connectRoom, react: (i, c) => react(people[i], c, ['TEST'], true), throwAt };
