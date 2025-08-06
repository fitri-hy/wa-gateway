module.exports = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const userRole = req.session.user.role;

  if (userRole !== 'admin' && userRole !== 'superadmin') {
    return res.status(403).render('error', { 
      title: '403 Access Denied',
	  message: 'You do not have access to this page!' 
	});
  }

  next();
};
