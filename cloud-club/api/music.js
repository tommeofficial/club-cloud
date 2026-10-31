// The music browser's server side: genres, track search and a download link from the Epidemic Sound Partner API.
// The API key stays here (env EPIDEMIC_API_KEY, set in Vercel); the browser never sees it. Without the key everything answers "not enabled".
// Only signed-in people (a real email, not a guest) can use it, so the key can't be used anonymously.
//   GET /api/music?a=config                      -> { enabled } (for this person: with MUSIC_ALLOWED_EMAILS set, only those accounts)
//   GET /api/music?a=genres
//   GET /api/music?a=tracks&genre=<id>&term=<text>&limit=24&offset=0
//   GET /api/music?a=file&id=<trackId>           -> { url, expires }  (the browser downloads the MP3 from that link)
const { env, userFromToken } = require('./_stripe');
const BASE = 'https://partner-content-api.epidemicsound.com';
const enabled = () => !!env('EPIDEMIC_API_KEY');
// while testing, MUSIC_ALLOWED_EMAILS (comma separated, set in Vercel) limits the library to those accounts; leave it empty to open it to every signed-in person
const allowed = (user) => { const list = env('MUSIC_ALLOWED_EMAILS').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean); return !list.length || (user && list.includes(String(user.email).toLowerCase())); };

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'GET') return send(405, { error: 'GET only' });
  const q = new URL(req.url, 'http://x').searchParams, a = q.get('a') || 'config';
  const token = String(req.headers.authorization || '').replace(/^Bearer /i, '');
  const user = token && (await userFromToken(token));
  if (a === 'config') return send(200, { enabled: enabled() && (!env('MUSIC_ALLOWED_EMAILS') ? true : !!(user && allowed(user))) });
  if (!enabled()) return send(503, { error: 'Music is not switched on yet.' });
  if (!user) return send(401, { error: 'Sign in with your email to use the music library.' });
  if (!allowed(user)) return send(403, { error: 'The music library is in private testing.' });
  const call = async (path) => {
    const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + env('EPIDEMIC_API_KEY'), Accept: 'application/json' } });
    if (!r.ok) { const t = await r.text().catch(() => ''); console.error('epidemic', r.status, path.split('?')[0], t.slice(0, 200)); const e = new Error('upstream ' + r.status); e.status = r.status; throw e; }
    return r.json();
  };
  try {
    if (a === 'genres') {
      const j = await call('/v0/genres');
      const list = (j.genres || j.data || j || []).map((g) => ({ id: g.id, name: g.name || g.displayTag || g.id }));
      return send(200, { genres: list });
    }
    if (a === 'tracks') {
      const p = new URLSearchParams();
      if (q.get('genre')) p.append('genre', q.get('genre'));
      if (q.get('term')) p.set('term', q.get('term').slice(0, 60));
      p.set('limit', String(Math.max(1, Math.min(40, +q.get('limit') || 24)))); p.set('offset', String(Math.max(0, +q.get('offset') || 0)));
      if (+q.get('bpmMin')) p.set('bpmMin', String(+q.get('bpmMin'))); if (+q.get('bpmMax')) p.set('bpmMax', String(+q.get('bpmMax')));
      p.set('vocalType', 'NONE');                       // DJ-friendly: no lead vocals over the top of a mix
      const j = await call(`/v0/tracks/search?${p}`);
      const tracks = (j.tracks || j.data || []).map((t) => ({
        id: t.id, title: t.title, artist: (t.mainArtists || []).join(', '), bpm: t.bpm, length: t.length,
        image: t.images && (t.images.S || t.images.default || t.images.XS), genres: (t.genres || []).map((g) => g.displayTag || g.name || g), previewOnly: !!t.isPreviewOnly,
      }));
      return send(200, { tracks, more: tracks.length >= (+q.get('limit') || 24) });
    }
    if (a === 'file') {
      const id = String(q.get('id') || '').replace(/[^\w-]/g, '');
      if (!id) return send(400, { error: 'Missing track.' });
      const j = await call(`/v0/tracks/${id}/download?format=mp3&quality=high`);
      return send(200, { url: j.url || j.downloadUrl, expires: j.expires || j.expiresAt || null });
    }
    send(400, { error: 'Unknown request.' });
  } catch (e) { send(e.status === 429 ? 429 : 502, { error: 'The music library is not answering. Try again in a moment.' }); }
};
