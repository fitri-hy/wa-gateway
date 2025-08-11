const { RateLimiterMemory } = require('rate-limiter-flexible');

const loginAttempt = new RateLimiterMemory({
  points: Number(process.env.LOGIN_ATTEMPT_POINTS) || 5,
  duration: Number(process.env.LOGIN_ATTEMPT_DURATION) || 15 * 60,
});

const registerAttempt = new RateLimiterMemory({
  points: Number(process.env.REGISTER_ATTEMPT_POINTS) || 3,
  duration: Number(process.env.REGISTER_ATTEMPT_DURATION) || 24 * 60 * 60,
});

async function loginLimiterCheck(req, res, next) {
  try {
    await loginAttempt.consume(req.ip, 0);
    next();
  } catch {
    return res.status(429).render('error', {
      title: res.__('error.Too Many Requests'),
      message: res.__('error.Too many login attempts please try again later'),
    });
  }
}

async function registerLimiterCheck(req, res, next) {
  try {
    await registerAttempt.consume(req.ip, 0);
    next();
  } catch {
    return res.status(429).render('error', {
      title: res.__('error.Too Many Requests'),
      message: res.__('error.Too many registration attempts please try again later'),
    });
  }
}

async function loginLimiter(req) {
  try {
    await loginAttempt.consume(req.ip);
    return true;
  } catch {
    return false;
  }
}

async function registerLimiter(req) {
  try {
    await registerAttempt.consume(req.ip);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  loginLimiterCheck,
  loginLimiter,
  registerLimiterCheck,
  registerLimiter,
};
