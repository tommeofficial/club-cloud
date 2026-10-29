// Deck time. Watching streams, the club and the chat are free; USING THE DECKS is metered:
//   5 free minutes per account per rolling 24 hours, then paid hours (GBP 1 each, any number, never expiring).
// The clock only runs while a deck is playing. The balance lives on the server (see supabase/billing.sql); this file reports playing time
// in small chunks, shows the balance, and locks the decks when the time runs out.
// If the backend is not available (local testing, offline) nothing is locked.
const FLUSH_EVERY = 15;  // seconds of playing between reports to the server
const PRICE = 1;         // GBP per hour

const B = { ready: false, free: 300, paid: 0, resets: null, locked: false, pending: 0, sinceFlush: 0, backend: null, busy: false };
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtH = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`; };
const decks = () => (window.__cc && window.__cc.decks) || [];
const playing = () => decks().some((d) => d.loaded && d.playing);

// ------------------------------------------------------------------ the pill in the top bar
function pill() {
  const el = document.getElementById('timepill'); if (!el) return;
  if (!B.ready) { el.hidden = true; return; }
  el.hidden = false;
  const left = B.free + B.paid;
  el.classList.toggle('out', left <= 0);
  el.classList.toggle('low', left > 0 && left < 60);
  el.textContent = left <= 0 ? 'TIME’S UP' : B.paid > 0 ? fmtH(B.paid + B.free) : `FREE ${fmt(B.free)}`;
  el.title = left <= 0 ? 'Buy deck time to keep playing' : 'Deck time left. Streams and chat are free; only playing the decks uses it.';
}

// ------------------------------------------------------------------ the server
function take(st) { B.free = st.free_left; B.paid = st.paid_left; B.resets = st.free_resets_at ? new Date(st.free_resets_at) : null; }
async function rpc(name, args) {
  const { data, error } = await B.backend.supabase.rpc(name, args);
  if (error) throw error;
  return data;
}
async function flush() {
  if (!B.ready || B.busy || !B.pending) return;
  B.busy = true; const n = B.pending; B.pending = 0; B.sinceFlush = 0;
  try { take(await rpc('use_deck_time', { p_seconds: n })); } catch (e) { B.pending += n; console.warn('deck time report failed', e); }
  B.busy = false; check(); pill();
}

// ------------------------------------------------------------------ the clock: one tick a second
function tick() {
  if (!B.ready) return;
  if (playing()) {
    B.pending++; B.sinceFlush++;
    if (B.free > 0) B.free--; else if (B.paid > 0) B.paid--;     // show the balance falling right away; the server confirms it
    if (B.sinceFlush >= FLUSH_EVERY) flush();
    check(); pill();
  }
}
function check() {
  const out = B.free + B.paid <= 0;
  if (out && !B.locked) { B.locked = true; for (const d of decks()) d.pauseNow(); flush(); showShop('out'); }
  if (!out && B.locked) { B.locked = false; hideShop(); }
}

// ------------------------------------------------------------------ the shop (free test purchase until real payments are connected)
let shop = null;
function showShop(why) {
  if (!shop) { shop = document.createElement('div'); shop.id = 'timeshop'; document.body.appendChild(shop); shop.addEventListener('click', onShopClick); }
  const resets = B.resets && B.free <= 0 ? `Your 5 free minutes come back ${B.resets.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : '';
  shop.innerHTML = `<div class="tsbox">
    <h3>${why === 'out' ? 'Your deck time is up' : 'Deck time'}</h3>
    <p>Watching streams and chatting are always free. Playing the decks uses deck time: <b>5 free minutes every 24 hours</b>, then <b>£${PRICE} an hour</b>. Hours never expire, and only count down while a deck is playing. ${resets}</p>
    <div class="tsopts">${[1, 3, 5, 10].map((h) => `<button data-h="${h}"><b>${h} hour${h > 1 ? 's' : ''}</b><i>£${PRICE * h}</i></button>`).join('')}</div>
    <p class="tsnote">Test mode: payments are not connected yet, so hours are added for free.</p>
    <button class="tsclose">${B.free + B.paid > 0 ? 'CLOSE' : 'NOT NOW'}</button></div>`;
  shop.hidden = false;
}
function hideShop() { if (shop) shop.hidden = true; }
async function onShopClick(e) {
  if (e.target.closest('.tsclose')) { hideShop(); return; }
  const b = e.target.closest('[data-h]'); if (!b || B.busy) return;
  B.busy = true; b.disabled = true;
  try { take(await rpc('test_buy_hours', { p_hours: +b.dataset.h })); B.locked = false; hideShop(); pill(); }
  catch (err) { console.warn('could not add hours', err); b.disabled = false; }
  B.busy = false;
}

// ------------------------------------------------------------------ start
async function init() {
  try {
    B.backend = await import('./backend.js');
    if (!B.backend.supabase) return;
    await B.backend.ensureSession();
    take(await rpc('wallet_status'));
  } catch (e) { console.warn('deck time is not metered here', e); return; }
  B.ready = true; pill(); check();
  setInterval(tick, 1000);
  addEventListener('pagehide', () => { if (B.pending) flush(); });
  document.addEventListener('click', (e) => { if (e.target.closest('#timepill')) showShop(B.free + B.paid <= 0 ? 'out' : 'info'); });
}
window.__billing = { state: B, get locked() { return B.locked; }, showShop, flush };
init();
