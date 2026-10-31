// The 24/7 Club Cloud room (/app?house=<id>). Nothing runs until someone presses ENTER. Then this browser plays the hour mix from mixes.json
// (everyone hears the same moment of the mix, worked out from the clock, like a radio), the club lights, crowd and robot DJ all react to
// that audio on THIS device, and nothing about the crowd is streamed. See MIXES.md for adding mixes.
// A room is either an hour MP3 ("url") or a radio built from the Epidemic Sound library ("source": "epidemic", see api/house.js): a fixed playlist
// that every listener follows from the same clock, so everyone hears the same track at the same moment.
const params = new URLSearchParams(location.search), id = params.get('house');
if (id) init();

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EPOCH = Date.UTC(2026, 0, 1) / 1000;     // every viewer counts the mix from the same moment

async function init() {
  document.body.classList.add('house');
  let mix = null;
  try { const r = await fetch('mixes.json', { cache: 'no-cache' }); const j = r.ok ? await r.json() : []; mix = (Array.isArray(j) ? j : j.mixes || []).find((m) => m.id === id); } catch (_) {}
  const ov = document.createElement('div'); ov.id = 'houseov';
  ov.innerHTML = `<div class="hbox"><div class="hbadge">24/7</div><h2>CLUB CLOUD</h2><h3>${esc(mix ? mix.name || mix.id : 'Not on yet')}</h3>
    <p>${mix ? 'The Club Cloud robot is on the decks. The room starts when you do.' : 'This room isn’t on right now.'}</p>
    ${mix ? '<button class="hgo">ENTER THE CLUB</button>' : ''}<a class="hback" href="/">‹ BACK</a></div>`;
  document.body.appendChild(ov);
  if (!mix) return;
  ov.querySelector('.hgo').onclick = () => start(mix, ov);
}

async function start(mix, ov) {
  const btn = ov.querySelector('.hgo'); btn.disabled = true; btn.textContent = 'STARTING…';
  try { window.__cc?.unlock?.(); } catch (_) {}
  const ctx = new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume().catch(() => {});
  const master = ctx.createGain(), dest = ctx.createMediaStreamDestination();   // the audio goes to the speakers and to the club (lights, crowd and robot follow it)
  master.connect(ctx.destination); master.connect(dest);
  let room;
  try { room = mix.source === 'epidemic' ? await radio(mix, ctx, master, btn) : await hourMix(mix, ctx, master, btn); }
  catch (e) { btn.disabled = false; btn.textContent = e.message || 'TRY AGAIN'; return; }
  if (!room) { btn.disabled = false; btn.textContent = 'TRY AGAIN'; return; }
  try { await window.__club.useStream(dest.stream); } catch (e) { console.warn('club could not follow the mix', e); }
  document.querySelector('#tabs [data-mode=club]:not(.on)')?.click();
  ov.remove();
  const bar = document.createElement('div'); bar.id = 'househud';
  bar.innerHTML = `<span class="dot"></span><b>${esc(mix.name || mix.id)}</b>${room.now ? ' <span class="hnow"></span>' : ''}${mix.source === 'epidemic' ? ' <small>Music by <a href="https://www.epidemicsound.com" target="_blank" rel="noopener">Epidemic Sound</a></small>' : ''}<a href="/">‹ LEAVE</a>`;
  document.body.appendChild(bar);
  const tickNow = () => { const b = bar.querySelector('.hnow'); if (b) b.textContent = room.now(); };
  if (room.now) { tickNow(); setInterval(tickNow, 2000); }
  addEventListener('pagehide', () => { try { room.pause(); window.__club.stopInput(); } catch (_) {} });
  // free to watch, but a guest gets 5 minutes a day (the same 5 minutes as any DJ stream), then makes a free account to keep watching
  const load = () => { try { const o = JSON.parse(localStorage.getItem('cc-watch') || '{}'); return o.t0 && Date.now() - o.t0 < 864e5 ? o : { t0: Date.now(), s: 0 }; } catch (_) { return { t0: Date.now(), s: 0 }; } };
  let asking = false;
  setInterval(async () => {
    const A = window.__auth; if (!A || !A.isReady || A.signedIn || asking || room.paused()) return;
    const o = load(); o.s += 1; try { localStorage.setItem('cc-watch', JSON.stringify(o)); } catch (_) {}
    if (o.s < 300) return;
    asking = true;
    const ok = await A.require('keep watching');
    asking = false;
    if (ok) return;
    room.pause(); try { window.__club.stopInput(); } catch (_) {}
    bar.innerHTML = '<span class="dot"></span><b>Create a free account to keep watching</b> <a href="/">‹ LEAVE</a>';
  }, 1000);
}

