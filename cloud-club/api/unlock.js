// Invite password check for the website's VIP Access pop-up. A right password gets the access cookie that
// middleware.js looks for on /app. Only hashes live here; the password itself is never stored.
const crypto = require('crypto');

const PASSWORD_SHA256 = 'ac05c4220ac659b8bbd161e01732eb7f60379c73a7e8bb41410ec549b812fd33';
const ACCESS_TOKEN = '36c7ab1734950b2b6c913479ddb7fcbfa901536f9ef20a6df4519f9fd2a55e04'; // keep in step with middleware.js

module.exports = (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const pw = String((req.body && req.body.password) || '').slice(0, 200);
  const got = crypto.createHash('sha256').update(pw).digest();
  if (!crypto.timingSafeEqual(got, Buffer.from(PASSWORD_SHA256, 'hex'))) { res.statusCode = 401; return res.end(); }
  res.setHeader('Set-Cookie', `cc_access=${ACCESS_TOKEN}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`);
  res.statusCode = 200; res.end();
};
