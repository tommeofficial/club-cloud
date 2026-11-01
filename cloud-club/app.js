/* Club Cloud DJ: hardware layout, touch controls, deck logic, mixer, Beat FX, screens and library. */
(() => {
'use strict';

// ============================================================ geometry (reference photo pixel space)
const X0 = 80, Y0 = 312, SW = 1840, SH = 964;
const D2 = 1170; // deck 2 sits 1170px right of deck 1 (identical layout)
const ZOOMS = { all: [80, 312, 1840, 964], d1: [88, 320, 646, 945], mix: [690, 320, 620, 945], d2: [1266, 320, 646, 945] };
const JOG = { x: 417, y: 811, R: 201 };
const SCR = { x: 104, y: 334, w: 580, h: 146 };
const CSCR = { x: 700, y: 334, w: 494, h: 146 };

// drawn, not typed: iOS turns ▶ into a colour emoji whatever font you ask for
const PLAY_GLYPH = '<svg class="pp" viewBox="0 0 34 12" fill="currentColor" aria-hidden="true">'
  + '<path d="M0 0l10 6-10 6z"/><path d="M15.6 12.4L19.6-.4l1.7.5-4 12.8z"/>'
  + '<rect x="24" width="4" height="12" rx="1"/><rect x="30" width="4" height="12" rx="1"/></svg>';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const $ = (s, r = document) => r.querySelector(s);
const nowS = () => performance.now() / 1000;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UIF = "'Barlow Semi Condensed','Arial Narrow',sans-serif";

const HOT = ['#ff2d3d', '#22d3ff', '#c6ff1f', '#6a4cff', '#22e05b', '#ff8a1c', '#2a6bff', '#ffd21c'];
const LETTERS = 'ABCDEFGH';
const RANGES = [6, 10, 16, 100], RANGE_N = ['±6', '±10', '±16', 'WIDE'];
const FX_NAMES = ['FILTER', 'FLANGER', 'TRANS', 'PHASER', 'REVERB', 'PITCH', 'SPIRAL', 'SLIP ROLL', 'PING PONG', 'ROLL', 'ECHO', 'VINYL BRAKE', 'DELAY', 'HELIX'];
const FX_SEQ = [12, 10, 8, 6, 4, 2, 0, 1, 3, 5, 7, 9, 11, 13]; // clockwise around the selector
const FX_ANG = [-134, -117, -99, -88, -73, -53, -30, 38, 57, 73, 88, 102, 110, 134];
const CH_SEQ = ['A', 'B', 'MIC', 'AUX', '1', '2', 'MASTER'];
const CH_ANG = [-110, -88, -62, -32, 10, 52, 88];
const BEATS = [1 / 8, 1 / 4, 1 / 2, 3 / 4, 1, 2, 4, 8, 16, 32, 64];
const BEAT_LBL = ['1/8', '1/4', '1/2', '3/4', '1', '2', '4', '8', '16', '32', '64'];
const REV_VALS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const PITCH_VALS = [-50, -25, -10, 10, 25, 50, 100];
const CFX = ['', 'SPACE', 'DUB ECHO', 'SWEEP', 'NOISE', 'CRUSH', 'FILTER'];
const BL1 = [1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32], BL2 = [1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4];
const SLL = [1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16];
const BJ1 = [-1, 1, -2, 2, -4, 4, -8, 8], BJ2 = [-8, 8, -16, 16, -32, 32, -64, 64];
const ZOOM_SECS = [3, 4, 6, 8, 12, 16];
const fracLbl = (b) => (b >= 1 ? String(b) : '1/' + Math.round(1 / b));

// ============================================================ DOM
const app = $('#app'), tabs = $('#tabs'), view = $('#view'), stage = $('#stage');
const modal = $('#modal'), veil = $('#veil'), toastEl = $('#toast'), fileIn = $('#filein');

const L = { mode: 'normal', portrait: false, vw: 0, vh: 0, W: 0, H: 0, vx: 0, vy: 0, aw: 0, ah: 0, s: 0.5, tx: 0, ty: 0, zoom: 'all', pan: { d1: 0.5, mix: 0.35, d2: 0.5 }, panRange: 0, panAxis: 'y', clubZoom: 1, splitFrac: 0.5 };
try { const f = parseFloat(localStorage.getItem('cc-split')); if (f >= 0.25 && f <= 0.75) L.splitFrac = f; } catch (_) {}

let toastT = 0;
function toast(msg, sec = 2.6) { toastEl.textContent = msg; toastEl.hidden = false; toastT = nowS() + sec; }

// ============================================================ controls
const controls = new Map();
const canvases = [];
const knobDots = [];

function box(el, cx, cy, w, h) {
  el.style.left = (cx - w / 2 - X0) + 'px'; el.style.top = (cy - h / 2 - Y0) + 'px';
  el.style.width = w + 'px'; el.style.height = h + 'px';
}
function reg(c, el) { c.el = el; el.dataset.id = c.id; controls.set(c.id, c); stage.appendChild(el); return c; }
function mkCanvas(x, y, w, h, cls) {
  const el = document.createElement('canvas');
  el.className = 'cv ' + (cls || '');
  el.style.left = (x - X0) + 'px'; el.style.top = (y - Y0) + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
  stage.appendChild(el);
  const o = { el, x, y, w, h, ctx: el.getContext('2d'), k: 1 };
  canvases.push(o);
  return o;
}
function sizeCanvases() {
  const k = Math.min(3, L.s * (window.devicePixelRatio || 1));
  for (const o of canvases) {
    const W = Math.max(1, Math.round(o.w * k)), H = Math.max(1, Math.round(o.h * k));
    if (o.el.width !== W || o.el.height !== H) { o.el.width = W; o.el.height = H; }
    o.ctx.setTransform(W / o.w, 0, 0, H / o.h, 0, 0);
    o.k = k; o.gen = (o.gen || 0) + 1;
  }
}

class Knob {
  constructor(o) {
    Object.assign(this, { def: 0.5, kind: '', steps: 0, angles: null, label: '', note: null, fmt: (v) => Math.round(v * 100) + '%', onChange: null, bip: false }, o);
    if (this.v === undefined) this.v = this.def;
    const el = document.createElement('div');
    el.className = 'c k ' + this.kind;
    el.innerHTML = '<div class="body"></div><div class="rot"><div class="knurl"></div><div class="cap"></div><div class="ind"></div></div>';
    box(el, o.x, o.y, o.r * 2, o.r * 2);
    reg(this, el);
    this.rot = el.querySelector('.rot');
    if (o.dots) knobDots.push([o.x, o.y, o.r + 7, o.dots, !!this.bip]);
    this.set(this.v, false);
  }
  angle(v) { return this.angles ? this.angles[v] : -150 + 300 * v; }
  set(v, fire = true) {
    if (this.steps) v = clamp(Math.round(v), 0, this.steps - 1);
    else { v = clamp(v, 0, 1); if (this.bip && Math.abs(v - 0.5) < 0.014) v = 0.5; }
    const ch = v !== this.v;
    this.v = v;
    this.rot.style.transform = `rotate(${this.angle(v)}deg)`;
    if (fire && ch && this.onChange) this.onChange(v);
    if (bubble.ctrl === this) bubble.update();
  }
  down(p) {
    this.p0 = p; this.v0 = this.v;
    // a selector with lots of options (Beat FX type, FX channel) opens the option wheel straight away, no readout
    if (this.steps > 4) { optWheel.open(this, p); return; }
    bubble.show(this, p);
  }
  move(p) {
    if (optWheel.ctrl === this) { optWheel.move(p); return; }
    const d = ((p.x - this.p0.x) - (p.y - this.p0.y)) * L.s;
    this.set(this.steps ? this.v0 + d / 24 : this.v0 + d / 200);
  }
  up() { if (optWheel.ctrl === this) { optWheel.close(true); return; } bubble.hide(this); }
  wheel(dy) { this.set(this.steps ? this.v + (dy > 0 ? -1 : 1) : this.v - dy / 1600); bubble.flash(this); }
  reset() { if (!this.steps) this.set(this.bip ? 0.5 : 0); } // double-tap: centred knobs to the middle, levels to minimum
  text() { return this.fmt(this.v); }
  frac() { return this.steps ? this.v / (this.steps - 1) : this.v; }
}

class Encoder {
  constructor(o) {
    Object.assign(this, { kind: 'enc', label: '', onStep: null, onPush: null, info: null }, o);
    const el = document.createElement('div');
    el.className = 'c k ' + this.kind;
    el.innerHTML = '<div class="body"></div><div class="rot"><div class="knurl"></div><div class="cap"></div></div>';
    box(el, o.x, o.y, o.r * 2, o.r * 2);
    reg(this, el);
    this.rot = el.querySelector('.rot'); this.ang = 0;
  }
  turn(n) { this.ang += n * 15; this.rot.style.transform = `rotate(${this.ang}deg)`; if (this.onStep) this.onStep(n); if (bubble.ctrl === this) bubble.update(); }
  down(p) { this.p0 = p; this.acc = 0; this.moved = false; if (this.info) bubble.show(this, p); }
  move(p) {
    const d = ((p.x - this.p0.x) - (p.y - this.p0.y)) * L.s;
    const n = Math.trunc((d - this.acc) / 16);
    if (n) { this.acc += n * 16; this.moved = true; this.turn(n); }
  }
  up() { if (!this.moved && this.onPush) this.onPush(); bubble.hide(this); }
  wheel(dy) { this.turn(dy > 0 ? 1 : -1); if (this.info) bubble.flash(this); }
  text() { return this.info ? this.info() : ''; }
  frac() { return -1; }
}

class Fader {
  constructor(o) {
    Object.assign(this, { min: 0, max: 1, def: 0, invert: false, kind: '', label: '', fmt: (v) => v.toFixed(2), onChange: null, detent: 0, bip: false }, o);
    if (this.v === undefined) this.v = this.def;
    const el = document.createElement('div');
    el.className = 'c f ' + o.axis + ' ' + this.kind;
    const vert = o.axis === 'v';
    this.bw = vert ? Math.max(o.capW, 30) : o.len + o.capW;
    this.bh = vert ? o.len + o.capH : Math.max(o.capH, 30);
    box(el, o.x, o.y, this.bw, this.bh);
    el.innerHTML = '<div class="slot"></div><div class="cap"></div>';
    const slot = el.firstChild;
    if (vert) Object.assign(slot.style, { left: (this.bw - o.slotW) / 2 + 'px', top: o.capH / 2 - 4 + 'px', width: o.slotW + 'px', height: o.len + 8 + 'px' });
    else Object.assign(slot.style, { top: (this.bh - o.slotW) / 2 + 'px', left: o.capW / 2 - 4 + 'px', height: o.slotW + 'px', width: o.len + 8 + 'px' });
    this.cap = el.lastChild;
    Object.assign(this.cap.style, { width: o.capW + 'px', height: o.capH + 'px' });
    if (vert) this.cap.style.left = (this.bw - o.capW) / 2 + 'px'; else this.cap.style.top = (this.bh - o.capH) / 2 + 'px';
    reg(this, el);
    this.set(this.v, false);
  }
  frac() { return (this.v - this.min) / (this.max - this.min); }
  set(v, fire = true) {
    v = clamp(v, this.min, this.max);
    if (this.detent && Math.abs(v - this.def) < this.detent) v = this.def;
    const ch = v !== this.v;
    this.v = v;
    const f = this.frac();
    if (this.axis === 'v') this.cap.style.top = (this.invert ? f : 1 - f) * this.len + 'px';
    else this.cap.style.left = f * this.len + 'px';
    if (fire && ch && this.onChange) this.onChange(v);
    if (bubble.ctrl === this) bubble.update();
  }
  down(p) { this.p0 = p; this.v0 = this.v; bubble.show(this, p); }
  move(p) {
    let d = this.axis === 'v' ? -(p.y - this.p0.y) : p.x - this.p0.x;
    if (this.invert) d = -d;
    this.set(this.v0 + d / this.len * (this.max - this.min));
  }
  up() { bubble.hide(this); }
  wheel(dy) { this.set(this.v + (this.invert ? 1 : -1) * dy / 2400 * (this.max - this.min)); bubble.flash(this); }
  reset() { const mid = (this.min + this.max) / 2; this.set(this.bip || this.def === mid ? mid : this.min); } // centred faders to the middle, levels to minimum
  text() { return this.fmt(this.v); }
}

class Switch {
  constructor(o) {
    Object.assign(this, { n: 3, v: 0, names: [], label: '', onChange: null }, o);
    const el = document.createElement('div');
    el.className = 'c sw';
    box(el, o.x, o.y, o.w, o.h);
    el.innerHTML = '<div class="lever"></div>';
    reg(this, el);
    this.lever = el.firstChild;
    this.set(this.v, false);
  }
  set(v, fire = true) {
    v = clamp(v, 0, this.n - 1);
    const ch = v !== this.v; this.v = v;
    this.lever.style.left = (6 + v * (60 - 6) / (this.n - 1)) + '%';
    if (fire && ch && this.onChange) this.onChange(v);
    if (bubble.ctrl === this) bubble.update();
  }
  down(p) { this.p0 = p; this.moved = false; bubble.show(this, p); }
  move(p) {
    const lx = (p.x - (this.x - this.w / 2)) / this.w;
    if (Math.abs(p.x - this.p0.x) * L.s > 6) {
      this.moved = true;
      this.set(Math.round(clamp(lx, 0, 1) * (this.n - 1)));
    }
  }
  up() { if (!this.moved) this.set((this.v + 1) % this.n); bubble.hide(this); }
  text() { return this.names[this.v] || String(this.v); }
  frac() { return this.v / (this.n - 1); }
}

class Btn {
  constructor(o) {
    Object.assign(this, { cls: '', text: '', lc: null, onDown: null, onUp: null }, o);
    const el = document.createElement('div');
    el.className = 'c b ' + this.cls;
    el.innerHTML = '<div class="lamp"></div>' + (this.text ? `<span>${this.text}</span>` : '');
    if (this.lc) el.style.setProperty('--lc', this.lc);
    box(el, o.x, o.y, o.w, o.h);
    el.dataset.led = '0';
    reg(this, el);
  }
  down(p) { this.el.classList.add('dn'); if (this.onDown) this.onDown(p); }
  up(p) { this.el.classList.remove('dn'); if (this.onUp) this.onUp(p); }
  move() {}
  led(s) { if (this._l !== s) { this._l = s; this.el.dataset.led = s; } }
  color(c) { if (this._c !== c) { this._c = c; this.el.style.setProperty('--pc', c); } }
}

// ============================================================ option wheel
// Press a selector knob (Beat FX type, FX channel…) and its options fan out round your finger in the same order
// as printed round the knob; slide into a slice and let go to pick it. Let go in the middle to keep what it was.
const optWheel = {
  el: null, ctrl: null, cx: 0, cy: 0, pick: -1,
  open(c, p) {
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'optwheel'; app.appendChild(this.el); }
    const n = c.steps, R = 150, r0 = 46, NS = 'http://www.w3.org/2000/svg';
    this.ctrl = c; this.pick = -1;
    this.cx = clamp(p.ax, R + 8, L.W - R - 8); this.cy = clamp(p.ay, R + 8, L.H - R - 8);
    let svg = `<svg xmlns="${NS}" width="${R * 2}" height="${R * 2}" viewBox="${-R} ${-R} ${R * 2} ${R * 2}">`;
    for (let i = 0; i < n; i++) {
      const deg = (k) => ((-150 + 300 * k / n) * Math.PI) / 180 - Math.PI / 2; // same arc and order as the labels round the knob
      const a0 = deg(i), a1 = deg(i + 1), am = (a0 + a1) / 2, big = a1 - a0 > Math.PI ? 1 : 0;
      const P = (rr, aa) => `${(Math.cos(aa) * rr).toFixed(1)} ${(Math.sin(aa) * rr).toFixed(1)}`;
      svg += `<path data-i="${i}" class="${i === c.v ? 'cur' : ''}" d="M${P(r0, a0)} L${P(R - 4, a0)} A${R - 4} ${R - 4} 0 ${big} 1 ${P(R - 4, a1)} L${P(r0, a1)} A${r0} ${r0} 0 ${big} 0 ${P(r0, a0)}Z"/>`;
      const lr = (r0 + R) / 2 + 6, txt = String(c.fmt(i)).replace(/[<&>]/g, '');
      svg += `<text x="${(Math.cos(am) * lr).toFixed(1)}" y="${(Math.sin(am) * lr).toFixed(1)}" font-size="${n > 10 ? 10 : 12}">${txt}</text>`;
    }
    svg += `<circle r="${r0 - 6}" class="hub"/><text class="hubt" y="4">${String(c.label || '').replace(/[<&>]/g, '').toUpperCase()}</text></svg>`;
    this.el.innerHTML = svg;
    Object.assign(this.el.style, { left: this.cx - R + 'px', top: this.cy - R + 'px' });
    this.el.hidden = false;
  },
  move(p) {
    const dx = p.ax - this.cx, dy = p.ay - this.cy, n = this.ctrl.steps;
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 at the top, clockwise
    this.pick = Math.hypot(dx, dy) < 40 || Math.abs(deg) > 150 ? -1 : Math.min(n - 1, Math.floor(((deg + 150) / 300) * n));
    this.el.querySelectorAll('path').forEach((pa) => pa.classList.toggle('on', +pa.dataset.i === this.pick));
  },
  close(apply) {
    if (apply && this.pick >= 0) { this.ctrl.set(this.pick); bubble.flash(this.ctrl); }
    this.ctrl = null; if (this.el) this.el.hidden = true;
  },
};

// ============================================================ value bubble
const bubble = {
  el: $('#bubble'), ctrl: null, until: 0,
  show(c) { this.ctrl = c; this.until = 0; this.el.hidden = false; this.update(); this.place(c); },
  // pinned beside the control it belongs to: controls on the left half get it on their right, and the other way round,
  // so the finger never covers it and it never jumps about
  place(c) {
    const r = c.el.getBoundingClientRect();
    const a = toStage({ clientX: r.left, clientY: r.top }), b = toStage({ clientX: r.right, clientY: r.bottom });
    const x0 = Math.min(a.ax, b.ax), x1 = Math.max(a.ax, b.ax), y0 = Math.min(a.ay, b.ay), y1 = Math.max(a.ay, b.ay);
    const right = (x0 + x1) / 2 < L.W / 2, w = this.el.offsetWidth, h = this.el.offsetHeight;
    const x = clamp(right ? x1 + 14 : x0 - 14 - w, 6, L.W - w - 6);
    const y = clamp((y0 + y1) / 2 - h / 2, 6, L.H - h - 6);
    this.el.style.left = x + 'px'; this.el.style.top = y + 'px';
  },
  move() {},
  flash(c) { this.show(c); this.until = nowS() + 0.9; },
  update() {
    const c = this.ctrl; if (!c) return;
    this.el.querySelector('.bl').textContent = c.label || '';
    this.el.querySelector('.bv').textContent = c.text();
    const note = c.note ? c.note() : '';
    const bn = this.el.querySelector('.bn'); bn.textContent = note || ''; bn.hidden = !note;
    const f = c.frac(), bar = this.el.querySelector('.bar'), i = bar.querySelector('i'), b = bar.querySelector('b');
    bar.hidden = f < 0;
    if (f >= 0) {
      if (c.bip) { const a = Math.min(f, 0.5), z = Math.max(f, 0.5); i.style.left = a * 100 + '%'; i.style.width = (z - a) * 100 + '%'; b.hidden = false; }
      else { i.style.left = '0'; i.style.width = f * 100 + '%'; b.hidden = true; }
    }
  },
  hide(c) { if (this.ctrl === c && !this.until) { this.ctrl = null; this.el.hidden = true; } },
  tick(t) { if (this.until && t > this.until) { this.until = 0; this.ctrl = null; this.el.hidden = true; } },
};

// ============================================================ layout / zoom
function insets() {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(p);
  const cs = getComputedStyle(p);
  const r = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  p.remove();
  return r;
}

const Q = new URLSearchParams(location.search);
const ADVERT = Q.has('advert') || Q.has('shot'); // the advert films the app full-bleed in portrait
const headerH = () => (document.querySelector('.sh') && !document.body.classList.contains('cc-full') ? 64 : 0);   // the site header across the top (hidden in full screen and in the advert)
function layout(animate) {
  if (L.full && L.mode !== 'club') L.full = false;
  document.body.classList.toggle('cc-full', !!L.full || ADVERT);
  const hb = headerH();
  const vw = window.innerWidth, vh = window.innerHeight - hb;
  app.style.top = hb + 'px';
  const portrait = !ADVERT && vh > vw * 1.05;
  L.portrait = portrait; L.vw = vw; L.vh = vh;
  const W = portrait ? vh : vw, H = portrait ? vw : vh;
  L.W = W; L.H = H;
  app.style.width = W + 'px'; app.style.height = H + 'px';
  app.style.transform = portrait ? `translate(${vw}px,0) rotate(90deg)` : 'none';
  const si = insets();
  const ins = portrait ? { t: si.r, r: si.b, b: si.l, l: si.t } : si;
  const club = $('#club');
  // SPLIT: club on the left half, tabs + decks on the right half
  const split = L.mode === 'split';
  let px = ins.l, pw = W - ins.l - ins.r;
  const bar = $('#splitbar');
  bar.hidden = !split;
  let cw = 0;
  if (split) {
    cw = Math.round(pw * L.splitFrac);
    club.hidden = false;
    px += cw; pw -= cw;
  }
  if (L.full && L.mode !== 'club') L.full = false;           // the full-screen button hides the top bar, in the club only
  const full = !!L.full; tabs.style.display = full ? 'none' : ''; const fx = $('#fsexit'); if (fx) fx.hidden = !full;
  // deck zooms only make sense on the full-screen decks
  tabs.querySelector('.zooms').hidden = L.mode === 'club';
  // horizontal tab bar on top, or a vertical rail on the left when that leaves the stage bigger
  const [, , rw, rh] = ZOOMS.all;
  const availH = { w: pw - 8, h: H - ins.t - ins.b - 44 - 6 };
  const availV = { w: pw - 64 - 6, h: H - ins.t - ins.b - 8 };
  const sH = Math.min(availH.w / rw, availH.h / rh), sV = Math.min(availV.w / rw, availV.h / rh);
  const vert = false;   // the tab bar always sits across the top (it used to move to a rail down the left when that gave the decks more room)
  tabs.className = 'h';                                  // the tab bar stays across the whole top in every view, split included
  tabs.style.left = ins.l + 'px'; tabs.style.top = ins.t + 'px';
  if (vert) { tabs.style.bottom = ins.b + 'px'; tabs.style.right = ''; }
  else { tabs.style.right = ins.r + 'px'; tabs.style.bottom = ''; }
  // in DECKS and SPLIT the zoom buttons sit on a second row under the view buttons
  const sub = !vert && L.mode !== 'club' ? 34 : 0;
  tabs.classList.toggle('sub', sub > 0);
  L.vx = px + (vert ? 64 + 3 : 4); L.vy = ins.t + (vert ? 4 : 44 + 3) + sub;
  L.aw = px + pw - L.vx - 4; L.ah = H - L.vy - ins.b - 3;
  if (ADVERT || full) { L.vx = 0; L.vy = 0; L.aw = W; L.ah = H; }
  if (split) {      // split: the club on the left, the decks on the right, both under the tab bar
    Object.assign(club.style, { left: ins.l + 4 + 'px', top: L.vy + 'px', width: cw - 8 + 'px', height: H - L.vy - ins.b - 3 + 'px' });
    Object.assign(bar.style, { left: ins.l + cw - 6 + 'px', top: L.vy + 'px', height: H - L.vy - ins.b - 3 + 'px' });
  } // the advert films the stage edge to edge
  // CLUB: one 3D view from behind the DJ; the club fills the screen
  if (L.mode === 'club') {
    Object.assign(club.style, ADVERT || full ? { left: '0px', top: '0px', width: W + 'px', height: H + 'px', borderRadius: '0' } : { left: L.vx + 'px', top: L.vy + 'px', width: L.aw + 'px', height: L.ah + 'px' });
    club.hidden = false;
    // the real controller is laid onto the booth table in 3D: club.js perspective-maps this box onto it
    L.aw = 920; L.ah = Math.round(920 * ZOOMS.all[3] / ZOOMS.all[2]);
  } else if (!split) club.hidden = true;
  view.style.zIndex = L.mode === 'club' ? 4 : '';
  // 1 | M | 2 hang under the active view button (DECKS or SPLIT), which widens to match them
  const zr = tabs.querySelector('.zooms'), db = tabs.querySelector(`[data-mode=${L.mode === 'split' ? 'split' : 'normal'}]`);
  for (const b of tabs.querySelectorAll('[data-mode]')) b.style.minWidth = '';
  db.style.minWidth = ''; zr.style.width = ''; // measure their natural widths, not last time's stretched ones
  if (sub) {
    const w = Math.max(db.offsetWidth, zr.offsetWidth);
    db.style.minWidth = w - 6 + 'px';
    zr.style.width = w + 'px';
    zr.style.left = db.offsetLeft - 4 + 'px'; // offsets, not screen rects, so this also works when the app is rotated
  } else { zr.style.width = ''; zr.style.left = ''; }
  Object.assign(view.style, { left: L.vx + 'px', top: L.vy + 'px', width: L.aw + 'px', height: L.ah + 'px' });
  clubTilt();
  placeStage(animate);
  window.dispatchEvent(new CustomEvent('cc-view', { detail: { mode: L.mode === 'normal' ? 'off' : L.mode } }));
}

function placeStage(animate) {
  const zk = L.mode === 'club' ? 'all' : L.zoom;
  const z = ZOOMS[zk], [zx, zy, zw, zh] = z;
  // always fit the whole section on screen, a little inside the edges, so nothing needs scrolling
  const s = Math.min(L.aw / zw, L.ah / zh) * (L.mode === 'club' || zk === 'ad' ? 1 : zk === 'all' ? 0.94 : 0.97);
  L.panRange = 0;
  const oldS = L.s;
  L.s = s;
  let tx = (L.aw - zw * s) / 2 - (zx - X0) * s;
  const ty = (L.ah - zh * s) / 2 - (zy - Y0) * s;
  L.tx = tx; L.ty = ty;
  stage.classList.toggle('anim', !!animate);
  stage.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
  if (Math.abs(oldS - s) > 1e-4 || !canvases[0] || canvases[0].k === 1) sizeCanvases();
  for (const b of tabs.querySelectorAll('[data-zoom]')) b.classList.toggle('on', b.dataset.zoom === L.zoom);
  const shown = L.mode === 'club' ? (L.cam === 'booth' ? 'djview' : 'club') : L.mode;
  for (const b of tabs.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === shown);
  // CLUB is one tab: the first press is the fixed view (1), pressing it again moves to the next (2)
  const cb = tabs.querySelector('[data-mode=club]');
  if (cb) { const v = shown === 'club' ? (L.cam === 'pan' ? 'b' : 'a') : ''; cb.innerHTML = clubTabHtml(v); cb.title = v === 'a' ? 'Camera A. Press again for camera B' : v === 'b' ? 'Camera B (auto camera). Press again for camera A' : 'The club. Press again to switch between camera A and B'; }
}

// the CLUB tab is two views in one: CLUB with an A / B pair and a cycle arrow, so it is obvious it can be pressed again
const clubTabHtml = (v) => `CLUB<span class="ab"><i class="${v === 'a' ? 'on' : ''}">A</i><i class="${v === 'b' ? 'on' : ''}">B</i></span>`;
function setZoom(z) { L.zoom = L.zoom === z ? 'all' : z; placeStage(true); } // pressing the open side again goes back to both decks
// DJ VIEW and CLUB 1 / CLUB 2 are all the 3D club: DJ VIEW looks over the DJ's shoulder, CLUB 1 looks at the stage from the back wall
// (fixed), CLUB 2 is the same room with a camera that drifts between shots on the beat
function setMode(m) {
  if (m === 'djview' || m === 'club' || m === 'club2') { L.cam = m === 'djview' ? 'booth' : m === 'club2' ? 'pan' : 'crowd'; m = 'club'; m = 'club'; window.dispatchEvent(new CustomEvent('cc-cam', { detail: L.cam })); }
  L.mode = m; L.zoom = 'all'; layout(false); // picking a view always starts zoomed out
}
// drag bar between the club and the decks in SPLIT
$('#splitbar').addEventListener('pointerdown', (e) => {
  const bar = e.currentTarget; e.preventDefault(); bar.setPointerCapture(e.pointerId);
  const ins = insets(), left = L.portrait ? ins.t : ins.l, width = L.W - (L.portrait ? ins.t + ins.b : ins.l + ins.r);
  const move = (ev) => { const x = L.portrait ? ev.clientY : ev.clientX; L.splitFrac = clamp((x - left) / width, 0.25, 0.75); layout(false); };
  const up = () => {
    bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
    try { localStorage.setItem('cc-split', String(L.splitFrac)); } catch (_) {}
  };
  bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
});

// CLUB: the real controller is shown on the 3D booth table, just for show
function clubTilt() {
  const club = L.mode === 'club';
  view.style.pointerEvents = club ? 'none' : ''; // just for show in the club
  view.style.transformOrigin = club ? '0 0' : '';
  if (!club) view.style.transform = ''; // in the club, club.js sets the transform each time the camera or size changes
  else window.dispatchEvent(new Event('cc-deckplace'));
}
function toStage(e) {
  let ax, ay;
  if (L.portrait) { ax = e.clientY; ay = L.vw - e.clientX; } else { ax = e.clientX; ay = e.clientY; }
  return { ax, ay, x: X0 + (ax - L.vx - L.tx) / L.s, y: Y0 + (ay - L.vy - L.ty) / L.s, t: nowS() };
}

// ============================================================ pointer routing
const active = new Map();
let panDrag = null;
view.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (L.mode === 'club') return; // decks are not playable from the club view
  if (e.target.closest('.native')) return;
  const t = e.target.closest('[data-id]');
  const p = toStage(e);
  if (!t) {
    if (L.panRange > 0) { panDrag = { id: e.pointerId, y: p.ay, pan: L.pan[L.zoom] || 0 }; view.setPointerCapture(e.pointerId); }
    return;
  }
  const c = controls.get(t.dataset.id);
  if (!c) return;
  e.preventDefault();
  try { t.setPointerCapture(e.pointerId); } catch (_) {}
  active.set(e.pointerId, c);
  if (c.reset && c.last && p.t - c.last < 0.3) { c.reset(); c.last = 0; } else c.last = p.t;
  c.down(p, e);
});
view.addEventListener('pointermove', (e) => {
  const c = active.get(e.pointerId);
  if (c) { c.move(toStage(e), e); return; }
  if (panDrag && panDrag.id === e.pointerId) {
    const p = toStage(e);
    L.pan[L.zoom] = clamp(panDrag.pan - (p.ay - panDrag.y) / L.panRange, 0, 1);
    placeStage(false);
  }
});
const endPtr = (e) => {
  const c = active.get(e.pointerId);
  if (c) { active.delete(e.pointerId); c.up(toStage(e), e); }
  if (panDrag && panDrag.id === e.pointerId) panDrag = null;
};
view.addEventListener('pointerup', endPtr);
view.addEventListener('pointercancel', endPtr);
view.addEventListener('lostpointercapture', (e) => { if (active.has(e.pointerId)) endPtr(e); });
view.addEventListener('wheel', (e) => {
  if (e.target.closest('.native')) return;
  const t = e.target.closest('[data-id]');
  const c = t && controls.get(t.dataset.id);
  if (c && c.wheel) { e.preventDefault(); c.wheel(e.deltaY); return; }
  if (L.panRange > 0) { e.preventDefault(); L.pan[L.zoom] = clamp(L.pan[L.zoom] + e.deltaY / L.panRange, 0, 1); placeStage(false); }
}, { passive: false });
app.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  unlockAudio();
  if (b.dataset.zoom) setZoom(b.dataset.zoom);
  else if (b.dataset.mode === 'club') setMode(L.mode === 'club' && L.cam === 'crowd' ? 'club2' : 'club'); // again: next camera, round to 1
  else if (b.dataset.mode) setMode(b.dataset.mode);
  else if (b.dataset.act === 'live') location.href = '/';   // HOME is the website's home page
  else if (b.dataset.act === 'lib') openLibrary(null);
  else if (b.dataset.act === 'help') openHelp();
  else if (b.dataset.act === 'fs') toggleFullscreen();
  else if (b.dataset.act === 'full') setFull(true);
});
// the top bar is always there, unless FULL SCREEN (next to CLUB) is pressed: then the club fills the whole window until EXIT, Esc or leaving browser full screen
function setFull(on) {
  L.full = on;
  if (on) { const el = document.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen; try { const r = fn && fn.call(el); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
  else if (document.fullscreenElement || document.webkitFullscreenElement) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (_) {} }
  layout(false);
}
$('#fsexit').addEventListener('click', () => setFull(false));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && L.full) setFull(false); });
// the menu: library, settings, help and account tuck away here; HOME, REC and GO LIVE stay on the bar
const moreBtn = $('#morebtn'), moreMenu = $('#moremenu'), goTop = $('#golivebtn');
const closeMore = () => { moreMenu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); };
moreBtn.addEventListener('click', (e) => { e.stopPropagation(); moreMenu.hidden = !moreMenu.hidden; moreBtn.setAttribute('aria-expanded', String(!moreMenu.hidden)); });
moreMenu.addEventListener('click', closeMore);
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#moremenu, #morebtn')) closeMore(); });
// GO LIVE up here drives the chat panel's own button, so the same checks (Pro, rights) apply
goTop.addEventListener('click', () => document.querySelector('.cgolive')?.click());
setInterval(() => { const g = document.querySelector('.cgolive'); goTop.hidden = !g || !!g.closest('[hidden]'); if (g) { goTop.classList.toggle('on', g.classList.contains('on')); goTop.textContent = g.classList.contains('on') ? 'LIVE' : 'GO LIVE'; } }, 800);
function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const el = d.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn) { toast('Full screen is not available here. On iPhone, add the page to your Home Screen.'); return; }
  try { const r = fn.call(el); if (r && r.catch) r.catch(() => toast('Full screen was blocked by the browser.')); } catch (_) { toast('Full screen was blocked by the browser.'); }
}
window.addEventListener('resize', () => layout(false));
if (window.ResizeObserver) new ResizeObserver(() => layout(false)).observe(document.documentElement);
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => layout(false));
document.addEventListener('fullscreenchange', () => { if (L.full && !document.fullscreenElement && !document.webkitFullscreenElement) L.full = false; setTimeout(() => layout(false), 60); });

