// A live beat tracker for audio the app does not own (a mic or line-in), where there is no beat grid to read.
// It watches the low end for kicks, finds the tempo that the gaps between them fit best, and keeps a beat counter
// running that is nudged onto each kick as it lands. Because the counter keeps running between kicks, the lights can
// act on beats *before* they are heard: through a breakdown, and onto the next downbeat.
// The kick detector, one sample at a time: a low-passed envelope jumping over its own recent average. Used inside an audio
// worklet (so no sample is ever skipped, whatever the frame rate) and by the per-frame fallback.
export class OnsetDetector {
  constructor(sr) {
    this.sr = sr; this.y = 0; this.env = 0; this.slow = 0; this.prev = 0; this.last = -9;
    this.a = 1 - Math.exp(-2 * Math.PI * 150 / sr); this.rel = Math.exp(-1 / (0.025 * sr)); this.sl = 1 - Math.exp(-1 / (0.25 * sr));
  }
  // x: the sample, t: its time in seconds. Returns true if a kick starts on this sample.
  step(x, t) {
    this.y += this.a * (x - this.y);
    const v = Math.abs(this.y); this.env = v > this.env ? v : this.env * this.rel;
    let hit = false;
    if (this.env > this.slow * 2.1 + 0.004 && this.env > this.prev && t - this.last > 0.2) { hit = true; this.last = t; this.slow = this.env * 0.7; }
    this.prev = this.env; this.slow += (this.env - this.slow) * this.sl;
    return hit;
  }
}

export function createBeatTracker() {
  const T = {
    beat: 0, bpm: 124, conf: 0,           // beat counter (whole numbers are beats), tempo, and how well the kicks fit the grid (0..1)
    avg: 0, prev: 0, last: -9, tempoAt: 0, // running average, last frame's energy, time of last kick
    iois: [], hits: [], pend: 0, pendN: 0,
    onset: false,                          // true on the frame a kick was heard
  };
  const LAG = 0.03; // seconds the analyser's window delays a kick

  // score each candidate tempo by how close every gap between kicks is to a whole number of beats
  function bestTempo(prev) {
    let best = 0, bestScore = -1;
    for (let bpm = 84; bpm <= 176; bpm += 0.5) {
      let sc = 0;
      for (const ioi of T.iois) {
        const x = ioi * bpm / 60, r = x - Math.round(x);
        if (x < 0.6) continue;
        sc += Math.exp(-(r * r) / (2 * 0.07 * 0.07)) / Math.max(1, Math.round(x) * 0.35 + 0.65);  // longer gaps count for less
      }
      if (prev) sc *= 1 + 0.15 * Math.exp(-Math.pow((bpm - prev) / 6, 2));                       // a mild preference for staying put
      if (sc > bestScore) { bestScore = sc; best = bpm; }
    }
    return best;
  }

  // a kick was heard at time `at` (found at time `now`): log the gap, and pull the beat counter onto it
  function kick(now, at) {
    T.onset = true;
    if (T.last > 0 && at - T.last < 1.2) { T.iois.push(at - T.last); if (T.iois.length > 14) T.iois.shift(); }
    T.last = at;
    const ob = T.beat - (now - at) * T.bpm / 60, err = Math.round(ob) - ob;
    T.beat += err * (T.conf > 0.5 ? 0.25 : 0.5);
    T.hits.push(Math.abs(err) < 0.12 ? 1 : 0); if (T.hits.length > 16) T.hits.shift();
    T.conf = T.hits.reduce((a, b) => a + b, 0) / T.hits.length * Math.min(1, T.hits.length / 8);
    T.err = err;
    if (T.conf > 0.5 && Math.abs(err) < 0.2) T.bpm *= 1 + err * 0.1;   // a steady lead or lag means the tempo is off: let it creep to follow a tempo change
  }

  // the precise path: the newest raw samples. The kick is found by a low-passed envelope jumping over its recent average,
  // and stamped with the sample it happened on, so it is timed to a few milliseconds rather than a frame
  let det = null;
  T.wave = false;
  T.updateWave = (dt, t, buf, sr) => {
    T.wave = true; if (!det || det.sr !== sr) det = new OnsetDetector(sr);
    const n = Math.min(buf.length, Math.ceil(dt * sr) + 64);
    T.onset = false; T.beat += dt * T.bpm / 60;
    for (let i = buf.length - n; i < buf.length; i++) { const t_i = t - (buf.length - 1 - i) / sr; if (det.step(buf[i], t_i)) kick(t, t_i); }
    afterKicks(dt, t);
    return T;
  };
  // the worklet path: the clock is the audio context's time; kicks arrive already stamped
  let lastNow = null;
  T.advance = (now) => {
    T.wave = true; const dt = lastNow == null ? 0 : Math.max(0, Math.min(2, now - lastNow)); lastNow = now;
    T.beat += dt * T.bpm / 60; afterKicks(dt, now); return T;
  };
  T.kickAt = (now, at) => { T.advance(now); kick(now, at); }; // bring the counter up to now first, then pull it onto the kick
  function afterKicks(dt, t) {
    if (t - T.last > 3) T.conf = Math.max(0, T.conf - dt * 0.15);
    if (t - T.tempoAt > 0.5 && T.iois.length >= 6) {
      T.tempoAt = t;
      const cand = bestTempo(T.bpm);
      if (Math.abs(cand - T.bpm) / T.bpm < 0.05) { T.bpm += (cand - T.bpm) * 0.3; T.pendN = 0; }
      else if (Math.abs(cand - T.pend) < 1.5) { if (++T.pendN >= 3) { T.bpm = cand; T.pendN = 0; T.iois = T.iois.slice(-8); } }
      else { T.pend = cand; T.pendN = 1; }
    }
  }

  // dt: seconds since the last call, t: clock, low: bass-band energy (linear, any scale)
  T.update = (dt, t, low) => {
    T.onset = false;
    T.avg += (low - T.avg) * Math.min(1, dt * 2.5);
    const rising = low > T.prev; T.prev = low;
    T.beat += dt * T.bpm / 60;
    if (!T.wave && low > T.avg * 1.45 + 1e-5 && rising && t - T.last > 0.2) kick(t, t - LAG);
    if (t - T.last > 3) T.conf = Math.max(0, T.conf - dt * 0.15);          // long gaps: trust the grid less, but keep counting
    if (t - T.tempoAt > 0.5 && T.iois.length >= 6) {
      T.tempoAt = t;
      const cand = bestTempo(T.bpm);
      if (Math.abs(cand - T.bpm) / T.bpm < 0.05) { T.bpm += (cand - T.bpm) * 0.3; T.pendN = 0; }
      else if (Math.abs(cand - T.pend) < 1.5) { if (++T.pendN >= 3) { T.bpm = cand; T.pendN = 0; T.iois = T.iois.slice(-8); } }
      else { T.pend = cand; T.pendN = 1; }                               // a new tempo has to be seen three times running
    }
    return T;
  };
  T.reset = () => { lastNow = null; T.iois = []; T.hits = []; T.conf = 0; T.last = -9; T.pendN = 0; };
  return T;
}
