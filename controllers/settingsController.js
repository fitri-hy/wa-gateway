const bcrypt = require('bcrypt');
const db = require('../config/MySQL');

exports.index = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  try {
    const [results] = await db.promise().query(`
      SELECT u.id, u.name, u.email, u.role, u.status,
             u.package_id, u.package_start, u.package_end,
             p.name AS package_name, p.duration_days
      FROM users u
      LEFT JOIN packages p ON u.package_id = p.id
      WHERE u.id = ?
    `, [userId]);

    if (results.length === 0) {
      req.flash('error', res.__('flash.User not found'));
      return res.redirect('/dashboard/settings');
    }

    const user = results[0];

    if (!user.package_id) {
      user.expiredFormatted = 'No Active Packages';
      user.remainingDays = null;
      user.totalDays = null;
      user.progressPercent = null;
      user.usedDaysDisplay = null;

    } else if (user.duration_days === -1) {
      user.expiredFormatted = 'Unlimited';
      user.remainingDays = null;
      user.totalDays = null;
      user.progressPercent = 100;
      user.usedDaysDisplay = '∞';

    } else if (!user.package_start || !user.package_end) {
      user.expiredFormatted = 'No Active Packages';
      user.remainingDays = null;
      user.totalDays = null;
      user.progressPercent = null;
      user.usedDaysDisplay = null;

    } else {
      function toDateOnly(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }

      const startDate = toDateOnly(new Date(user.package_start));
      const endDate = toDateOnly(new Date(user.package_end));
      const today = toDateOnly(new Date());

      const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      let usedDays;
      if (today < startDate) {
        usedDays = 0;
      } else if (today > endDate) {
        usedDays = totalDays;
      } else {
        usedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
      }

      usedDays = Math.min(Math.max(usedDays, 0), totalDays);
      const remainingDays = totalDays - usedDays;
      const percent = totalDays > 0 ? Math.min(100, Math.floor((usedDays / totalDays) * 100)) : 0;

      const expiredDate = new Date(user.package_end);
      const hours = expiredDate.getHours().toString().padStart(2, '0');
      const minutes = expiredDate.getMinutes().toString().padStart(2, '0');
      const day = expiredDate.getDate().toString().padStart(2, '0');
      const month = (expiredDate.getMonth() + 1).toString().padStart(2, '0');
      const year = expiredDate.getFullYear();

      user.expiredFormatted = `${hours}:${minutes} ${day}/${month}/${year}`;
      user.totalDays = totalDays;
      user.remainingDays = remainingDays > 0 ? remainingDays : 0;
      user.progressPercent = percent;
      user.usedDaysDisplay = `${usedDays.toString().padStart(2, '0')}/${totalDays.toString().padStart(2, '0')}`;
    }

    res.render('dashboard/settings', { user });

  } catch (err) {
    console.error(err);
    req.flash('error', res.__('flash.Database error'));
    return res.redirect('/dashboard/settings');
  }
};

exports.update = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  const { name } = req.body;

  const nameRegex = /^[a-zA-Z\s]{1,25}$/;
  if (!nameRegex.test(name)) {
    req.flash('error', res.__('flash.Maximum name 25 characters no symbols'));
    return res.redirect('/dashboard/settings');
  }

  db.query('UPDATE users SET name = ? WHERE id = ?', [name, userId], (err) => {
    if (err) {
      console.error(err);
      req.flash('error', res.__('flash.Failed to update user data'));
      return res.redirect('/dashboard/settings');
    }

    req.session.user.name = name;
    req.flash('success', res.__('flash.Profile updated successfully'));
    return res.redirect('/dashboard/settings');
  });
};

exports.password = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  const { password, 're-password': confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    req.flash('error', res.__('flash.Please fill in both password fields'));
    return res.redirect('/dashboard/settings');
  }

  if (password.length < 6) {
    req.flash('error', res.__('flash.Password must be at least 6 characters'));
    return res.redirect('/dashboard/settings');
  }

  if (password !== confirmPassword) {
    req.flash('error', res.__('flash.Passwords do not match'));
    return res.redirect('/dashboard/settings');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
      if (err) {
        console.error(err);
        req.flash('error', res.__('flash.Failed to update password'));
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
    req.flash('error', res.__('flash.Server error'));
    return res.redirect('/dashboard/settings');
  }
};
