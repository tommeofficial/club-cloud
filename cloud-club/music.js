// The music browser: genres and tracks from the Epidemic Sound library (through /api/music, which holds the key). Tracks are downloaded
// to this tab only and added to the library for the session. They are never saved on the device and never stored by us.
// Shown only when the server says it is switched on and the person is signed in.
const GENRES = ['Tech House', 'Groovy House', 'Afro House', 'Techno', 'House', 'Minimal House'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let backend = null, panel = null, genreMap = null, current = null;

async function token() {
  const { data } = await backend.supabase.auth.getSession();
  return data.session ? data.session.access_token : null;
}
async function api(query) {
  const t = await token();
  const r = await fetch('/api/music?' + query, { headers: t ? { Authorization: 'Bearer ' + t } : {}, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'The music library is not answering.');
  return j;
}
// match the six genre buttons to the library's own genre list when it has them; otherwise they become a text search
async function mapGenres() {
  if (genreMap) return genreMap;
  genreMap = {};
  try {
    const { genres } = await api('a=genres');
    for (const name of GENRES) {
      const n = name.toLowerCase().replace('groovy ', '');
      const hit = genres.find((g) => g.name.toLowerCase() === name.toLowerCase()) || genres.find((g) => g.name.toLowerCase() === n);
      if (hit) genreMap[name] = hit.id;
    }
  } catch (_) {}
  return genreMap;
}
function build() {
  panel = document.createElement('div'); panel.id = 'musicpanel'; panel.hidden = true;
  panel.innerHTML = `<div class="mh"><b>MUSIC</b><i>Added for this session only</i><button class="mx" aria-label="Close">✕</button></div>
    <div class="chips">${GENRES.map((g) => `<button data-g="${esc(g)}">${esc(g.toUpperCase())}</button>`).join('')}</div>
    <div class="mq"><input type="search" placeholder="Search tracks" aria-label="Search tracks"></div>
    <div class="rows"><div class="mnote">Pick a genre to start.</div></div>
    <div class="mnote">Music by <a href="https://www.epidemicsound.com" target="_blank" rel="noopener">Epidemic Sound</a>.</div>`;
  document.getElementById('app').appendChild(panel);
  panel.querySelector('.mx').onclick = () => { panel.hidden = true; };
  panel.querySelector('.chips').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; panel.querySelectorAll('.chips button').forEach((x) => x.classList.toggle('on', x === b)); panel.querySelector('input').value = ''; current = { genre: b.dataset.g }; search(); };
  panel.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { panel.querySelectorAll('.chips button').forEach((x) => x.classList.remove('on')); current = { term: e.target.value.trim() }; search(); } });
  panel.querySelector('.rows').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const row = b.closest('.row'), tr = row._t; b.disabled = true; b.textContent = '…';
    try {
      const { url } = await api('a=file&id=' + encodeURIComponent(tr.id));
      if (!url) throw new Error('No download link.');
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `${tr.artist ? tr.artist + ' - ' : ''}${tr.title}.mp3`.replace(/[\\/:*?"<>|]/g, ''), { type: 'audio/mpeg' });
      window.__cc.unlock?.();
      await window.__cc.addFiles([file], null, { session: true });
      b.textContent = 'ADDED';
    } catch (err) { b.disabled = false; b.textContent = 'ADD'; row.querySelector('.t span').textContent = /Failed to fetch|NetworkError/i.test(err.message) ? 'Download blocked: add this website in the music library’s allowed sites.' : err.message; }
  };
}
async function search() {
  const rows = panel.querySelector('.rows'); rows.innerHTML = '<div class="mnote">Loading…</div>';
  try {
    const q = new URLSearchParams({ a: 'tracks', limit: '30' });
    if (current.genre) { const m = await mapGenres(); if (m[current.genre]) q.set('genre', m[current.genre]); else q.set('term', current.genre); }
    if (current.term) q.set('term', current.term);
    const { tracks } = await api(q.toString());
    rows.innerHTML = tracks.length ? '' : '<div class="mnote">Nothing found. Try another genre.</div>';
    for (const t of tracks) {
      const el = document.createElement('div'); el.className = 'row'; el._t = t;
      el.innerHTML = `<img alt="" src="${esc(t.image || '')}"><div class="t"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><span>${t.bpm ? esc(t.bpm) + ' BPM' : ''}</span><span>${t.length ? mmss(t.length) : ''}</span><button ${t.previewOnly ? 'disabled title="Preview only"' : ''}>ADD</button>`;
      rows.appendChild(el);
    }
  } catch (err) { rows.innerHTML = `<div class="mnote">${esc(err.message)}</div>`; }
}
async function open() {
  if (window.__auth && !(await window.__auth.require('use the music library'))) return;
  if (!panel) build();
  panel.hidden = false;
}
async function init() {
  try {
    backend = await import('./backend.js?v=2');
    if (!backend.supabase) return;
    const t = await token();
    const r = await fetch('/api/music?a=config', { headers: t ? { Authorization: 'Bearer ' + t } : {}, cache: 'no-store' });
    if (!r.ok || !(await r.json()).enabled) return;
    const btn = document.getElementById('musicbtn'); if (!btn || btn.dataset.on) return;
    btn.dataset.on = '1'; btn.hidden = false; btn.addEventListener('click', open);
  } catch (_) { /* not enabled here (local testing, offline): the button simply stays hidden */ }
}
init();
addEventListener('cc-auth', () => setTimeout(init, 300));   // signing in (or out) changes who may see it
