// Tells the page whether real payments are switched on (so it shows the free test purchases or the real checkout).
const { paymentsOn } = require('./_stripe');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ payments: paymentsOn() }));
};
