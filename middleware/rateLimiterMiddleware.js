const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  handler: (req, res) => {
    res.status(429).render('error', {
      title: res.__('error.Too Many Requests'),
      message: res.__('error.Too many login attempts please try again later'),
    });
  },
});

const registerLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  handler: (req, res) => {
    res.status(429).render('error', {
      title: res.__('error.Too Many Requests'),
      message: res.__('error.Too many registration attempts please try again later'),
    });
  },
});

module.exports = {
  loginLimiter,
  registerLimiter,
};
