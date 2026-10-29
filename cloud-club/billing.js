// Deck time. Watching streams, the club and the chat are free; USING THE DECKS is metered:
//   5 free minutes per account per rolling 24 hours, then paid hours (GBP 1 each, any number, never expiring).
// The clock only runs while a deck is playing. The balance lives on the server (see supabase/billing.sql); this file reports playing time
// in small chunks, shows the balance, and locks the decks when the time runs out.
// If the backend is not available (local testing, offline) nothing is locked.
const GRACE = 120;       // seconds the music carries on after the time runs out, while the offer is on screen
const FLUSH_EVERY = 15;  // seconds of playing between reports to the server
const PRICE = 1;         // GBP per hour

const PRO_PRICE = 9.99; // GBP a month: unlimited deck time, and the only way to go live
const B = { inGrace: false, grace: 0, ready: false, pro: false, proUntil: null, free: 300, paid: 0, resets: null, locked: false, pending: 0, sinceFlush: 0, backend: null, busy: false };
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtH = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`; };
const decks = () => (window.__cc && window.__cc.decks) || [];
const playing = () => decks().some((d) => d.loaded && d.playing);

// ------------------------------------------------------------------ the pill in the top bar
function pill() {
  const el = document.getElementById('timepill'); if (!el) return;
  if (!B.ready) { el.hidden = true; return; }
  el.hidden = false;
  if (B.pro) { el.className = 'pro'; el.textContent = 'PRO'; el.title = `Pro until ${B.proUntil ? B.proUntil.toLocaleDateString() : ''}: unlimited deck time, and you can go live.`; return; }
  el.className = '';
  const left = B.free + B.paid;
  el.classList.toggle('out', left <= 0);
  el.classList.toggle('low', left > 0 && left <= 180);
  el.textContent = left <= 0 ? 'TIME’S UP' : B.paid > 0 ? fmtH(B.paid + B.free) : `FREE ${fmt(B.free)}`;
  el.title = left <= 0 ? 'Buy deck time to keep playing' : 'Deck time left. Streams and chat are free; only playing the decks uses it.';
}

// ------------------------------------------------------------------ the server
function take(st) { B.pro = !!st.pro; B.proUntil = st.pro_until ? new Date(st.pro_until) : null; B.free = st.free_left; B.paid = st.paid_left; B.resets = st.free_resets_at ? new Date(st.free_resets_at) : null; }
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

// ------------------------------------------------------------------ the "running low" prompt: one tap to add an hour, without stopping the music
const WARN_AT = [180, 60, 30];   // seconds left when the prompt appears (again each time, if dismissed)
let warnEl = null, prevLeft = null, dismissedAt = null, flashUntil = 0;
function warn() {
  if (!warnEl) {
    warnEl = document.createElement('div'); warnEl.id = 'timewarn';
    warnEl.innerHTML = '<span class="twt"></span><button class="twadd">ADD 1 HOUR \u00b7 \u00a3' + PRICE + '</button><button class="twx" aria-label="Dismiss">\u2715</button>';
    document.body.appendChild(warnEl);
    warnEl.addEventListener('click', async (e) => {
      if (e.target.closest('.twx')) { dismissedAt = B.free + B.paid; warnEl.hidden = true; return; }
      const add = e.target.closest('.twadd'); if (!add || B.busy) return;
      B.busy = true; add.disabled = true;
      try { take(await rpc('test_buy_hours', { p_hours: 1 })); flashUntil = Date.now() + 2500; prevLeft = B.free + B.paid; dismissedAt = null; pill(); }  // payments are a free test until they are connected
      catch (err) { console.warn('could not add an hour', err); }
      add.disabled = false; B.busy = false; warnRefresh();
    });
  }
  warnEl.hidden = false; warnRefresh();
}
function warnRefresh() {
  if (!warnEl || (warnEl.hidden && !B.inGrace)) return;
  const left = B.free + B.paid;
  if (B.inGrace) { if (shop && !shop.hidden) { warnEl.hidden = true; return; } warnEl.hidden = false; warnEl.classList.remove('ok'); warnEl.querySelector('.twadd').hidden = false; warnEl.querySelector('.twt').textContent = `Out of time \u00b7 ${fmt(B.grace)} left to keep playing`; return; }
  if (Date.now() < flashUntil) { warnEl.classList.add('ok'); warnEl.querySelector('.twt').textContent = '\u2713 1 hour added'; warnEl.querySelector('.twadd').hidden = true; return; }
  if (B.pro || left > WARN_AT[0] + 1) { warnEl.hidden = true; warnEl.classList.remove('ok'); return; }
  warnEl.classList.remove('ok'); warnEl.querySelector('.twadd').hidden = false;
  warnEl.querySelector('.twt').textContent = `\u23f1 ${fmt(left)} left`;
}
function lowCheck() {
  const left = B.free + B.paid;
  if (!B.pro && left > 0 && prevLeft !== null) {
    for (const s of WARN_AT) if (prevLeft > s && left <= s) { dismissedAt = null; warn(); break; }
  }
  prevLeft = left; warnRefresh();
}

// ------------------------------------------------------------------ the clock: one tick a second
function tick() {
  if (!B.ready) return;
  if (B.pro && B.proUntil && Date.now() > B.proUntil.getTime()) { B.proUntil = null; rpc('wallet_status').then((st) => { const was = B.pro; take(st); if (was && !B.pro) dispatchEvent(new Event('cc-timeup')); check(); pill(); }).catch(() => {}); } // the membership has just ended
  if (B.pro) return;                      // Pro members use no deck time
  if (B.inGrace) { if (playing()) B.grace--; graceUi(); if (B.grace <= 0) lockDecks(); return; }
  if (playing()) {
    B.pending++; B.sinceFlush++;
    if (B.free > 0) B.free--; else if (B.paid > 0) B.paid--;     // show the balance falling right away; the server confirms it
    if (B.sinceFlush >= FLUSH_EVERY) flush();
    check(); pill(); lowCheck();
  } else if (warnEl && !warnEl.hidden) warnRefresh();
}
function check() {
  const out = !B.pro && B.free + B.paid <= 0;
  if (!out) { if (B.locked || B.inGrace) { B.locked = false; B.inGrace = false; hideShop(); warnRefresh(); } return; }
  if (B.locked || B.inGrace) return;
  // out of time in the middle of a set: the music carries on for two minutes while a big offer is on screen; otherwise lock straight away
  if (playing()) { B.inGrace = true; B.grace = GRACE; flush(); showShop('grace'); }
  else lockDecks();
}
function lockDecks() {
  B.inGrace = false; B.locked = true;
  for (const d of decks()) d.pauseNow();
  flush(); dispatchEvent(new Event('cc-timeup')); showShop('out'); warnRefresh();
}
function graceUi() {
  const t = shop && !shop.hidden && shop.querySelector('.tsgrace b'); if (t) t.textContent = fmt(B.grace);
  if (warnEl) warnRefresh();
}

// ------------------------------------------------------------------ the shop (free test purchase until real payments are connected)
let shop = null;
function showShop(why) {
  if (!shop) { shop = document.createElement('div'); shop.id = 'timeshop'; document.body.appendChild(shop); shop.addEventListener('click', onShopClick); }
  const resets = B.resets && B.free <= 0 ? `Your 5 free minutes come back ${B.resets.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : '';
  shop.className = why === 'grace' ? 'grace' : '';
  shop.innerHTML = `<div class="tsbox">
    <h3>${why === 'out' || why === 'grace' ? 'Your deck time is up' : why === 'golive' ? 'Going live is for Pro members' : why === 'rec' ? 'Recording is for Pro members' : 'Deck time'}</h3>
    ${why === 'grace' ? `<p class="tsgrace">You can keep playing for <b>${fmt(B.grace)}</b>. Add time now to carry on without a break.</p>` : ''}
    ${why === 'rec' ? '<p>Recording your set and downloading it is for Pro members. Pro is £9.99 a month, with unlimited deck time and going live. Pay-as-you-go hours do not unlock it.</p>' : ''}
    ${why === 'golive' ? '<p>Going live is for Pro members. Pro is £9.99 a month, with unlimited deck time. Pay-as-you-go hours do not unlock it.</p>' : ''}
    <div class="tspro"><div><b>PRO · £${PRO_PRICE} a month</b><span>Unlimited deck time, and the only way to go live.</span></div><button data-pro="30">${B.pro ? 'EXTEND' : 'GO PRO'}</button></div>
    <p>Or pay as you go. Playing the decks uses deck time: <b>5 free minutes every 24 hours</b>, then <b>£${PRICE} an hour</b>. Hours never expire, and only count down while a deck is playing. ${resets}</p>
    <div class="tsopts">${[1, 3, 5, 10].map((h) => `<button data-h="${h}"><b>${h} hour${h > 1 ? 's' : ''}</b><i>£${PRICE * h}</i></button>`).join('')}</div>
    <p class="tsnote">Test mode: payments are not connected yet, so hours and Pro are added for free.</p>
    <button class="tsclose">${why === 'grace' ? 'KEEP PLAYING' : B.free + B.paid > 0 ? 'CLOSE' : 'NOT NOW'}</button></div>`;
  shop.hidden = false;
}
function hideShop() { if (shop) shop.hidden = true; }
async function onShopClick(e) {
  if (e.target.closest('.tsclose')) { hideShop(); if (B.inGrace) { warn(); } return; }   // in the grace minutes, 'keep playing' shrinks the offer to the small bar
  const b = e.target.closest('[data-h], [data-pro]'); if (!b || B.busy) return;
  B.busy = true; b.disabled = true;
  try { take(b.dataset.pro ? await rpc('test_set_pro', { p_days: +b.dataset.pro }) : await rpc('test_buy_hours', { p_hours: +b.dataset.h })); B.locked = false; hideShop(); check(); pill(); }
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
  document.addEventListener('click', (e) => { if (e.target.closest('#timepill')) showShop(B.inGrace ? 'grace' : B.free + B.paid <= 0 ? 'out' : 'info'); });
}
window.__billing = { state: B, get locked() { return B.locked; }, showShop, flush, lowCheck, tick, check };
init();
