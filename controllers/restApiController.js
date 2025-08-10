const crypto = require('crypto');
const db = require('../config/MySQL');
const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

exports.index = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.redirect('/login');
  
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  try {
    const mdPath = path.join(__dirname, '..', 'config', 'data', 'Rest_API.md');
    const markdown = await fs.readFile(mdPath, 'utf-8');

    const htmlContent = marked.parse(markdown);

    res.render('dashboard/rest-api', {
      base_url: baseUrl,
      user_token: req.session.user.token,
      docs: htmlContent,
      query: req.query,
    });

  } catch (err) {
    console.error('Failed to load Rest_API.md:', err);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.regenerateToken = (req, res) => {
  const userId = req.session?.user?.id;
  
  if (!userId) return res.redirect('/login');
  
  const newToken = crypto.randomBytes(32).toString('hex');

  db.query(
    'UPDATE users SET token = ? WHERE id = ?',
    [newToken, userId],
    (err) => {
      if (err) {
        console.error(err);
        req.flash('error', res.__('flash.Failed to regenerate token'));
        return res.redirect('/dashboard/rest-api');
      }

      req.session.user.token = newToken;

      req.flash('success', res.__('flash.Token regenerated successfully'));
      return res.redirect('/dashboard/rest-api');
    }
  );
};
