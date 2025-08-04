const db = require('../config/Mysql');

exports.index = (req, res) => {
  const userId = req.session.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return res.redirect('/login');

  const queryReplies = `
    SELECT ar.*, s.phone AS session_phone_number
    FROM auto_replies ar
    LEFT JOIN sessions s ON ar.session_id = s.id
    WHERE ar.user_id = ?
    ORDER BY ar.updated_at DESC
  `;

  const querySessions = `
    SELECT id, phone FROM sessions WHERE user_id = ? AND connected = 1
  `;

  const error = req.query.error || null;
  const success = req.query.success || null;

  db.query(queryReplies, [userId], (errReplies, replies) => {
    if (errReplies) {
      console.error('Error fetching auto replies:', errReplies);
      return res.status(500).render('error', {
        title: '500 Internal Server Error',
        message: 'Failed to retrieve auto reply data.',
      });
    }

    db.query(querySessions, [userId], (errSessions, sessions) => {
      if (errSessions) {
        console.error('Error fetching sessions:', errSessions);
        return res.status(500).render('error', {
          title: '500 Internal Server Error',
          message: 'Failed to retrieve sessions data.',
        });
      }

      db.query('SELECT * FROM uploads WHERE user_id = ? ORDER BY id DESC', [userId], (errUploads, uploads) => {
        if (errUploads) {
          console.error('Error fetching uploads:', errUploads);
          return res.render('dashboard/auto-reply', {
            baseUrl,
            replies,
            sessions,
            user: req.session.user,
            error: 'Failed to load uploads.',
            success,
            uploads: []
          });
        }

        res.render('dashboard/auto-reply', {
          baseUrl,
          replies,
          sessions,
          user: req.session.user,
          error,
          success,
          uploads
        });
      });
    });
  });
};

exports.create = (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  const {
    title,
    prefix,
    includes,
    category,
    type,
    response,
    file,
    session_id,
    location_lat,
    location_lng,
    location_name,
    fileName
  } = req.body;

  const validCategories = ['Private', 'Group', 'All'];
  const validIncludes = ['Exactly', 'Contains'];
  const validTypes = ['text', 'Image', 'Video', 'Document', 'Audio', 'Location', 'Sticker'];

  if (
    !title || !prefix || !includes || !category || !type || !session_id ||
    !validCategories.includes(category) ||
    !validIncludes.includes(includes) ||
    !validTypes.includes(type)
  ) {
    req.flash('error', 'Invalid input.');
    return res.redirect('/dashboard/auto-reply');
  }

  let finalResponse = response || '';
  let finalFile = file || null;
  let finalFileName = null;

  if (type === 'Location') {
    if (!location_lat || !location_lng) {
      req.flash('error', 'Latitude and Longitude are required for location.');
      return res.redirect('/dashboard/auto-reply');
    }

    finalResponse = JSON.stringify({
      lat: parseFloat(location_lat),
      lng: parseFloat(location_lng),
      name: location_name || ''
    });

    finalFile = null;
  }

  if (type === 'Document') {
    finalFileName = fileName || 'file';
  }

  if (type === 'Sticker' && !file) {
    req.flash('error', 'File URL is required for sticker.');
    return res.redirect('/dashboard/auto-reply');
  }

  const query = `
    INSERT INTO auto_replies
    (user_id, session_id, title, prefix, includes, category, type, response, file, fileName)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    userId,
    session_id,
    title,
    prefix,
    includes,
    category,
    type,
    finalResponse,
    finalFile,
    finalFileName
  ];

  db.query(query, values, (err) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Failed to save auto reply.');
      return res.redirect('/dashboard/auto-reply');
    }
    req.flash('success', 'Auto reply saved successfully.');
    return res.redirect('/dashboard/auto-reply');
  });
};

exports.delete = (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  const autoReplyId = req.params.id;
  if (!autoReplyId) {
    req.flash('error', 'Invalid auto reply ID.');
    return res.redirect('/dashboard/auto-reply');
  }

  const query = 'DELETE FROM auto_replies WHERE id = ? AND user_id = ?';

  db.query(query, [autoReplyId, userId], (err, result) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Failed to delete auto reply.');
      return res.redirect('/dashboard/auto-reply');
    }

    if (result.affectedRows === 0) {
      req.flash('error', 'Auto reply not found or unauthorized.');
      return res.redirect('/dashboard/auto-reply');
    }

      req.flash('success', 'Auto reply deleted successfully.');
      return res.redirect('/dashboard/auto-reply');
  });
};

exports.delete = (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

  const autoReplyId = req.params.id;
  if (!autoReplyId) {
    req.flash('error', 'Invalid auto reply ID.');
    return res.redirect('/dashboard/auto-reply');
  }

  const query = 'DELETE FROM auto_replies WHERE id = ? AND user_id = ?';

  db.query(query, [autoReplyId, userId], (err, result) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Failed to delete auto reply.');
      return res.redirect('/dashboard/auto-reply');
    }

    if (result.affectedRows === 0) {
      req.flash('error', 'Auto reply not found or unauthorized.');
      return res.redirect('/dashboard/auto-reply');
    }

    req.flash('success', 'Auto reply deleted successfully.');
    return res.redirect('/dashboard/auto-reply');
  });
};
