const nodemailer = require('nodemailer');

const DEFAULT_FROM = process.env.SMTP_DEFAULT_FROM?.replace(/^"(.*)"$/, '$1');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, subject, text, html, from = DEFAULT_FROM }) {
  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail, DEFAULT_FROM };

/* How to Use
await sendMail({
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'Welcome to FhytsBot!',
  text: 'Thank you for registering.',
  html: '<h1>Welcome to <strong>FhytsBot</strong>!</h1><p>Thank you for registering.</p>',
});
*/
