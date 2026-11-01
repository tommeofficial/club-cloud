// The SFU's gatekeeper: hands out LiveKit join tokens, and only inside a hard budget, so the bill cannot run away.
// POST { room, role: 'dj' | 'listener' } with the person's Supabase access token -> { url, token, expires }.
// The caps (all env, set in Vercel):
//   LK_BUDGET_MINUTES  participant-minutes per month this site may hand out (default 1500: set it to about 80% of your plan's free allowance)
//   LK_MAX_LISTENERS   listeners in one room (default 100)
//   LK_LISTEN_SECONDS  how long one listener token is good for, and what it is counted as (default 900 = 15 minutes; the page leaves and rejoins)
// Every token is counted in full when it is issued (api's supabase/livekit.sql: lk_take), so a month can never go past the budget. Keep NO payment card on the LiveKit plan: then nothing can be billed at all.
const crypto = require('crypto');
const { env, serviceHeaders } = require('./_stripe');

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const jwt = (claims, secret) => { const h = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}`; return `${h}.${crypto.createHmac('sha256', secret).update(h).digest('base64url')}`; };
const httpUrl = (u) => u.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
const sb = (path, init = {}) => fetch(`${env('SUPABASE_URL')}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...serviceHeaders(), ...(init.headers || {}) } });

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { error: 'POST only' });
  const KEY = env('LIVEKIT_API_KEY'), SECRET = env('LIVEKIT_API_SECRET'), URL_ = env('LIVEKIT_URL');
  if (!KEY || !SECRET || !URL_ || !env('SUPABASE_URL')) return send(503, { error: 'The big room is not switched on.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer /i, '');
  if (!token) return send(401, { error: 'Sign in first.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const room = String(body.room || '').toLowerCase(), role = body.role === 'dj' ? 'dj' : 'listener';
  if (!/^[a-z0-9_]{3,30}$/.test(room)) return send(400, { error: 'Bad room.' });
  try {
    // who is asking: any signed-in person (guests too) may listen; only a Pro DJ, in their own room, may publish
    const ur = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY') } });
    if (!ur.ok) return send(401, { error: 'Sign in first.' });
    const user = await ur.json();
    if (!user || !user.id) return send(401, { error: 'Sign in first.' });
    if (role === 'dj') {
      if (user.is_anonymous) return send(403, { error: 'Only a DJ can go live.' });
      const [p, w] = await Promise.all([sb(`/rest/v1/profiles?id=eq.${user.id}&select=username`).then((r) => r.json()), sb(`/rest/v1/wallets?user_id=eq.${user.id}&select=pro_until`).then((r) => r.json())]);
      if (!p[0] || p[0].username !== room) return send(403, { error: 'That is not your room.' });
      if (!w[0] || !w[0].pro_until || new Date(w[0].pro_until) < new Date()) return send(403, { error: 'Going live needs Pro.' });
    } else {
      // the room's listener cap, asked of LiveKit itself
      const cap = Math.max(1, +env('LK_MAX_LISTENERS') || 100);
      const admin = jwt({ iss: KEY, sub: 'server', nbf: Math.floor(Date.now() / 1000) - 10, exp: Math.floor(Date.now() / 1000) + 60, video: { roomAdmin: true, room: 'r-' + room } }, SECRET);
      try {
        const r = await fetch(`${httpUrl(URL_)}/twirp/livekit.RoomService/ListParticipants`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + admin }, body: JSON.stringify({ room: 'r-' + room }) });
        if (r.ok) { const j = await r.json(); if ((j.participants || []).length - 1 >= cap) return send(429, { error: 'The big room is full.', full: true }); }
      } catch (_) { /* LiveKit not reachable: the budget below still protects us */ }
    }
    // the monthly budget: count this token in full now, refuse if it would pass the budget
    const ttl = role === 'dj' ? 3600 : Math.max(60, +env('LK_LISTEN_SECONDS') || 900);
    const month = new Date().toISOString().slice(0, 7), budget = Math.round((+env('LK_BUDGET_MINUTES') || 1500) * 60);
    const r = await sb('/rest/v1/rpc/lk_take', { method: 'POST', body: JSON.stringify({ p_month: month, p_seconds: ttl, p_budget: budget }) });
    if (!r.ok || (await r.json()) !== true) return send(429, { error: 'The big room is at its limit for this month.', full: true });
    const now = Math.floor(Date.now() / 1000);
    const grant = { room: 'r-' + room, roomJoin: true, canSubscribe: true, canPublish: role === 'dj', canPublishData: role === 'dj' };
    send(200, { url: URL_, token: jwt({ iss: KEY, sub: (role === 'dj' ? 'dj-' : 'fan-') + user.id, name: role === 'dj' ? 'dj' : 'fan', nbf: now - 10, exp: now + ttl, video: grant }, SECRET), expires: now + ttl, seconds: ttl });
  } catch (e) { console.error('lk', e.message); send(502, { error: 'The big room is not answering.' }); }
};
