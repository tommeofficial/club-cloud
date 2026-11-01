// Shared helpers for the payment functions. Keys come from environment variables on the server, never from the browser.
const crypto = require('crypto');

const env = (k) => process.env[k] || '';
exports.env = env;
exports.paymentsOn = () => !!(env('STRIPE_SECRET_KEY') && env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'));

// Stripe's REST API takes form-encoded bodies with bracketed keys
const form = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => {
  const key = prefix ? `${prefix}[${k}]` : k;
  return v && typeof v === 'object' ? form(v, key) : [`${encodeURIComponent(key)}=${encodeURIComponent(v)}`];
}).join('&');
exports.form = form;

exports.stripe = async (method, path, body) => {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method, headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: body ? form(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.error && data.error.message) || `Stripe ${r.status}`);
  return data;
};

// who is calling: check their Supabase access token and return the user (must have a real email, not a guest)
exports.userFromToken = async (token) => {
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY') } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id && u.email && !u.is_anonymous ? u : null;
};

// Supabase's newer secret keys (sb_secret_...) are not JWTs and go in the apikey header only; the older service_role key is a JWT and also goes in Authorization
const serviceHeaders = () => { const k = env('SUPABASE_SERVICE_ROLE_KEY'); return k.startsWith('eyJ') ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k }; };
exports.serviceHeaders = serviceHeaders;

// call a database function as the server (service role)
exports.rpc = async (fn, args) => {
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...serviceHeaders() }, body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`database ${fn} ${r.status}: ${await r.text()}`);
};

// verify a Stripe webhook: HMAC-SHA256 of "timestamp.body" with the endpoint's signing secret, within five minutes
exports.verifyStripe = (raw, header, secret, now = Date.now()) => {
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')));
  const t = +parts.t; if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const want = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const got = String(header).split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  return got.some((g) => g.length === want.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(want)));
};

// Hours or Pro are granted from two places that must never double up: the webhook and the return-from-Stripe check (api/confirm.js). Both key hours on the Checkout session id.
exports.grantHours = (session, userId) => exports.rpc('grant_paid_once', { p_event: session.id, p_user: userId, p_seconds: 3600 * Math.max(1, Math.min(50, +(session.metadata || {}).hours || 1)) });
exports.grantPro = async (subscriptionId) => {   // sets Pro to the end of the paid period, so repeating it changes nothing
  const sub = await exports.stripe('GET', `/subscriptions/${subscriptionId}`);
  const user = sub.metadata && sub.metadata.user_id;
  if (user && sub.current_period_end) await exports.rpc('grant_pro_until', { p_user: user, p_until: new Date(sub.current_period_end * 1000).toISOString() });
};
