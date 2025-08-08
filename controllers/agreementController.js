const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

exports.privacy = (req, res) => {
  const privacyPath = path.join(__dirname, '..', 'config', 'data', 'privacy-policy.md');
  fs.readFile(privacyPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).render('error', {
        title: 'Internal Server Error',
        message: 'Failed to load Privacy Policy.',
      });
    }

    const htmlContent = marked.parse(data);
    res.render('privacy-policy', { content: htmlContent });
  });
};

exports.term = (req, res) => {
  const termsPath = path.join(__dirname, '..', 'config', 'data', 'terms-conditions.md');
  fs.readFile(termsPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).render('error', {
        title: 'Internal Server Error',
        message: 'Failed to load Terms and Conditions.',
      });
    }

    const htmlContent = marked.parse(data);
    res.render('terms-conditions', { title: 'Terms & Conditions', content: htmlContent });
  });
};
