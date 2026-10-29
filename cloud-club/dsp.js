/* DSP: deck playback (scratch, loops, slip, master tempo), channel strip
   (trim, isolator EQ, sound colour FX) and the Beat FX unit.
   Runs inside an AudioWorklet; the same classes back a ScriptProcessor fallback. */
(function (G) {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DN = 1e-20;

class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  run(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2 + DN;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  set(type, f, q, sr) {
    f = clamp(f, 10, sr * 0.45);
    const w = TAU * f / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; } // band-pass
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  reset() { this.z1 = this.z2 = 0; }
}

class Delay {
  constructor(n) { this.n = Math.max(4, n | 0); this.b = new Float32Array(this.n); this.w = 0; }
  push(x) { this.b[this.w] = x; if (++this.w >= this.n) this.w = 0; }
  // d = samples behind the newest written sample (>= 1)
  read(d) {
    let r = this.w - d;
    while (r < 0) r += this.n;
    const i = r | 0, f = r - i, j = i + 1 >= this.n ? 0 : i + 1;
    return this.b[i] + (this.b[j] - this.b[i]) * f;
  }
  clear() { this.b.fill(0); this.w = 0; }
}

class Comb {
  constructor(n) { this.b = new Float32Array(n); this.i = 0; this.f = 0; this.fb = 0.84; this.d = 0.2; }
  run(x) {
    const o = this.b[this.i];
    this.f = o * (1 - this.d) + this.f * this.d + DN;
    this.b[this.i] = x + this.f * this.fb;
    if (++this.i >= this.b.length) this.i = 0;
    return o;
  }
}
class AllPass {
  constructor(n) { this.b = new Float32Array(n); this.i = 0; }
  run(x) {
    const o = this.b[this.i];
    this.b[this.i] = x + o * 0.5 + DN;
    if (++this.i >= this.b.length) this.i = 0;
    return o - x;
  }
}
// Freeverb
class Reverb {
  constructor(sr) {
    const k = sr / 44100;
    const C = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], A = [556, 441, 341, 225];
    this.cl = C.map(n => new Comb((n * k) | 0)); this.cr = C.map(n => new Comb(((n + 23) * k) | 0));
    this.al = A.map(n => new AllPass((n * k) | 0)); this.ar = A.map(n => new AllPass(((n + 23) * k) | 0));
    this.L = 0; this.R = 0; this.set(0.8, 0.3);
  }
  set(room, damp) { for (const c of this.cl) { c.fb = room; c.d = damp; } for (const c of this.cr) { c.fb = room; c.d = damp; } }
  run(x) {
    const s = x * 0.015; let l = 0, r = 0;
    for (let j = 0; j < 8; j++) { l += this.cl[j].run(s); r += this.cr[j].run(s); }
    for (let j = 0; j < 4; j++) { l = this.al[j].run(l); r = this.ar[j].run(r); }
    this.L = l; this.R = r;
  }
}
// Delay-line pitch shifter with two crossfaded taps
class Shifter {
  constructor(sr) { this.W = (sr * 0.06) | 0; this.dl = new Delay(this.W + 8); this.dr = new Delay(this.W + 8); this.ph = 0; this.ratio = 1; this.L = 0; this.R = 0; }
  run(l, r) {
    this.dl.push(l); this.dr.push(r);
    this.ph += (1 - this.ratio) / this.W;
    if (this.ph >= 1) this.ph -= 1; else if (this.ph < 0) this.ph += 1;
    const p2 = this.ph + 0.5 >= 1 ? this.ph - 0.5 : this.ph + 0.5;
    const d1 = 2 + this.ph * this.W, d2 = 2 + p2 * this.W;
    const g1 = Math.sin(Math.PI * this.ph), g2 = Math.sin(Math.PI * p2);
    const a = g1 * g1, b = g2 * g2;
    this.L = this.dl.read(d1) * a + this.dl.read(d2) * b;
    this.R = this.dr.read(d1) * a + this.dr.read(d2) * b;
  }
}

/* ---------------------------------------------------------------- DECK */
// Sound colour FX ids
const C_SPACE = 1, C_DUB = 2, C_SWEEP = 3, C_NOISE = 4, C_CRUSH = 5, C_FILTER = 6;

class DeckDSP {
  constructor(sr) {
    this.sr = sr;
    this.L = null; this.R = null; this.N = 0;
    this.pos = 0; this.playing = false; this.motor = 0; this.rampUp = 0; this.rampDown = 0;
    this.speed = 1; this.rate = 0;
    this.scr = false; this.scrTarget = 0; this.scrVel = 0; this.scrTau = 0.012;
    this.keylock = false; this.kl = false;
    this.loopOn = false; this.loopIn = 0; this.loopOut = 0;
    this.slip = false; this.slipPos = 0; this.slipSpeed = 1;
    this.spin = 0; this.spinLen = 1;
    this.echoOut = 0;
    this.events = [];
    // master tempo (WSOLA)
    let g = 256; while (g < sr * 0.045) g <<= 1;
    this.G = g; this.H = g >> 1;
    this.win = new Float32Array(g);
    for (let i = 0; i < g; i++) this.win[i] = 0.5 - 0.5 * Math.cos(TAU * i / g);
    this.accL = new Float32Array(g); this.accR = new Float32Array(g); this.hop = 0; this.prev = -1;
    // channel strip
    this.mute = false;
    this.trimT = 1; this.trim = 1;
    this.gT = [1, 1, 1]; this.g = [1, 1, 1];
    this.lp = [new Biquad(), new Biquad(), new Biquad(), new Biquad()];
    this.hp = [new Biquad(), new Biquad(), new Biquad(), new Biquad()];
    for (const b of this.lp) b.set('lp', 220, Math.SQRT1_2, sr);
    for (const b of this.hp) b.set('hp', 2800, Math.SQRT1_2, sr);
    this.cType = 0; this.cT = 0; this.c = 0; this.param = 0.5; this.beatSec = 0.5;
    this.cf = [new Biquad(), new Biquad()]; this.cfKey = '';
    this.wf = [new Biquad(), new Biquad()]; this.wfKey = '';
    this.rev = new Reverb(sr);
    this.eL = new Delay(sr * 4); this.eR = new Delay(sr * 4);
    this.ef = [new Biquad(), new Biquad()]; this.efKey = '';
    this.env = 0; this.gate = 1;
    this.hold = [0, 0]; this.holdN = 0;
    this.seed = 12345;
    this.peak = 0;
    this.n = 0;
  }

  cmd(m) {
    switch (m.cmd) {
      case 'load':
        this.L = m.L; this.R = m.R || m.L; this.N = m.L.length;
        this.pos = m.pos || 0; this.playing = false; this.motor = 0; this.loopOn = false;
        this.slip = false; this.scr = false; this.spin = 0; this.echoOut = 0; this.resetKL();
        break;
      case 'unload': this.L = this.R = null; this.N = 0; this.playing = false; this.motor = 0; break;
      case 'set': for (const k in m.v) this[k] = m.v[k]; break;
      case 'seek': this.pos = clamp(m.pos, 0, Math.max(0, this.N - 2)); if (this.scr) this.scrTarget = this.pos; this.resetKL(); break;
      case 'jump': { // optional phase-preserving jump: q = [firstBeat, beatLen] in samples
        let to = m.pos;
        if (m.q) {
          const [f, b] = m.q, ph = (x) => ((x - f) % b + b) % b;
          let d = ph(this.pos) - ph(to);
          if (d < 0) d += b;
          to += d;
        }
        this.pos = clamp(to, 0, Math.max(0, this.N - 2)); this.resetKL();
        break;
      }
      case 'play': this.playing = true; if (m.instant) this.motor = 1; break;
      case 'pause': this.playing = false; if (m.instant) this.motor = 0; break;
      case 'scratch':
        this.scr = !!m.on;
        if (this.scr) { this.scrTarget = this.pos; this.scrVel = this.speed * this.motor; }
        break;
      case 'nudge': this.scrTarget += m.d; break;
      case 'loop': this.loopOn = !!m.on; this.loopIn = m.in | 0; this.loopOut = m.out | 0; break;
      case 'slip':
        if (m.on) { this.slip = true; this.slipPos = this.pos; }
        else { if (this.slip && m.ret) { this.pos = this.slipPos; if (this.scr) this.scrTarget = this.pos; this.resetKL(); } this.slip = false; }
        break;
      case 'backspin': this.spin = this.spinLen = Math.max(1, m.len * this.sr); this.playing = false; break;
      case 'echoOut': this.echoOut = m.len * this.sr; break;
    }
  }

  resetKL() { this.accL.fill(0); this.accR.fill(0); this.hop = 0; this.prev = -1; }

  wrapIdx(j) {
    if (this.loopOn && j >= this.loopOut && this.loopOut > this.loopIn) j -= (this.loopOut - this.loopIn);
    return j;
  }
  mono(j) { j = this.wrapIdx(j); return j >= 0 && j < this.N ? this.L[j] + this.R[j] : 0; }

  grain(rate) {
    const G = this.G, H = this.H, L = this.L, R = this.R;
    const ideal = Math.round(this.pos + H * rate - H);
    let best = ideal;
    if (this.prev >= 0) {
      const nat = this.prev + H, D = H >> 1;
      let bc = -Infinity;
      for (let d = -D; d <= D; d += 8) {
        const s = ideal + d; let c = 0;
        for (let k = 0; k < H; k += 4) c += this.mono(nat + k) * this.mono(s + k);
        if (c > bc) { bc = c; best = s; }
      }
      const b0 = best;
      for (let d = -7; d <= 7; d++) {
        if (!d) continue;
        const s = b0 + d; let c = 0;
        for (let k = 0; k < H; k += 4) c += this.mono(nat + k) * this.mono(s + k);
        if (c > bc) { bc = c; best = s; }
      }
    }
    this.prev = best;
    const aL = this.accL, aR = this.accR, w = this.win, N = this.N;
    for (let k = 0; k < G; k++) {
      const j = this.wrapIdx(best + k);
      if (j >= 0 && j < N) { aL[k] += w[k] * L[j]; aR[k] += w[k] * R[j]; }
    }
  }

  read(B, p) { // cubic hermite
    const i = Math.floor(p), f = p - i, N = this.N;
    const xm = i > 0 && i - 1 < N ? B[i - 1] : 0, x0 = i >= 0 && i < N ? B[i] : 0;
    const x1 = i + 1 < N && i + 1 >= 0 ? B[i + 1] : 0, x2 = i + 2 < N && i + 2 >= 0 ? B[i + 2] : 0;
    const c1 = 0.5 * (x1 - xm), c2 = xm - 2.5 * x0 + 2 * x1 - 0.5 * x2, c3 = 0.5 * (x2 - xm) + 1.5 * (x0 - x1);
    return ((c3 * f + c2) * f + c1) * f + x0;
  }

  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 2147483648 - 1; }

  process(oL, oR, n) {
    const L = this.L, R = this.R, N = this.N, sr = this.sr;
    let kl = false;
    if (L) kl = this.keylock && !this.scr && this.spin <= 0 && this.playing && this.motor >= 1 &&
      this.speed > 0.3 && this.speed < 3 && Math.abs(this.speed - 1) > 1e-4;
    if (kl !== this.kl) { this.kl = kl; this.resetKL(); }
    const up = this.rampUp > 0 ? 1 / (this.rampUp * sr) : 1, dn = this.rampDown > 0 ? 1 / (this.rampDown * sr) : 1;
    const va = 1 - Math.exp(-1 / (0.0025 * sr));
    const sm = 0.0015;
    this.colorSetup();
    for (let i = 0; i < n; i++) {
      let xl = 0, xr = 0;
      if (L) {
        if (this.playing) { if (this.motor < 1) this.motor = Math.min(1, this.motor + up); }
        else if (this.motor > 0) this.motor = Math.max(0, this.motor - dn);
        let rate;
        if (this.scr) {
          const want = clamp((this.scrTarget - this.pos) / (this.scrTau * sr), -16, 16);
          this.scrVel += (want - this.scrVel) * va;
          rate = this.scrVel;
        } else if (this.spin > 0) {
          const t = 1 - this.spin / this.spinLen;
          rate = t < 0.06 ? 1 - (t / 0.06) * 4 : -3 * Math.pow(1 - (t - 0.06) / 0.94, 2);
          if (--this.spin <= 0) this.motor = 0;
        } else rate = this.speed * this.motor;
        this.rate = rate;
        if (kl) {
          if (this.hop === 0) this.grain(rate);
          xl = this.accL[this.hop]; xr = this.accR[this.hop];
          if (++this.hop >= this.H) {
            this.accL.copyWithin(0, this.H); this.accR.copyWithin(0, this.H);
            this.accL.fill(0, this.G - this.H); this.accR.fill(0, this.G - this.H);
            this.hop = 0;
          }
        } else if (rate !== 0) {
          const vg = Math.min(1, Math.abs(rate) * 14);
          xl = this.read(L, this.pos) * vg; xr = this.read(R, this.pos) * vg;
        }
        this.pos += rate;
        if (this.loopOn && this.loopOut > this.loopIn) {
          const len = this.loopOut - this.loopIn;
          if (this.pos >= this.loopOut) { this.pos -= len; if (this.scr) this.scrTarget -= len; }
          else if (rate < 0 && this.pos < this.loopIn) { this.pos += len; if (this.scr) this.scrTarget += len; }
        }
        if (this.pos >= N - 2) {
          this.pos = N - 2;
          if (this.playing || this.motor > 0) { this.playing = false; this.motor = 0; this.events.push('end'); }
        } else if (this.pos < 0) {
          this.pos = 0;
          if (!this.scr && this.spin <= 0 && rate < 0) { this.playing = false; this.motor = 0; this.events.push('start'); }
        }
        if (this.slip) { this.slipPos += this.slipSpeed; if (this.slipPos > N - 2) this.slipPos = N - 2; }
        if (this.echoOut > 0 && --this.echoOut <= 0) { this.playing = false; this.motor = 0; this.events.push('stopped'); }
      }
      // ---- channel strip
      this.trim += (this.trimT - this.trim) * sm;
      const g = this.g, gT = this.gT;
      g[0] += (gT[0] - g[0]) * sm; g[1] += (gT[1] - g[1]) * sm; g[2] += (gT[2] - g[2]) * sm;
      this.c += (this.cT - this.c) * sm;
      let l = this.mute ? 0 : xl * this.trim, r = this.mute ? 0 : xr * this.trim;
      const lowL = this.lp[1].run(this.lp[0].run(l)), lowR = this.lp[3].run(this.lp[2].run(r));
      const hiL = this.hp[1].run(this.hp[0].run(l)), hiR = this.hp[3].run(this.hp[2].run(r));
      l = g[0] * lowL + g[1] * (l - lowL - hiL) + g[2] * hiL;
      r = g[0] * lowR + g[1] * (r - lowR - hiR) + g[2] * hiR;
      this.colorRun(l, r);
      l = this.oL; r = this.oR;
      const al = l < 0 ? -l : l, ar = r < 0 ? -r : r;
      if (al > this.peak) this.peak = al;
      if (ar > this.peak) this.peak = ar;
      oL[i] = l; oR[i] = r;
    }
  }

  // Coefficients for the colour FX filters (updated once per block)
  colorSetup() {
    const c = this.cT, a = Math.abs(c), sr = this.sr, t = this.cType;
    const q = 0.7 + this.param * 4;
    let key = '';
    if (t === C_FILTER || t === C_NOISE || t === C_CRUSH) {
      const lp = c < 0;
      let f;
      if (t === C_FILTER) f = lp ? 20000 * Math.pow(70 / 20000, a) : 20 * Math.pow(9000 / 20, a);
      else if (t === C_NOISE) f = lp ? 20000 * Math.pow(250 / 20000, a) : 20 * Math.pow(9000 / 20, a);
      else f = lp ? 20000 * Math.pow(900 / 20000, a) : 20 * Math.pow(2500 / 20, a);
      const qq = t === C_FILTER ? q : 0.9;
      key = (lp ? 'l' : 'h') + Math.round(f) + ':' + qq.toFixed(2);
      if (key !== this.cfKey) { this.cfKey = key; for (const b of this.cf) b.set(lp ? 'lp' : 'hp', f, qq, sr); }
    } else if (t === C_SWEEP && c > 0) {
      const f = 150 * Math.pow(60, a);
      key = 'b' + Math.round(f) + ':' + q.toFixed(2);
      if (key !== this.cfKey) { this.cfKey = key; for (const b of this.cf) b.set('bp', f, 1 + this.param * 5, sr); }
    }
    // reverb wet filter
    if (t === C_SPACE) {
      const lp = c < 0, f = lp ? 400 + 8000 * Math.pow(1 - a, 2) : 150 + 2500 * a;
      const k = (lp ? 'l' : 'h') + Math.round(f);
      if (k !== this.wfKey) { this.wfKey = k; for (const b of this.wf) b.set(lp ? 'lp' : 'hp', f, 0.8, sr); }
      this.rev.set(0.7 + this.param * 0.28, 0.25);
    }
    // echo feedback filter
    const dub = t === C_DUB;
    const elp = dub ? c < 0 : true;
    const ef = dub ? (elp ? 600 + 6000 * Math.pow(1 - a, 2) : 200 + 2200 * a) : 4500;
    const ek = (elp ? 'l' : 'h') + Math.round(ef);
    if (ek !== this.efKey) { this.efKey = ek; for (const b of this.ef) b.set(elp ? 'lp' : 'hp', ef, 0.7, sr); }
  }

  colorRun(l, r) {
    const t = this.cType, c = this.c, a = Math.abs(c), on = a > 0.015;
    // space reverb (always runs so tails decay)
    const spaceSend = t === C_SPACE && on ? a : 0;
    this.rev.run((l + r) * 0.5 * spaceSend);
    let wl = this.wf[0].run(this.rev.L * 3), wr = this.wf[1].run(this.rev.R * 3);
    // dub echo + release-FX echo
    const D = clamp(this.beatSec * this.sr, 64, this.eL.n - 4);
    const echoSend = (t === C_DUB && on ? a : 0) + (this.echoOut > 0 ? 1 : 0);
    const fb = this.echoOut > 0 ? 0.6 : 0.45 + this.param * 0.45;
    const el = this.ef[0].run(this.eL.read(D)), er = this.ef[1].run(this.eR.read(D));
    this.eL.push(l * echoSend + el * fb); this.eR.push(r * echoSend + er * fb);
    let ol = l, or = r;
    if (on) {
      switch (t) {
        case C_FILTER: {
          const m = Math.min(1, a / 0.08);
          ol = l + (this.cf[0].run(l) - l) * m; or = r + (this.cf[1].run(r) - r) * m;
          break;
        }
        case C_SWEEP: {
          if (c < 0) {
            const e = Math.max(Math.abs(l), Math.abs(r));
            this.env = e > this.env ? this.env + (e - this.env) * 0.3 : this.env * 0.9993;
            const thr = a * 0.45 * (0.4 + this.param);
            const gt = this.env > thr ? 1 : 0;
            this.gate += (gt - this.gate) * (gt > this.gate ? 0.05 : 0.004);
            const gg = 1 - a + a * this.gate;
            ol = l * gg; or = r * gg;
          } else {
            const bl = this.cf[0].run(l) * 2.2, br = this.cf[1].run(r) * 2.2;
            ol = l + (bl - l) * a; or = r + (br - r) * a;
          }
          break;
        }
        case C_NOISE: {
          const lev = a * 0.22 * (0.4 + this.param);
          ol = l + this.cf[0].run(this.rnd()) * lev; or = r + this.cf[1].run(this.rnd()) * lev;
          break;
        }
        case C_CRUSH: {
          const bits = 16 - a * 13, q = Math.pow(2, bits - 1);
          const ds = 1 + Math.floor(a * a * (4 + this.param * 28));
          if (++this.holdN >= ds) { this.holdN = 0; this.hold[0] = Math.round(l * q) / q; this.hold[1] = Math.round(r * q) / q; }
          const cl = this.cf[0].run(this.hold[0] * (1 + this.param)), cr = this.cf[1].run(this.hold[1] * (1 + this.param));
          const m = Math.min(1, a * 4);
          ol = l + (cl - l) * m; or = r + (cr - r) * m;
          break;
        }
      }
    } else if (t === C_FILTER || t === C_SWEEP) { this.cf[0].run(0); this.cf[1].run(0); }
    this.oL = ol + wl + el; this.oR = or + wr + er;
  }

  report() {
    const r = { pos: this.pos, rate: this.rate, playing: this.playing, motor: this.motor, slip: this.slip, slipPos: this.slipPos, peak: this.peak, scr: this.scr, ev: this.events.length ? this.events.splice(0) : null };
    this.peak = 0;
    return r;
  }
}