// ============================================================ audio engine
let ctx = null, worklet = false, audioReady = false;
const engineInfo = { audio: 'starting…', analysis: 'not used yet' };
const master = {};
// The Club Cloud tag: a short, unmistakable jingle played over the mix every 10 minutes of deck time on non-Pro accounts (see billing.js).
// It goes into the master output, so anything that captures the sound (a screen or audio recorder) captures the tag too.
// If sounds/club-cloud-tag.mp3 exists (a recorded voice saying "Thank you for using Club Cloud"), that is played; otherwise the jingle below.
let tagBuf = null, tagTried = false;
async function loadTag() {
  if (tagTried) return; tagTried = true;
  try { const r = await fetch('sounds/club-cloud-tag.mp3'); if (!r.ok) return; tagBuf = await ctx.decodeAudioData(await r.arrayBuffer()); } catch (_) {}
}
function playWatermark() {
  if (!ctx || !master.duck) return;
  if (tagBuf) { const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.9; s.buffer = tagBuf; s.connect(g).connect(master.duck); s.start(ctx.currentTime + 0.05); return; }
  const t0 = ctx.currentTime + 0.05, out = ctx.createGain(); out.gain.value = 0.55; out.connect(master.duck);
  // a rising swell of filtered noise leads in
  const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.7), ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(); ns.buffer = nb;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.setValueAtTime(500, t0); bp.frequency.exponentialRampToValueAtTime(6000, t0 + 0.65);
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t0); ng.gain.exponentialRampToValueAtTime(0.5, t0 + 0.62); ng.gain.linearRampToValueAtTime(0, t0 + 0.7);
  ns.connect(bp).connect(ng).connect(out); ns.start(t0); ns.stop(t0 + 0.72);
  // then four rising notes and a held chord: E5, G#5, B5, E6
  const bell = (f, at, len, vol) => {
    for (const [mult, v, type] of [[1, 1, 'sine'], [2, 0.35, 'triangle'], [3.01, 0.12, 'sine']]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol * v, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g).connect(out); o.start(at); o.stop(at + len + 0.05);
    }
  };
  [659.25, 830.61, 987.77, 1318.51].forEach((f, i) => bell(f, t0 + 0.72 + i * 0.17, 0.9, 0.5));
  for (const f of [659.25, 830.61, 987.77, 1318.51]) bell(f, t0 + 1.42, 1.5, 0.32);
  setTimeout(() => out.disconnect(), 4000);
}
function unlockAudio() {
  if (!ctx) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

function makeDeckNode() {
  if (worklet) {
    const node = new AudioWorkletNode(ctx, 'cc-deck', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    const w = { node, onReport: null, send: (m, tr) => node.port.postMessage(m, tr || []) };
    node.port.onmessage = (e) => w.onReport && w.onReport(e.data);
    return w;
  }
  const dsp = new window.CCDSP.DeckDSP(ctx.sampleRate);
  const node = ctx.createScriptProcessor(1024, 1, 2);
  const w = { node, onReport: null, send: (m) => dsp.cmd(m) };
  node.onaudioprocess = (e) => {
    const o = e.outputBuffer;
    dsp.process(o.getChannelData(0), o.getChannelData(1), o.length);
    const r = dsp.report(); r.t = e.playbackTime || ctx.currentTime;
    if (w.onReport) w.onReport(r);
  };
  return w;
}
function makeFxNode() {
  if (worklet) {
    const node = new AudioWorkletNode(ctx, 'cc-beatfx', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
    return { node, send: (m) => node.port.postMessage(m) };
  }
  const dsp = new window.CCDSP.BeatFxDSP(ctx.sampleRate);
  const node = ctx.createScriptProcessor(1024, 2, 2);
  node.onaudioprocess = (e) => {
    const i = e.inputBuffer, o = e.outputBuffer;
    dsp.process(i.getChannelData(0), i.numberOfChannels > 1 ? i.getChannelData(1) : i.getChannelData(0), o.getChannelData(0), o.getChannelData(1), o.length);
  };
  return { node, send: (m) => dsp.cmd(m) };
}
const insertPoint = () => { const pre = ctx.createGain(), post = ctx.createGain(); pre.connect(post); return { pre, post }; };

async function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { ctx = new AC(); }
  if (ctx.audioWorklet) {
    try { await ctx.audioWorklet.addModule('dsp.js'); worklet = true; engineInfo.audio = 'AudioWorklet'; }
    catch (e) {
      try {
        const src = await (await fetch('dsp.js')).text();
        const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url); worklet = true; engineInfo.audio = 'AudioWorklet (blob)';
      } catch (e2) { console.warn('AudioWorklet unavailable, using ScriptProcessor', e, e2); engineInfo.audio = 'ScriptProcessor fallback'; }
    }
  } else engineInfo.audio = 'ScriptProcessor fallback';
  master.sum = ctx.createGain();
  master.ip = insertPoint(); master.sum.connect(master.ip.pre);
  master.level = ctx.createGain(); master.ip.post.connect(master.level);
  master.lim = ctx.createDynamicsCompressor();
  const lp = master.lim;
  lp.threshold.value = -1.5; lp.knee.value = 0; lp.ratio.value = 20; lp.attack.value = 0.002; lp.release.value = 0.12;
  master.level.connect(lp);
  master.tap = ctx.createMediaStreamDestination(); lp.connect(master.tap); // the mix as a stream, for going live (before the chat ducking, so shout-outs do not dip it)
  master.duck = ctx.createGain(); lp.connect(master.duck); master.duck.connect(ctx.destination); // chat shout-outs duck the music here
  master.split = ctx.createChannelSplitter(2); lp.connect(master.split);
  master.anL = ctx.createAnalyser(); master.anR = ctx.createAnalyser();
  master.anL.fftSize = master.anR.fftSize = 1024;
  master.split.connect(master.anL, 0); master.split.connect(master.anR, 1);
  master.bufL = new Float32Array(1024); master.bufR = new Float32Array(1024);
  master.spec = ctx.createAnalyser(); master.spec.fftSize = 2048; master.spec.smoothingTimeConstant = 0.55; lp.connect(master.spec);
  for (const d of decks) {
    d.node = makeDeckNode();
    d.node.onReport = (r) => d.onReport(r);
    d.fader = ctx.createGain(); d.ipCh = insertPoint(); d.xf = ctx.createGain(); d.ipXf = insertPoint();
    d.node.node.connect(d.fader); d.fader.connect(d.ipCh.pre); d.ipCh.post.connect(d.xf);
    d.xf.connect(d.ipXf.pre); d.ipXf.post.connect(master.sum);
    d.speed = null; d.stripSent = ''; d.beatSent = 0;
    d.sendRamps(); d.sendStrip();
  }
  fx.node = makeFxNode();
  routeFx();
  applyGains();
  audioReady = true;
}

// ============================================================ mixer state
const mix = { fader: [1, 1], xf: 0.5, curve: 1, input: [0, 0], trim: [0.5, 0.5], eq: [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5]], color: [0.5, 0.5], cfx: 0, param: 0.5, master: 0.6, cue: [false, false, false] };
const eqGain = (v) => { if (v < 0.02) return 0; const db = v < 0.5 ? -26 * (0.5 - v) / 0.5 : 6 * (v - 0.5) / 0.5; return Math.pow(10, db / 20); };
const eqDb = (v) => (v < 0.02 ? '-∞ dB (kill)' : ((v < 0.5 ? -26 * (0.5 - v) / 0.5 : 6 * (v - 0.5) / 0.5) >= 0 ? '+' : '') + (v < 0.5 ? -26 * (0.5 - v) / 0.5 : 6 * (v - 0.5) / 0.5).toFixed(1) + ' dB');
const trimGain = (v) => (v < 0.5 ? Math.pow(v / 0.5, 2) : Math.pow(10, 9 * (v - 0.5) / 0.5 / 20));
const trimDb = (v) => { const g = trimGain(v); return g <= 0.0001 ? '-∞ dB' : ((g >= 1 ? '+' : '') + (20 * Math.log10(g)).toFixed(1) + ' dB'); };
const masterGain = (v) => (v <= 0.6 ? Math.pow(v / 0.6, 2) : Math.pow(10, 5 * (v - 0.6) / 0.4 / 20));
function xfGains() {
  const x = mix.xf;
  if (mix.curve === 0) return [1, 1];
  if (mix.curve === 1) return [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)];
  return [x < 0.94 ? 1 : (1 - x) / 0.06, x > 0.06 ? 1 : x / 0.06];
}
function chanGain(i) { if (mix.input[i] !== 0) return 0; return Math.pow(mix.fader[i], 2) * xfGains()[i] * trimGain(mix.trim[i]); }
function applyGains() {
  if (!ctx) return;
  const x = mix.xf, t = ctx.currentTime;
  let gA, gB;
  if (mix.curve === 0) { gA = 1; gB = 1; }
  else if (mix.curve === 1) { gA = Math.cos(x * Math.PI / 2); gB = Math.sin(x * Math.PI / 2); }
  else { gA = x < 0.94 ? 1 : (1 - x) / 0.06; gB = x > 0.06 ? 1 : x / 0.06; }
  decks[0].xf.gain.setTargetAtTime(gA, t, 0.006);
  decks[1].xf.gain.setTargetAtTime(gB, t, 0.006);
  for (const d of decks) d.fader.gain.setTargetAtTime(Math.pow(mix.fader[d.i], 2), t, 0.006);
  master.level.gain.setTargetAtTime(masterGain(mix.master), t, 0.01);
}

