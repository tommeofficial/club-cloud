// Deck time. Watching streams (DJ streams and the 24/7 rooms), the club and the chat are free (a guest gets 5 minutes, then makes a free account); USING THE DECKS is metered:
//   5 free minutes per account per rolling 24 hours, then paid hours (GBP 1 each, any number, never expiring).
// The clock only runs while a deck is playing. The balance lives on the server (see supabase/billing.sql); this file reports playing time
// in small chunks, shows the balance, and locks the decks when the time runs out.
// If the backend is not available (local testing, offline) nothing is locked.
const TAG_EVERY = 600;     // seconds of deck time between the Club Cloud tag on non-Pro accounts
const GRACE = 120;       // seconds the music carries on after the time runs out, while the offer is on screen
const FLUSH_EVERY = 5;   // seconds of playing between reports to the server
const PRICE = 1;         // GBP per hour

const PRO_PRICE = 9.99; // GBP a month: unlimited deck time, and the only way to go live
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
const B = { token: null, live: false, tagClock: 0, inGrace: false, grace: 0, ready: false, pro: false, proUntil: null, free: 300, paid: 0, resets: null, locked: false, pending: 0, sinceFlush: 0, backend: null, busy: false };
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtH = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`; };
const decks = () => (window.__cc && window.__cc.decks) || [];
const playing = () => decks().some((d) => d.loaded && d.playing);

// ------------------------------------------------------------------ the pill in the top bar
function pill() {
  const bar = document.getElementById('timebar');        // the countdown beside REC: only for people on free or pay-as-you-go time
  if (bar) {
    const left = B.free + B.paid;
    bar.hidden = !B.ready || B.pro;
    bar.classList.toggle('out', left <= 0); bar.classList.toggle('low', left > 0 && left <= 120);
    bar.textContent = left <= 0 ? 'TIME’S UP' : B.paid > 0 ? fmtH(left) : 'FREE ' + fmt(left);
  }
  const el = document.getElementById('timepill'); if (!el) return;
  if (!B.ready) { el.hidden = true; return; }
  el.hidden = false;
  if (B.pro) { el.className = 'pro'; el.textContent = 'PRO'; el.title = `Pro until ${B.proUntil ? B.proUntil.toLocaleDateString() : ''}: unlimited deck time, and you can go live.`; return; }
  el.className = '';
  const left = B.free + B.paid;
  el.classList.toggle('out', left <= 0);
  el.classList.toggle('low', left > 0 && left <= 180);
  el.textContent = left <= 0 ? 'TIME’S UP' : B.paid > 0 ? fmtH(B.paid + B.free) : `FREE ${fmt(B.free)}`;
  el.title = left <= 0 ? 'Buy time to keep going' : 'Deck time left. Streams and chat are free; only playing the decks uses it.';
}

// ------------------------------------------------------------------ the server
function take(st) { B.pro = !!st.pro; B.proUntil = st.pro_until ? new Date(st.pro_until) : null; B.free = st.free_left; B.paid = st.paid_left; B.resets = st.free_resets_at ? new Date(st.free_resets_at) : null; }
async function rpc(name, args) {
  const { data, error } = await B.backend.supabase.rpc(name, args);
  if (error) throw error;
  return data;
}
// On refresh or close an ordinary request can be cancelled, so the last seconds are sent as a keepalive request that the browser finishes anyway.
// That is what makes the remaining time survive a refresh.
function flushOnExit() {
  if (!B.ready || !B.pending || !B.token) return;
  const n = B.pending; B.pending = 0; B.sinceFlush = 0;
  try { fetch(SUPABASE_URL + '/rest/v1/rpc/use_deck_time', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + B.token }, body: JSON.stringify({ p_seconds: n }) }); }
  catch (_) { B.pending += n; }
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
      try { await buy('hours', 1); if (!B.live) { flashUntil = Date.now() + 2500; prevLeft = B.free + B.paid; dismissedAt = null; pill(); } }
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
const TAG_AT_FREE = 150;   // the Club Cloud voice tag also plays once at 2:30 of the 5 free minutes, so free sets carry it too
function lowCheck() {
  const left = B.free + B.paid;
  if (!B.pro && B.paid === 0 && prevLeft !== null && prevLeft > TAG_AT_FREE && left <= TAG_AT_FREE) window.__cc?.watermark?.();
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
    if (++B.tagClock >= TAG_EVERY) { B.tagClock = 0; window.__cc?.watermark?.(); }   // the tag: a short jingle over the mix, every 10 minutes
    B.pending++; B.sinceFlush++;
    if (B.free > 0) B.free--; else if (B.paid > 0) B.paid--;     // show the balance falling right away; the server confirms it
    if (B.sinceFlush >= FLUSH_EVERY) flush();
    check(); pill(); lowCheck();
  } else if (warnEl && !warnEl.hidden) warnRefresh();
}
function check() {
  const out = !B.pro && B.free + B.paid <= 0;
  if (!out) { if (B.locked || B.inGrace) { const wasLocked = B.locked; B.locked = false; B.inGrace = false; hideShop(); warnRefresh(); if (wasLocked) dispatchEvent(new Event('cc-timeback')); } return; }
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

// ------------------------------------------------------------------ buying
// With real payments switched on (api/config says so), buying goes to Stripe Checkout and the hours or Pro arrive when the payment completes.
// Until then it is a free test purchase.
async function checkout(kind, hours) {
  if (window.__auth && !(await window.__auth.require('buy deck time'))) throw new Error('Sign in or create an account first, then press pay again.');
  const { data } = await B.backend.supabase.auth.getSession();
  const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ kind, hours }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error((j.error || 'Couldn\u2019t start the payment.') + (j.detail ? ' (' + j.detail + ')' : ''));
  location.href = j.url;     // Stripe's page; it brings them back here when done
}
async function buy(kind, arg) {
  if (B.live) { await checkout(kind, arg); return; }
  take(kind === 'pro' ? await rpc('test_set_pro', { p_days: 30 }) : await rpc('test_buy_hours', { p_hours: arg }));
}

// ------------------------------------------------------------------ the shop
let shop = null;
function showShop(why) {
  pickH = 1;
  if ((why === 'out' || why === 'grace') && window.__auth?.isReady && !window.__auth.signedIn && !showShop.asking) {   // a guest's 5 minutes are up: an account comes first
    showShop.asking = true;
    window.__auth.require('keep playing').then((ok) => { showShop.asking = false; if (ok) showShop(why); });
    return;
  }
  if (!shop) { shop = document.createElement('div'); shop.id = 'timeshop'; document.body.appendChild(shop); shop.addEventListener('click', onShopClick); }
  const resets = B.resets && B.free <= 0 ? `Your 5 free minutes come back ${B.resets.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : '';
  shop.className = why === 'grace' ? 'grace' : '';
  shop.innerHTML = `<div class="tsbox">
    <p class="tserr" role="alert" hidden></p>
    <h3>${why === 'out' || why === 'grace' ? 'Your deck time is up' : why === 'golive' ? 'Going live is for Pro members' : why === 'rec' ? 'Recording is for Pro members' : 'Deck time'}</h3>
    ${why === 'grace' ? `<p class="tsgrace">You can keep playing for <b>${fmt(B.grace)}</b>. Add time now to carry on without a break.</p>` : ''}
    ${why === 'rec' ? '<p>Recording your set and downloading it is for Pro members. Pro is £9.99 a month, with unlimited deck time and going live. Pay-as-you-go hours do not unlock it.</p>' : ''}
    ${why === 'golive' ? '<p>Going live is for Pro members. Pro is £9.99 a month, with unlimited deck time. Pay-as-you-go hours do not unlock it.</p>' : ''}
    <div class="tspro"><div><b>PRO · £${PRO_PRICE} a month</b><span>Unlimited deck time, going live and recording, and no tag over your sound.</span></div><button data-pro="30">${B.pro ? 'EXTEND' : 'GO PRO'}</button></div>
    <div class="tscode"><input class="tscodein" placeholder="Have a code? Enter it here" autocomplete="off" autocapitalize="characters" spellcheck="false"><button data-code>APPLY</button></div><p class="tscodemsg"></p>
    <p>Or pay as you go. Playing the decks uses deck time: <b>5 free minutes every 24 hours</b>, then <b>£${PRICE} an hour</b>. Hours never expire, and only count down while a deck is playing. A short Club Cloud tag plays over the sound every 10 minutes on pay-as-you-go; Pro removes it. ${resets}</p>
    <div class="tsopts">${[1, 3, 5, 10].map((h) => `<button data-h="${h}"${h === 1 ? ' class="on"' : ''}><b>${h} hour${h > 1 ? 's' : ''}</b><i>£${PRICE * h}</i></button>`).join('')}</div>
    <button class="tspay" data-pay>PAY £${PRICE}</button>
    ${B.live ? '' : '<p class="tsnote">Test mode: payments are not connected yet, so hours and Pro are added for free.</p>'}
    <button class="tsclose">${why === 'grace' ? 'KEEP PLAYING' : B.free + B.paid > 0 ? 'CLOSE' : 'NOT NOW'}</button></div>`;
  shop.hidden = false;
  shop.querySelector('.tscodein')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') redeemCode(); });
}
function hideShop() { if (shop) shop.hidden = true; }
let pickH = 1;
const tsErr = (t) => { const e = shop && shop.querySelector('.tserr'); if (e) { e.textContent = t || ''; e.hidden = !t; } };
async function pay(kind, hours, btn) {
  if (B.busy) return;
  B.busy = true; tsErr(''); const label = btn.textContent; btn.disabled = true; btn.textContent = 'ONE MOMENT\u2026';
  try {
    await buy(kind, hours);
    if (!B.live) { B.locked = false; hideShop(); check(); pill(); }
  } catch (err) {
    console.warn('payment did not start', err);
    tsErr(String((err && err.message) || 'Something went wrong. Try again.'));
    if (shop) shop.scrollTop = 0;
  }
  btn.disabled = false; btn.textContent = label; B.busy = false;      // if it worked, the page is already on its way to the payment screen
}
async function onShopClick(e) {
  if (e.target.closest('.tsclose')) { hideShop(); if (B.inGrace) { warn(); } return; }
  if (e.target.closest('[data-code]')) { await redeemCode(); return; }   // in the grace minutes, 'keep playing' shrinks the offer to the small bar
  const hb = e.target.closest('[data-h]');
  if (hb) {                                                              // choosing how many hours: highlight it and show the price on the PAY button
    pickH = +hb.dataset.h; tsErr('');
    shop.querySelectorAll('[data-h]').forEach((x) => x.classList.toggle('on', x === hb));
    const p = shop.querySelector('[data-pay]'); if (p) p.textContent = `PAY \u00a3${PRICE * pickH}`;
    return;
  }
  const payBtn = e.target.closest('[data-pay]');
  if (payBtn) { await pay('hours', pickH, payBtn); return; }
  const proBtn = e.target.closest('[data-pro]');
  if (proBtn) { await pay('pro', 0, proBtn); return; }
}

