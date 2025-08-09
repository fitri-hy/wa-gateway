module.exports = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const userRole = req.session.user.role;

  if (userRole !== 'admin' && userRole !== 'superadmin') {
    return res.status(403).render('error', { 
	  title: res.__('error.Forbidden'),
	  message: res.__('error.Access to this page'),
	});
  }

  next();
};