// ============================================================ Beat FX
const fx = {
  type: 10, on: false, depth: 0.5, ch: 'MASTER', auto: true, tapBpm: 128, taps: [], manual: null,
  idx: {}, node: null, sent: '', cur: null,
  list() { return this.type === 4 ? REV_VALS : this.type === 5 ? PITCH_VALS : BEATS; },
  getIdx() { const l = this.list(); if (this.idx[this.type] == null) this.idx[this.type] = this.type === 4 ? 5 : this.type === 5 ? 3 : 4; return clamp(this.idx[this.type], 0, l.length - 1); },
  bpm() {
    if (!this.auto) return this.tapBpm;
    const d = this.ch === '1' || this.ch === 'A' ? decks[0] : this.ch === '2' || this.ch === 'B' ? decks[1] : (masterDeck() || decks.find((x) => x.playing && x.loaded) || decks.find((x) => x.loaded));
    return d && d.loaded ? d.effBpm : 128;
  },
  amt() { if (this.manual != null && (this.type === 4 || this.type === 5)) return this.manual; const l = this.list(); return l[this.getIdx()]; },
  timeSec() {
    if (this.type === 4 || this.type === 5) return BEATS[4] * 60 / this.bpm();
    if (this.manual != null) return this.manual / 1000;
    return BEATS[this.getIdx()] * 60 / this.bpm();
  },
  beatText() {
    if (this.type === 4) return this.amt() + ' %';
    if (this.type === 5) return (this.amt() > 0 ? '+' : '') + this.amt() + ' %';
    if (this.manual != null) return 'MANUAL';
    return BEAT_LBL[this.getIdx()] + ' BEAT';
  },
  step(dir) { this.manual = null; const l = this.list(); this.idx[this.type] = clamp(this.getIdx() + dir, 0, l.length - 1); },
  time(n) {
    if (this.type === 4) this.manual = clamp((this.manual ?? this.amt()) + n, 1, 100);
    else if (this.type === 5) this.manual = clamp((this.manual ?? this.amt()) + n, -50, 100);
    else this.manual = clamp(Math.round((this.manual ?? this.timeSec() * 1000) * Math.pow(1.04, n)), 1, 4000);
  },
  update() {
    if (!this.node) return;
    const v = { type: this.type, on: this.on, depth: this.depth, time: this.timeSec(), amt: this.amt() };
    const k = JSON.stringify(v);
    if (k !== this.sent) { this.sent = k; this.node.send({ cmd: 'set', v }); }
  },
};
function routeFx() {
  if (!fx.node) return;
  const map = { 1: decks[0].ipCh, 2: decks[1].ipCh, A: decks[0].ipXf, B: decks[1].ipXf, MASTER: master.ip };
  const ip = map[fx.ch] || null;
  if (fx.cur === ip) return;
  if (fx.cur) { try { fx.cur.pre.disconnect(fx.node.node); } catch (_) {} try { fx.node.node.disconnect(); } catch (_) {} fx.cur.pre.connect(fx.cur.post); }
  fx.cur = ip;
  if (ip) { try { ip.pre.disconnect(ip.post); } catch (_) {} ip.pre.connect(fx.node.node); fx.node.node.connect(ip.post); }
}

// ============================================================ decks
const decks = [];
const masterDeck = () => decks.find((d) => d.master && d.loaded) || null;

class Deck {
  constructor(n) {
    this.n = n; this.i = n - 1;
    this.t = null; this.buf = null; this.sr = 48000;
    this.base = null; this.cmdT = -1;
    this.pos = 0; this.vpos = 0; this.playing = false; this.motor = 0; this.scrActive = false;
    this.slider = 0; this.range = 1; this.sync = false; this.master = false; this.pickup = null; this.syncTempo = null; this.lastSliderPct = 0;
    this.keylock = false; this.vinyl = true; this.slipMode = false; this.quantize = true; this.rev = false; this.vsa = false; this.jogAdj = 0.5;
    this.cue = 0;
    this.loop = { on: false, in: null, out: null, kind: '', pad: -1 };
    this.adjust = null; this.padMode = 0; this.padAlt = false; this.padsDown = new Set();
    this.bend = 0; this.lastJogMove = 0; this.jog = null; this.jogAngle = 0;
    this.cueHold = false; this.cueKeep = false; this.hotHold = new Set(); this.hotPlay = false; this.hotKeep = false;
    this.slipTags = new Set(); this.slipPos = 0; this.slipOn = false;
    this.shiftHeld = false; this.shiftLatch = false; this.shiftT = 0; this.shiftUsed = false;
    this.speed = null; this.search = 0; this.searchAcc = 0; this.inTimer = null; this.timeMode = 0;
    this.peak = 0; this.zoomIdx = 2; this.beatSent = 0; this.stripSent = '';
    this.node = null; this.ui = null;
  }
  get loaded() { return !!(this.t && this.buf); }
  get bpm() { return this.t ? this.t.bpm || 120 : 120; }
  get B() { return 60 / this.bpm; }
  get first() { return this.t ? this.t.first || 0 : 0; }
  get dur() { return this.buf ? this.buf.duration : 0; }
  get shift() { return this.shiftHeld || this.shiftLatch; }
  takeShift() { const s = this.shift; if (s) { this.shiftUsed = true; this.shiftLatch = false; } return s; }
  get tempoPct() {
    if (this.sync && this.syncTempo != null) return (this.syncTempo - 1) * 100;
    if (this.pickup != null) return this.pickup;
    return this.slider * RANGES[this.range];
  }
  get tempo() { return 1 + this.tempoPct / 100; }
  get effBpm() { return this.bpm * this.tempo; }
  snap(t) { return this.first + Math.round((t - this.first) / this.B) * this.B; }
  snapFloor(t) { return this.first + Math.floor((t - this.first) / this.B + 1e-4) * this.B; }
  send(m, tr) { if (this.node) this.node.send(m, tr); }
  at() { return ctx ? ctx.currentTime : 0; }

  onReport(r) {
    if (!(this.cmdT >= 0 && r.t < this.cmdT + 0.006)) {
      this.base = { pos: r.pos / this.sr, rate: r.rate, t: r.t };
      this.slipPos = r.slipPos / this.sr;
    }
    this.motor = r.motor; this.slipOn = r.slip; this.scrActive = r.scr;
    if (r.peak > this.peak) this.peak = r.peak;
    if (r.ev) for (const ev of r.ev) {
      if (ev === 'end' || ev === 'stopped' || ev === 'start') { this.playing = false; this.cueHold = false; this.hotPlay = false; }
    }
  }
  setPos(t) { this.pos = t; this.vpos = t; this.base = { pos: t, rate: this.playing ? this.speed || 1 : 0, t: this.at() }; this.cmdT = this.at(); }
  seek(t) { if (!this.loaded) return; t = clamp(t, 0, Math.max(0, this.dur - 0.02)); this.send({ cmd: 'seek', pos: t * this.sr }); this.setPos(t); }
  jumpTo(t, q) {
    if (!this.loaded) return;
    t = clamp(t, 0, Math.max(0, this.dur - 0.02));
    if (q && this.quantize && this.playing) {
      const f = this.first, b = this.B, ph = (x) => (((x - f) % b) + b) % b;
      let d = ph(this.pos) - ph(t); if (d < 0) d += b;
      this.send({ cmd: 'jump', pos: t * this.sr, q: [f * this.sr, b * this.sr] });
      this.setPos(t + d);
    } else this.seek(t);
  }
  rel(dt) { if (!this.loaded) return; this.send({ cmd: 'seek', pos: clamp(this.pos + dt, 0, this.dur - 0.02) * this.sr }); this.setPos(clamp(this.pos + dt, 0, this.dur - 0.02)); }

  load(rec, buf, opts = {}) {
    if (!buf) return;
    if (this.playing) this.pauseNow();
    this.slipTags.clear(); this.hotHold.clear(); this.padsDown.clear(); this.cueHold = false; this.hotPlay = false;
    this.t = rec; this.buf = buf; this.sr = buf.sampleRate;
    if (!rec.hot) rec.hot = new Array(8).fill(null);
    if (!rec.mem) rec.mem = [];
    const Lc = buf.getChannelData(0).slice();
    const Rc = buf.numberOfChannels > 1 ? buf.getChannelData(1).slice() : null;
    const start = opts.pos != null ? opts.pos : (rec.firstSound || 0);
    this.send({ cmd: 'load', L: Lc, R: Rc, pos: start * this.sr }, Rc ? [Lc.buffer, Rc.buffer] : [Lc.buffer]);
    this.playing = false; this.rev = false; this.speed = null;
    this.cue = opts.cue != null ? opts.cue : start;
    this.loop = { on: false, in: null, out: null, kind: '', pad: -1 }; this.adjust = null;
    this.setPos(start);
    this.ovl = null; this.stripSent = '';
    if (this.master && !this.loaded) this.master = false;
    renderCenter();
  }
  unloadIf(id) { if (this.t && this.t.id === id) { this.pauseNow(); this.send({ cmd: 'unload' }); this.t = null; this.buf = null; this.master = false; this.sync = false; } }

  // ---------------------------------------------------------------- transport
  play() {
    if (!this.loaded) return;
    if (window.__billing && window.__billing.locked) { window.__billing.showShop('out'); return; } // out of deck time: buy more to play
    if (this.pos >= this.dur - 0.05) this.seek(this.cue);
    const M = masterDeck();
    if (this.sync && M && M !== this && M.playing && !this.slipTags.size) {
      const d = this.phaseDiff(M);
      if (Math.abs(d) > 0.004) this.seek(this.pos + d * this.B);
    }
    this.playing = true;
    this.send({ cmd: 'play', instant: !this.vsa });
    this.slipEnd('pause');
    wakeLock();
  }
  pause() {
    if (!this.playing) return;
    if (this.slipMode) this.slipBegin('pause');
    this.playing = false;
    this.send({ cmd: 'pause', instant: !this.vsa });
  }
  pauseNow() { this.playing = false; this.send({ cmd: 'pause', instant: true }); }
  playPress() {
    if (!this.loaded) { openLibrary(this.i); return; }
    if (this.takeShift()) { this.seek(0); return; }
    if (this.cueHold) { this.cueKeep = true; return; }
    if (this.hotPlay) { this.hotKeep = true; return; }
    if (this.playing) this.pause(); else this.play();
  }
  cueDown() {
    if (!this.loaded) return;
    if (this.takeShift()) { this.pauseNow(); this.seek(0); return; }
    if (this.playing && !this.cueHold) { this.pauseNow(); this.slipCancel(); this.seek(this.cue); return; }
    if (!this.playing) {
      if (Math.abs(this.pos - this.cue) < 0.03) {
        this.cueHold = true; this.cueKeep = false; this.playing = true; this.send({ cmd: 'play', instant: true });
      } else {
        this.cue = this.quantize ? clamp(this.snap(this.pos), 0, this.dur - 0.05) : this.pos;
        this.seek(this.cue);
      }
    }
  }
  cueUp() {
    if (!this.cueHold) return;
    this.cueHold = false;
    if (!this.cueKeep) { this.pauseNow(); this.seek(this.cue); }
  }
  sendRamps() { this.send({ cmd: 'set', v: { rampUp: this.vsa ? 0.18 + this.jogAdj * 0.3 : 0, rampDown: this.vsa ? 0.35 + this.jogAdj * 1.4 : 0, scrTau: 0.006 + this.jogAdj * 0.024 } }); }
  setVsa(on) { this.vsa = on; this.sendRamps(); }
  setJogAdj(v) { this.jogAdj = v; this.sendRamps(); }
  toggleRev() { if (!this.loaded) return; this.rev = !this.rev; if (this.rev) this.slipBegin('rev'); else this.slipEnd('rev'); }
  toggleSlip() { this.slipMode = !this.slipMode; if (!this.slipMode) this.slipCancel(); }
  keylockToggle() { this.keylock = !this.keylock; this.send({ cmd: 'set', v: { keylock: this.keylock } }); }
  cycleRange() {
    if (this.takeShift()) return;
    const before = this.tempoPct;
    this.range = (this.range + 1) % RANGES.length;
    if (!this.sync) this.pickup = Math.abs(before - this.slider * RANGES[this.range]) > 0.02 ? clamp(before, -RANGES[this.range], RANGES[this.range]) : null;
    if (this.pickup != null && Math.abs(this.pickup) < 0.01) this.pickup = null;
  }
  setSlider(v) {
    const pct = v * RANGES[this.range];
    if (this.pickup != null) {
      const a = this.lastSliderPct - this.pickup, b = pct - this.pickup;
      if (Math.abs(b) < 0.08 || (a !== 0 && Math.sign(a) !== Math.sign(b))) this.pickup = null;
    }
    this.lastSliderPct = pct;
    this.slider = v;
  }

  // ---------------------------------------------------------------- sync
  phaseDiff(M) {
    const k = this.effBpm / M.effBpm;
    const kk = k > 1.5 ? 2 : k < 0.75 ? 0.5 : 1;
    // vpos is latency-compensated, so both decks are compared at the position the listener hears
    const bm = (M.vpos - M.first) / M.B * kk, bs = (this.vpos - this.first) / this.B;
    let d = (bm - Math.floor(bm)) - (bs - Math.floor(bs));
    if (d > 0.5) d -= 1; else if (d < -0.5) d += 1;
    return d;
  }
  syncPress() {
    if (!this.loaded) return;
    if (this.takeShift()) { this.instantDouble(); return; }
    if (this.sync) {
      const cur = this.tempoPct;
      this.sync = false; this.syncTempo = null;
      if (!this.master) this.pickup = Math.abs(cur - this.slider * RANGES[this.range]) > 0.02 ? cur : null;
      return;
    }
    this.sync = true;
    const other = decks[1 - this.i];
    if (!masterDeck()) {
      if (other.loaded && (other.playing || !this.playing)) other.master = true; else this.master = true;
    }
    this.pickup = null;
  }
  masterPress() { if (!this.loaded) return; for (const d of decks) d.master = false; this.master = true; }
  instantDouble() {
    const o = decks[1 - this.i];
    if (!o.loaded) { toast('Load a track on the other deck first'); return; }
    this.load(o.t, o.buf, { pos: o.pos, cue: o.cue });
    if (o.loop.on) this.setLoop(o.loop.in, o.loop.out, o.loop.kind, -1);
    this.pickup = o.sync || this.sync ? null : o.tempoPct;
    if (o.playing) { this.playing = true; this.send({ cmd: 'play', instant: true }); this.seek(o.pos + 0.004); }
    toast(`Instant doubles: deck ${o.n} → deck ${this.n}`);
  }

  // ---------------------------------------------------------------- slip
  slipBegin(tag, force) {
    if (!this.slipMode && !force) return;
    if (this.slipTags.has(tag)) return;
    if (!this.slipTags.size) { this.send({ cmd: 'slip', on: true }); this.slipPos = this.pos; }
    this.slipTags.add(tag);
  }
  slipEnd(tag) {
    if (!this.slipTags.delete(tag)) return;
    if (!this.slipTags.size) { this.send({ cmd: 'slip', on: false, ret: true }); this.setPos(this.slipPos); this.cmdT = this.at(); }
  }
  slipCancel() { if (this.slipTags.size) { this.slipTags.clear(); this.send({ cmd: 'slip', on: false, ret: false }); } }

  // ---------------------------------------------------------------- loops
  sendLoop() {
    const l = this.loop, ok = l.on && l.in != null && l.out != null && l.out > l.in;
    this.send({ cmd: 'loop', on: ok, in: ok ? l.in * this.sr : 0, out: ok ? l.out * this.sr : 0 });
  }
  setLoop(a, b, kind, pad) {
    a = clamp(a, 0, this.dur - 0.01); b = clamp(b, a + 0.005, this.dur);
    const was = this.loop.on;
    this.loop = { on: true, in: a, out: b, kind, pad };
    this.sendLoop();
    if (!was && kind !== 'slip' && kind !== 'hot') this.slipBegin('loop');
  }
  loopExit() { if (!this.loop.on) return; this.loop.on = false; this.adjust = null; this.sendLoop(); this.slipEnd('loop'); }
  inDown() {
    if (!this.loaded) return;
    if (this.loop.on) { this.adjust = this.adjust === 'in' ? null : 'in'; return; }
    const p = this.quantize ? this.snap(this.pos) : this.pos;
    this.loop = { on: false, in: p, out: null, kind: 'manual', pad: -1 };
    clearTimeout(this.inTimer);
    this.inTimer = setTimeout(() => {
      this.inTimer = null;
      const a = this.quantize ? this.snapFloor(this.pos) : this.pos;
      this.setLoop(a, a + 4 * this.B, 'auto', -1);
    }, 650);
  }
  inUp() { if (this.inTimer) { clearTimeout(this.inTimer); this.inTimer = null; } }
  outDown() {
    if (!this.loaded) return;
    if (this.loop.on) { this.adjust = this.adjust === 'out' ? null : 'out'; return; }
    if (this.loop.in == null || this.pos < this.loop.in - 0.01) return;
    let b = this.quantize ? this.snap(this.pos) : this.pos;
    if (b <= this.loop.in + 0.02) b = this.loop.in + (this.quantize ? this.B : 0.1);
    this.setLoop(this.loop.in, b, 'manual', -1);
  }
  reloop() {
    if (!this.loaded) return;
    if (this.adjust) { this.adjust = null; return; }
    if (this.loop.on) this.loopExit();
    else if (this.loop.in != null && this.loop.out != null) { this.seek(this.loop.in); this.setLoop(this.loop.in, this.loop.out, this.loop.kind || 'manual', -1); }
  }
  call(dir) {
    if (!this.loaded) return;
    if (this.loop.on) {
      const len = this.loop.out - this.loop.in;
      const nl = dir < 0 ? len / 2 : len * 2;
      if (nl < this.B / 32 - 1e-6 || nl > this.B * 512) return;
      this.loop.out = this.loop.in + nl; this.sendLoop();
      return;
    }
    const ref = this.playing ? this.pos : this.cue, mem = this.t.mem;
    let m = null;
    if (dir < 0) { for (const x of mem) if (x.pos < ref - 0.05) m = x; }
    else m = mem.find((x) => x.pos > ref + 0.05) || null;
    if (!m) { toast('No memory cue ' + (dir < 0 ? 'before' : 'after') + ' this point'); return; }
    if (this.playing) this.jumpTo(m.pos, true); else { this.seek(m.pos); this.cue = m.pos; }
    if (m.loop) this.loop = { on: false, in: m.loop[0], out: m.loop[1], kind: 'manual', pad: -1 };
  }
  memAdd() {
    if (!this.loaded) return;
    const m = this.loop.on ? { pos: this.loop.in, loop: [this.loop.in, this.loop.out] } : { pos: this.cue };
    if (this.t.mem.some((x) => Math.abs(x.pos - m.pos) < 0.01)) { toast('Memory cue already stored here'); return; }
    this.t.mem.push(m); this.t.mem.sort((a, b) => a.pos - b.pos);
    persist(this.t); toast('Memory cue stored');
  }
  memDel() {
    if (!this.loaded) return;
    const ref = this.playing ? this.pos : this.cue;
    const i = this.t.mem.findIndex((x) => Math.abs(x.pos - ref) < 0.08);
    if (i < 0) { toast('Call a memory cue first, then press DELETE'); return; }
    this.t.mem.splice(i, 1); persist(this.t); toast('Memory cue deleted');
  }

