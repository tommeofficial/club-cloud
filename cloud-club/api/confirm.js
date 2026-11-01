// Called when someone comes back from Stripe Checkout: ask Stripe directly whether that checkout was paid, and grant the hours or Pro if so.
// The webhook does the same job; both grant through the same idempotent functions (hours are keyed on the session id), so whichever lands first wins and the other changes nothing.
// POST { session_id } with the person's Supabase access token. It only grants for a session that belongs to the caller.
const { stripe, userFromToken, paymentsOn, grantHours, grantPro } = require('./_stripe');

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { error: 'POST only' });
  if (!paymentsOn()) return send(503, { error: 'Payments are not switched on yet.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer /i, '');
  const user = token && (await userFromToken(token));
  if (!user) return send(401, { error: 'Sign in first.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const id = String(body.session_id || '');
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return send(400, { error: 'Bad session.' });
  try {
    const s = await stripe('GET', `/checkout/sessions/${id}`);
    if (!s || !s.metadata || s.metadata.user_id !== user.id) return send(403, { error: 'That payment is not on this account.' });
    let granted = false;
    if (s.metadata.kind === 'hours' && s.payment_status === 'paid') granted = !!(await grantHours(s, user.id));
    else if (s.metadata.kind === 'pro' && s.subscription && s.status === 'complete') { await grantPro(typeof s.subscription === 'string' ? s.subscription : s.subscription.id); granted = true; }
    send(200, { paid: s.payment_status === 'paid' || s.status === 'complete', granted });
  } catch (e) { console.error('confirm', e.message); send(502, { error: 'Couldn’t check the payment.' }); }
};
