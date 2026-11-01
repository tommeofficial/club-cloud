// The LIVE grid: every stream that is on air right now, as cards. Pressing a card takes you into that DJ's room and starts the stream;
// the STREAMS button in the club brings you back here. The list comes from the shared lobby channel (see backend.js openLobby).
import { loadHouses, houseCard, openHouse } from './house-cards.js?v=4';
const MAX = 99;   // peer to peer up to 12, then the big room (see api/lk.js); the room's real cap is set there
const hue = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const since = (t) => { const m = Math.max(0, Math.floor((Date.now() - t) / 60000)); return m < 1 ? 'just started' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; };

export function createLobby({ backend, me, enter }) {
  const root = document.getElementById('lobby'), grid = root.querySelector('.lgrid'), empty = root.querySelector('.lempty');
  const L = { me, list: [], isOpen: false, mine: null, houses: [] };
  loadHouses().then((h) => { L.houses = h; if (L.isOpen) render(); });
  const chan = backend.openLobby(me, (list) => { L.list = list; if (L.isOpen) render(); count(); });

  function count() { document.querySelectorAll('[data-act=live] .lnum').forEach((el) => { const n = L.list.filter((c) => c.dj !== me).length; el.textContent = n ? n : ''; }); }
  function render() {
    const cards = [...L.list].sort((a, b) => (a.since || 0) - (b.since || 0));
    empty.hidden = cards.length > 0 || L.houses.length > 0;
    grid.innerHTML = L.houses.map(houseCard).join('') + cards.map((c) => {
      const mine = c.dj === me, full = (c.listeners || 0) >= MAX && !mine;
      return `<button class="lcard${mine ? ' mine' : ''}${full ? ' full' : ''}" data-room="${esc(c.room)}" ${mine || full ? 'disabled' : ''}>
        <span class="lthumb" style="background-image:${c.thumb ? `url(${esc(c.thumb)})` : `linear-gradient(135deg, hsl(${hue(c.dj)} 55% 28%), hsl(${(hue(c.dj) + 60) % 360} 60% 14%))`}"></span>
        <span class="lav" style="background:hsl(${hue(c.dj)} 80% 62%)">${esc(c.dj[0].toUpperCase())}</span>
        <span class="lbadge">${full ? 'FULL' : mine ? 'YOU' : 'LIVE'}</span>
        <b class="ltitle">${esc(c.title || 'Live set')}</b>
        <i class="lname">@${esc(c.dj)}${c.house ? ' · HOUSE DJ' : ''}</i>
        <span class="lmeta">${c.track ? '♪ ' + esc(c.track) : 'on air'}${c.bpm ? ' · ' + Math.round(c.bpm) + ' BPM' : ''}${c.entry > 0 ? ' · £' + (Number.isInteger(c.entry) ? c.entry : Number(c.entry).toFixed(2)) + ' entry' : ''}</span>
        <span class="lfoot"><span>${since(c.since || Date.now())}</span><span class="lcount">${c.listeners || 0}/${MAX}</span></span>
      </button>`;
    }).join('');
  }
  L.open = () => { L.isOpen = true; root.hidden = false; render(); document.querySelectorAll('[data-act=live]').forEach((b) => b.classList.add('on')); };
  L.close = () => { L.isOpen = false; root.hidden = true; document.querySelectorAll('[data-act=live]').forEach((b) => b.classList.remove('on')); };
  L.toggle = () => (L.isOpen ? L.close() : L.open());
  L.announce = (card) => { L.mine = card; chan.announce(card); };
  L.update = (patch) => { if (L.mine) { L.mine = { ...L.mine, ...patch }; chan.announce(L.mine); } };
  L.withdraw = () => { L.mine = null; chan.withdraw(); };
  L.destroy = () => { chan.close(); };
  grid.addEventListener('click', async (e) => {
    const b = e.target.closest('.lcard'); if (!b || b.disabled) return;
    if (b.dataset.house) { openHouse(b.dataset.house); return; }
    L.close(); enter(b.dataset.room);
  });
  root.querySelector('.lplay')?.addEventListener('click', () => { L.close(); document.querySelector('#tabs [data-mode=normal]')?.click(); });
  root.querySelector('.lprobtn')?.addEventListener('click', () => window.__billing?.showShop('info'));
  root.querySelector('.lclose').addEventListener('click', L.close);
  setInterval(() => { if (L.isOpen) render(); }, 30000); // keep the "x min" times fresh
  return L;
}
