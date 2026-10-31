// Start a Stripe Checkout for Pro (a monthly subscription) or for hours of deck time. The browser sends its Supabase access token.
// Body: { kind: 'pro' } or { kind: 'hours', hours: 1..50 }. Returns { url } to send the person to.
const { env, stripe, userFromToken, paymentsOn } = require('./_stripe');

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { error: 'POST only' });
  if (!paymentsOn()) return send(503, { error: 'Payments are not switched on yet.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer /i, '');
  const user = token && (await userFromToken(token));
  if (!user) return send(401, { error: 'Sign in with your email first.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const site = env('SITE_URL') || `https://${req.headers.host}`;
  const common = { client_reference_id: user.id, customer_email: user.email, success_url: `${site}/app?paid=1`, cancel_url: `${site}/app?paid=0`, 'metadata': { user_id: user.id } };
  try {
    let session;
    if (body.kind === 'pro') {
      if (!env('STRIPE_PRICE_PRO')) return send(503, { error: 'Pro is not set up yet.' });
      session = await stripe('POST', '/checkout/sessions', { ...common, mode: 'subscription', line_items: { 0: { price: env('STRIPE_PRICE_PRO'), quantity: 1 } }, metadata: { user_id: user.id, kind: 'pro' }, subscription_data: { metadata: { user_id: user.id } } });
    } else if (body.kind === 'hours') {
      const hours = Math.max(1, Math.min(50, Math.floor(+body.hours || 1)));
      session = await stripe('POST', '/checkout/sessions', { ...common, mode: 'payment',
        line_items: { 0: { quantity: hours, price_data: { currency: 'gbp', unit_amount: 100, product_data: { name: 'Club Cloud deck time (1 hour)' } } } },
        metadata: { user_id: user.id, kind: 'hours', hours: String(hours) } });
    } else return send(400, { error: 'Unknown purchase.' });
    send(200, { url: session.url });
  } catch (e) { console.error('checkout', e.message); send(502, { error: 'Couldn’t start the payment.', detail: String(e.message || '').slice(0, 140) }); }
};
