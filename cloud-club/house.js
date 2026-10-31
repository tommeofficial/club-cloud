// The 24/7 Club Cloud room (/app?house=<id>). Nothing runs until someone presses ENTER. Then this browser plays the hour mix from mixes.json
// (everyone hears the same moment of the mix, worked out from the clock, like a radio), the club lights, crowd and robot DJ all react to
// that audio on THIS device, and nothing about the crowd is streamed. See MIXES.md for adding mixes.
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
  const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.loop = true; el.src = mix.url;
  await new Promise((res, rej) => { el.addEventListener('loadedmetadata', res, { once: true }); el.addEventListener('error', () => rej(new Error('The mix could not load.')), { once: true }); }).catch((e) => { btn.textContent = e.message; return null; });
  if (!isFinite(el.duration) || !el.duration) { btn.disabled = false; btn.textContent = 'TRY AGAIN'; return; }
  const dur = el.duration;
  const at = () => (((Date.now() / 1000 - EPOCH) % dur) + dur) % dur;       // where the room is in the mix right now
  // the audio goes to the speakers and to the club (lights, crowd and robot follow it)
  const ctx = new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume().catch(() => {});
  const src = ctx.createMediaElementSource(el), dest = ctx.createMediaStreamDestination();
  src.connect(ctx.destination); src.connect(dest);
  el.currentTime = at();
  try { await el.play(); } catch (e) { btn.disabled = false; btn.textContent = 'TAP TO PLAY'; return; }
  try { await window.__club.useStream(dest.stream); } catch (e) { console.warn('club could not follow the mix', e); }
  // keep everyone on the same moment: nudge back if this device has drifted
  setInterval(() => { const want = at(); let d = el.currentTime - want; if (d > dur / 2) d -= dur; else if (d < -dur / 2) d += dur; if (Math.abs(d) > 1.5) el.currentTime = want; }, 15000);
  document.querySelector('#tabs [data-mode=club]:not(.on)')?.click();
  ov.remove();
  const bar = document.createElement('div'); bar.id = 'househud';
  bar.innerHTML = `<span class="dot"></span><b>24/7</b> ${esc(mix.name || mix.id)}<a href="/">‹ LEAVE</a>`;
  document.body.appendChild(bar);
  addEventListener('pagehide', () => { try { el.pause(); window.__club.stopInput(); } catch (_) {} });
  // free to watch, but a guest gets 5 minutes a day (the same 5 minutes as any DJ stream), then makes a free account to keep watching
  const load = () => { try { const o = JSON.parse(localStorage.getItem('cc-watch') || '{}'); return o.t0 && Date.now() - o.t0 < 864e5 ? o : { t0: Date.now(), s: 0 }; } catch (_) { return { t0: Date.now(), s: 0 }; } };
  let asking = false;
  setInterval(async () => {
    const A = window.__auth; if (!A || !A.isReady || A.signedIn || asking || el.paused) return;
    const o = load(); o.s += 1; try { localStorage.setItem('cc-watch', JSON.stringify(o)); } catch (_) {}
    if (o.s < 300) return;
    asking = true;
    const ok = await A.require('keep watching');
    asking = false;
    if (ok) return;
    el.pause(); try { window.__club.stopInput(); } catch (_) {}
    bar.innerHTML = '<span class="dot"></span><b>24/7</b> Create a free account to keep watching <a href="/">\u2039 LEAVE</a>';
  }, 1000);
}
