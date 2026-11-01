// Stripe tells us here when a payment goes through. We check the signature, then add the hours or extend Pro on the person's account.
const { env, verifyStripe, grantHours, grantPro } = require('./_stripe');

const readRaw = (req) => new Promise((ok, no) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); req.on('error', no); });

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const raw = await readRaw(req);
  if (!env('STRIPE_WEBHOOK_SECRET') || !verifyStripe(raw, req.headers['stripe-signature'], env('STRIPE_WEBHOOK_SECRET'))) { res.statusCode = 400; return res.end('bad signature'); }
  const ev = JSON.parse(raw), obj = ev.data && ev.data.object;
  try {
    if (ev.type === 'checkout.session.completed' && obj.payment_status === 'paid' || ev.type === 'checkout.session.completed' && obj.mode === 'subscription') {
      const m = obj.metadata || {};
      if (m.kind === 'hours' && m.user_id) await grantHours(obj, m.user_id);
      else if (m.kind === 'pro' && obj.subscription) await grantPro(obj.subscription);
    } else if (ev.type === 'invoice.paid' && obj.subscription) await grantPro(obj.subscription);   // each monthly renewal
  } catch (e) { console.error('webhook', ev.type, e.message); res.statusCode = 500; return res.end('retry'); }   // a 500 makes Stripe send it again
  res.statusCode = 200; res.end('ok');
};
module.exports.config = { api: { bodyParser: false } };
