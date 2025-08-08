const db = require('../config/MySQL');

module.exports = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const user = req.session.user;

  if (user.status !== 'active') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'Your account is inactive or blocked. Please contact the admin.  <a class="text-rose-500" href="/logout">Logout</a>'
    });
  }

  if (!['superadmin', 'admin', 'user'].includes(user.role)) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You do not have access to this page!. <a class="text-rose-500" href="/logout">Logout</a>'
    });
  }

  try {
    const [result] = await db.promise().query(`
      SELECT u.package_id, u.package_start, u.package_end,
             p.duration_days
      FROM users u
      LEFT JOIN packages p ON u.package_id = p.id
      WHERE u.id = ?
    `, [user.id]);

    const userData = result[0];
	
	const [packages] = await db.promise().query(`
      SELECT id, name, duration_days, price, description
      FROM packages
      ORDER BY id ASC
    `);
	
	const filteredPackages = packages
	  .filter(pkg => parseFloat(pkg.price) > 0)
	  .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    if (!userData || !userData.package_id) {
	  return res.status(403).render('pricing', {
        title: 'Incomplete Package Information',
        message: 'We noticed some missing information in your subscription. Kindly reach out to support to resolve this.',
		packages: filteredPackages,
	  });
    }

    if (userData.duration_days === -1) {
      return next();
    }

    if (!userData.package_start || !userData.package_end) {
	  return res.status(403).render('pricing', {
        title: 'Incomplete Package Information',
        message: 'We noticed some missing information in your subscription. Kindly reach out to support to resolve this.',
        packages,
	  });
    }

    const now = new Date();
    const packageEnd = new Date(userData.package_end);

    if (packageEnd < now) {
	  return res.status(403).render('pricing', {
        title: 'Subscription Expired',
        message: 'Your subscription package has expired. Kindly renew it to continue enjoying our services.',
        packages,
	  });
    }

    next();

  } catch (err) {
    console.error('Error checking package:', err);
    return res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while checking the user package.'
    });
  }
};
