// Sign out of the VIP area: clear the access cookie and drop back onto the website.
module.exports = (req, res) => {
  res.setHeader('Set-Cookie', 'cc_access=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  res.statusCode = 302;
  res.setHeader('Location', '/');
  res.end();
};
