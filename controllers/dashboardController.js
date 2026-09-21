const db = require('../config/MySQL');
const { getAllSessionsStatus } = require('../services/whatsappService');
const { getTotalContactsByUser } = require('../services/contactService');

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

exports.apiStats = async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [sessions, messages, broadcasts, contacts] = await Promise.all([
      queryAsync('SELECT COUNT(*) AS total FROM sessions WHERE user_id = ?', [userId]).then(r => r[0].total),
      queryAsync('SELECT COUNT(*) AS total FROM messages WHERE user_id = ?', [userId]).then(r => r[0].total),
      queryAsync('SELECT COUNT(*) AS total FROM broadcasts WHERE user_id = ?', [userId]).then(r => r[0].total),
      getTotalContactsByUser(userId),
    ]);

    res.json({ totalSessions: sessions, totalMessages: messages, totalContacts: contacts, totalBroadcasts: broadcasts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
};

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

