// REC: record the DJ's mix (what comes out of the master, before chat ducking) and download it as a file when stopped.
// The browser's own recorder writes compressed audio as it goes (about 60-85 MB an hour), so a long set is fine.
// Format depends on the browser: WebM/Opus in Chrome, Edge and Firefox; M4A/AAC in Safari.
const MAX_HOURS = 4;                     // a safety stop: a set longer than this is saved and a new one can be started
const BITRATE = 320000;                // Pro recordings are high quality (320 kbps)
const btn = document.getElementById('recbtn');
const R = { rec: null, chunks: [], t0: 0, timer: null, bytes: 0, mime: '' };
const toast = (m, s = 4) => { const el = document.getElementById('toast'); if (el) { el.textContent = m; el.hidden = false; clearTimeout(R.toastT); R.toastT = setTimeout(() => { el.hidden = true; }, s * 1000); } };
const pick = () => ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
const ext = (mime) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');
const clock = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };

function ui() {
  if (!btn) return;
  const on = !!R.rec;
  btn.classList.toggle('on', on);
  btn.innerHTML = on ? `<i></i>REC ${clock((Date.now() - R.t0) / 1000)}` : '<i></i>REC';
  btn.title = on ? 'Stop and download your set' : 'Record your mix and download it when you stop';
}

function start() {
  if (R.rec) return;
  // recording is a Pro feature
  const bill = window.__billing?.state;
  if (bill?.ready && !bill.pro) { toast('Recording is for Pro members.'); window.__billing.showShop('rec'); return; }
  window.__cc?.unlock?.();
  const tap = window.__cc?.master?.tap;
  if (!tap || !window.MediaRecorder) { toast('Recording is not available here. Press play on a deck first, then try again.'); return; }
  R.mime = pick();
  let rec;
  try { rec = new MediaRecorder(tap.stream, R.mime ? { mimeType: R.mime, audioBitsPerSecond: BITRATE } : { audioBitsPerSecond: BITRATE }); }
  catch (e) { console.warn('recorder', e); toast('Your browser could not start a recording.'); return; }
  R.mime = rec.mimeType || R.mime; R.chunks = []; R.bytes = 0; R.t0 = Date.now();
  rec.ondataavailable = (e) => { if (e.data && e.data.size) { R.chunks.push(e.data); R.bytes += e.data.size; } };
  rec.onstop = save;
  rec.start(1000);                                                    // a chunk every second, so nothing is lost if the page closes badly
  R.rec = rec;
  R.timer = setInterval(() => { ui(); if ((Date.now() - R.t0) / 3600000 >= MAX_HOURS) { toast(`Recording stopped at ${MAX_HOURS} hours and saved. Press REC to start a new one.`); stop(); } }, 1000);
  ui();
}

function stop() {
  if (!R.rec) return;
  clearInterval(R.timer);
  try { R.rec.stop(); } catch (_) { save(); }
  R.rec = null; ui();
}

function save() {
  if (!R.chunks.length) { toast('Nothing was recorded.'); return; }
  const blob = new Blob(R.chunks, { type: R.mime || 'audio/webm' });
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  const name = `club-cloud-set-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext(R.mime)}`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  toast(`Saved ${name} (${(blob.size / 1048576).toFixed(1)} MB, ${clock((Date.now() - R.t0) / 1000)})`, 7);
  R.chunks = [];
}

// if the Pro membership ends in the middle of a set, stop and save what was recorded so far
addEventListener('cc-timeup', () => { if (R.rec && !window.__billing?.state?.pro) { toast('Your Pro membership ended, so the recording was stopped and saved.', 6); stop(); } });
btn?.addEventListener('click', () => (R.rec ? stop() : start()));
addEventListener('beforeunload', (e) => { if (R.rec) { e.preventDefault(); e.returnValue = ''; } }); // a recording in progress is lost if the page closes
window.__rec = { R, start, stop };
