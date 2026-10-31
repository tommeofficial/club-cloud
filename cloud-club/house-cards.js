// The 24/7 Club Cloud rooms: one card per mix listed in mixes.json (a room starts for you when you press it, nothing runs until then).
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hue = (n) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
export async function loadHouses() {
  try { const r = await fetch('mixes.json', { cache: 'no-cache' }); if (!r.ok) return []; const j = await r.json(); return (Array.isArray(j) ? j : j.mixes || []).filter((m) => m && m.id && (m.url || m.source)); }
  catch (_) { return []; }
}
// the room always has people in: the pretend regulars (the chat bots) drift between about 18 and 30 through the day, and the chat's "here" count starts from the same number
export const viewers = () => { const m = Date.now() / 60000; return Math.max(12, Math.round(24 + 4 * Math.sin(m / 7) + 2 * Math.sin(m / 2.3))); };
const EYE = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
setInterval(() => document.querySelectorAll('.lviews b').forEach((b) => { b.textContent = viewers(); }), 20000);
export const houseCard = (m) => `<button class="lcard house" data-house="${esc(m.id)}">
  <span class="lthumb" style="background-image:url(${esc(m.thumb || 'hero/house-thumb.jpg')}), linear-gradient(135deg, hsl(${hue(m.id)} 60% 30%), hsl(${(hue(m.id) + 70) % 360} 65% 14%))"></span>
  <span class="lbadge">24/7</span><span class="lviews" title="Watching now">${EYE}<b>${viewers()}</b></span>
  <span class="lover"><b class="ltitle">${esc(m.name || m.id)}</b><i class="lname">@clubcloud · HOUSE DJ</i><span class="lfoot"><span>always on</span><span>${esc(m.genre || '')}</span></span></span>
</button>`;
export const openHouse = (id) => { location.href = '/app?house=' + encodeURIComponent(id); };
