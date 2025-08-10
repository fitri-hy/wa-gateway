const fs = require('fs');
const path = require('path');
const contactService = require('../services/contactService');

function parseVCard(vcardData) {
  const contacts = [];
  const entries = vcardData.split('END:VCARD');

  entries.forEach(entry => {
    if (!entry.trim()) return;

    const nameMatch = entry.match(/FN:(.+)/);
    const phoneMatch = entry.match(/TEL[^:]*:(.+)/);

    if (nameMatch && phoneMatch) {
      contacts.push({
        name: nameMatch[1].trim(),
        phone: phoneMatch[1].trim()
      });
    }
  });

  return contacts;
}

function normalizePhone(phone) {
  phone = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (phone.startsWith('+')) {
    phone = phone.slice(1);
  }
  return phone;
}

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
    req.flash('error', res.__('flash.Failed to load contacts'));
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
      req.flash('error', res.__('flash.Name must be max 25 characters and contain only letters and spaces'));
      return res.redirect('/dashboard/contact');
    }

    if (!phoneRegex.test(phone)) {
      req.flash('error', res.__('flash.Phone must be 8–15 digits'));
      return res.redirect('/dashboard/contact');
    }

    await contactService.createContact(userId, name, phone);
    req.flash('success', res.__('flash.Contact successfully added'));
    res.redirect('/dashboard/contact');
  } catch (err) {
    console.error('Error creating contact:', err);
    req.flash('error', res.__('flash.Failed to create contact'));
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
      req.flash('error', res.__('flash.Name must be max 25 characters and contain only letters and spaces'));
      return res.redirect('/dashboard/contact');
    }

    if (!phoneRegex.test(phone)) {
      req.flash('error', res.__('flash.Phone must be 8–15 digits'));
      return res.redirect('/dashboard/contact');
    }

    await contactService.updateContact(id, name, phone);
    req.flash('success', res.__('flash.Contact successfully updated'));
    res.redirect('/dashboard/contact');
  } catch (err) {
    console.error('Error updating contact:', err);
    req.flash('error', res.__('flash.Failed to update contact'));
    res.redirect('/dashboard/contact');
  }
};

exports.delete = async (req, res) => {
  try {
    const contactId = req.params.id;
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    await contactService.deleteContact(contactId, userId);
    req.flash('success', res.__('flash.Contact successfully deleted'));
    res.redirect('/dashboard/contact');
  } catch (err) {
    console.error('Failed to delete contact:', err);
    req.flash('error', res.__('flash.Failed to delete contact'));
    res.redirect('/dashboard/contact');
  }
};

exports.import = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.redirect('/login');
    }

    if (!req.file) {
      req.flash('error', res.__('flash.File not found'));
      return res.redirect('/dashboard/contact');
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.vcf') {
      fs.unlinkSync(req.file.path);

      req.flash('error', res.__('flash.The file must have a vcf extension'));
      return res.redirect('/dashboard/contact');
    }

    const filePath = req.file.path;
    const vcardData = fs.readFileSync(filePath, 'utf-8');
    const contacts = parseVCard(vcardData);

    if (contacts.length === 0) {
      req.flash('error', res.__('flash.No valid contacts in vcf file'));
      fs.unlinkSync(filePath);
      return res.redirect('/dashboard/contact');
    }

    const existingContacts = await contactService.getContactsByUser(userId);

    let successCount = 0;

    for (const contact of contacts) {
      try {
        const phone = normalizePhone(contact.phone);

        const existingContact = existingContacts.find(
          c => c.name.toLowerCase() === contact.name.toLowerCase()
        );

        if (existingContact) {
          await contactService.updateContact(existingContact.id, {
            name: contact.name,
            phone: phone,
            userId: userId,
          });
        } else {
          await contactService.createContact(userId, contact.name, phone);
        }

        successCount++;
      } catch (err) {
        console.error('Failed to import contact:', contact, err);
      }
    }

    fs.unlinkSync(filePath);

    req.flash('success', `${successCount} contact(s) imported successfully`);
    res.redirect('/dashboard/contact');
  } catch (err) {
    console.error('Contact import failed:', err);
    req.flash('error', res.__('flash.An error occurred while importing contacts'));
    res.redirect('/dashboard/contact');
  }
};