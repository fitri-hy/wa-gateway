const db = require('../config/Mysql');
const { getAllSessionsStatus } = require('../services/whatsappService');
const { getTotalContactsByUser } = require('../services/contactService');

exports.index = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  let totalSessions = 0;
  let totalMessages = 0;
  let totalContacts = 0;
  let totalBroadcasts = 0;

  try {
    totalSessions = await new Promise((resolve, reject) => {
      db.query('SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?', [userId], (err, results) => {
        if (err) return reject(err);
        resolve(results[0].total);
      });
    });

    totalMessages = await new Promise((resolve, reject) => {
      db.query('SELECT COUNT(*) AS total FROM messages WHERE user_id = ?', [userId], (err, results) => {
        if (err) return reject(err);
        resolve(results[0].total);
      });
    });

    totalBroadcasts = await new Promise((resolve, reject) => {
      db.query('SELECT COUNT(*) AS total FROM broadcasts WHERE user_id = ?', [userId], (err, results) => {
        if (err) return reject(err);
        resolve(results[0].total);
      });
    });

    totalContacts = await getTotalContactsByUser(userId);

    res.render('dashboard/index', {
	  user_name: req.session.user.name,
      phone: null,
      error: null,
      totalSessions,
      totalMessages,
      totalContacts,
      totalBroadcasts,
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard/index', {
	  user_name: req.session.user.name,
      phone: null,
      error: 'Failed to load data',
      totalSessions,
      totalMessages,
      totalContacts,
      totalBroadcasts,
    });
  }
};

