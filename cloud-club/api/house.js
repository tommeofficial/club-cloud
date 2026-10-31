// The 24/7 Club Cloud room's radio, built from the Epidemic Sound Partner API (the key stays here, env EPIDEMIC_API_KEY).
// Open to everyone who can watch (guests too), but it only ever hands out the room's own playlist: it is not a general music search.
//   GET /api/house?a=playlist&genre=<name>   -> { tracks: [{ id, title, artist, length }], total }   (same order for everyone, cached for an hour)
//   GET /api/house?a=file&id=<trackId>       -> { url }   (only for a track that is on the playlist)
const { env } = require('./_stripe');
const BASE = 'https://partner-content-api.epidemicsound.com';
const ROOMS = { 'tech-house': { genre: 'Tech House', bpmMin: 120, bpmMax: 130 } };   // room id -> what to search for
const TTL = 60 * 60 * 1000, MIN_TOTAL = 3600;                                       // the playlist is at least an hour long before it loops
const cache = {};                                                                  // room id -> { at, tracks }

const call = async (path) => {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + env('EPIDEMIC_API_KEY'), Accept: 'application/json' } });
  if (!r.ok) { console.error('epidemic', r.status, path.split('?')[0]); const e = new Error('upstream ' + r.status); e.status = r.status; throw e; }
  return r.json();
};
async function build(room) {
  const cfg = ROOMS[room];
  let genreId = null;
  try { const j = await call('/v0/genres'); const g = (j.genres || j.data || j || []).find((x) => String(x.name || x.displayTag || '').toLowerCase() === cfg.genre.toLowerCase()); genreId = g && g.id; } catch (_) {}
  const out = [], seen = new Set();
  for (let offset = 0; offset < 120 && out.reduce((s, t) => s + t.length, 0) < MIN_TOTAL * 1.1; offset += 40) {
    const p = new URLSearchParams();
    if (genreId) p.append('genre', genreId); else p.set('term', cfg.genre);
    p.set('limit', '40'); p.set('offset', String(offset)); p.set('bpmMin', String(cfg.bpmMin)); p.set('bpmMax', String(cfg.bpmMax)); p.set('vocalType', 'NONE');
    const j = await call(`/v0/tracks/search?${p}`);
    const got = j.tracks || j.data || [];
    for (const t of got) if (t.id && !seen.has(t.id) && !t.isPreviewOnly && t.length > 60) { seen.add(t.id); out.push({ id: t.id, title: t.title, artist: (t.mainArtists || []).join(', '), length: Math.round(t.length) }); }
    if (got.length < 40) break;
  }
  out.sort((a, b) => (a.id < b.id ? -1 : 1));                                      // a fixed order, so every listener hears the same thing
  return out;
}
async function playlist(room) {
  const c = cache[room];
  if (c && Date.now() - c.at < TTL) return c.tracks;
  // the playlist only changes when the cache expires, and everyone's position is worked out from the playlist, so refresh on the hour for all
  const tracks = await build(room);
  cache[room] = { at: Math.floor(Date.now() / TTL) * TTL, tracks };
  return tracks;
}

module.exports = async (req, res) => {
  const send = (code, obj, cache = 'no-store') => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', cache); res.end(JSON.stringify(obj)); };
  if (req.method !== 'GET') return send(405, { error: 'GET only' });
  if (!env('EPIDEMIC_API_KEY')) return send(503, { error: 'This room is not on right now.' });
  const q = new URL(req.url, 'http://x').searchParams, a = q.get('a') || 'playlist', room = q.get('room') || 'tech-house';
  if (!ROOMS[room]) return send(404, { error: 'No such room.' });
  try {
    const tracks = await playlist(room);
    if (!tracks.length) return send(503, { error: 'This room is not on right now.' });
    if (a === 'playlist') return send(200, { tracks, total: tracks.reduce((s, t) => s + t.length, 0), built: cache[room].at }, 'public, max-age=60');
    if (a === 'file') {
      const id = String(q.get('id') || '').replace(/[^\w-]/g, '');
      if (!tracks.some((t) => t.id === id)) return send(404, { error: 'Not on this playlist.' });
      let j = null;
      try { j = await call(`/v0/tracks/${id}/stream`); } catch (_) { j = null; }
      let url = j && (j.url || j.streamUrl);
      if (!url || /\.m3u8(\?|$)/i.test(url)) { j = await call(`/v0/tracks/${id}/download?format=mp3&quality=high`); url = j.url || j.downloadUrl || j.streamUrl; }   // HLS can't be played in a plain audio element
      return send(200, { url });
    }
    send(400, { error: 'Unknown request.' });
  } catch (e) { send(e.status === 429 ? 429 : 502, { error: 'The music is not answering. Try again in a moment.' }); }
};