  // ---------------------------------------------------------------- pads
  padModePress(k) {
    const sh = this.takeShift();
    this.releasePads();
    if (sh) { this.padMode = k; this.padAlt = true; }
    else if (this.padMode === k) this.padAlt = !this.padAlt;
    else { this.padMode = k; this.padAlt = false; }
  }
  releasePads() { for (const i of [...this.padsDown]) this.padUp(i); }
  padDown(i) {
    this.padsDown.add(i);
    if (!this.loaded) { if (this.padsDown.size === 1) openLibrary(this.i); return; }
    const m = this.padMode, alt = this.padAlt;
    if (m === 0) return this.hotDown(i);
    if (m === 1) {
      const len = (alt ? BL2 : BL1)[i] * this.B;
      if (this.loop.on && this.loop.kind === 'beat' && this.loop.pad === i) { this.loopExit(); return; }
      const a = this.loop.on && this.loop.kind === 'beat' ? this.loop.in : this.quantize ? this.snapFloor(this.pos) : this.pos;
      this.setLoop(a, a + len, 'beat', i);
      return;
    }
    if (m === 2) {
      if (alt) { this.releaseFx(i); return; }
      const a = this.quantize ? this.snapFloor(this.pos) : this.pos;
      this.slipBegin('sloop', true);
      this.setLoop(a, a + SLL[i] * this.B, 'slip', i);
      return;
    }
    if (m === 3) {
      const n = (alt ? BJ2 : BJ1)[i], d = n * this.B;
      if (this.loop.on) { this.loop.in += d; this.loop.out += d; this.sendLoop(); }
      this.rel(d);
    }
  }
  padUp(i) {
    if (!this.padsDown.delete(i)) return;
    if (!this.loaded) return;
    if (this.padMode === 0) this.hotUp(i);
    else if (this.padMode === 2 && !this.padAlt) {
      if (this.loop.on && this.loop.kind === 'slip' && this.loop.pad === i) { this.loop.on = false; this.sendLoop(); }
      this.slipEnd('sloop');
    }
  }
  hotDown(i) {
    const h = this.t.hot[i];
    if (this.takeShift()) { if (h) { this.t.hot[i] = null; persist(this.t); } return; }
    if (!h) {
      const p = this.quantize ? clamp(this.snap(this.pos), 0, this.dur - 0.05) : this.pos;
      this.t.hot[i] = this.loop.on ? { pos: this.loop.in, loop: [this.loop.in, this.loop.out] } : { pos: p };
      persist(this.t);
      return;
    }
    const gate = this.padAlt;
    if (this.playing && !gate && !this.hotPlay) {
      if (this.slipMode) this.slipBegin('hot' + i);
      this.jumpTo(h.pos, true);
      if (h.loop) this.setLoop(h.loop[0], h.loop[1], 'hot', -1); else if (this.loop.on) { this.loop.on = false; this.sendLoop(); }
      this.hotHold.add(i);
    } else {
      this.jumpTo(h.pos, false);
      this.cue = h.pos;
      if (h.loop) this.setLoop(h.loop[0], h.loop[1], 'hot', -1);
      this.hotHold.add(i);
      if (!this.hotPlay) { this.hotPlay = true; this.hotKeep = false; }
      if (!this.playing) { this.playing = true; this.send({ cmd: 'play', instant: true }); }
    }
  }
  hotUp(i) {
    if (!this.hotHold.delete(i)) return;
    if (this.hotPlay && this.hotHold.size === 0) {
      this.hotPlay = false;
      if (!this.hotKeep) { const h = this.t.hot[i]; this.pauseNow(); if (this.loop.kind === 'hot') { this.loop.on = false; this.sendLoop(); } if (h) this.seek(h.pos); }
    }
    this.slipEnd('hot' + i);
  }
  releaseFx(i) {
    if (!this.playing) return;
    if (i === 0 || i === 3) {
      const len = (i === 0 ? 2 : 0.5) * this.B * 2;
      this.send({ cmd: 'set', v: { rampDown: len } });
      this.playing = false; this.send({ cmd: 'pause' });
      setTimeout(() => this.sendRamps(), len * 1000 + 150);
    } else if (i === 1) { this.playing = false; this.send({ cmd: 'backspin', len: 1.2 + this.jogAdj }); }
    else if (i === 2) { this.send({ cmd: 'echoOut', len: this.B }); setTimeout(() => { this.playing = false; }, this.B * 1000); }
  }

  // ---------------------------------------------------------------- search & shift
  trackSearch(dir) {
    if (!this.loaded) { loadAdjacent(this, dir); return; }
    if (this.takeShift()) { loadAdjacent(this, dir); return; }
    if (dir < 0 && this.pos > 1.5) { this.seek(0); this.cue = 0; return; }
    loadAdjacent(this, dir);
  }
  searchDown(dir) { this.search = dir; this.searchAcc = 1; }
  searchUp() { this.search = 0; }
  shiftDown() { this.shiftHeld = true; this.shiftT = nowS(); this.shiftUsed = false; }
  shiftUp() {
    this.shiftHeld = false;
    if (!this.shiftUsed && nowS() - this.shiftT < 0.3) this.shiftLatch = !this.shiftLatch;
  }

  // ---------------------------------------------------------------- jog
  jogDown(p) {
    const cx = JOG.x + this.i * D2, cy = JOG.y;
    const r = Math.hypot(p.x - cx, p.y - cy) / JOG.R;
    const a = Math.atan2(p.y - cy, p.x - cx);
    let mode;
    if (this.adjust && this.loop.on) mode = 'adjust';
    else if (!this.loaded) mode = 'idle';
    else if ((r < 0.78 && this.vinyl) || !this.playing) mode = 'scratch';
    else mode = 'bend';
    this.jog = { a, mode, t: p.t };
    if (mode === 'scratch') { this.send({ cmd: 'scratch', on: true }); if (r < 0.78 && this.vinyl && this.playing) this.slipBegin('scr'); }
  }
  jogMove(p) {
    const j = this.jog; if (!j) return;
    const cx = JOG.x + this.i * D2, cy = JOG.y;
    const a = Math.atan2(p.y - cy, p.x - cx);
    let da = a - j.a; if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
    j.a = a;
    const dt = Math.max(0.004, p.t - j.t); j.t = p.t;
    this.jogAngle += da;
    if (j.mode === 'adjust') {
      const d = da / TAU * this.B, l = this.loop;
      if (this.adjust === 'in') l.in = clamp(l.in + d, 0, l.out - this.B / 32);
      else l.out = clamp(l.out + d, l.in + this.B / 32, this.dur);
      this.sendLoop();
    } else if (j.mode === 'scratch') {
      this.send({ cmd: 'nudge', d: da / TAU * 1.8 * this.sr * (this.rev ? -1 : 1) });
    } else if (j.mode === 'bend') {
      const target = clamp((da / dt) * 0.04, -0.85, 0.85);
      this.bend += (target - this.bend) * 0.6;
      this.lastJogMove = p.t;
    }
  }
  jogUp() {
    const j = this.jog; if (!j) return;
    this.jog = null;
    if (j.mode === 'scratch') { this.send({ cmd: 'scratch', on: false }); this.slipEnd('scr'); }
  }
  jogWheel(dy) {
    if (!this.loaded) return;
    if (this.playing) { this.bend = clamp(this.bend - dy * 0.0012, -0.5, 0.5); this.lastJogMove = nowS(); }
    else this.rel(-dy * 0.0015);
    this.jogAngle -= dy * 0.004;
  }

  // ---------------------------------------------------------------- per frame
  update(dt, at, t) {
    if (this.base) {
      const el = clamp(at - this.base.t, 0, 0.15);
      this.pos = clamp(this.base.pos + this.base.rate * this.sr / this.sr * el, 0, this.dur);
    }
    const lat = ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0;
    this.vpos = clamp(this.pos - (this.base ? this.base.rate : 0) * Math.min(lat, 0.2), 0, this.dur);
    const M = masterDeck();
    // master hand-over when the master stops and this synced deck is playing
    if (M && M !== this && this.sync && this.playing && !M.playing) { M.master = false; this.master = true; }
    // tempo under sync
    this.syncTempo = null;
    if (this.sync && M && M !== this && this.loaded) {
      let r = M.effBpm / this.bpm;
      while (r >= 1.5) r /= 2;
      while (r < 0.75) r *= 2;
      this.syncTempo = r;
    }
    let corr = 1;
    if (this.syncTempo != null && M.playing && this.playing && !this.scrActive && !this.jog && !this.slipTags.size) {
      const d = this.phaseDiff(M);
      if (Math.abs(d) > 0.003) {
        // pull back faster: lock within about a beat instead of one and a half
        const tc = Math.abs(d) > 0.15 ? 0.25 : 0.7;
        corr = 1 + clamp(d * this.B / (tc * this.tempo), -0.06, 0.06);
      }
    }
    if (t - this.lastJogMove > 0.05) this.bend *= Math.exp(-dt * 14);
    if (Math.abs(this.bend) < 1e-4) this.bend = 0;
    const sp = this.tempo * corr * (1 + this.bend) * (this.rev ? -1 : 1);
    if (this.speed === null || Math.abs(sp - this.speed) > 2e-6) {
      this.speed = sp;
      this.send({ cmd: 'set', v: { speed: sp, slipSpeed: this.tempo } });
    }
    if (this.loaded) {
      const bs = 60 / this.effBpm;
      if (Math.abs(bs - this.beatSent) > 1e-4) { this.beatSent = bs; this.send({ cmd: 'set', v: { beatSec: bs } }); }
    }
    if (this.search && this.loaded) {
      this.searchAcc += dt;
      if (this.searchAcc > 0.07) { this.searchAcc = 0; this.rel(this.search * 0.6); }
    }
  }
  sendStrip() {
    const i = this.i;
    const v = {
      trimT: trimGain(mix.trim[i]), gT: mix.eq[i].map(eqGain), mute: mix.input[i] !== 0,
      cType: mix.cfx, cT: Math.abs(mix.color[i] - 0.5) < 0.014 ? 0 : (mix.color[i] - 0.5) * 2, param: mix.param,
    };
    const k = JSON.stringify(v);
    if (k !== this.stripSent) { this.stripSent = k; this.send({ cmd: 'set', v }); }
  }
  // bars to the next cue/hot cue ahead
  barsToCue() {
    if (!this.loaded) return '';
    let next = this.dur;
    for (const h of this.t.hot) if (h && h.pos > this.pos + 0.01 && h.pos < next) next = h.pos;
    for (const m of this.t.mem) if (m.pos > this.pos + 0.01 && m.pos < next) next = m.pos;
    const beats = Math.max(0, Math.floor((next - this.pos) / this.B));
    return Math.floor(beats / 4) + '.' + ((beats % 4) + 1);
  }
}
decks.push(new Deck(1), new Deck(2));

// ============================================================ build the panel
let rotary;
function buildDeck(d) {
  const ox = d.i * D2, id = (k) => d.n + ':' + k;
  const B = (o) => new Btn(Object.assign({}, o, { id: id(o.k), x: o.x + ox }));
  const ui = d.ui = {};
  ui.in = B({ k: 'in', x: 212, y: 535, w: 42, h: 42, cls: 'inout', onDown: () => d.inDown(), onUp: () => d.inUp() });
  ui.out = B({ k: 'out', x: 277, y: 535, w: 42, h: 42, cls: 'inout', onDown: () => d.outDown() });
  ui.reloop = B({ k: 'reloop', x: 352, y: 535, w: 26, h: 26, cls: 'round', lc: '#ff9a14', onDown: () => d.reloop() });
  ui.callP = B({ k: 'callp', x: 462, y: 535, w: 22, h: 22, cls: 'round plain arrow', text: '◀︎', onDown: () => d.call(-1) });
  ui.callN = B({ k: 'calln', x: 515, y: 535, w: 22, h: 22, cls: 'round plain arrow', text: '▶︎', onDown: () => d.call(1) });
  ui.del = B({ k: 'del', x: 574, y: 535, w: 28, h: 28, cls: 'round plain', onDown: () => d.memDel() });
  ui.mem = B({ k: 'mem', x: 623, y: 535, w: 22, h: 22, cls: 'round plain', onDown: () => d.memAdd() });
  ui.slip = B({ k: 'slip', x: 159, y: 616, w: 26, h: 26, cls: 'round', lc: '#ff2b2b', onDown: () => d.toggleSlip() });
  ui.quant = B({ k: 'quant', x: 225, y: 616, w: 26, h: 26, cls: 'round', lc: '#ff2b2b', onDown: () => { d.quantize = !d.quantize; } });
  new Knob({ id: id('jogadj'), x: 577 + ox, y: 615, r: 17, def: 0.5, dots: 9, label: `Deck ${d.n} jog adjust`, fmt: (v) => (v < 0.34 ? 'LIGHT' : v > 0.66 ? 'HEAVY' : 'MEDIUM'), onChange: (v) => d.setJogAdj(v) });
  ui.vsa = B({ k: 'vsa', x: 669, y: 615, w: 24, h: 24, cls: 'round', lc: '#ff2b2b', onDown: () => d.setVsa(!d.vsa) });
  ui.rev = B({ k: 'rev', x: 159, y: 682, w: 52, h: 34, cls: 'rect rev', text: 'REV', onDown: () => d.toggleRev() });
  ui.vinyl = B({ k: 'vinyl', x: 669, y: 682, w: 52, h: 34, cls: 'rect vinyl', text: 'VINYL', onDown: () => { d.vinyl = !d.vinyl; } });
  ui.tp = B({ k: 'tp', x: 141, y: 771, w: 31, h: 31, cls: 'pill', text: '|◀◀', onDown: () => d.trackSearch(-1) });
  ui.tn = B({ k: 'tn', x: 181, y: 771, w: 31, h: 31, cls: 'pill', text: '▶▶|', onDown: () => d.trackSearch(1) });
  ui.sp = B({ k: 'sp', x: 141, y: 846, w: 31, h: 31, cls: 'pill', text: '◀◀', onDown: () => d.searchDown(-1), onUp: () => d.searchUp() });
  ui.sn = B({ k: 'sn', x: 181, y: 846, w: 31, h: 31, cls: 'pill', text: '▶▶', onDown: () => d.searchDown(1), onUp: () => d.searchUp() });
  ui.sync = B({ k: 'sync', x: 650, y: 750, w: 30, h: 30, cls: 'rect sync', text: 'SYNC', onDown: () => d.syncPress() });
  ui.master = B({ k: 'master', x: 688, y: 750, w: 30, h: 30, cls: 'rect master', text: 'MASTER', onDown: () => d.masterPress() });
  ui.range = B({ k: 'range', x: 669, y: 827, w: 22, h: 22, cls: 'round plain', onDown: () => d.cycleRange() });
  ui.mt = B({ k: 'mt', x: 669, y: 884, w: 24, h: 24, cls: 'round', lc: '#ff2b2b', onDown: () => d.keylockToggle() });
  ui.shift = B({ k: 'shift', x: 159, y: 937, w: 50, h: 30, cls: 'rect shift', text: 'SHIFT', onDown: () => d.shiftDown(), onUp: () => d.shiftUp() });
  ui.cue = B({ k: 'cue', x: 177, y: 1062, w: 76, h: 76, cls: 'big cue', text: 'CUE', onDown: () => d.cueDown(), onUp: () => d.cueUp() });
  ui.play = B({ k: 'play', x: 177, y: 1178, w: 76, h: 76, cls: 'big play', text: PLAY_GLYPH, onDown: () => d.playPress() });
  ui.pm = ['HOT CUE', 'BEAT LOOP', 'SLIP LOOP', 'BEAT JUMP'].map((t, k) => B({ k: 'pm' + k, x: 302 + k * 75, y: 1058, w: 62, h: 17, cls: 'pm', text: t, lc: ['#f2f2f2', '#ff9a14', '#3a72ff', '#ff2b3a'][k], onDown: () => d.padModePress(k) }));
  ui.pads = [];
  for (let k = 0; k < 8; k++) ui.pads.push(B({ k: 'pad' + k, x: 302 + (k % 4) * 75, y: k < 4 ? 1125 : 1200, w: 60, h: 58, cls: 'pad', onDown: () => d.padDown(k), onUp: () => d.padUp(k) }));
  ui.tempo = new Fader({
    id: id('tempo'), x: 670 + ox, y: 1072.5, len: 225, axis: 'v', kind: 'tempo', capW: 46, capH: 48, slotW: 7, min: -1, max: 1, def: 0, invert: true, detent: 0.01, bip: true,
    label: `Deck ${d.n} tempo`,
    fmt: (v) => { const p = v * RANGES[d.range]; return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(2) + '%'; },
    note: () => (d.sync && d.syncTempo != null ? 'SYNC is on: tempo follows the master' : d.pickup != null ? `Move to ${d.pickup.toFixed(2)}% to pick up` : d.loaded ? (d.bpm * (1 + v2pct(d))).toFixed(1) + ' BPM · ' + RANGE_N[d.range] : RANGE_N[d.range]),
    onChange: (v) => d.setSlider(v),
  });
  // jog wheel
  d.jogCv = mkCanvas(JOG.x - JOG.R - 6 + ox, JOG.y - JOG.R - 6, JOG.R * 2 + 12, JOG.R * 2 + 12);
  const jel = document.createElement('div'); jel.className = 'c jog';
  box(jel, JOG.x + ox, JOG.y, JOG.R * 2, JOG.R * 2);
  reg({ id: id('jog'), down: (p) => d.jogDown(p), move: (p) => d.jogMove(p), up: (p) => d.jogUp(p), wheel: (dy) => d.jogWheel(dy) }, jel);
  // top screen
  const sx = d.i ? 1316 : SCR.x;
  d.scr = mkCanvas(sx, SCR.y, SCR.w, SCR.h, 'scr');
  const sel = document.createElement('div'); sel.className = 'c';
  sel.style.cssText = `left:${sx - X0}px;top:${SCR.y - Y0}px;width:${SCR.w}px;height:${SCR.h}px;cursor:pointer`;
  reg(new ScreenCtrl(d, sx), sel);
}
const v2pct = (d) => (d.slider * RANGES[d.range]) / 100;

