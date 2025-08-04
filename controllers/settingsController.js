const bcrypt = require('bcrypt');
const db = require('../config/MySQL');

exports.index = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  db.query('SELECT id, name, email, role FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Database error.');
      return res.redirect('/dashboard/settings');
    }

    if (results.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/dashboard/settings');
    }

    const user = results[0];
    res.render('dashboard/settings', { user });
  });
};

exports.update = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  const { name } = req.body;

  const nameRegex = /^[a-zA-Z\s]{1,25}$/;
  if (!nameRegex.test(name)) {
    req.flash('error', 'Maximum name 25 characters, no symbols.');
    return res.redirect('/dashboard/settings');
  }

  db.query('UPDATE users SET name = ? WHERE id = ?', [name, userId], (err) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Failed to update user data.');
      return res.redirect('/dashboard/settings');
    }

    req.session.user.name = name;
    req.flash('success', 'Profile updated successfully.');
    return res.redirect('/dashboard/settings');
  });
};

exports.password = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  const { password, 're-password': confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    req.flash('error', 'Please fill in both password fields.');
    return res.redirect('/dashboard/settings');
  }

  if (password.length < 6) {
    req.flash('error', 'Password must be at least 6 characters!');
    return res.redirect('/dashboard/settings');
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match!');
    return res.redirect('/dashboard/settings');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Failed to update password.');
        return res.redirect('/dashboard/settings');
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.redirect('/login');
        }
        res.redirect('/login');
      });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error.');
    return res.redirect('/dashboard/settings');
  }
};