/* ---------------------------------------------------------------- BEAT FX */
const FX_FILTER = 0, FX_FLANGER = 1, FX_TRANS = 2, FX_PHASER = 3, FX_REVERB = 4, FX_PITCH = 5, FX_SPIRAL = 6,
  FX_SLIPROLL = 7, FX_PINGPONG = 8, FX_ROLL = 9, FX_ECHO = 10, FX_BRAKE = 11, FX_DELAY = 12, FX_HELIX = 13;

class BeatFxDSP {
  constructor(sr) {
    this.sr = sr; this.type = FX_ECHO; this.on = false; this.depth = 0.5; this.time = 0.5; this.amt = 50;
    this.mix = 0; this.ph = 0;
    this.dl = new Delay(sr * 9); this.dr = new Delay(sr * 9);
    this.fl = new Delay(sr * 0.03); this.fr = new Delay(sr * 0.03);
    this.apL = new Float32Array(6); this.apR = new Float32Array(6); this.pfL = 0; this.pfR = 0; this.apA = 0;
    this.rev = new Reverb(sr);
    this.bq = [new Biquad(), new Biquad()]; this.bqN = 0;
    this.sh = new Shifter(sr);
    this.cap = new Delay(sr * 12); this.capR = new Delay(sr * 12);
    this.roll = new Float32Array(sr * 9); this.rollR = new Float32Array(sr * 9);
    this.rec = 0; this.rIdx = 0; this.hSpeed = 1; this.hRead = 0;
    this.brake = 0; this.bv = 1;
    this.gate = 1; this.dampL = 0; this.dampR = 0;
    this.wasOn = false;
  }
  cmd(m) {
    if (m.cmd !== 'set') return;
    const v = m.v;
    if (v.type !== undefined && v.type !== this.type) { this.type = v.type; this.clear(); }
    for (const k in v) if (k !== 'type') this[k] = v[k];
  }
  clear() {
    this.dl.clear(); this.dr.clear(); this.fl.clear(); this.fr.clear();
    this.apL.fill(0); this.apR.fill(0); this.rec = 0; this.rIdx = 0; this.hSpeed = 1; this.hRead = 0;
    this.rev = new Reverb(this.sr); this.ph = 0;
  }
  process(iL, iR, oL, oR, n) {
    const sr = this.sr, t = this.type, d = this.depth;
    const target = this.on ? 1 : 0;
    const timeS = Math.max(0.005, this.time);
    if (this.on && !this.wasOn) { this.ph = 0; this.rec = 0; this.rIdx = 0; this.hSpeed = 1; this.hRead = 0; this.brake = this.cap.w; this.bv = 1; }
    this.wasOn = this.on;
    const D = clamp(timeS * sr, 32, this.dl.n - 4);
    const dPh = 1 / (timeS * sr);
    if (t === FX_REVERB) this.rev.set(0.5 + 0.48 * clamp(this.amt, 1, 100) / 100, 0.25);
    if (t === FX_PITCH) this.sh.ratio = clamp(1 + this.amt / 100, 0.5, 2);
    if (t === FX_SPIRAL) this.sh.ratio = 1.035;
    const rollLen = Math.min(this.roll.length - 1, Math.max(64, Math.round(timeS * sr)));
    for (let i = 0; i < n; i++) {
      const l = iL[i], r = iR ? iR[i] : l;
      this.mix += (target - this.mix) * 0.004;
      const m = this.mix;
      this.cap.push(l); this.capR.push(r);
      let ol = l, or = r;
      switch (t) {
        case FX_FILTER: {
          this.ph += dPh; if (this.ph >= 1) this.ph -= 1;
          if (++this.bqN >= 16) { this.bqN = 0; const f = 60 * Math.pow(250, 0.5 - 0.5 * Math.cos(TAU * this.ph)); this.bq[0].set('lp', f, 2.4, sr); this.bq[1].set('lp', f, 2.4, sr); }
          const wl = this.bq[0].run(l), wr = this.bq[1].run(r), k = m * (0.3 + 0.7 * d);
          ol = l + (wl - l) * k; or = r + (wr - r) * k;
          break;
        }
        case FX_FLANGER: {
          this.ph += dPh; if (this.ph >= 1) this.ph -= 1;
          const dd = (0.0004 + 0.0055 * (0.5 - 0.5 * Math.cos(TAU * this.ph))) * sr;
          const wl = this.fl.read(dd), wr = this.fr.read(dd);
          this.fl.push(l + wl * 0.72); this.fr.push(r + wr * 0.72);
          ol = l + wl * m * d * 0.9; or = r + wr * m * d * 0.9;
          ol *= 1 - m * 0.25; or *= 1 - m * 0.25;
          break;
        }
        case FX_TRANS: {
          this.ph += dPh; if (this.ph >= 1) this.ph -= 1;
          const gt = this.ph < 0.5 ? 1 : 1 - d;
          this.gate += (gt - this.gate) * 0.02;
          const gg = 1 - m + m * this.gate;
          ol = l * gg; or = r * gg;
          break;
        }
        case FX_PHASER: {
          this.ph += dPh; if (this.ph >= 1) this.ph -= 1;
          if (++this.bqN >= 8) { this.bqN = 0; const f = 200 * Math.pow(20, 0.5 - 0.5 * Math.cos(TAU * this.ph)), tn = Math.tan(Math.PI * f / sr); this.apA = (tn - 1) / (tn + 1); }
          const A = this.apA;
          let vl = l + this.pfL * 0.5, vr = r + this.pfR * 0.5;
          for (let s = 0; s < 6; s++) {
            const yl = A * vl + this.apL[s]; this.apL[s] = vl - A * yl + DN; vl = yl;
            const yr = A * vr + this.apR[s]; this.apR[s] = vr - A * yr + DN; vr = yr;
          }
          this.pfL = vl; this.pfR = vr;
          const k = m * (0.4 + 0.6 * d) * 0.5;
          ol = l * (1 - k) + vl * k; or = r * (1 - k) + vr * k;
          break;
        }
        case FX_REVERB: {
          this.rev.run((l + r) * 0.5 * m);
          ol = l + this.rev.L * 3 * d; or = r + this.rev.R * 3 * d;
          break;
        }
        case FX_PITCH: {
          this.sh.run(l, r);
          const k = m * d;
          ol = l * (1 - k) + this.sh.L * k; or = r * (1 - k) + this.sh.R * k;
          break;
        }
        case FX_SPIRAL: {
          const el = this.dl.read(D), er = this.dr.read(D);
          this.sh.run(el, er);
          this.dl.push(l * m + this.sh.L * 0.72); this.dr.push(r * m + this.sh.R * 0.72);
          ol = l + el * d; or = r + er * d;
          break;
        }
        case FX_ECHO: case FX_DELAY: {
          const el = this.dl.read(D), er = this.dr.read(D);
          this.dampL += (el - this.dampL) * 0.45; this.dampR += (er - this.dampR) * 0.45;
          const fb = t === FX_ECHO ? 0.3 + 0.45 * d : 0.12;
          this.dl.push(l * m + this.dampL * fb); this.dr.push(r * m + this.dampR * fb);
          ol = l + el * d; or = r + er * d;
          break;
        }
        case FX_PINGPONG: {
          const el = this.dl.read(D), er = this.dr.read(D);
          const fb = 0.35 + 0.4 * d;
          this.dl.push((l + r) * 0.5 * m + er * fb); this.dr.push(el * fb);
          ol = l + el * d; or = r + er * d;
          break;
        }
        case FX_ROLL: case FX_SLIPROLL: case FX_HELIX: {
          if (m < 0.002 && !this.on) { this.rec = 0; this.rIdx = 0; this.hSpeed = 1; this.hRead = 0; break; }
          let wl = l, wr = r;
          if (this.rec < rollLen) {
            this.roll[this.rec] = l; this.rollR[this.rec] = r; this.rec++;
          } else if (t === FX_HELIX) {
            const p = this.hRead, j = p | 0, f = p - j, j2 = j + 1 >= rollLen ? 0 : j + 1;
            wl = this.roll[j] + (this.roll[j2] - this.roll[j]) * f;
            wr = this.rollR[j] + (this.rollR[j2] - this.rollR[j]) * f;
            this.hRead += this.hSpeed;
            if (this.hRead >= rollLen) { this.hRead -= rollLen; this.hSpeed = Math.min(4, this.hSpeed * 1.0595); }
          } else {
            if (this.rIdx >= rollLen) this.rIdx = 0;
            const e = Math.min(1, this.rIdx / 64, (rollLen - this.rIdx) / 64);
            wl = this.roll[this.rIdx] * e; wr = this.rollR[this.rIdx] * e; this.rIdx++;
          }
          const k = m * (0.5 + 0.5 * d);
          ol = l * (1 - k) + wl * k; or = r * (1 - k) + wr * k;
          break;
        }
        case FX_BRAKE: {
          let bl = 0, br = 0;
          if (this.on) {
            const back = this.cap.w - this.brake;
            const dd = (back < 0 ? back + this.cap.n : back);
            if (this.bv > 0 && dd > 1 && dd < this.cap.n - 4) { bl = this.cap.read(dd); br = this.capR.read(dd); }
            this.brake += this.bv; if (this.brake >= this.cap.n) this.brake -= this.cap.n;
            this.bv = Math.max(0, this.bv - 1 / (timeS * sr));
          }
          ol = l * (1 - m) + bl * m * (0.6 + 0.4 * d) ; or = r * (1 - m) + br * m * (0.6 + 0.4 * d);
          break;
        }
      }
      oL[i] = ol; oR[i] = or;
    }
  }
}

