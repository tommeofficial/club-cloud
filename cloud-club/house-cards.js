// The 24/7 Club Cloud rooms: one card per mix listed in mixes.json (a room starts for you when you press it, nothing runs until then).
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hue = (n) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
export async function loadHouses() {
  try { const r = await fetch('mixes.json', { cache: 'no-cache' }); if (!r.ok) return []; const j = await r.json(); return (Array.isArray(j) ? j : j.mixes || []).filter((m) => m && m.id && m.url); }
  catch (_) { return []; }
}
export const houseCard = (m) => `<button class="lcard house" data-house="${esc(m.id)}">
  <span class="lthumb" style="background-image:linear-gradient(135deg, hsl(${hue(m.id)} 60% 30%), hsl(${(hue(m.id) + 70) % 360} 65% 14%))"></span>
  <span class="lbadge">24/7</span>
  <span class="lav" style="background:#4cebff;color:#04121a">C</span>
  <b class="ltitle">Club Cloud · ${esc(m.name || m.id)}</b>
  <i class="lname">@clubcloud · HOUSE DJ</i>
  <span class="lmeta">The Club Cloud robot on the decks · starts when you join</span>
  <span class="lfoot"><span>always on</span><span>${esc(m.genre || m.name || '')}</span></span>
</button>`;
export const openHouse = (id) => { location.href = '/app?house=' + encodeURIComponent(id); };
