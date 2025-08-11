const { RecaptchaV2 } = require('express-recaptcha');

let recaptcha = null;

if (process.env.RECAPTCHA_ENABLED === 'true') {
  recaptcha = new RecaptchaV2(process.env.RECAPTCHA_SITE_KEY, process.env.RECAPTCHA_SECRET_KEY);
}

function recaptchaMiddleware(req, res, next) {
  if (process.env.RECAPTCHA_ENABLED === 'true') {
    return recaptcha.middleware.verify(req, res, next);
  }
  next();
}

module.exports = {
  recaptcha,
  recaptchaMiddleware
};
