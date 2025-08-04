const contactService = require('../services/contactService');

exports.index = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const { contacts, total } = await contactService.getContactsByUserPaginated(userId, search, limit, offset);
    const totalPages = Math.ceil(total / limit);

    res.render('dashboard/contact', {
      contacts,
      currentPage: page,
      totalPages,
      search
    });
  } catch (err) {
    console.error('Failed to load contacts:', err);
    req.flash('error', 'Failed to load contacts');
    res.redirect('/dashboard/contact');
  }
};

exports.store = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const { name, phone } = req.body;

    const nameRegex = /^[A-Za-z0-9\s]{3,25}$/;
    const phoneRegex = /^\d{8,15}$/;

    if (!nameRegex.test(name)) {
      req.flash('error', 'Name must be 3–25 characters and contain only letters and spaces.');
      return res.redirect('/dashboard/contact');
    }

    if (!phoneRegex.test(phone)) {
      req.flash('error', 'Phone must be 8–15 digits.');
      return res.redirect('/dashboard/contact');
    }

    await contactService.createContact(userId, name, phone);
    req.flash('success', 'Contact successfully added.');
    res.redirect('/dashboard/contact');
  } catch (err) {
    console.error('Error creating contact:', err);
    req.flash('error', 'Failed to create contact.');
    res.redirect('/dashboard/contact');
  }
};

exports.update = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const { id } = req.params;
    const { name, phone } = req.body;

    const nameRegex = /^[A-Za-z0-9\s]{3,25}$/;
    const phoneRegex = /^\d{8,15}$/;

    if (!nameRegex.test(name)) {
      req.flash('error', 'Name must be 3–25 characters and contain only letters and spaces.');
      return res.redirect('/dashboard/contact');
    }

    if (!phoneRegex.test(phone)) {
      req.flash('error', 'Phone must be 8–15 digits.');
      return res.redirect('/dashboard/contact');
    }

    await contactService.updateContact(id, name, phone);
    req.flash('success', 'Contact successfully updated.');
    res.redirect('/dashboard/contact');
  } catch (err) {
    console.error('Error updating contact:', err);
    req.flash('error', 'Failed to update contact.');
    res.redirect('/dashboard/contact');
  }
};

exports.delete = async (req, res) => {
  try {
    const contactId = req.params.id;
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    await contactService.deleteContact(contactId, userId);
    req.flash('success', 'Contact successfully deleted.');
    res.redirect('/dashboard/contact');
  } catch (err) {
    console.error('Failed to delete contact:', err);
    req.flash('error', 'Failed to delete contact.');
    res.redirect('/dashboard/contact');
  }
};