G.CCDSP = { DeckDSP, BeatFxDSP };

if (typeof registerProcessor === 'function') {
  class DeckProc extends AudioWorkletProcessor {
    constructor() {
      super();
      this.dsp = new DeckDSP(sampleRate); this.k = 0;
      this.port.onmessage = (e) => this.dsp.cmd(e.data);
    }
    process(inputs, outputs) {
      const o = outputs[0];
      this.dsp.process(o[0], o[1] || o[0], o[0].length);
      if (++this.k >= 4) { this.k = 0; const r = this.dsp.report(); r.t = currentTime; this.port.postMessage(r); }
      return true;
    }
  }
  class FxProc extends AudioWorkletProcessor {
    constructor() {
      super();
      this.dsp = new BeatFxDSP(sampleRate);
      this.port.onmessage = (e) => this.dsp.cmd(e.data);
      this.z = new Float32Array(128);
    }
    process(inputs, outputs) {
      const i = inputs[0], o = outputs[0];
      const n = o[0].length;
      if (this.z.length !== n) this.z = new Float32Array(n);
      const l = i && i[0] ? i[0] : this.z, r = i && i[1] ? i[1] : l;
      this.dsp.process(l, r, o[0], o[1] || o[0], n);
      return true;
    }
  }
  registerProcessor('cc-deck', DeckProc);
  registerProcessor('cc-beatfx', FxProc);
}
})(typeof globalThis !== 'undefined' ? globalThis : this);
