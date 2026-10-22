/* Cloud Club track analysis worker: 3-band waveform, BPM, beat grid, key, first sound. */
'use strict';
self.onmessage = (e) => {
  const { id, mono, sr } = e.data;
  try {
    const r = analyze(mono, sr);
    self.postMessage({ id, ok: true, r }, [r.low.buffer, r.mid.buffer, r.high.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.stack || err) });
  }
};

function biquad(type, f, q, sr) {
  const w = 2 * Math.PI * f / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; } else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  const a0 = 1 + al, a1 = -2 * cw / a0, a2 = (1 - al) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  let z1 = 0, z2 = 0;
  return (x) => { const y = b0 * x + z1; z1 = b1 * x - a1 * y + z2; z2 = b2 * x - a2 * y; return y; };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const ar = re[i + k + h], ai = im[i + k + h];
        const tr = ar * cr - ai * ci, ti = ar * ci + ai * cr;
        re[i + k + h] = re[i + k] - tr; im[i + k + h] = im[i + k] - ti;
        re[i + k] += tr; im[i + k] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

function analyze(x, sr) {
  const N = x.length;
  // ---- 3-band waveform, 150 columns per second
  const WR = 150, bin = sr / WR, cols = Math.max(1, Math.ceil(N / bin));
  const fl = new Float32Array(cols), fm = new Float32Array(cols), fh = new Float32Array(cols);
  const lp = biquad('lp', 200, 0.707, sr), mA = biquad('hp', 200, 0.707, sr), mB = biquad('lp', 2500, 0.707, sr), hp = biquad('hp', 2500, 0.707, sr);
  let firstSound = -1;
  for (let i = 0; i < N; i++) {
    const s = x[i];
    if (firstSound < 0 && (s > 0.02 || s < -0.02)) firstSound = i;
    const a = Math.abs(lp(s)), b = Math.abs(mB(mA(s))), c = Math.abs(hp(s));
    const k = (i / bin) | 0;
    if (a > fl[k]) fl[k] = a; if (b > fm[k]) fm[k] = b; if (c > fh[k]) fh[k] = c;
  }
  const q8 = (arr, gain) => {
    let mx = 1e-9; for (let i = 0; i < arr.length; i++) if (arr[i] > mx) mx = arr[i];
    const out = new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = Math.min(255, Math.round(Math.pow(arr[i] / mx, 0.85) * 255 * gain));
    return out;
  };
  const low = q8(fl, 1), mid = q8(fm, 0.95), high = q8(fh, 0.85);

  // ---- onset novelty on a ~11 kHz copy
  const dsf = Math.max(1, Math.round(sr / 11025)), fsr = sr / dsf, M = Math.floor(N / dsf);
  const xs = new Float32Array(M);
  for (let j = 0; j < M; j++) { let s = 0; const o = j * dsf; for (let k = 0; k < dsf; k++) s += x[o + k]; xs[j] = s / dsf; }
  const NF = 512, hop = 128, hopSec = hop / fsr;
  const frames = Math.max(0, Math.floor((M - NF) / hop) + 1);
  const win = new Float32Array(NF);
  for (let i = 0; i < NF; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / NF);
  const re = new Float64Array(NF), im = new Float64Array(NF);
  const prev = new Float32Array(NF / 2), cur = new Float32Array(NF / 2);
  const flux = new Float32Array(frames), lowFlux = new Float32Array(frames);
  const kLow = Math.max(2, Math.round(150 / (fsr / NF))), kMax = Math.round(5000 / (fsr / NF));
  for (let t = 0; t < frames; t++) {
    const o = t * hop;
    for (let i = 0; i < NF; i++) { re[i] = xs[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let f = 0, fLo = 0;
    for (let k = 1; k < kMax; k++) {
      const m = Math.log1p(100 * Math.hypot(re[k], im[k]));
      cur[k] = m;
      const d = m - prev[k];
      if (d > 0) { f += d; if (k <= kLow) fLo += d; }
    }
    prev.set(cur);
    flux[t] = f; lowFlux[t] = fLo;
  }
  const novelty = (arr) => {
    const out = new Float32Array(arr.length), W = 16;
    let sum = 0; const q = [];
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i]; q.push(arr[i]);
      if (q.length > 2 * W + 1) sum -= q.shift();
      const c = i - W;
      if (c >= 0) out[c] = Math.max(0, arr[c] - sum / q.length);
    }
    let mx = 1e-9; for (let i = 0; i < out.length; i++) if (out[i] > mx) mx = out[i];
    for (let i = 0; i < out.length; i++) out[i] /= mx;
    return out;
  };
  const nF = novelty(flux), nL = novelty(lowFlux);
  const nov = new Float32Array(frames);
  for (let i = 0; i < frames; i++) nov[i] = nF[i] + 1.5 * nL[i];

  let bpm = 120, firstBeat = 0, downbeat = 0;
  if (frames > 400) {
    // autocorrelation tempo estimate with a prior around 122 BPM
    const minLag = Math.floor(60 / 200 / hopSec), maxLag = Math.ceil(60 / 60 / hopSec);
    let best = -1, bestLag = minLag;
    const acf = new Float32Array(maxLag + 2);
    for (let l = minLag; l <= maxLag + 1; l++) {
      let s = 0; for (let t = 0; t + l < frames; t++) s += nov[t] * nov[t + l];
      acf[l] = s / (frames - l);
    }
    for (let l = minLag; l <= maxLag; l++) {
      const b = 60 / (l * hopSec);
      const w = Math.exp(-0.5 * Math.pow(Math.log2(b / 122) / 0.45, 2));
      const sc = acf[l] * w;
      if (sc > best) { best = sc; bestLag = l; }
    }
    const b0 = 60 / (bestLag * hopSec);
    // comb refine over the middle of the track
    const t0 = Math.floor(frames * 0.1), t1 = Math.floor(frames * 0.9);
    const at = (p) => { const i = p | 0; return i >= 0 && i < frames - 1 ? nov[i] + (nov[i + 1] - nov[i]) * (p - i) : 0; };
    const score = (b, step) => {
      const P = 60 / b / hopSec; let bs = -1, bp = 0;
      for (let ph = 0; ph < P; ph += step) {
        let s = 0;
        for (let p = t0 + ph; p < t1; p += P) s += at(p);
        if (s > bs) { bs = s; bp = ph; }
      }
      return [bs, bp];
    };
    let bb = b0, bsc = -1;
    for (let b = b0 * 0.965; b <= b0 * 1.035; b += 0.02) { const [s] = score(b, 1); if (s > bsc) { bsc = s; bb = b; } }
    for (let b = bb - 0.05; b <= bb + 0.05; b += 0.005) { const [s] = score(b, 0.5); if (s > bsc) { bsc = s; bb = b; } }
    if (Math.abs(bb - Math.round(bb)) < 0.06) bb = Math.round(bb);
    else if (Math.abs(bb * 2 - Math.round(bb * 2)) < 0.06) bb = Math.round(bb * 2) / 2;
    bpm = bb;
    const [, ph] = score(bpm, 0.25);
    const P = 60 / bpm;
    const LAT = (NF * 0.5) / fsr + 0.011;
    let fb = (t0 + ph) * hopSec + LAT;
    fb = ((fb % P) + P) % P;
    firstBeat = fb;
    // bar phase: which of the 4 beats carries the most low-end attack
    const sums = [0, 0, 0, 0];
    for (let j = 0; ; j++) {
      const ts = fb + j * P; const fi = Math.round((ts - LAT) / hopSec);
      if (fi >= frames) break;
      if (fi >= 0) sums[j % 4] += nL[fi] + 0.3 * nF[fi];
    }
    downbeat = sums.indexOf(Math.max(...sums));
  }

  // ---- key (chroma + Krumhansl profiles)
  let key = '';
  try {
    const KN = 4096, kh = 4096, kFrames = Math.floor((M - KN) / kh);
    if (kFrames > 8) {
      const chroma = new Float64Array(12);
      const kre = new Float64Array(KN), kim = new Float64Array(KN), kw = new Float32Array(KN);
      for (let i = 0; i < KN; i++) kw[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / KN);
      const pcOf = new Int8Array(KN / 2).fill(-1);
      for (let k = 1; k < KN / 2; k++) {
        const f = k * fsr / KN;
        if (f >= 100 && f <= 2000) pcOf[k] = ((Math.round(12 * Math.log2(f / 440)) % 12) + 12 + 9) % 12;
      }
      const step = Math.max(1, Math.floor(kFrames / 160));
      for (let t = 0; t < kFrames; t += step) {
        const o = t * kh;
        for (let i = 0; i < KN; i++) { kre[i] = xs[o + i] * kw[i]; kim[i] = 0; }
        fft(kre, kim);
        for (let k = 1; k < KN / 2; k++) { const pc = pcOf[k]; if (pc >= 0) chroma[pc] += Math.sqrt(Math.hypot(kre[k], kim[k])); }
      }
      const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
      const MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
      const corr = (a, b) => {
        const ma = a.reduce((s, v) => s + v, 0) / 12, mb = b.reduce((s, v) => s + v, 0) / 12;
        let n = 0, da = 0, db = 0;
        for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
        return n / Math.sqrt(da * db + 1e-12);
      };
      const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
      let bk = -2, bn = '';
      for (let r = 0; r < 12; r++) {
        const rot = Array.from({ length: 12 }, (_, i) => chroma[(i + r) % 12]);
        const cM = corr(rot, MAJ), cm = corr(rot, MIN);
        if (cM > bk) { bk = cM; bn = NAMES[r]; }
        if (cm > bk) { bk = cm; bn = NAMES[r] + 'm'; }
      }
      key = bn;
    }
  } catch (_) { key = ''; }

  return {
    bpm, firstBeat, downbeat, key,
    firstSound: firstSound < 0 ? 0 : Math.max(0, firstSound / sr - 0.005),
    duration: N / sr, wfRate: WR, low, mid, high,
  };
}
