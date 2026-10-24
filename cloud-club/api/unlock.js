// Invite password check for the website's "Invite Early" pop-up. A right password gets the access cookie that
// middleware.js looks for on /app. Only hashes live here; the password itself is never stored.
const crypto = require('crypto');

const PASSWORD_SHA256 = '8c6e18ee5b93efd691ec0386e740dc9961795c472254fed6fa225acbf8af4361';
const ACCESS_TOKEN = '26aeec9afc765928a26673e59e5edff090c6c0ab583bffdbe2e91f3c45aab2e6'; // keep in step with middleware.js

module.exports = (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const pw = String((req.body && req.body.password) || '').slice(0, 200);
  const got = crypto.createHash('sha256').update(pw).digest();
  if (!crypto.timingSafeEqual(got, Buffer.from(PASSWORD_SHA256, 'hex'))) { res.statusCode = 401; return res.end(); }
  res.setHeader('Set-Cookie', `cc_access=${ACCESS_TOKEN}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`);
  res.statusCode = 200; res.end();
};
