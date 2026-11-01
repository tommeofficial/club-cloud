// The home page's "live now" grid: everyone who is on air right now, from the shared lobby (see backend.js openLobby).
// Pressing a card needs a sign-in, then goes into the app in that DJ's room and starts the stream.
import * as backend from './backend.js?v=2';
import { loadHouses, houseCard, openHouse } from './house-cards.js?v=4';
const MAX = 12;
const grid = document.getElementById('liveGrid');
const hue = (n) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const since = (t) => { const m = Math.max(0, Math.floor((Date.now() - t) / 60000)); return m < 1 ? 'just started' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; };
const gbp = (n) => '£' + (Number.isInteger(n) ? n : Number(n).toFixed(2));

const empty = (msg) => { grid.innerHTML = `<div class="lempty"><b>${msg}</b>Nobody is on air right now. Check back soon, or jump on the decks yourself.<br><a class="btn" href="/app">Play the decks</a></div>`; };
let houses = [], lastList = [], ready = false;   // 'ready': the 24/7 rooms have been fetched, so an empty grid is really empty
loadHouses().then((h) => { houses = h; ready = true; render(lastList); });
setTimeout(() => { if (!ready) { ready = true; render(lastList); } }, 4000);
function render(list) {
  lastList = list;
  if (!ready) return;                                   // still checking: keep the 'Checking' message rather than flashing 'Quiet in here'
  if (!list.length && !houses.length) return empty('Quiet in here');
  grid.innerHTML = houses.map(houseCard).join('') + [...list].sort((a, b) => (a.since || 0) - (b.since || 0)).map((c) => {
    const full = (c.listeners || 0) >= MAX;
    const bg = c.thumb ? `url(${esc(c.thumb)})` : `linear-gradient(135deg, hsl(${hue(c.dj)} 55% 28%), hsl(${(hue(c.dj) + 60) % 360} 60% 14%))`;
    return `<button class="lcard${full ? ' full' : ''}" data-room="${esc(c.room)}" ${full ? 'disabled' : ''}>
      <span class="lthumb" style="background-image:${bg}"></span>
      <span class="lbadge">${full ? 'FULL' : 'LIVE'}</span>
      <span class="lav" style="background:hsl(${hue(c.dj)} 80% 62%)">${esc(c.dj[0].toUpperCase())}</span>
      <b class="ltitle">${esc(c.title || 'Live set')}</b>
      <i class="lname">@${esc(c.dj)}</i>
      <span class="lmeta">${c.track ? '♪ ' + esc(c.track) : 'on air'}${c.bpm ? ' · ' + Math.round(c.bpm) + ' BPM' : ''}${c.entry > 0 ? ' · ' + gbp(c.entry) + ' entry' : ''}</span>
      <span class="lfoot"><span>${since(c.since || Date.now())}</span><span>${c.listeners || 0}/${MAX} listening</span></span>
    </button>`;
  }).join('');
}

grid.addEventListener('click', async (e) => {
  const b = e.target.closest('.lcard'); if (!b || b.disabled) return;
  if (b.dataset.house) { openHouse(b.dataset.house); return; }
  location.href = `/app?room=${encodeURIComponent(b.dataset.room)}&listen=1`;
});

try {
  if (!backend.supabase) throw new Error('not configured');
  backend.openLobby('web-' + Math.random().toString(36).slice(2, 8), render);
} catch (e) { console.warn('live grid', e); empty('Live streams will show up here'); }