// a promo code: one-time, gives Pro for a while (see supabase/promo_codes.sql)
async function redeemCode() {
  const input = shop.querySelector('.tscodein'), msg = shop.querySelector('.tscodemsg'), code = input.value.trim();
  const say = (t, bad) => { msg.textContent = t; msg.className = 'tscodemsg' + (bad ? ' err' : ' ok'); };
  if (code.length < 6) { say('Enter your code.', true); return; }
  if (window.__auth && !(await window.__auth.require('use a code'))) return;       // codes belong to an account
  if (B.busy) return; B.busy = true; say('Checking…');
  try {
    take(await rpc('redeem_promo', { p_code: code }));
    B.locked = false; check(); pill(); say(`Code accepted. Pro is on until ${B.proUntil ? B.proUntil.toLocaleDateString() : 'later'}.`);
    setTimeout(hideShop, 2200);
  } catch (err) {
    const m = String(err && err.message || '');
    say(/already used/i.test(m) ? 'That code has already been used.' : /invalid/i.test(m) ? 'That code isn\u2019t valid. Check it and try again.' : /sign in/i.test(m) ? 'Sign in first, then enter the code.' : 'Couldn\u2019t check that code. Try again in a moment.', true);
  }
  B.busy = false;
}

// ------------------------------------------------------------------ start
async function init() {
  try {
    B.backend = await import('./backend.js?v=2');
    if (!B.backend.supabase) return;
    await B.backend.ensureSession();
    take(await rpc('wallet_status'));
    const auth = B.backend.supabase.auth;
    auth.getSession().then(({ data }) => { B.token = data.session ? data.session.access_token : null; });
    auth.onAuthStateChange((_e, s) => { B.token = s ? s.access_token : null; });
  } catch (e) { console.warn('deck time is not metered here', e); return; }
  try { B.tagClock = Math.min(TAG_EVERY - 1, +localStorage.getItem('cc-tag-clock') || 0); } catch (_) {}
  window.__cc?.loadTag?.();   // get the voice tag ready, if there is one
  try { B.live = !!(await (await fetch('/api/config', { cache: 'no-store' })).json()).payments; } catch (_) {}
  if (new URLSearchParams(location.search).get('paid') === '1') {   // back from Stripe: the payment is confirmed by the webhook a moment later, so keep checking
    const was = B.free + B.paid + (B.pro ? 1e9 : 0); let tries = 0;
    const poll = setInterval(async () => { try { take(await rpc('wallet_status')); pill(); if (B.free + B.paid + (B.pro ? 1e9 : 0) !== was || ++tries > 15) { clearInterval(poll); check(); } } catch (_) { clearInterval(poll); } }, 2000);
    history.replaceState(null, '', location.pathname);
  }
  B.ready = true; pill(); check();
  if (new URLSearchParams(location.search).has('shop')) {   // the website's pricing buttons: open the buy screen straight away
    history.replaceState(null, '', location.pathname);
    setTimeout(async () => { if (!window.__auth || await window.__auth.require('buy deck time')) showShop('info'); }, 600);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushOnExit(); });
  setInterval(tick, 1000);
  setInterval(() => { try { localStorage.setItem('cc-tag-clock', String(B.tagClock)); } catch (_) {} }, 5000); // so reloading the page does not reset the 10 minutes
  addEventListener('pagehide', () => { flushOnExit(); try { localStorage.setItem('cc-tag-clock', String(B.tagClock)); } catch (_) {} });
  document.addEventListener('click', (e) => { if (e.target.closest('#timepill, #timebar')) showShop(B.inGrace ? 'grace' : B.free + B.paid <= 0 ? 'out' : 'info'); });
}
window.__billing = { state: B, get locked() { return B.locked; }, showShop, flush, lowCheck, tick, check };
init();
