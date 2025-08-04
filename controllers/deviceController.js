const { getAllSessionsStatus, deleteSession } = require('../services/whatsappService');

exports.index = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.redirect('/login');
    }

    const search = req.query.search ? req.query.search.trim() : '';
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (currentPage - 1) * perPage;

    let devices = await getAllSessionsStatus(userId);

    if (search) {
      devices = devices.filter(d => d.phone.includes(search));
    }

    const totalDevices = devices.length;
    const totalPages = Math.max(1, Math.ceil(totalDevices / perPage));

    const pageDevices = devices.slice(offset, offset + perPage);

    res.render('dashboard/devices', {
      devices: pageDevices,
      search,
      currentPage,
      totalPages
    });

  } catch (error) {
    console.error('Failed to get sessions:', error);
    res.render('dashboard/devices', {
      devices: [],
      search: '',
      currentPage: 1,
      totalPages: 1
    });
  }
};

exports.delete = async (req, res) => {
  const phone = req.params.phone;
  try {
    await deleteSession(phone);
	req.flash('success', 'Session detele successfully.');
	res.redirect('/dashboard/devices');
  } catch (error) {
    console.error(error);
	res.status(500).render('error', {
    title: '500 Internal Server Error',
    message: 'Failed to delete session',
  });
  }
};