let mixUI = {};
function buildMixer() {
  const M = mixUI;
  const sw = (id, x, y, names, label, onChange, w = 42, h = 16) => new Switch({ id, x, y, w, h, n: 3, names, label, onChange });
  M.in1 = sw('m:in1', 801, 586, ['DECK 1', 'LINE (no input)', 'PHONO (no input)'], 'CH1 input', (v) => { mix.input[0] = v; decks[0].sendStrip(); });
  M.in2 = sw('m:in2', 1200, 586, ['DECK 2', 'LINE (no input)', 'PHONO (no input)'], 'CH2 input', (v) => { mix.input[1] = v; decks[1].sendStrip(); });
  sw('m:aux', 801, 654, ['OFF', 'LINE', 'PORTABLE'], 'AUX input');
  const K = (o) => new Knob(o);
  for (let i = 0; i < 2; i++) {
    const x = i ? 1087 : 912, n = i + 1;
    K({ id: `m:trim${n}`, x, y: 584, r: 18, kind: 'trim', dots: 11, label: `CH${n} trim`, fmt: trimDb, onChange: (v) => { mix.trim[i] = v; decks[i].sendStrip(); } });
    ['HI', 'MID', 'LOW'].forEach((nm, k) => {
      const band = 2 - k;
      K({ id: `m:eq${n}${k}`, x, y: [653, 724, 794][k], r: 19, dots: 11, bip: true, label: `CH${n} ${nm}`, fmt: eqDb, onChange: (v) => { mix.eq[i][band] = v; decks[i].sendStrip(); } });
    });
    K({
      id: `m:color${n}`, x, y: 875, r: 25, kind: 'color', bip: true, dots: 11, label: `CH${n} colour`,
      fmt: (v) => { const a = Math.round(Math.abs(v - 0.5) * 200); return a < 2 ? 'OFF' : (v < 0.5 ? 'LOW ' : 'HI ') + a + '%'; },
      note: () => (mix.cfx ? 'Sound Colour FX: ' + CFX[mix.cfx] : 'Pick a Sound Colour FX first'),
      onChange: (v) => { mix.color[i] = v; decks[i].sendStrip(); },
    });
    M['cue' + n] = new Btn({ id: `m:cue${n}`, x, y: 930, w: 47, h: 21, cls: 'mcue', text: 'CUE', onDown: () => { mix.cue[i] = !mix.cue[i]; } });
    new Fader({ id: `m:fader${n}`, x, y: 1052, len: 110, axis: 'v', capW: 60, capH: 15, slotW: 6, min: 0, max: 1, def: 1, v: 1, label: `CH${n} fader`, fmt: (v) => (v * 10).toFixed(1), onChange: (v) => { mix.fader[i] = v; applyGains(); } });
  }
  K({ id: 'm:master', x: 1000, y: 586, r: 18, dots: 11, def: 0.6, label: 'Master level', fmt: (v) => { const g = masterGain(v); return g <= 0.0001 ? '-∞ dB' : ((g >= 1 ? '+' : '') + (20 * Math.log10(g)).toFixed(1) + ' dB'); }, onChange: (v) => { mix.master = v; applyGains(); } });
  K({ id: 'm:auxtrim', x: 800, y: 724, r: 18, dots: 11, label: 'AUX trim', note: () => 'No AUX input in the browser' });
  K({ id: 'm:booth', x: 1200, y: 641, r: 18, dots: 11, def: 0.3, label: 'Booth monitor', note: () => 'Uses the same output as master' });
  M.cueM = new Btn({ id: 'm:cuem', x: 1000, y: 930, w: 47, h: 21, cls: 'mcue', text: 'CUE', onDown: () => { mix.cue[2] = !mix.cue[2]; } });
  M.cfx = CFX.slice(1).map((nm, k) => new Btn({
    id: 'm:cfx' + k, x: [758, 800, 841][k % 3], y: k < 3 ? 847 : 896, w: 30, h: 20, cls: 'cfx', text: nm === 'DUB ECHO' ? 'DUB<br>ECHO' : nm,
    onDown: () => { mix.cfx = mix.cfx === k + 1 ? 0 : k + 1; for (const d of decks) d.sendStrip(); },
  }));
  K({ id: 'm:param', x: 800, y: 954, r: 18, dots: 11, label: 'Colour FX parameter', onChange: (v) => { mix.param = v; for (const d of decks) d.sendStrip(); } });
  M.hpcue = new Btn({ id: 'm:hpcue', x: 758, y: 1020, w: 28, h: 20, cls: 'mcue', text: 'CUE', onDown: () => { M.link = !M.link; } });
  K({ id: 'm:hpmix', x: 800, y: 1060, r: 18, dots: 11, bip: true, label: 'Headphones mixing', fmt: (v) => (v < 0.45 ? 'CUE ' : v > 0.55 ? 'MASTER ' : 'BLEND ') + Math.round(v * 100), note: () => 'Headphone cue needs a second output' });
  K({ id: 'm:hplevel', x: 800, y: 1131, r: 18, dots: 11, def: 0.6, label: 'Headphones level', note: () => 'Headphone cue needs a second output' });
  new Switch({ id: 'm:curve', x: 1000, y: 1052, w: 60, h: 30, n: 3, v: 1, names: ['THRU (no fade)', 'SMOOTH', 'SHARP CUT'], label: 'Crossfader curve', onChange: (v) => { mix.curve = v; applyGains(); } });
  new Fader({ id: 'm:xf', x: 1000, y: 1208, len: 120, axis: 'h', capW: 26, capH: 54, slotW: 6, min: 0, max: 1, def: 0.5, v: 0.5, detent: 0.012, bip: true, label: 'Crossfader', fmt: (v) => (Math.abs(v - 0.5) < 0.01 ? 'CENTRE' : v < 0.5 ? 'A ' + Math.round((0.5 - v) * 200) + '%' : 'B ' + Math.round((v - 0.5) * 200) + '%'), onChange: (v) => { mix.xf = v; applyGains(); } });
  // Beat FX
  M.beatL = new Btn({ id: 'm:beatl', x: 1181, y: 718, w: 29, h: 19, cls: 'rect beat', text: '◀︎', onDown: () => { fx.step(-1); flashFx(); } });
  M.beatR = new Btn({ id: 'm:beatr', x: 1221, y: 718, w: 29, h: 19, cls: 'rect beat', text: '▶︎', onDown: () => { fx.step(1); flashFx(); } });
  M.tap = new Btn({
    id: 'm:tap', x: 1201, y: 766, w: 38, h: 38, cls: 'tap', text: 'TAP',
    onDown: () => {
      const t = nowS();
      M.tapHold = setTimeout(() => { fx.auto = true; fx.taps = []; toast('Beat FX BPM: AUTO'); }, 900);
      fx.taps = fx.taps.filter((x) => t - x < 2.2); fx.taps.push(t);
      if (fx.taps.length > 4) fx.taps.shift();
      if (fx.taps.length >= 2) {
        const iv = (fx.taps[fx.taps.length - 1] - fx.taps[0]) / (fx.taps.length - 1);
        fx.tapBpm = clamp(60 / iv, 40, 240); fx.auto = false;
      }
    },
    onUp: () => clearTimeout(M.tapHold),
  });
  M.auto = new Btn({ id: 'm:auto', x: 1201, y: 797, w: 26, h: 12, cls: 'auto', text: 'AUTO', onDown: () => { fx.auto = true; fx.taps = []; } });
  M.fxSel = K({ id: 'm:fxsel', x: 1199, y: 837, r: 18, steps: 14, angles: FX_ANG, v: FX_SEQ.indexOf(10), label: 'Beat FX', fmt: (v) => FX_NAMES[FX_SEQ[v]], onChange: (v) => { fx.type = FX_SEQ[v]; fx.manual = null; } });
  M.chSel = K({ id: 'm:chsel', x: 1201, y: 905, r: 16, steps: 7, angles: CH_ANG, v: 6, label: 'FX channel', fmt: (v) => ({ A: 'CROSSFADER A', B: 'CROSSFADER B', MIC: 'MIC', AUX: 'AUX', 1: 'CH 1', 2: 'CH 2', MASTER: 'MASTER' }[CH_SEQ[v]]), note: () => (fx.ch === 'MIC' || fx.ch === 'AUX' ? 'No signal on this input' : ''), onChange: (v) => { fx.ch = CH_SEQ[v]; routeFx(); } });
  M.time = new Encoder({ id: 'm:time', x: 1200, y: 985, r: 19, label: 'FX time', info: () => fxValueText(), onStep: (n) => fx.time(n) });
  K({ id: 'm:depth', x: 1200, y: 1071, r: 18, dots: 11, def: 0.5, label: 'FX level / depth', onChange: (v) => { fx.depth = v; } });
  M.fxOn = new Btn({ id: 'm:fxon', x: 1200, y: 1152, w: 48, h: 48, cls: 'fxon', onDown: () => { fx.on = !fx.on; } });
  // top-centre browse controls
  M.back = new Btn({ id: 'c:back', x: 1226, y: 350, w: 42, h: 19, cls: 'rect dark', text: 'BACK', onDown: () => { if (!modal.hidden) closeModal(); else { centerTab = 'all'; query = ''; renderCenter(); } } });
  M.tag = new Btn({ id: 'c:tag', x: 1280, y: 350, w: 42, h: 19, cls: 'rect dark', text: 'TAG', onDown: () => { const r = selected(); if (r) { r.tag = !r.tag; persist(r); renderCenter(); toast(r.tag ? 'Tagged: ' + r.title : 'Untagged: ' + r.title); } } });
  rotary = new Encoder({ id: 'c:rot', x: 1253, y: 402, r: 23, kind: 'enc rotary', label: 'Browse', onStep: (n) => moveSel(n), onPush: () => openLibrary(null) });
  M.load1 = new Btn({ id: 'c:load1', x: 1229, y: 461, w: 38, h: 22, cls: 'rect load', text: '1', onDown: () => loadSelected(0) });
  M.load2 = new Btn({ id: 'c:load2', x: 1277, y: 461, w: 38, h: 22, cls: 'rect load', text: '2', onDown: () => loadSelected(1) });
  // meters
  M.meter = mkCanvas(958, 658, 84, 186);
}
function flashFx() { bubble.flash({ el: mixUI.fxSel.el, label: 'Beat FX ' + FX_NAMES[fx.type], text: () => fxValueText(), frac: () => -1 }); }
function fxValueText() {
  if (fx.type === 4 || fx.type === 5) return fx.beatText();
  return fx.manual != null ? Math.round(fx.timeSec() * 1000) + ' ms' : fx.beatText() + ' · ' + Math.round(fx.timeSec() * 1000) + ' ms';
}

// ------------------------------------------------------------ deck screen control
class ScreenCtrl {
  constructor(d, sx) { this.d = d; this.sx = sx; this.id = d.n + ':scr'; }
  down(p) {
    const d = this.d, lx = p.x - this.sx, ly = p.y - SCR.y;
    this.mode = null;
    if (!d.loaded) { openLibrary(d.i); return; }
    if (ly >= 96 && lx >= 192) { this.mode = 'needle'; this.needle(lx); return; }
    if (ly >= 21 && ly < 84) { this.mode = 'scrub'; this.x0 = lx; this.p0 = d.pos; this.wasPlaying = d.playing; return; }
    if (ly >= 96 && lx < 114) { d.timeMode = 1 - d.timeMode; return; }
    if (ly < 19) { openLibrary(d.i); return; }
    if (ly >= 84 && ly < 97) { d.zoomIdx = (d.zoomIdx + 1) % ZOOM_SECS.length; toast('Waveform zoom: ' + ZOOM_SECS[d.zoomIdx] + ' s'); }
  }
  needle(lx) { const d = this.d; d.seek(clamp((lx - 194) / 382, 0, 1) * d.dur); }
  move(p) {
    const d = this.d, lx = p.x - this.sx;
    if (this.mode === 'needle') this.needle(lx);
    else if (this.mode === 'scrub' && !d.playing) d.seek(this.p0 - (lx - this.x0) / (SCR.w / ZOOM_SECS[d.zoomIdx]));
  }
  up() { this.mode = null; }
  wheel(dy) { const d = this.d; d.zoomIdx = clamp(d.zoomIdx + (dy > 0 ? 1 : -1), 0, ZOOM_SECS.length - 1); }
}

// ============================================================ static panel artwork (SVG)
function brushTexture() {
  const c = document.createElement('canvas'); c.width = 640; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#26272a'; g.fillRect(0, 0, 640, 320);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 2600; i++) {
    const y = rnd() * 320, x = rnd() * 640, w = 40 + rnd() * 380, l = rnd();
    g.fillStyle = l > 0.5 ? `rgba(255,255,255,${0.012 + rnd() * 0.035})` : `rgba(0,0,0,${0.03 + rnd() * 0.08})`;
    g.fillRect(x, y, w, 0.6 + rnd() * 0.9);
    if (x + w > 640) g.fillRect(x - 640, y, w, 0.8);
  }
  return c.toDataURL('image/png');
}

function buildArt() {
  const o = [];
  const T = (x, y, txt, s = 10.5, op = {}) => o.push(`<text x="${x}" y="${y}" font-size="${s}" text-anchor="${op.a || 'middle'}" fill="${op.c || '#cfd1d5'}"${op.w ? ` font-weight="${op.w}"` : ''}${op.ls != null ? ` letter-spacing="${op.ls}"` : ''}${op.st ? ` font-style="${op.st}"` : ''}${op.tr ? ` transform="${op.tr}"` : ''}>${esc(txt)}</text>`);
  const Badge = (x, y, txt, w) => { o.push(`<rect x="${x - w / 2}" y="${y - 6}" width="${w}" height="11" rx="2" fill="#a2a3a8"/>`); T(x, y + 3, txt, 7.6, { c: '#141414' }); };
  const P = (d, c = '#86888e', w = 1.1) => o.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`);
  const R = (x, y, w, h, rx, fill, stroke, sw = 1) => o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`);
  const brush = brushTexture();
  o.push(`<defs>
    <pattern id="br" patternUnits="userSpaceOnUse" width="640" height="320"><image href="${brush}" width="640" height="320"/></pattern>
    <linearGradient id="gTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18191b"/><stop offset=".5" stop-color="#0b0b0c"/><stop offset="1" stop-color="#060607"/></linearGradient>
    <linearGradient id="gVig" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".12" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
    <linearGradient id="gVigY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".04"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
    <linearGradient id="gMix" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151517"/><stop offset="1" stop-color="#0c0c0d"/></linearGradient>
    <linearGradient id="ccRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#41E7FF"/><stop offset="1" stop-color="#6285FF"/></linearGradient>
    <linearGradient id="gTempo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b1b1d"/><stop offset=".5" stop-color="#0d0d0e"/><stop offset="1" stop-color="#1b1b1d"/></linearGradient>
  </defs>`);
  // chassis
  R(84, 316, 1831, 951, 18, '#050505');
  R(88, 320, 1823, 943, 14, '#141416', '#323338', 2);
  R(93, 325, 1813, 163, 9, 'url(#gTop)', '#1f2023');
  o.push('<path d="M93 325 H600 L420 488 H93 Z" fill="#fff" opacity=".028"/>');
  for (const x of [95, 1275]) {
    R(x, 492, 630, 766, 4, 'url(#br)');
    R(x, 492, 630, 766, 4, 'url(#gVig)');
    R(x, 492, 630, 766, 4, 'url(#gVigY)', '#0a0a0b', 1.5);
  }
  R(728, 492, 544, 766, 2, 'url(#gMix)', '#08080a', 1.5);
  // screen bezels
  for (const x of [99, 1311]) R(x, 329, 590, 156, 6, '#020203', '#2a2b2f', 1.5);
  R(695, 329, 610, 156, 6, '#020203', '#2a2b2f', 1.5);
  R(1203, 335, 98, 144, 5, '#0d0d0f', '#1e1f22');
  T(1253, 449, 'LOAD', 8.5, { c: '#9a9ca2' });
  T(1253, 478, '— INST.DOUBLES —', 6.5, { c: '#6f7177' });
  // knob tick dots
  for (const [cx, cy, r, n, bip] of knobDots) {
    for (let i = 0; i < n; i++) {
      const a = (-150 + 300 * i / (n - 1)) * Math.PI / 180;
      const big = bip && i === (n - 1) / 2;
      o.push(`<circle cx="${(cx + Math.sin(a) * r).toFixed(1)}" cy="${(cy - Math.cos(a) * r).toFixed(1)}" r="${big ? 1.9 : 1.15}" fill="#b4b6bb"/>`);
    }
  }
  // decks
  for (let i = 0; i < 2; i++) {
    const X = (x) => x + i * D2;
    T(X(212), 507, '• IN / ▬ 4BEAT', 9.5); T(X(277), 507, 'OUT', 9.5);
    P(`M${X(234)} 535 H${X(255)} M${X(299)} 535 H${X(304)} M${X(330)} 535 H${X(338)}`);
    T(X(317), 531, 'LOOP', 8.5);
    T(X(352), 512, 'RELOOP / EXIT', 9.5);
    Badge(X(212), 568, 'IN ADJUST', 44); Badge(X(277), 568, 'OUT ADJUST', 48);
    T(X(489), 513, 'CUE / LOOP', 9.5); T(X(489), 529, 'CALL', 9.5);
    T(X(462), 555, '1/2X', 8); Badge(X(489), 552, 'LOOP', 22); T(X(515), 555, '2X', 8);
    P(`M${X(527)} 535 H${X(559)} M${X(589)} 535 H${X(611)}`);
    T(X(574), 513, 'DELETE', 9.5); T(X(623), 513, 'MEMORY', 9.5);
    T(X(159), 594, 'SLIP', 9.5); T(X(225), 594, 'QUANTIZE', 9.5);
    T(X(577), 585, 'JOG ADJUST', 9.5); T(X(559), 644, 'LIGHT', 7); T(X(596), 644, 'HEAVY', 7);
    T(X(669), 585, 'VINYL SPEED ADJ.', 9.5); T(X(669), 595, 'ON / OFF', 8);
    T(X(159), 658, 'DIRECTION', 9.5); T(X(669), 658, 'JOG MODE', 9.5);
    T(X(159), 744, 'TRACK SEARCH', 9.5); T(X(159), 820, 'SEARCH', 9.5);
    R(X(117), 752, 84, 38, 19, '#09090a', '#2c2d31', 1.5); R(X(117), 827, 84, 38, 19, '#09090a', '#2c2d31', 1.5);
    T(X(669), 726, 'BEAT SYNC', 9.5);
    R(X(631), 732, 76, 36, 4, 'none', '#3a3b40', 1.2);
    P(`M${X(642)} 768 V781 H${X(651)}`, '#c9cbd0', 1.6); T(X(653), 784, 'INST.DOUBLES', 8, { a: 'start' });
    T(X(669), 803, 'TEMPO', 9.5); T(X(669), 813, '±6/±10/±16/WIDE', 7);
    T(X(669), 857, 'MASTER', 9.5); T(X(669), 867, 'TEMPO', 9.5);
    // jog bezel + direction arcs
    o.push(`<circle cx="${X(JOG.x)}" cy="${JOG.y}" r="${JOG.R + 5}" fill="#0b0b0c" stroke="#2e2f33" stroke-width="2"/>`);
    P(`M${X(250)} 960 Q ${X(258)} 985 ${X(292)} 1000`, '#c9cbd0', 1.6); T(X(250), 984, '−', 12); T(X(255), 1001, 'REV', 9);
    P(`M${X(584)} 960 Q ${X(576)} 985 ${X(542)} 1000`, '#c9cbd0', 1.6); T(X(584), 984, '+', 12); T(X(580), 1001, 'FWD', 9);
    T(X(415), 1036, 'PAD MODE', 9.5);
    P(`M${X(262)} 1033 H${X(382)} M${X(448)} 1033 H${X(568)}`);
    T(X(303), 1046, '▬ CALL', 8.5);
    Badge(X(302), 1076, 'GATE CUE', 46); Badge(X(377), 1076, 'BEAT LOOP 2', 54); Badge(X(452), 1076, 'RELEASE FX', 52); Badge(X(527), 1076, 'BEAT JUMP 2', 54);
    T(X(396), 1249, 'HOT CUE', 9); Badge(X(437), 1246, 'DELETE', 32);
    P(`M${X(262)} 1236 V1242 H${X(365)} M${X(458)} 1242 H${X(568)} V1236`);
    T(X(214), 1252, 'PHONES', 7.5); P(`M${X(233)} 1249 H${X(245)} V1243`);
    // tempo slider housing
    R(X(641), 913, 57, 318, 6, 'url(#gTempo)', '#2c2d31', 1.5);
    for (let y = 930; y <= 1215; y += 7.5) P(`M${X(649)} ${y} H${X(660)} M${X(680)} ${y} H${X(691)}`, '#3a3b40', 1);
    for (let y = 963; y <= 1187; y += 9) o.push(`<circle cx="${X(633)}" cy="${y}" r="1" fill="#9a9ca1"/>`);
    T(X(633), 951, '−', 11); T(X(633), 1075, '0', 8.5); T(X(633), 1201, '+', 11);
    T(X(670), 1223, 'TEMPO', 9);
  }
  // mixer labels
  T(801, 569, 'DECK1  LINE  PHONO', 7.6); T(1200, 569, 'DECK2  LINE  PHONO', 7.6);
  for (const x of [912, 1087]) {
    T(x, 557, 'TRIM', 9.5); T(x - 19, 615, '−∞', 8); T(x + 19, 615, '+9', 8);
    T(x, 624, 'HI', 9.5); T(x, 694, 'MID', 9.5); T(x, 764, 'LOW', 9.5);
    for (const y of [684, 754, 824]) { T(x - 19, y, '−26', 7.5); T(x + 19, y, '+6', 7.5); }
    T(x, 837, 'COLOR', 9.5); T(x - 26, 904, 'LOW', 7); T(x + 26, 904, 'HI', 7);
    T(x, 968, x === 912 ? '1' : '2', 30, { w: 700, c: '#e9eaec' });
  }
  T(874, 720, 'EQ/', 8.5); T(874, 730, 'ISO', 8.5); P('M882 653 H876 V708 M876 737 V794 H882');
  T(1125, 720, 'EQ/', 8.5); T(1125, 730, 'ISO', 8.5); P('M1117 653 H1123 V708 M1123 737 V794 H1117');
  T(1000, 548, 'MASTER', 9.5); T(1000, 558, 'LEVEL', 9.5); T(981, 615, '−∞', 8); T(1022, 615, '+5dB', 7.5); T(1033, 573, '0dB', 7.5);
  o.push('<circle cx="1022" cy="570" r="1.8" fill="#d0d0d0"/>');
  R(955, 604, 90, 265, 4, '#060607', '#222326', 1.2);
  T(967, 640, 'CH1', 7.5); T(1000, 640, 'MASTER', 7.5); T(1032, 640, 'CH2', 7.5); T(1000, 653, 'CLIP', 7, { c: '#ff3b3b' });
  const dbs = ['15', '12', '9', '6', '3', '0', '−3', '−6', '−9', '−15', '−24'];
  dbs.forEach((s, k) => { const y = 669 + k * 16.8; T(982, y, s, 7.5); T(1019, y, s, 7.5); });
  T(982, 858, 'dB', 7.5); T(1019, 858, 'dB', 7.5);
  T(800, 615, 'AUX', 11); T(800, 627, 'LINE', 7); T(779, 635, 'OFF', 7); T(824, 635, 'PORTABLE', 7);
  o.push('<rect x="741" y="696" width="12" height="4" rx="1" fill="#4ad66d" opacity=".55"/>'); T(770, 701, 'SIGNAL', 6.5);
  T(800, 695, 'TRIM', 9.5); T(781, 753, '−∞', 8); T(819, 753, '+9', 8);
  P('M744 604 H857 V812 M744 816 H861 V986 H744 M861 992 V1196');
  P('M1142 604 H1256 M1142 679 H1256 M1139 604 V1196');
  o.push('<path d="M861 866 l5 4 l-5 4 z" fill="#c9cbd0"/>');
  T(800, 873, 'SOUND COLOR FX', 10);
  T(800, 925, 'PARAMETER', 9.5); T(781, 983, 'MIN', 7); T(821, 983, 'MAX', 7);
  T(800, 999, 'HEADPHONES', 10.5); T(758, 1041, 'LINK', 6.5);
  T(800, 1032, 'MIXING', 9.5); T(777, 1092, 'CUE', 7); T(828, 1092, 'MASTER', 7);
  T(800, 1104, 'LEVEL', 9.5); T(777, 1164, '−∞', 8); T(818, 1164, '0', 8);
  T(1000, 969, 'MASTER', 11);
  T(1200, 615, 'BOOTH MONITOR', 10.5); T(1181, 673, '−∞', 8); T(1218, 673, '0', 8);
  T(1200, 692, 'BEAT FX', 12); T(1200, 703, 'BEAT', 8.5);
  P('M1196 718 H1206');
  const fxl = [['FILTER', 1184, 813], ['FLANGER', 1219, 813], ['TRANS', 1176, 821], ['PHASER', 1227, 821], ['REVERB', 1166, 829], ['PITCH', 1232, 829], ['SPIRAL', 1165, 838], ['SLIP ROLL', 1238, 838], ['PING PONG', 1158, 846], ['ROLL', 1232, 846], ['ECHO', 1170, 854], ['VINYL BRAKE', 1243, 854], ['DELAY', 1174, 863], ['HELIX', 1224, 863]];
  for (const [s, x, y] of fxl) T(x, y, s, 6.8);
  const chl = [['AUX', 1186, 883], ['1', 1207, 887], ['MIC', 1172, 893], ['2', 1223, 893], ['B', 1166, 906], ['MASTER', 1243, 906], ['CROSS', 1151, 911], ['FADER', 1151, 918], ['A', 1168, 920]];
  for (const [s, x, y] of chl) T(x, y, s, 6.8);
  T(1200, 961, 'TIME', 9.5); T(1200, 1041, 'LEVEL / DEPTH', 9.5); T(1179, 1101, 'MIN', 7); T(1222, 1101, 'MAX', 7); T(1200, 1119, 'ON / OFF', 9.5);
  // fader scales
  for (let k = 0; k <= 10; k++) {
    const y = 1107 - k * 11;
    T(871, y + 3, String(k), 8); T(1128, y + 3, String(k), 8);
    P(`M880 ${y} H903 M921 ${y} H945 M1055 ${y} H1078 M1096 ${y} H1120`, '#55575c', 1);
  }
  T(1000, 1029, 'CROSSFADER CURVE', 9);
  T(981, 1086, 'THRU', 6.5);
  P('M995 1083 l5 -4 l5 4 M1013 1083 l3 -5 h6 l3 5', '#c9cbd0', 1);
  for (let x = 944; x <= 1056; x += 14) P(`M${x} 1180 V1236`, '#3d3f44', 1.2);
  T(898, 1213, '‹A', 15, { w: 700 }); T(1102, 1213, 'B›', 15, { w: 700 });
  // Club Cloud marks (jog-wheel monogram: two C arcs almost meeting, an inner ring and a blue centre)
  const Mark = (cx, cy, r) => o.push(`<g transform="translate(${cx - r} ${cy - r}) scale(${(r / 155).toFixed(4)})"><circle cx="155" cy="155" r="143" fill="#0D1B2D" stroke="url(#ccRing)" stroke-width="12"/><path d="M145.7 62A93 93 0 0 0 145.7 248" fill="none" stroke="#F4FBFF" stroke-width="31"/><path d="M164.3 62A93 93 0 0 1 164.3 248" fill="none" stroke="#4CEBFF" stroke-width="31"/><circle cx="155" cy="155" r="46.5" fill="none" stroke="#25415E" stroke-width="4.6"/><circle cx="155" cy="155" r="15.5" fill="#4CEBFF"/></g>`);
  const WF = "'Avenir Next','Avenir','Barlow Semi Condensed','Helvetica Neue',sans-serif";
  const Word = (x, y, size) => {
    o.push(`<text x="${x}" y="${y}" font-size="${size}" font-family="${WF}" font-weight="700" letter-spacing="${-size * 0.02}" fill="#F4FBFF" text-anchor="start">club</text>`);
    o.push(`<line x1="${x + 1}" y1="${y + size * 0.25}" x2="${x + size * 2.55}" y2="${y + size * 0.25}" stroke="#25415E" stroke-width="${Math.max(1, size * 0.03)}"/>`);
    o.push(`<text x="${x + 2}" y="${y + size * 0.78}" font-size="${size * 0.42}" font-family="${WF}" font-weight="700" letter-spacing="${size * 0.13}" fill="#41E7FF" text-anchor="start">CLOUD</text>`);
  };
  Mark(1000, 512, 19);
  o.push(`<text x="972" y="522.5" font-size="29" font-family="${WF}" font-weight="700" letter-spacing="3" fill="#F4FBFF" text-anchor="end">CLUB</text>`);
  o.push(`<text x="1028" y="522.5" font-size="29" font-family="${WF}" font-weight="700" letter-spacing="3" fill="#41E7FF" text-anchor="start">CLOUD</text>`);
  T(1200, 1214, 'ALL-IN-ONE DJ SYSTEM', 7.8);
  Mark(1158, 1236, 13); Word(1178, 1239, 17);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', SW); svg.setAttribute('height', SH);
  svg.setAttribute('viewBox', `${X0} ${Y0} ${SW} ${SH}`);
  svg.innerHTML = o.join('');
  stage.prepend(svg);
}

