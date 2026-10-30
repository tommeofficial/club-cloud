// Stripe tells us here when a payment goes through. We check the signature, then add the hours or extend Pro on the person's account.
const { env, stripe, rpc, verifyStripe } = require('./_stripe');

const readRaw = (req) => new Promise((ok, no) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); req.on('error', no); });

async function grantPro(subscriptionId) {
  const sub = await stripe('GET', `/subscriptions/${subscriptionId}`);
  const user = sub.metadata && sub.metadata.user_id;
  if (user && sub.current_period_end) await rpc('grant_pro_until', { p_user: user, p_until: new Date(sub.current_period_end * 1000).toISOString() });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const raw = await readRaw(req);
  if (!env('STRIPE_WEBHOOK_SECRET') || !verifyStripe(raw, req.headers['stripe-signature'], env('STRIPE_WEBHOOK_SECRET'))) { res.statusCode = 400; return res.end('bad signature'); }
  const ev = JSON.parse(raw), obj = ev.data && ev.data.object;
  try {
    if (ev.type === 'checkout.session.completed' && obj.payment_status === 'paid' || ev.type === 'checkout.session.completed' && obj.mode === 'subscription') {
      const m = obj.metadata || {};
      if (m.kind === 'hours' && m.user_id) await rpc('grant_paid_once', { p_event: ev.id, p_user: m.user_id, p_seconds: 3600 * Math.max(1, Math.min(50, +m.hours || 1)) });
      else if (m.kind === 'pro' && obj.subscription) await grantPro(obj.subscription);
    } else if (ev.type === 'invoice.paid' && obj.subscription) await grantPro(obj.subscription);   // each monthly renewal
  } catch (e) { console.error('webhook', ev.type, e.message); res.statusCode = 500; return res.end('retry'); }   // a 500 makes Stripe send it again
  res.statusCode = 200; res.end('ok');
};
module.exports.config = { api: { bodyParser: false } };