// an hour MP3 on a loop
async function hourMix(mix, ctx, master, btn) {
  const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.loop = true; el.src = mix.url;
  await new Promise((res, rej) => { el.addEventListener('loadedmetadata', res, { once: true }); el.addEventListener('error', () => rej(new Error('The mix could not load.')), { once: true }); });
  if (!isFinite(el.duration) || !el.duration) return null;
  const dur = el.duration;
  const at = () => (((Date.now() / 1000 - EPOCH) % dur) + dur) % dur;       // where the room is in the mix right now
  ctx.createMediaElementSource(el).connect(master);
  el.currentTime = at();
  try { await el.play(); } catch (e) { btn.textContent = 'TAP TO PLAY'; return null; }
  // keep everyone on the same moment: nudge back if this device has drifted
  setInterval(() => { const want = at(); let d = el.currentTime - want; if (d > dur / 2) d -= dur; else if (d < -dur / 2) d += dur; if (Math.abs(d) > 1.5) el.currentTime = want; }, 15000);
  return { paused: () => el.paused, pause: () => el.pause() };
}

// the radio: the playlist from /api/house, each track fetched into this tab only (never saved), played at the position the clock says
async function radio(mix, ctx, master, btn) {
  const r = await fetch('/api/house?a=playlist&room=' + encodeURIComponent(mix.id), { cache: 'no-cache' });
  const pl = await r.json().catch(() => ({}));
  if (!r.ok || !pl.tracks || !pl.tracks.length) throw new Error(pl.error || 'This room isn’t on right now.');
  const T = pl.tracks, total = T.reduce((s, t) => s + t.length, 0);
  const pos = () => {                                                      // which track the room is on, and how far in
    let t = (((Date.now() / 1000 - EPOCH) % total) + total) % total;
    for (let i = 0; i < T.length; i++) { if (t < T[i].length) return { i, off: t }; t -= T[i].length; }
    return { i: 0, off: 0 };
  };
  const got = {};                                                          // track index -> promise of its audio element
  const fetchTrack = (i) => got[i] || (got[i] = (async () => {
    const f = await (await fetch('/api/house?a=file&room=' + encodeURIComponent(mix.id) + '&id=' + encodeURIComponent(T[i].id))).json();
    if (!f.url) throw new Error('No link for ' + T[i].title);
    const blob = await (await fetch(f.url)).blob();
    const el = new Audio(URL.createObjectURL(blob)); el.preload = 'auto';
    ctx.createMediaElementSource(el).connect(master);
    return el;
  })().catch((e) => { delete got[i]; throw e; }));
  let cur = null, paused = false, busy = false;
  const stop = (i) => { const p = got[i]; delete got[i]; p && p.then((el) => { el.pause(); URL.revokeObjectURL(el.src); }).catch(() => {}); };
  const sync = async () => {
    if (busy || paused) return; busy = true;
    try {
      const w = pos();
      if (cur !== w.i) {
        const old = cur; cur = w.i;
        const el = await fetchTrack(w.i); const again = pos();                       // loading takes a moment: aim at where the room is now
        if (cur === w.i) { el.currentTime = again.i === w.i ? again.off : 0; await el.play().catch(() => {}); }
        if (old !== null && old !== w.i) stop(old);
      } else {
        const el = await fetchTrack(cur);
        if (Math.abs(el.currentTime - w.off) > 1.5 && w.off < (el.duration || 1e9) - 1) el.currentTime = w.off;
        if (el.paused && !el.ended) await el.play().catch(() => {});
      }
      if (T[w.i].length - w.off < 40) fetchTrack((w.i + 1) % T.length).catch(() => {});   // the next track is ready before it is needed
    } catch (e) { console.warn('house radio', e); }
    busy = false;
  };
  btn.textContent = 'LOADING THE MUSIC…';
  await sync();
  if (cur === null || !got[cur]) throw new Error('The music could not load. Try again.');
  setInterval(sync, 500);
  return { paused: () => paused, pause: () => { paused = true; const p = got[cur]; p && p.then((el) => el.pause()); }, now: () => { const t = T[cur == null ? 0 : cur]; return (t.artist ? t.artist + ' – ' : '') + t.title; } };
}
