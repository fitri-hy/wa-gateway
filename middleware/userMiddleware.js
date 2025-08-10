const db = require('../config/MySQL');

module.exports = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const user = req.session.user;

  if (user.status !== 'active') {
    return res.status(403).render('error', {
      title: res.__('error.Access Denied'),
      message: res.__('error.Your account is inactive or blocked')
    });
  }

  if (!['superadmin', 'admin', 'user'].includes(user.role)) {
    return res.status(403).render('error', {
      title: res.__('error.Access Denied'),
      message: res.__('error.You do not have access to this page')
    });
  }

  try {
    const [result] = await db.promise().query(`
      SELECT u.package_id, u.package_start, u.package_end,
             p.name
      FROM users u
      LEFT JOIN packages p ON u.package_id = p.id
      WHERE u.id = ?
    `, [user.id]);

    const userData = result[0];
	
    const [packages] = await db.promise().query(`
      SELECT id, name, duration_days, price, description
      FROM packages
      WHERE UPPER(name) <> 'ADMIN'
      ORDER BY id ASC
    `);
	
    const filteredPackages = packages
      .filter(pkg => parseFloat(pkg.price) > 0)
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    if (!userData || !userData.package_id) {
      return res.status(403).render('pricing', {
        title: res.__('error.Incomplete Package Information'),
        message: res.__('error.We noticed some missing information in your subscription'),
        packages: filteredPackages,
      });
    }

    if (userData.name && userData.name.toUpperCase() === 'ADMIN') {
      return next();
    }

    if (!userData.package_start || !userData.package_end) {
      return res.status(403).render('pricing', {
        title: res.__('error.Incomplete Package Information'),
        message: res.__('error.We noticed some missing information in your subscription'),
        packages: filteredPackages,
      });
    }

    const now = new Date();
    const packageEnd = new Date(userData.package_end);

    if (packageEnd < now) {
      return res.status(403).render('pricing', {
        title: res.__('error.Subscription Expired'),
        message: res.__('error.Your subscription package has expired'),
        packages: filteredPackages,
      });
    }

    next();

  } catch (err) {
    console.error('Error checking package:', err);
    return res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};