const db = require('../config/Mysql');
const { startSession, deleteSession } = require('../services/whatsappService');
const { getTotalContactsByUser } = require('../services/contactService');

exports.connect = async (req, res) => {
  const phoneRaw = req.body.phone || '';
  const phone = phoneRaw.replace(/\D/g, '');
  const userId = req.session.user?.id;

  if (!userId) {
    return res.redirect('/login');
  }

  let totalSessions = 0;
  let totalMessages = 0;
  let totalContacts = 0;
  let totalBroadcasts = 0;

  if (!phone || !/^\d{8,15}$/.test(phone)) {
    req.flash('error', 'The phone number must consist of 8-15 digits.');
  }

  try {
    totalSessions = await queryAsync(
      'SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?',
      [userId]
    ).then(results => results[0].total);

    totalMessages = await queryAsync(
      'SELECT COUNT(*) AS total FROM messages WHERE user_id = ?',
      [userId]
    ).then(results => results[0].total);

    totalBroadcasts = await queryAsync(
      'SELECT COUNT(*) AS total FROM broadcasts WHERE user_id = ?',
      [userId]
    ).then(results => results[0].total);

    totalContacts = await getTotalContactsByUser(userId);

    const usedByOthers = await queryAsync(
      'SELECT * FROM sessions WHERE phone = ? AND user_id != ?',
      [phone, userId]
    );

    if (usedByOthers.length > 0) {
      return res.render('dashboard/index', {
	    user_name: req.session.user.name,
        phone: null,
        error: 'This session is already in use by another account.',
        totalSessions,
        totalMessages,
        totalContacts,
        totalBroadcasts,
      });
    }

    const existing = await queryAsync(
      'SELECT * FROM sessions WHERE phone = ? AND user_id = ?',
      [phone, userId]
    );

    const existingSession = existing[0];

    if (existingSession) {
      if (existingSession.connected === 1) {
        return res.render('dashboard/index', {
	      user_name: req.session.user.name,
          phone,
          error: 'This session is already connected.',
          totalSessions,
          totalMessages,
          totalContacts,
          totalBroadcasts,
        });
      } else {
        await deleteSession(phone);
      }
    }

    await startSession(phone);

    if (!existingSession) {
      await queryAsync(
        'INSERT INTO sessions (user_id, phone, connected) VALUES (?, ?, 0)',
        [userId, phone]
      );
    }

    return res.render('dashboard/index', {
	  user_name: req.session.user.name,
      phone,
      error: null,
      totalSessions,
      totalMessages,
      totalContacts,
      totalBroadcasts,
    });
  } catch (err) {
    console.error(err);
    return res.render('dashboard/index', {
	  user_name: req.session.user.name,
      phone: null,
      error: 'Failed to start session',
      totalSessions,
      totalMessages,
      totalContacts,
      totalBroadcasts,
    });
  }
};

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}