// ============================================================ jog drawing
function jogLayers(o) {
  if (o.layersGen === o.gen) return;
  o.layersGen = o.gen;
  const S = o.w, k = o.k, R = JOG.R, c0 = S / 2;
  const mk = () => { const c = document.createElement('canvas'); c.width = Math.round(S * k); c.height = Math.round(S * k); const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.translate(c0, c0); return [c, g]; };
  // rotating part: dimples + platter
  const [rc, g] = mk();
  let gr = g.createRadialGradient(0, 0, R - 12, 0, 0, R);
  gr.addColorStop(0, '#1a1a1c'); gr.addColorStop(0.55, '#3c3d41'); gr.addColorStop(0.8, '#141416'); gr.addColorStop(1, '#050505');
  g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = gr; g.fill();
  g.beginPath(); g.arc(0, 0, R - 9, 0, TAU); g.fillStyle = '#141416'; g.fill();
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU;
    g.save(); g.rotate(a); g.translate(0, -(R - 26));
    const dg = g.createRadialGradient(0, 2, 1, 0, 0, 14);
    dg.addColorStop(0, '#060607'); dg.addColorStop(0.7, '#111113'); dg.addColorStop(1, '#2a2b2f');
    g.beginPath(); g.ellipse(0, 0, 15, 11, 0, 0, TAU); g.fillStyle = dg; g.fill();
    g.beginPath(); g.ellipse(0, 0, 15, 11, 0, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }
  g.beginPath(); g.arc(0, 0, R - 44, 0, TAU); g.fillStyle = '#2b2c30'; g.fill();
  g.beginPath(); g.arc(0, 0, R - 47, 0, TAU); g.fillStyle = '#111113'; g.fill();
  for (let r = 84; r < R - 48; r += 2.6) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.strokeStyle = (r | 0) % 2 ? 'rgba(255,255,255,.022)' : 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.stroke(); }
  g.save(); g.fillStyle = 'rgba(244,251,255,.16)'; g.textAlign = 'center';
  g.font = `700 17px 'Avenir Next','Barlow Semi Condensed',sans-serif`; g.fillText('club', 0, -112);
  g.font = `700 7.5px 'Avenir Next','Barlow Semi Condensed',sans-serif`; g.fillStyle = 'rgba(65,231,255,.28)'; g.fillText('C L O U D', 0, -101);
  g.restore();
  o.rot = rc;
  // fixed lighting: sheen wedges
  const [fc, f] = mk();
  if (f.createConicGradient) {
    const cg = f.createConicGradient(-Math.PI / 2, 0, 0);
    const st = [[0, 0], [0.06, 0.09], [0.13, 0], [0.5, 0], [0.56, 0.06], [0.62, 0], [1, 0]];
    for (const [p, a] of st) cg.addColorStop(p, `rgba(255,255,255,${a})`);
    f.beginPath(); f.arc(0, 0, R - 47, 0, TAU); f.fillStyle = cg; f.fill();
  }
  const top = f.createLinearGradient(0, -R, 0, R);
  top.addColorStop(0, 'rgba(255,255,255,.06)'); top.addColorStop(0.5, 'rgba(255,255,255,0)'); top.addColorStop(1, 'rgba(0,0,0,.25)');
  f.beginPath(); f.arc(0, 0, R, 0, TAU); f.fillStyle = top; f.fill();
  o.fix = fc;
}

function drawMark(c, x, y, r) {
  // the Club Cloud mark: a white C and a blue backwards C almost meeting, an inner ring and a blue centre, like a jog wheel
  const k = r / 155, gap = 0.1;
  c.save(); c.translate(x - 155 * k, y - 155 * k); c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 310, 310); g.addColorStop(0, '#41E7FF'); g.addColorStop(1, '#6285FF');
  c.beginPath(); c.arc(155, 155, 143, 0, TAU); c.fillStyle = '#0D1B2D'; c.fill(); c.lineWidth = 12; c.strokeStyle = g; c.stroke();
  c.lineWidth = 31;
  const hx = 93 * Math.sin(gap);   // flat, parallel C ends
  for (const [side, col] of [[-1, '#F4FBFF'], [1, '#4CEBFF']]) { c.save(); c.beginPath(); side < 0 ? c.rect(0, 0, 155 - hx, 310) : c.rect(155 + hx, 0, 155, 310); c.clip(); c.beginPath(); c.arc(155, 155, 93, 0, TAU); c.strokeStyle = col; c.stroke(); c.restore(); }
  c.beginPath(); c.arc(155, 155, 46.5, 0, TAU); c.lineWidth = 4.6; c.strokeStyle = '#25415E'; c.stroke();
  c.beginPath(); c.arc(155, 155, 15.5, 0, TAU); c.fillStyle = '#4CEBFF'; c.fill();
  c.restore();
}
function ringText(c, s, ang, r, color) {
  c.save();
  const bottom = ang > 0 && ang < Math.PI;
  c.rotate(bottom ? ang - Math.PI / 2 : ang + Math.PI / 2);
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(s, 0, bottom ? r : -r);
  c.restore();
}

function drawJog(d) {
  const o = d.jogCv, c = o.ctx, S = o.w, c0 = S / 2;
  jogLayers(o);
  c.clearRect(0, 0, S, S);
  c.save(); c.translate(c0, c0); c.rotate(d.jogAngle); c.drawImage(o.rot, -c0, -c0, S, S); c.restore();
  c.drawImage(o.fix, 0, 0, S, S);
  c.save(); c.translate(c0, c0);
  // display
  c.beginPath(); c.arc(0, 0, 80, 0, TAU); c.fillStyle = '#040405'; c.fill();
  c.lineWidth = 2; c.strokeStyle = '#2c2d31'; c.stroke();
  c.save(); c.beginPath(); c.arc(0, 0, 64, 0, TAU); c.clip();
  const bg = c.createLinearGradient(-64, 0, 64, 0);
  bg.addColorStop(0, '#1b4f9c'); bg.addColorStop(0.5, '#3aa2ff'); bg.addColorStop(1, '#1b4f9c');
  c.globalAlpha = d.vinyl ? (d.jog ? 1 : 0.9) : 0.18; c.fillStyle = bg; c.fillRect(-64, -24, 128, 48);
  c.restore();
  c.font = `600 8.5px ${UIF}`;
  ringText(c, 'MODE', -Math.PI / 2, 71, '#b9bbc0');
  ringText(c, 'VINYL', -Math.PI / 4, 71, d.vinyl ? '#59a8ff' : '#3b3d42');
  ringText(c, 'SLIP', -Math.PI * 3 / 4, 71, d.slipMode ? '#ff3b3b' : '#3b3d42');
  ringText(c, 'SYNC', Math.PI * 3 / 4, 71, d.sync ? '#ffffff' : '#3b3d42');
  ringText(c, 'MASTER', Math.PI / 4, 71, d.master ? '#ff9a14' : '#3b3d42');
  ringText(c, 'BEAT SYNC', Math.PI / 2, 71, '#b9bbc0');
  // white ring + position marker (one revolution = 1.8 s)
  const ang = (d.vpos / 1.8) * TAU - Math.PI / 2;
  c.beginPath(); c.arc(0, 0, 50, 0, TAU); c.lineWidth = 8; c.strokeStyle = d.loaded ? '#f1f1f1' : '#4a4b50'; c.stroke();
  if (d.loaded) {
    c.beginPath(); c.arc(0, 0, 50, ang - 0.2, ang + 0.2); c.strokeStyle = d.jog ? '#ff8a1c' : '#ff2a2a'; c.stroke();
    if (d.slipTags.size) { const ga = (d.slipPos / 1.8) * TAU - Math.PI / 2; c.beginPath(); c.arc(0, 0, 50, ga - 0.12, ga + 0.12); c.strokeStyle = '#7d8088'; c.stroke(); }
  }
  // artwork
  c.save(); c.beginPath(); c.arc(0, 0, 45, 0, TAU); c.clip();
  c.fillStyle = '#111'; c.fillRect(-45, -45, 90, 90);
  const img = d.t && artImage(d.t);
  if (img) { c.rotate(ang + Math.PI / 2); c.drawImage(img, -45, -45, 90, 90); }
  else { if (d.loaded) c.rotate(ang + Math.PI / 2); drawMark(c, 0, 0, 38); } // no cover art: the logo is the label, and spins with the platter
  c.restore();
  if (d.loaded && d.loop.on) { c.beginPath(); c.arc(0, 0, 58, 0, TAU); c.lineWidth = 2; c.strokeStyle = 'rgba(255,154,20,.9)'; c.stroke(); }
  c.restore();
}

// ============================================================ deck screens
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function tx(c, s, x, y, font, color, align = 'left') { c.font = font; c.fillStyle = color; c.textAlign = align; c.fillText(s, x, y); }
const fmtTime = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return [String(m).padStart(2, '0') + ':' + String(Math.floor(r)).padStart(2, '0'), '.' + String(Math.floor((r % 1) * 1000)).padStart(3, '0')]; };
const fmtDur = (s) => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function bandAt(t, a, i0, i1) { let m = 0; for (let i = i0; i < i1; i++) { const v = a[i]; if (v > m) m = v; } return m; }

function drawLane(c, d, x0, y0, w, h, phx) {
  const t = d.t;
  const secs = ZOOM_SECS[d.zoomIdx], pps = w / secs, pos = d.vpos;
  const mid = y0 + h / 2, amp = h / 2 - 3;
  c.fillStyle = '#04060a'; c.fillRect(x0, y0, w, h);
  if (t.low) {
    const rate = t.wfRate, n = t.low.length;
    const cols = [];
    for (let x = 0; x < w; x += 1) {
      const ts = pos + (x - phx) / pps;
      let i0 = Math.floor(ts * rate), i1 = Math.floor((ts + 1 / pps) * rate);
      if (i1 <= i0) i1 = i0 + 1;
      if (i1 <= 0 || i0 >= n) { cols.push(null); continue; }
      i0 = Math.max(0, i0); i1 = Math.min(n, i1);
      cols.push([bandAt(0, t.low, i0, i1) / 255, bandAt(0, t.mid, i0, i1) / 255, bandAt(0, t.high, i0, i1) / 255]);
    }
    const pass = (k, color, scale) => {
      c.fillStyle = color; c.beginPath();
      for (let x = 0; x < cols.length; x++) { const v = cols[x]; if (!v) continue; const hh = Math.max(0.5, v[k] * amp * scale); c.rect(x0 + x, mid - hh, 1, hh * 2); }
      c.fill();
    };
    pass(0, '#2b7cff', 1); pass(1, '#ffa31a', 0.82); pass(2, '#fff1d0', 0.5);
    c.fillStyle = 'rgba(4,6,10,.32)'; c.fillRect(x0, y0, phx, h);
  }
  // beat grid
  const B = d.B, f = d.first, tStart = pos - phx / pps, tEnd = pos + (w - phx) / pps;
  let k0 = Math.ceil((tStart - f) / B), k1 = Math.floor((tEnd - f) / B);
  const down = (t.down || 0);
  for (let k = k0; k <= k1; k++) {
    const x = x0 + phx + (f + k * B - pos) * pps;
    const bar = ((k - down) % 4 + 4) % 4 === 0;
    c.fillStyle = bar ? '#ff3b3b' : 'rgba(255,255,255,.75)';
    c.fillRect(x - 0.5, y0, 1, bar ? 7 : 4); c.fillRect(x - 0.5, y0 + h - (bar ? 7 : 4), 1, bar ? 7 : 4);
  }
  const X = (tt) => x0 + phx + (tt - pos) * pps;
  if (d.loop.in != null && d.loop.out != null) {
    const a = X(d.loop.in), b = X(d.loop.out);
    c.fillStyle = d.loop.on ? 'rgba(255,140,0,.42)' : 'rgba(255,140,0,.14)'; c.fillRect(a, y0, b - a, h);
  } else if (d.loop.in != null) { c.fillStyle = '#ff9a14'; c.fillRect(X(d.loop.in) - 1, y0, 2, h); }
  t.hot.forEach((hc, i) => {
    if (!hc) return; const x = X(hc.pos); if (x < x0 - 8 || x > x0 + w + 8) return;
    c.fillStyle = HOT[i]; c.fillRect(x - 0.5, y0, 1, h);
    c.fillRect(x - 5, y0 + 1, 10, 10); tx(c, LETTERS[i], x, y0 + 9.5, `700 8.5px ${UIF}`, '#000', 'center');
  });
  for (const m of t.mem) { const x = X(m.pos); c.fillStyle = '#ff2b2b'; c.beginPath(); c.moveTo(x - 4, y0 + h); c.lineTo(x + 4, y0 + h); c.lineTo(x, y0 + h - 6); c.fill(); }
  { const x = X(d.cue); c.fillStyle = '#ff9a14'; c.beginPath(); c.moveTo(x - 4, y0 + h); c.lineTo(x + 4, y0 + h); c.lineTo(x, y0 + h - 7); c.fill(); }
  if (d.slipTags.size) { const x = X(d.slipPos); c.fillStyle = 'rgba(190,195,205,.7)'; c.fillRect(x - 1, y0, 2, h); }
  c.fillStyle = '#ffffff'; c.fillRect(x0 + phx - 1, y0, 2, h);
}

function overviewImage(d, w, h, k) {
  const t = d.t, key = t.id + ':' + w + ':' + h + ':' + k;
  if (d.ovl && d.ovl.key === key) return d.ovl.c;
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
  if (t.low) {
    const n = t.low.length, mid = h / 2, cols = Math.round(w * 1.5);
    for (let x = 0; x < cols; x++) {
      const i0 = Math.floor(x / cols * n), i1 = Math.max(i0 + 1, Math.floor((x + 1) / cols * n));
      const lo = bandAt(0, t.low, i0, i1) / 255, mi = bandAt(0, t.mid, i0, i1) / 255, hi = bandAt(0, t.high, i0, i1) / 255;
      const px = x / 1.5;
      const a = Math.max(lo * 0.9, mi) * (mid - 1);
      g.fillStyle = '#2f6fe6'; g.fillRect(px, mid - a, 0.75, a * 2);
      const b = Math.max(mi, hi) * 0.55 * (mid - 1);
      g.fillStyle = '#d7e6ff'; g.fillRect(px, mid - b, 0.75, b * 2);
    }
  }
  d.ovl = { key, c: cv };
  return cv;
}

function drawDeckScreen(d) {
  const o = d.scr, c = o.ctx, W = o.w, H = o.h;
  c.fillStyle = '#04060a'; c.fillRect(0, 0, W, H);
  c.textBaseline = 'alphabetic';
  // header
  c.fillStyle = '#0b0f16'; c.fillRect(0, 0, W, 19);
  rr(c, 3, 2, 24, 15, 2); c.fillStyle = d.master ? '#ff8a1c' : '#1f2734'; c.fill();
  tx(c, String(d.n), 15, 14, `700 12px ${UIF}`, d.master ? '#1a0c00' : '#fff', 'center');
  if (!d.loaded) {
    tx(c, `DECK ${d.n}`, 34, 14, `600 11px ${UIF}`, '#8a929e');
    rr(c, 10, 30, W - 20, 104, 6); c.strokeStyle = '#26303d'; c.setLineDash([5, 4]); c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
    tx(c, d.t && !d.buf ? 'Loading…' : 'Drop a track here, or tap to open the library', W / 2, 78, `600 15px ${UIF}`, '#c9ced6', 'center');
    tx(c, 'MP3 · WAV · AIFF · FLAC · M4A', W / 2, 98, `500 11px ${UIF}`, '#6c7480', 'center');
    return;
  }
  const t = d.t;
  c.save(); c.beginPath(); c.rect(32, 0, W - 190, 19); c.clip();
  tx(c, '♪ ' + (t.title || 'Untitled'), 34, 14, `600 12px ${UIF}`, '#f2f3f5');
  const tw = c.measureText('♪ ' + (t.title || 'Untitled')).width;
  if (t.artist) tx(c, t.artist, 34 + tw + 8, 14, `500 11px ${UIF}`, '#7f8896');
  c.restore();
  tx(c, d.barsToCue() + ' Bars', W - 54, 14, `600 10.5px ${UIF}`, '#ff9a3a', 'right');
  rr(c, W - 48, 2, 44, 15, 2); c.fillStyle = '#121925'; c.fill();
  tx(c, t.key || '—', W - 26, 14, `600 10.5px ${UIF}`, '#7fd0ff', 'center');
  // lane
  drawLane(c, d, 0, 21, W, 62, Math.round(W * 0.3));
  if (d.loop.on) {
    const beats = (d.loop.out - d.loop.in) / d.B;
    rr(c, 4, 24, 54, 12, 2); c.fillStyle = 'rgba(255,140,0,.9)'; c.fill();
    tx(c, '⟲ ' + (beats >= 0.99 ? Math.round(beats) : '1/' + Math.round(1 / beats)) + ' BEAT', 31, 33, `700 8.5px ${UIF}`, '#1a0c00', 'center');
  }
  if (d.adjust) tx(c, (d.adjust === 'in' ? 'IN' : 'OUT') + ' ADJUST · TURN THE JOG', W - 6, 33, `700 9px ${UIF}`, '#ff9a14', 'right');
  tx(c, ZOOM_SECS[d.zoomIdx] + 's', W - 4, 81, `500 8px ${UIF}`, '#4f5762', 'right');
  // hot cue tiles
  const tw8 = (W - 6) / 8;
  for (let i = 0; i < 8; i++) {
    const x = 3 + i * tw8, hc = t.hot[i];
    c.fillStyle = hc ? '#151b25' : '#0b0f15'; c.fillRect(x, 85, tw8 - 3, 11);
    if (hc) { c.fillStyle = HOT[i]; c.fillRect(x + (tw8 - 3) / 2 - 5, 86, 10, 9); tx(c, LETTERS[i], x + (tw8 - 3) / 2, 94, `700 8px ${UIF}`, '#000', 'center'); }
    else tx(c, LETTERS[i], x + (tw8 - 3) / 2, 94, `600 8px ${UIF}`, '#2b3340', 'center');
  }
  // bottom: compact time / BPM / tempo block, then a wide overview
  const remain = d.timeMode === 0;
  tx(c, remain ? 'REMAIN' : 'TIME', 5, 106, `600 7.5px ${UIF}`, '#8a929e');
  const [tm, ms] = fmtTime(remain ? d.dur - d.vpos : d.vpos);
  tx(c, (remain ? '-' : '') + tm, 4, 127, `600 22px ${UIF}`, '#ffffff');
  const mw = c.measureText((remain ? '-' : '') + tm).width;
  tx(c, ms, 5 + mw, 127, `600 11px ${UIF}`, '#cfd3da');
  let bx = 5;
  const tag = (s, bgc, fg) => { c.font = `700 7px ${UIF}`; const w = c.measureText(s).width + 5; rr(c, bx, 134, w, 9, 2); c.fillStyle = bgc; c.fill(); tx(c, s, bx + w / 2, 141, `700 7px ${UIF}`, fg, 'center'); bx += w + 2; };
  if (d.keylock) tag('MT', '#d01c2a', '#fff');
  if (d.quantize) tag('Q', '#5a1418', '#ff6b6b');
  if (d.slipMode) tag('SLIP', d.slipTags.size ? '#ff2b2b' : '#4a1418', '#fff');
  if (d.rev) tag('REV', '#ff2b2b', '#fff');
  if (d.vsa) tag('VSA', '#3a2a10', '#ffb24a');
  // the BPM block sits right up against the time, sized for the widest time ("-00:00.000"), so the overview gets the room
  c.font = `600 22px ${UIF}`; const tw0 = c.measureText('-00:00').width; c.font = `600 11px ${UIF}`;
  const bx0 = Math.round(5 + tw0 + c.measureText('000').width + 6);
  const mc = d.master ? '#ff8a1c' : d.sync ? '#e9e9e9' : '#39404b';
  rr(c, bx0, 98, 66, 24, 3); c.lineWidth = 1.3; c.strokeStyle = mc; c.stroke();
  tx(c, d.master ? 'MASTER' : d.sync ? 'SYNC' : 'BPM', bx0 + 4, 106, `700 6.5px ${UIF}`, d.master || d.sync ? mc : '#8a929e');
  tx(c, d.effBpm.toFixed(1), bx0 + 62, 119, `700 15px ${UIF}`, d.master ? '#ffa13a' : '#ffffff', 'right');
  rr(c, bx0, 125, 24, 9, 2); c.fillStyle = d.range === 3 ? '#b02a2a' : '#1f8f3a'; c.fill();
  tx(c, RANGE_N[d.range], bx0 + 12, 132, `700 6.5px ${UIF}`, '#fff', 'center');
  const p = d.tempoPct;
  tx(c, (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(2) + '%', bx0 + 66, 144, `600 12.5px ${UIF}`, d.pickup != null ? '#ff9a3a' : '#e6e8eb', 'right');
  // overview: starts just after the BPM block and runs to the edge
  const ox = bx0 + 72, oy = 98, ow = 576 - ox, oh = 46;
  c.fillStyle = '#070a10'; c.fillRect(ox, oy, ow, oh);
  c.drawImage(overviewImage(d, ow, oh, o.k), ox, oy, ow, oh);
  const px = ox + (d.vpos / d.dur) * ow;
  c.fillStyle = 'rgba(5,8,12,.55)'; c.fillRect(ox, oy, px - ox, oh);
  if (d.loop.in != null && d.loop.out != null) { c.fillStyle = 'rgba(255,140,0,.55)'; c.fillRect(ox + d.loop.in / d.dur * ow, oy, Math.max(1.5, (d.loop.out - d.loop.in) / d.dur * ow), oh); }
  t.hot.forEach((hc, i) => { if (!hc) return; const x = ox + hc.pos / d.dur * ow; c.fillStyle = HOT[i]; c.fillRect(x - 3, oy, 6, 6); });
  for (const m of t.mem) { const x = ox + m.pos / d.dur * ow; c.fillStyle = '#ff2b2b'; c.beginPath(); c.moveTo(x - 3, oy + oh); c.lineTo(x + 3, oy + oh); c.lineTo(x, oy + oh - 5); c.fill(); }
  { const x = ox + d.cue / d.dur * ow; c.fillStyle = '#ff9a14'; c.beginPath(); c.moveTo(x - 3, oy + oh); c.lineTo(x + 3, oy + oh); c.lineTo(x, oy + oh - 5); c.fill(); }
  c.fillStyle = '#fff'; c.fillRect(px - 1, oy, 2, oh);
  if (d.dur - d.vpos < 30 && d.playing && Math.floor(nowS() * 2) % 2) { c.strokeStyle = '#ff2b2b'; c.lineWidth = 2; c.strokeRect(ox + 1, oy + 1, ow - 2, oh - 2); }
}

// ============================================================ meters
const meterLvl = [-60, -60, -60, -60];
function peakOf(an, buf) { an.getFloatTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > m) m = v; } return m; }
function drawMeters(dt) {
  const o = mixUI.meter; if (!o) return;
  const c = o.ctx;
  const peaks = [decks[0].peak, ctx && audioReady ? peakOf(master.anL, master.bufL) : 0, ctx && audioReady ? peakOf(master.anR, master.bufR) : 0, decks[1].peak];
  decks[0].peak = 0; decks[1].peak = 0;
  c.clearRect(0, 0, o.w, o.h);
  const xs = [9, 38, 46, 74];
  const TH = [15, 12, 9, 6, 3, 0, -3, -6, -9, -15, -24];
  for (let k = 0; k < 4; k++) {
    const db = peaks[k] > 0 ? 20 * Math.log10(peaks[k]) + 12 : -60;
    meterLvl[k] = Math.max(db, meterLvl[k] - dt * 30);
    for (let r = 0; r < TH.length; r++) {
      const y = 6 + r * 16.8, on = meterLvl[k] >= TH[r];
      const col = r < 2 ? '#ff2b2b' : r < 6 ? '#ffa31a' : '#2ee04a';
      c.fillStyle = on ? col : 'rgba(255,255,255,.05)';
      c.fillRect(xs[k] - 2.5, y - 4.5, 5, 9);
      if (on) { c.fillStyle = col + '40'; c.fillRect(xs[k] - 4, y - 6, 8, 12); }
    }
  }
}

// ============================================================ LEDs
function updateLeds(t) {
  stage.classList.toggle('bp', t % 0.5 > 0.25);
  for (const d of decks) {
    const u = d.ui, ld = d.loaded, l = d.loop;
    u.in.led(l.on ? (d.adjust === 'in' ? 'b' : '1') : l.in != null && l.out == null ? 'b' : ld ? 'd' : '0');
    u.out.led(l.on ? (d.adjust === 'out' ? 'b' : '1') : ld ? 'd' : '0');
    u.reloop.led(l.in != null && l.out != null ? (l.on ? '1' : 'd') : '0');
    u.slip.led(d.slipMode ? (d.slipTags.size ? 'b' : '1') : '0');
    u.quant.led(d.quantize ? '1' : '0');
    u.vsa.led(d.vsa ? '1' : '0');
    u.mt.led(d.keylock ? '1' : '0');
    u.rev.led(d.rev ? '1' : 'd');
    u.vinyl.led(d.vinyl ? '1' : 'd');
    u.sync.led(d.sync ? '1' : 'd');
    u.master.led(d.master ? '1' : 'd');
    u.shift.led(d.shiftLatch ? 'b' : d.shiftHeld ? '1' : '0');
    u.cue.led(!ld ? '0' : d.playing ? (d.cueHold ? '1' : 'd') : Math.abs(d.pos - d.cue) < 0.03 ? '1' : 'b');
    u.play.led(!ld ? 'd' : d.playing ? '1' : 'b');
    u.pm.forEach((b, k) => b.led(k === d.padMode ? (d.padAlt ? 'b' : '1') : 'd'));
    for (let i = 0; i < 8; i++) {
      const p = u.pads[i], held = d.padsDown.has(i);
      let col = '#444', s = '0';
      if (!ld) { col = '#333'; s = '0'; }
      else if (d.padMode === 0) { const h = d.t.hot[i]; col = HOT[i]; s = h ? '1' : '0'; if (d.padAlt && h) s = 'd'; }
      else if (d.padMode === 1) { col = '#ff9a14'; s = l.on && l.kind === 'beat' && l.pad === i ? 'b' : 'd'; }
      else if (d.padMode === 2) { if (d.padAlt) { col = ['#ff2b3a', '#ff2b3a', '#3a72ff', '#ff9a14'][i] || '#333'; s = i < 4 ? 'd' : '0'; } else { col = '#3a72ff'; s = l.on && l.kind === 'slip' && l.pad === i ? '1' : 'd'; } }
      else { col = i % 2 ? '#ff4a9e' : '#ff2b3a'; s = 'd'; }
      if (held && ld) s = '1';
      p.color(col); p.led(s);
    }
  }
  const M = mixUI;
  M.cue1.led(mix.cue[0] ? '1' : 'd'); M.cue2.led(mix.cue[1] ? '1' : 'd'); M.cueM.led(mix.cue[2] ? '1' : 'd');
  M.hpcue.led(M.link ? '1' : 'd');
  M.cfx.forEach((b, k) => b.led(mix.cfx === k + 1 ? 'b' : 'd'));
  M.fxOn.led(fx.on ? 'b' : 'd');
  M.auto.led(fx.auto ? '1' : '0');
  M.tap.led(M.tap.el.classList.contains('dn') ? '1' : 'd');
  const sel = selected();
  M.load1.led(sel ? 'd' : '0'); M.load2.led(sel ? 'd' : '0');
}

// ============================================================ library
const lib = [];
let sel = 0, centerTab = 'all', query = '';
const bufCache = new Map();
const DB = {
  db: null,
  open() {
    return new Promise((res) => {
      try {
        const rq = indexedDB.open('cloudclub-dj', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('tracks', { keyPath: 'id' });
        rq.onsuccess = () => { this.db = rq.result; res(true); };
        rq.onerror = () => res(false);
        rq.onblocked = () => res(false);
      } catch (_) { res(false); }
    });
  },
  tx(mode) { return this.db.transaction('tracks', mode).objectStore('tracks'); },
  all() { return new Promise((res) => { if (!this.db) return res([]); try { const r = this.tx('readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); } catch (_) { res([]); } }); },
  put(rec) { if (!this.db) return; try { this.tx('readwrite').put(rec); } catch (e) { console.warn('save failed', e); } },
  del(id) { if (!this.db) return; try { this.tx('readwrite').delete(id); } catch (_) {} },
};
const KEEP = ['id', 'title', 'artist', 'file', 'art', 'bpm', 'first', 'down', 'key', 'firstSound', 'dur', 'wfRate', 'low', 'mid', 'high', 'hot', 'mem', 'tag', 'added'];
const saveTimers = new Map();
function persist(rec) {
  if (!rec || rec.demo || rec.session) return;     // session tracks (the licensed music library) are never saved on this device
  clearTimeout(saveTimers.get(rec.id));
  saveTimers.set(rec.id, setTimeout(() => { const o = {}; for (const k of KEEP) o[k] = rec[k]; DB.put(o); }, 400));
}
function artImage(rec) {
  if (rec._img) return rec._img.complete === false ? null : rec._img;
  if (rec.art) { const im = new Image(); im.src = rec.art; rec._img = im; return null; }
  return null;
}
function viewList() {
  let a = lib;
  if (centerTab === 'tag') a = a.filter((r) => r.tag);
  if (query) { const q = query.toLowerCase(); a = a.filter((r) => ((r.title || '') + ' ' + (r.artist || '')).toLowerCase().includes(q)); }
  return a;
}
function selected() { const v = viewList(); return v[clamp(sel, 0, v.length - 1)] || null; }
function moveSel(n) {
  const v = viewList(); if (!v.length) return;
  sel = clamp(sel + n, 0, v.length - 1);
  renderCenter(true);
  if (!modal.hidden && modal.dataset.kind === 'lib') renderModalList(true);
}

async function getBuffer(rec) {
  if (bufCache.has(rec.id)) return bufCache.get(rec.id);
  if (!rec.file) return null;
  const ab = await rec.file.arrayBuffer();
  const buf = await ctx.decodeAudioData(ab);
  cacheBuffer(rec.id, buf);
  return buf;
}
function cacheBuffer(id, buf) {
  bufCache.set(id, buf);
  const inUse = new Set(decks.map((d) => d.t && d.t.id));
  for (const k of [...bufCache.keys()]) { if (bufCache.size <= 4) break; if (!inUse.has(k) && k !== id && !k.startsWith('demo')) bufCache.delete(k); }
}
async function loadToDeck(rec, i) {
  const d = decks[i];
  if (!rec || rec.busy) { if (rec && rec.busy) toast('Still analysing ' + rec.title); return; }
  const other = decks[1 - i];
  if (other.loaded && other.t.id === rec.id && (!d.t || d.t.id !== rec.id || true) && other.playing) { d.instantDouble(); return; }
  if (d.playing) { toast(`Deck ${d.n} is playing. Pause it first to load a new track.`); return; }
  try {
    const buf = await getBuffer(rec);
    if (!buf) { toast('Could not read that file'); return; }
    d.load(rec, buf);
    toast(`Loaded on deck ${d.n}: ${rec.title}`);
  } catch (e) { console.warn(e); toast('Could not decode ' + rec.title + '. Try MP3, WAV, AIFF or FLAC.'); }
}
function loadSelected(i) { const r = selected(); if (!r) { openLibrary(i); return; } loadToDeck(r, i); }
function loadAdjacent(d, dir) {
  if (!lib.length) return;
  let idx = d.t ? lib.findIndex((r) => r.id === d.t.id) : -1;
  idx = ((idx + dir) % lib.length + lib.length) % lib.length;
  loadToDeck(lib[idx], d.i);
}

// analysis: background worker from our own file, then a blob worker, then the main thread
let worker = null, workerSeq = 0, mainAnalyze = null;
const workerJobs = new Map();
async function analysisSource() { return (await fetch('analyze.js')).text(); }
function startWorker(w, label) {
  w.onmessage = (e) => { const j = workerJobs.get(e.data.id); if (j) { workerJobs.delete(e.data.id); clearTimeout(j.timer); e.data.ok ? j.res(e.data.r) : j.rej(new Error(e.data.error)); } };
  w.onerror = (e) => { console.warn('analysis worker failed', e); if (worker === w) { worker = false; for (const [id, j] of workerJobs) { workerJobs.delete(id); clearTimeout(j.timer); j.retry(); } } };
  worker = w; engineInfo.analysis = label;
}
async function getWorker() {
  if (worker !== null) return worker;
  try { startWorker(new Worker('analyze.js'), 'Background worker'); return worker; } catch (e) { console.warn('worker file blocked', e); }
  try { const src = await analysisSource(); startWorker(new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))), 'Background worker (blob)'); return worker; } catch (e) { console.warn('blob worker blocked', e); }
  worker = false; return worker;
}
async function analyzeMain(mono, sr) {
  if (!mainAnalyze) { const src = await analysisSource(); mainAnalyze = new Function('self', src + '\nreturn analyze;')({}); }
  engineInfo.analysis = 'Main thread fallback';
  await new Promise((r) => setTimeout(r, 0));
  return mainAnalyze(mono, sr);
}
const mapRes = (r) => ({ bpm: r.bpm, first: r.firstBeat, down: r.downbeat, key: r.key, firstSound: r.firstSound, wfRate: r.wfRate, low: r.low, mid: r.mid, high: r.high });
async function analyzeBuffer(buf) {
  const n = buf.length, L0 = buf.getChannelData(0), R0 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L0;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (L0[i] + R0[i]) * 0.5;
  const sr = buf.sampleRate;
  const fallback = async () => {
    try { return mapRes(await analyzeMain(mono, sr)); }
    catch (e) { console.warn('analysis failed', e); engineInfo.analysis = 'Unavailable (default 120 BPM)'; return { bpm: 120, first: 0, down: 0, key: '', firstSound: 0, wfRate: 150, low: null, mid: null, high: null }; }
  };
  const w = await getWorker();
  if (!w) return fallback();
  const id = ++workerSeq;
  return new Promise((res) => {
    const job = { res: (r) => res(mapRes(r)), rej: () => fallback().then(res), retry: () => fallback().then(res) };
    job.timer = setTimeout(() => { if (workerJobs.delete(id)) { worker = false; fallback().then(res); } }, 45000);
    workerJobs.set(id, job);
    try { w.postMessage({ id, mono: mono.slice(), sr }); } catch (e) { workerJobs.delete(id); clearTimeout(job.timer); fallback().then(res); }
  });
}

function readTags(file) {
  return new Promise((res) => {
    const jt = window.jsmediatags;
    if (!jt) return res(null);
    try {
      jt.read(file, {
        onSuccess: (tag) => {
          const t = tag.tags || {}, out = { title: t.title || '', artist: t.artist || '', art: null };
          const pic = t.picture;
          if (pic && pic.data && pic.data.length) {
            try {
              const blob = new Blob([new Uint8Array(pic.data)], { type: pic.format || 'image/jpeg' });
              const url = URL.createObjectURL(blob), im = new Image();
              im.onload = () => {
                const cv = document.createElement('canvas'); cv.width = cv.height = 160;
                const g = cv.getContext('2d'), s = Math.min(im.width, im.height);
                g.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 160, 160);
                URL.revokeObjectURL(url);
                try { out.art = cv.toDataURL('image/jpeg', 0.82); } catch (_) {}
                res(out);
              };
              im.onerror = () => { URL.revokeObjectURL(url); res(out); };
              im.src = url;
              return;
            } catch (_) {}
          }
          res(out);
        },
        onError: () => res(null),
      });
    } catch (_) { res(null); }
  });
}

const isAudio = (f) => /^audio\//.test(f.type) || /\.(mp3|wav|aiff?|flac|m4a|aac|ogg|opus|wma)$/i.test(f.name);
async function addFiles(files, deckIdx, opts) {
  files = [...files].filter(isAudio);
  if (!files.length) { toast('Those files are not audio. Try MP3, WAV, AIFF, FLAC or M4A.'); return; }
  if (!ctx) return;
  toast(files.length === 1 ? 'Adding ' + files[0].name : `Adding ${files.length} tracks…`);
  let first = true;
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '');
    const m = base.match(/^(.+?)\s+-\s+(.+)$/);
    const rec = { session: !!(opts && opts.session), id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: m ? m[2] : base, artist: m ? m[1] : '', file: f, added: Date.now(), hot: new Array(8).fill(null), mem: [], tag: false, busy: true, bpm: 120, first: 0, down: 0 };
    lib.push(rec);
    sel = viewList().indexOf(rec); if (sel < 0) sel = 0;
    renderCenter(true); if (!modal.hidden && modal.dataset.kind === 'lib') renderModalList(true);
    const tagP = readTags(f);
    try {
      const buf = await ctx.decodeAudioData(await f.arrayBuffer());
      rec.dur = buf.duration;
      cacheBuffer(rec.id, buf);
      const [tags, an] = await Promise.all([tagP, analyzeBuffer(buf)]);
      if (tags) { if (tags.title) rec.title = tags.title; if (tags.artist) rec.artist = tags.artist; if (tags.art) rec.art = tags.art; }
      Object.assign(rec, an);
      rec.busy = false;
      persist(rec);
      renderCenter(); if (!modal.hidden && modal.dataset.kind === 'lib') renderModalList();
      if (first && deckIdx != null) {
        const d = decks[deckIdx];
        if (d.playing) toast(`Added to the library. Deck ${d.n} is playing, so it was not loaded.`);
        else { d.load(rec, buf); toast(`Loaded on deck ${d.n}: ${rec.title}`); }
      }
    } catch (e) {
      console.warn(e);
      lib.splice(lib.indexOf(rec), 1);
      toast('Could not decode ' + f.name + '. Try MP3, WAV, AIFF or FLAC.');
      renderCenter();
    }
    first = false;
  }
}
fileIn.addEventListener('change', () => { addFiles(fileIn.files, fileIn.dataset.deck !== '' && fileIn.dataset.deck != null ? +fileIn.dataset.deck : null); fileIn.value = ''; });
function pickFiles(deckIdx) { unlockAudio(); fileIn.dataset.deck = deckIdx == null ? '' : deckIdx; fileIn.click(); }

// ---------------------------------------------------------------- centre screen (library + Beat FX)
let cscreen, cslist, csfx;
function buildCenter() {
  cscreen = document.createElement('div');
  cscreen.id = 'cscreen'; cscreen.className = 'scr native';
  Object.assign(cscreen.style, { left: CSCR.x - X0 + 'px', top: CSCR.y - Y0 + 'px', width: CSCR.w + 'px', height: CSCR.h + 'px' });
  cscreen.innerHTML = `<div class="hd"><button data-tab="all">LIBRARY</button><button data-tab="tag">TAG LIST</button><button data-tab="search">SEARCH</button><button data-tab="add">+ ADD</button><button data-tab="big">⤢︎</button><span class="cnt"></span></div><div class="bd"><div id="cslist"></div><div id="csfx"></div></div>`;
  stage.appendChild(cscreen);
  cslist = cscreen.querySelector('#cslist'); csfx = cscreen.querySelector('#csfx');
  cscreen.querySelector('.hd').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    unlockAudio();
    const t = b.dataset.tab;
    if (t === 'add') pickFiles(null);
    else if (t === 'big') openLibrary(null);
    else if (t === 'search') openLibrary(null, true);
    else { centerTab = t; sel = 0; renderCenter(); }
  });
  cslist.addEventListener('click', (e) => {
    unlockAudio();
    const ld = e.target.closest('[data-load]'), row = e.target.closest('.row');
    if (!row) { if (e.target.closest('.empty')) pickFiles(null); return; }
    const v = viewList(), r = v.find((x) => x.id === row.dataset.tid);
    sel = v.indexOf(r);
    if (ld) loadToDeck(r, +ld.dataset.load); else if (L.s < 0.62) openLibrary(null); else renderCenter(true);
  });
}
let centerSig = '';
function renderCenter(scroll) {
  if (!cslist) return;
  const v = viewList();
  sel = clamp(sel, 0, Math.max(0, v.length - 1));
  for (const b of cscreen.querySelectorAll('.hd [data-tab]')) b.classList.toggle('on', b.dataset.tab === centerTab || (b.dataset.tab === 'search' && !!query));
  const warn = /fallback|Unavailable/.test(engineInfo.audio + engineInfo.analysis) ? ' · ⚠ SEE HELP' : '';
  cscreen.querySelector('.cnt').textContent = (query ? `"${query}" · ` : '') + lib.length + (lib.length === 1 ? ' TRACK' : ' TRACKS') + warn;
  const sig = v.map((r) => r.id + (r.busy ? 'b' : '') + r.title + r.tag + (r.bpm || '') + (r.key || '')).join('|') + sel + decks.map((d) => d.t && d.t.id).join();
  if (sig !== centerSig) {
    centerSig = sig;
    if (!v.length) cslist.innerHTML = `<div class="empty">${centerTab === 'tag' ? 'No tagged tracks. Select a track and press <b>TAG</b>.' : '<b>Drop audio files on this screen</b> or tap <b>+ ADD</b> to build your library.'}</div>`;
    else cslist.innerHTML = v.map((r, i) => {
      const on = decks.filter((d) => d.t && d.t.id === r.id).map((d) => d.n).join('/');
      return `<div class="row${i === sel ? ' sel' : ''}" data-tid="${esc(r.id)}"><span class="num">${on ? '<b style="color:#ff9a1a">' + on + '</b>' : String(i + 1).padStart(2, '0')}</span><span class="ti">${r.tag ? '<span class="tag">★ </span>' : ''}${esc(r.title)}<small>${esc(r.artist || '')}</small></span><span class="bpm">${r.busy ? '…' : (r.bpm || 0).toFixed(1)}</span><span class="key">${esc(r.key || '')}</span><span class="tm" style="display:flex;gap:3px;justify-content:flex-end"><b data-load="0" style="background:#203a70;color:#fff;border-radius:2px;padding:1px 4px;font-size:9px">1</b><b data-load="1" style="background:#203a70;color:#fff;border-radius:2px;padding:1px 4px;font-size:9px">2</b></span></div>`;
    }).join('');
  }
  if (scroll) { const el = cslist.children[sel]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
}
let fxSig = '';
function renderFxPanel() {
  const bpm = fx.bpm();
  const s = [fx.type, fx.on, fx.ch, bpm.toFixed(1), fx.auto, fxValueText(), mix.cfx, Math.round(fx.depth * 100)].join('|');
  if (s === fxSig) return;
  fxSig = s;
  const ms = fx.type === 4 || fx.type === 5 ? fx.beatText() : Math.round(fx.timeSec() * 1000) + ' msec';
  csfx.innerHTML = `<div class="t">BEAT FX</div><div class="nm${fx.on ? ' on' : ''}">${FX_NAMES[fx.type]}</div><div class="t">CH SELECT · ${esc({ A: 'XF A', B: 'XF B' }[fx.ch] || fx.ch)}</div>
    <div class="box"><span>${bpm.toFixed(1)}</span><i class="src">${fx.auto ? 'AUTO' : 'TAP'} BPM</i><span>${esc(ms)}</span><i>${fx.type === 4 || fx.type === 5 ? '' : fx.manual != null ? 'MANUAL' : esc(fx.beatText())}</i><span>${Math.round(fx.depth * 100)}%</span><i>LEVEL</i></div>
    <div class="cfx">COLOR FX <b>${mix.cfx ? CFX[mix.cfx] : 'OFF'}</b></div>`;
}

// ---------------------------------------------------------------- modal
function closeModal() { modal.hidden = true; modal.innerHTML = ''; modal.dataset.kind = ''; }
modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeModal(); });
let modalDeck = null;
function openLibrary(deckIdx, focusSearch) {
  modalDeck = deckIdx;
  modal.dataset.kind = 'lib';
  modal.innerHTML = `<div class="panel" role="dialog" aria-label="Library"><div class="mh"><h2>${deckIdx != null ? 'Load deck ' + (deckIdx + 1) : 'Library'}</h2><input type="search" id="mq" placeholder="Search title or artist" value="${esc(query)}" autocomplete="off"><button class="btn pri" id="madd">Add music</button><button class="btn" id="mclose">Close</button></div><div class="mlist" id="mlist"></div></div>`;
  modal.hidden = false;
  $('#mclose').onclick = closeModal;
  $('#madd').onclick = () => pickFiles(deckIdx);
  const q = $('#mq');
  q.oninput = () => { query = q.value.trim(); sel = 0; renderModalList(); renderCenter(); };
  if (focusSearch) setTimeout(() => q.focus(), 30);
  $('#mlist').addEventListener('click', (e) => {
    const b = e.target.closest('button'), row = e.target.closest('.row');
    if (e.target.closest('.empty')) { pickFiles(deckIdx); return; }
    if (!row) return;
    const r = lib.find((x) => x.id === row.dataset.tid); if (!r) return;
    const v = viewList(); sel = Math.max(0, v.indexOf(r));
    if (!b) { renderModalList(); renderCenter(true); return; }
    if (b.classList.contains('l1')) { loadToDeck(r, 0); if (deckIdx != null) closeModal(); }
    else if (b.classList.contains('l2')) { loadToDeck(r, 1); if (deckIdx != null) closeModal(); }
    else if (b.classList.contains('tg')) { r.tag = !r.tag; persist(r); renderModalList(); renderCenter(); }
    else if (b.classList.contains('rm')) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Remove?'; return; }
      for (const d of decks) d.unloadIf(r.id);
      lib.splice(lib.indexOf(r), 1); bufCache.delete(r.id); DB.del(r.id);
      renderModalList(); renderCenter();
    }
  });
  renderModalList(true);
}
function renderModalList(scroll) {
  const box = $('#mlist'); if (!box) return;
  const v = viewList();
  if (!v.length) { box.innerHTML = `<div class="empty">${query ? 'No tracks match your search.' : '<b>Your library is empty.</b> Tap <b>Add music</b> or drop audio files anywhere on the decks.'}</div>`; return; }
  box.innerHTML = v.map((r, i) => {
    const art = r.art ? ` style="background-image:url('${r.art}')"` : '';
    const acts = r.busy ? '<span class="busy">Analysing…</span>' : `<button class="l1" aria-label="Load on deck 1">Deck 1</button><button class="l2" aria-label="Load on deck 2">Deck 2</button><button class="tg${r.tag ? ' on' : ''}" aria-label="Tag">★</button>${r.demo ? '' : '<button class="rm" aria-label="Remove from library">✕</button>'}`;
    return `<div class="row${i === sel ? ' sel' : ''}" data-tid="${esc(r.id)}"><div class="art"${art}></div><div class="ti"><b>${esc(r.title)}</b><small>${esc(r.artist || 'Unknown artist')}${r.demo ? ' · demo' : ''}</small></div><div class="bpm">${r.busy ? '' : (r.bpm || 0).toFixed(1)}</div><div class="key">${esc(r.key || '')}</div><div class="tm">${fmtDur(r.dur)}</div><div class="acts">${acts}</div></div>`;
  }).join('');
  if (scroll && box.children[sel]) box.children[sel].scrollIntoView({ block: 'nearest' });
}
function openHelp() {
  modal.dataset.kind = 'help';
  modal.innerHTML = `<div class="panel" role="dialog" aria-label="How to use"><div class="mh"><h2>How to use</h2><button class="btn" id="mclose">Close</button></div><div class="help">
  <h3>Load music</h3><ul><li>Drop audio files on a <b>deck screen</b> to load them there, or on the <b>centre screen</b> to add them to the library.</li><li>Tap <b>+ ADD</b> or <b>LIBRARY</b> to pick files. Use the browse knob and <b>LOAD 1 / 2</b> next to the centre screen.</li><li>Loading the track that is playing on the other deck makes an <b>instant double</b> (also <b>SHIFT + SYNC</b>).</li></ul>
  <h3>Knobs, faders and switches</h3><ul><li>Drag up/right to turn up, down/left to turn down. A readout shows the value while you hold it.</li><li><b>Double-tap</b> a knob or fader to reset it. Mouse wheel works too.</li><li>Use <b>DECK 1 · MIXER · DECK 2</b> at the top to zoom in. When zoomed, drag an empty area to scroll.</li></ul>
  <h3>Deck</h3><ul><li><b>CUE</b> works like a CDJ: while paused it sets the cue, hold it to preview, press it while playing to return.</li><li><b>Jog</b>: in VINYL mode the top scratches and the outer ring bends pitch. Turn off VINYL for CDJ mode. With a loop running, press IN or OUT and turn the jog to adjust.</li><li><b>IN / OUT</b> make a loop; hold IN for a 4-beat loop. <b>RELOOP/EXIT</b> leaves or re-enters it, <b>CALL ◀ ▶</b> halves or doubles it.</li><li><b>MEMORY</b> stores the cue point, <b>CALL</b> recalls memory cues, <b>DELETE</b> removes one.</li><li>Pads: <b>HOT CUE</b> (SHIFT + pad deletes), <b>BEAT LOOP</b>, <b>SLIP LOOP</b>, <b>BEAT JUMP</b>. Press a mode again, or SHIFT + mode, for the second set (GATE CUE, BEAT LOOP 2, RELEASE FX, BEAT JUMP 2).</li><li><b>SYNC</b> matches tempo and beat phase to the <b>MASTER</b> deck. <b>QUANTIZE</b> snaps cues and loops to the beat grid. <b>SLIP</b> keeps the track running underneath scratches, loops, reverse and pauses.</li><li><b>TEMPO</b> cycles ±6 / ±10 / ±16 / WIDE. <b>MASTER TEMPO</b> keeps the key when the tempo changes. Tap SHIFT once to latch it for the next button.</li></ul>
  <h3>Mixer</h3><ul><li>Pick a <b>SOUND COLOR FX</b> and turn each channel's <b>COLOR</b> knob; <b>PARAMETER</b> shapes it.</li><li><b>BEAT FX</b>: choose an effect and channel, set the beat with ◀ ▶ (or TIME), set LEVEL/DEPTH and press <b>ON/OFF</b>. TAP sets the FX tempo by hand; hold TAP to go back to AUTO.</li><li>Headphone cue, booth, mic and AUX need extra audio hardware, so they are shown but have no output in the browser.</li></ul>
  <h3>Your music stays on this device</h3><ul><li>Tracks you add are stored in this browser only, with their cues and loops.</li></ul>
  <h3>Engine status</h3><ul><li>Audio engine: <b>${esc(engineInfo.audio)}</b></li><li>Track analysis: <b>${esc(engineInfo.analysis)}</b></li></ul>
  </div></div>`;
  modal.hidden = false;
  $('#mclose').onclick = closeModal;
}

// ---------------------------------------------------------------- drag & drop
function zoneAt(p) {
  if (p.y < 490) return p.x < 692 ? 0 : p.x > 1308 ? 1 : null;
  return p.x < 728 ? 0 : p.x > 1272 ? 1 : null;
}
const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
app.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  const z = zoneAt(toStage(e));
  veil.hidden = false;
  veil.textContent = z == null ? 'DROP TO ADD TO THE LIBRARY' : `DROP TO LOAD ON DECK ${z + 1}`;
});
app.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !app.contains(e.relatedTarget)) veil.hidden = true; });
app.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault(); veil.hidden = true; unlockAudio();
  addFiles(e.dataTransfer.files, zoneAt(toStage(e)));
});

// ============================================================ demo tracks (synthesised so the decks open ready to play)
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
async function renderDemo(sp) {
  // Direct sample synthesis: far faster than scheduling thousands of OfflineAudioContext nodes.
  const sr = ctx.sampleRate, beat = 60 / sp.bpm, off = sp.first, bars = sp.bars;
  const N = Math.ceil((off + bars * 4 * beat + 2.5) * sr);
  const L = new Float32Array(N), R = new Float32Array(N);
  let seed = sp.seed;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823 - 1; };
  const T = (bar, b) => off + (bar * 4 + b) * beat;
  const add = (i, v, pan) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan); R[i] += v * (1 + pan); } };
  const kick = (t) => {
    const i0 = Math.round(t * sr), n = Math.round(0.42 * sr); let ph = 0;
    for (let k = 0; k < n; k++) {
      const x = k / sr, f = 46 + 110 * Math.exp(-x / 0.028);
      ph += TAU * f / sr;
      const a = Math.min(1, k / (0.0015 * sr)) * Math.exp(-x / 0.14);
      add(i0 + k, Math.sin(ph) * a * 0.95 + (k < 120 ? rnd() * 0.25 * (1 - k / 120) : 0), 0);
    }
  };
  const noiseHit = (t, dec, vol, hp, pan, len) => {
    const i0 = Math.round(t * sr), n = Math.round((len || dec * 6) * sr); let lp = 0, lp2 = 0;
    const a1 = Math.exp(-TAU * hp / sr);
    for (let k = 0; k < n; k++) {
      const w = rnd(); lp = a1 * lp + (1 - a1) * w;
      let y = w - lp;
      if (hp < 3000) { lp2 = 0.55 * lp2 + 0.45 * y; y = lp2 * 1.8; }
      add(i0 + k, y * vol * Math.exp(-k / sr / dec), pan);
    }
  };
  const clap = (t) => { for (const [d, v] of [[0, 0.5], [0.011, 0.4], [0.022, 0.55]]) noiseHit(t + d, d < 0.02 ? 0.01 : 0.09, v, 900, 0, d < 0.02 ? 0.012 : 0.3); };
  const synth = (t, freqs, len, cut0, cut1, vol, atk, pan, det) => {
    const i0 = Math.round(t * sr), n = Math.round(len * sr);
    const ph = freqs.flatMap(() => det ? [0, 0.3] : [0]);
    const fr = freqs.flatMap((f) => det ? [f * (1 - det), f * (1 + det)] : [f]);
    let lp = 0, lp2 = 0;
    for (let k = 0; k < n; k++) {
      const x = k / n;
      let s = 0;
      for (let j = 0; j < fr.length; j++) { ph[j] += fr[j] / sr; if (ph[j] >= 1) ph[j] -= 1; s += 2 * ph[j] - 1; }
      s /= fr.length;
      const cut = cut0 * Math.pow(cut1 / cut0, x), a = 1 - Math.exp(-TAU * cut / sr);
      lp += a * (s - lp); lp2 += a * (lp - lp2);
      const env = Math.min(1, k / (atk * sr)) * (atk > 0.1 ? Math.min(1, (n - k) / (0.3 * n)) : Math.exp(-x * 4));
      add(i0 + k, lp2 * env * vol, pan);
    }
  };
  const r = sp.root, prog = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
  for (let bar = 0; bar < bars; bar++) {
    const sec = bar < 8 ? 'intro' : bar < 16 ? 'build' : bar < 24 ? 'break' : bar < bars - 4 ? 'drop' : 'outro';
    const deg = prog[Math.floor(bar / 2) % 4];
    const ch = deg.map((x) => mtof(x + r + 12)), root = mtof(r - 12 + deg[0]);
    for (let b = 0; b < 4; b++) {
      const t = T(bar, b);
      if (sec !== 'break') kick(t);
      if (sec !== 'intro' || bar >= 4) noiseHit(t + beat / 2, 0.035, sec === 'break' ? 0.06 : 0.17, 7000, 0.15);
      if (sec === 'build' || sec === 'drop') { noiseHit(t + beat / 4, 0.012, 0.06, 9000, -0.25); noiseHit(t + beat * 0.75, 0.012, 0.06, 9000, -0.25); }
      if ((sec === 'build' || sec === 'drop') && (b === 1 || b === 3)) clap(t);
      if (sec === 'build' || sec === 'drop' || sec === 'outro') {
        synth(t + beat / 2, [root], beat * 0.42, 1100, 180, 0.55, 0.003, 0, 0);
        if (sec === 'drop' && b % 2) synth(t + beat * 0.75, [root * 2], beat * 0.2, 1400, 300, 0.32, 0.003, 0, 0);
      }
      if (sec === 'drop' && (b === 1 || b === 3)) synth(t + beat / 2, ch, beat * 0.45, 3200, 900, 0.22, 0.004, b === 1 ? -0.3 : 0.3, 0.006);
    }
    if (sec === 'break' && bar % 2 === 0) synth(T(bar, 0), ch, beat * 8, 1500, 900, 0.32, beat * 3, 0, 0.009);
    if (sec === 'break' && bar >= 20) {
      const i0 = Math.round(T(bar, 0) * sr), n = Math.round(4 * beat * sr); let lp = 0, lp2 = 0;
      for (let k = 0; k < n; k++) {
        const x = (bar - 20 + k / n) / 4, f = 300 * Math.pow(30, x), a = 1 - Math.exp(-TAU * f / sr);
        const w = rnd(); lp += a * (w - lp); lp2 += a * (lp - lp2);
        add(i0 + k, (lp - lp2) * (0.05 + 0.25 * x), 0);
      }
    }
  }
  let pk = 0;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 0.9); R[i] = Math.tanh(R[i] * 0.9); pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
  const g = 0.89 / (pk || 1);
  const buf = ctx.createBuffer(2, N, sr);
  const bl = buf.getChannelData(0), br = buf.getChannelData(1);
  for (let i = 0; i < N; i++) { bl[i] = L[i] * g; br[i] = R[i] * g; }
  return buf;
}
function demoArt(a, b, label) {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 160, 160); gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
  g.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(30 + i * 28, 110 - i * 9, 26 + i * 4, 0, TAU); g.fill(); }
  g.fillStyle = '#fff'; g.font = `700 18px ${UIF}`; g.textAlign = 'center'; g.fillText(label, 80, 60);
  g.font = `600 10px ${UIF}`; g.fillText('CLUB CLOUD', 80, 76);
  return c;
}
async function makeDemos() {
  const specs = [
    { id: 'demo1', title: 'Cloud Nine (Club Mix)', artist: 'Club Cloud', bpm: 124, root: 57, bars: 44, first: 0.25, seed: 99, art: ['#ff3d6e', '#5a1cff', 'CLOUD NINE'] },
    { id: 'demo2', title: 'Night Drive (Dub)', artist: 'Club Cloud', bpm: 122, root: 50, bars: 44, first: 0.25, seed: 4242, art: ['#00b3ff', '#0a2a6b', 'NIGHT DRIVE'] },
  ];
  for (const s of specs) {
    const buf = await renderDemo(s);
    const an = await analyzeBuffer(buf);
    console.info(`[analysis check] ${s.title}: detected ${an.bpm} BPM (true ${s.bpm}), first beat ${an.first.toFixed(3)}s (true ${s.first}), key ${an.key}`);
    const rec = { id: s.id, demo: true, title: s.title, artist: s.artist, dur: buf.duration, hot: new Array(8).fill(null), mem: [], tag: false, ...an, bpm: s.bpm, first: s.first, down: 0, firstSound: s.first };
    rec._img = demoArt(...s.art);
    const B = 60 / s.bpm;
    rec.hot[0] = { pos: s.first }; rec.hot[1] = { pos: s.first + 32 * B }; rec.hot[2] = { pos: s.first + 64 * B }; rec.hot[3] = { pos: s.first + 96 * B };
    bufCache.set(rec.id, buf);
    lib.unshift(rec);
  }
  lib.sort((a, b) => (a.demo === b.demo ? (a.demo ? a.id.localeCompare(b.id) : (a.added || 0) - (b.added || 0)) : a.demo ? -1 : 1));
}

// ============================================================ misc
let wl = null;
async function wakeLock() { try { if (!wl && navigator.wakeLock) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (_) { wl = null; } }

// ============================================================ main loop
let lastT = nowS(), lastFx = 0;
function frame() {
  requestAnimationFrame(frame);
  const t = nowS(), dt = Math.min(0.1, t - lastT); lastT = t;
  const at = ctx ? ctx.currentTime : 0;
  for (const d of decks) { d.update(dt, at, t); d.sendStrip(); }
  fx.update();
  for (const d of decks) { drawJog(d); drawDeckScreen(d); }
  drawMeters(dt);
  updateLeds(t);
  bubble.tick(t);
  if (t - lastFx > 0.12) { lastFx = t; renderFxPanel(); }
  if (toastT && t > toastT) { toastT = 0; toastEl.hidden = true; }
}

// ============================================================ boot
async function boot() {
  for (const d of decks) buildDeck(d);
  buildMixer();
  buildCenter();
  buildArt();
  layout(false);
  renderCenter();
  requestAnimationFrame(frame);
  await initAudio();
  const ok = await DB.open();
  if (ok) {
    const recs = await DB.all();
    for (const r of recs) { r.hot = r.hot || new Array(8).fill(null); r.mem = r.mem || []; lib.push(r); }
  }
  renderCenter();
  try { await makeDemos(); } catch (e) { console.warn('demo render failed', e); }
  renderCenter();
  const d1 = lib.find((r) => r.id === 'demo1'), d2 = lib.find((r) => r.id === 'demo2');
  if (d1) decks[0].load(d1, bufCache.get('demo1'));
  if (d2) decks[1].load(d2, bufCache.get('demo2'));
  renderCenter();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const d of decks) d.ovl = null; });
}
$('#signOut')?.addEventListener('click', async () => { try { if (window.__auth) await window.__auth.signOut(); } catch (_) {} location.href = '/'; });

window.__cc = { watermark: playWatermark, loadTag, engineInfo, master, chanGain, nowS, decks, mix, fx, lib, controls, L, get ctx() { return ctx; }, unlock: unlockAudio, setMode, addFiles, analyzeBuffer, layout, bubble, optWheel, zoomBox(box) { ZOOMS.ad = box; L.zoom = 'ad'; placeStage(false); } };
boot();
})();
