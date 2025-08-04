const db = require('../config/MySQL');
const { getAllSessionsStatus } = require('../services/whatsappService');
const { getContactsByUser } = require('../services/contactService');
const { getClientByPhone } = require('../services/whatsappService');

exports.index = async (req, res) => {
  const userId = req.session?.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return res.redirect('/login');

  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const searchQuery = `%${search}%`;

    const devices = await getAllSessionsStatus(userId);
    const contacts = await getContactsByUser(userId);

    db.query('SELECT * FROM uploads WHERE user_id = ? ORDER BY id DESC', [userId], (err, uploads) => {
      if (err) {
        console.error(err);
		req.flash('error', 'Failed to load uploads');
        return res.redirect('/dashboard/sending');
      }

      const countSql = `
        SELECT COUNT(*) AS total FROM messages 
        WHERE user_id = ? 
        AND (session LIKE ? OR phone LIKE ? OR type LIKE ? OR content LIKE ?)
      `;

      const dataSql = `
        SELECT * FROM messages 
        WHERE user_id = ? 
        AND (session LIKE ? OR phone LIKE ? OR type LIKE ? OR content LIKE ?) 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;

      db.query(countSql, [userId, searchQuery, searchQuery, searchQuery, searchQuery], (errCount, countResult) => {
        if (errCount) {
          console.error(errCount);
		  req.flash('error', 'Failed to count messages');
          return res.redirect('/dashboard/sending');
        }

        const total = countResult[0]?.total || 0;
        const totalPages = Math.ceil(total / limit);

        db.query(dataSql, [userId, searchQuery, searchQuery, searchQuery, searchQuery, limit, offset], (errData, messages) => {
          if (errData) {
            console.error(errData);
		    req.flash('error', 'Failed to load messages');
            return res.redirect('/dashboard/sending');
          }

          res.render('dashboard/sending', {
            baseUrl,
            devices,
            contacts,
            uploads,
            messages,
            query: req.query,
            search,
            currentPage: page,
            totalPages,
          });
        });
      });
    });
  } catch (error) {
    console.error('Failed to get sessions or contacts:', error.message || error);
    req.flash('error', 'Failed to get session or contact');
    return res.redirect('/dashboard/sending');
  }
};

exports.text = async (req, res) => {
  const { session, phone, content } = req.body;
  const userId = req.session?.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return res.redirect('/login');

  let devices = [];
  let contacts = [];
  let uploads = [];
  
  try {
    devices = await getAllSessionsStatus(userId);
    contacts = await getContactsByUser(userId);
  } catch (e) {
    console.error('Failed to get sessions or contacts:', e.message || e);
  }

  if (!session || !phone || !content) {
    req.flash('error', 'All fields must be filled in');
    return res.redirect('/dashboard/sending');
  }

  try {
    const client = getClientByPhone(session);
    if (!client) {
      req.flash('error', 'Session not found or inactive');
      return res.redirect('/dashboard/sending');
    }

    const to = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    await client.sendMessage(to, { text: content });
	
	const sql = `INSERT INTO messages (user_id, session, phone, type, content) VALUES (?, ?, ?, ?, ?)`;
	db.query(sql, [userId, session, phone, 'text', content], (err) => {
	  if (err) console.error('Failed to save message:', err);
	});

    req.flash('success', 'Message sent successfully!');
    return res.redirect('/dashboard/sending');
  } catch (error) {
    console.error('Failed to send message:', error);
    req.flash('error', 'Failed sent message!');
    return res.redirect('/dashboard/sending');
  }
};

exports.image = async (req, res) => {
  const { session, phone, 'image-url': imageUrl, caption } = req.body;
  const userId = req.session?.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return res.redirect('/login');

  let devices = [];
  let contacts = [];
  let uploads = [];
  
  try {
    devices = await getAllSessionsStatus(userId);
    contacts = await getContactsByUser(userId);
  } catch (e) {
    console.error('Failed to get sessions or contacts:', e.message || e);
  }

  if (!session || !phone || !imageUrl) {
    req.flash('error', 'All fields must be filled in');
    return res.redirect('/dashboard/sending');
  }

  try {
    const client = getClientByPhone(session);
    if (!client) {
      req.flash('error', 'Session not found or inactive');
      return res.redirect('/dashboard/sending');
    }

    const to = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    await client.sendMessage(to, {
      image: { url: imageUrl },
      caption: caption || '',
    });
	
	const sql = `INSERT INTO messages (user_id, session, phone, type, content, media_url) VALUES (?, ?, ?, ?, ?, ?)`;
	db.query(sql, [userId, session, phone, 'image', caption || '', imageUrl], (err) => {
	  if (err) console.error('Failed to save message:', err);
	});
	
    req.flash('success', 'Message sent successfully!');
    return res.redirect('/dashboard/sending');
  } catch (error) {
    console.error('Failed to send image message:', error);
    req.flash('error', 'Failed sent message!');
    return res.redirect('/dashboard/sending');
  }
};

exports.video = async (req, res) => {
  const { session, phone, 'video-url': videoUrl, caption } = req.body;
  const userId = req.session?.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return res.redirect('/login');

  let devices = [];
  let contacts = [];
  let uploads = [];

  try {
    devices = await getAllSessionsStatus(userId);
    contacts = await getContactsByUser(userId);
  } catch (e) {
    console.error('Failed to get sessions or contacts:', e.message || e);
  }

  if (!session || !phone || !videoUrl) {
    req.flash('error', 'All fields must be filled in');
    return res.redirect('/dashboard/sending');
  }

  try {
    const client = getClientByPhone(session);
    if (!client) {
      req.flash('error', 'Session not found or inactive');
      return res.redirect('/dashboard/sending');
    }

    const to = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    await client.sendMessage(to, {
      video: { url: videoUrl },
      caption: caption || '',
    });

	const sql = `INSERT INTO messages (user_id, session, phone, type, content, media_url) VALUES (?, ?, ?, ?, ?, ?)`;
	db.query(sql, [userId, session, phone, 'video', caption || '', videoUrl], (err) => {
	  if (err) console.error('Failed to save message:', err);
	});

    req.flash('success', 'Message sent successfully!');
    return res.redirect('/dashboard/sending');
  } catch (error) {
    console.error('Failed to send video message:', error);
    req.flash('error', 'Failed sent message!');
    return res.redirect('/dashboard/sending');
  }
};

exports.audio = async (req, res) => {
  const { session, phone, 'audio-url': audioUrl } = req.body;
  const userId = req.session?.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return res.redirect('/login');

  let devices = [];
  let contacts = [];
  let uploads = [];

  try {
    devices = await getAllSessionsStatus(userId);
    contacts = await getContactsByUser(userId);
  } catch (e) {
    console.error('Failed to get sessions or contacts:', e.message || e);
  }

  if (!session || !phone || !audioUrl) {
    req.flash('error', 'All fields must be filled in');
    return res.redirect('/dashboard/sending');
  }

  try {
    const client = getClientByPhone(session);
    if (!client) {
      req.flash('error', 'Session not found or inactive');
      return res.redirect('/dashboard/sending');
    }

    const to = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    await client.sendMessage(to, {
      audio: { url: audioUrl },
      mimetype: 'audio/mpeg',
    });
	
	const sql = `INSERT INTO messages (user_id, session, phone, type, media_url, mime_type) VALUES (?, ?, ?, ?, ?, ?)`;
	db.query(sql, [userId, session, phone, 'audio', audioUrl, 'audio/mpeg'], (err) => {
	  if (err) console.error('Failed to save message:', err);
	});

    req.flash('success', 'Message sent successfully!');
    return res.redirect('/dashboard/sending');
  } catch (error) {
    console.error('Failed to send audio message:', error);
    req.flash('error', 'Failed sent message!');
    return res.redirect('/dashboard/sending');
  }
};

exports.document = async (req, res) => {
  const { session, phone, 'document-url': documentUrl, caption, 'file-name': fileName } = req.body;
  const userId = req.session?.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  if (!userId) return res.redirect('/login');

  let devices = [];
  let contacts = [];
  let uploads = [];

  try {
    devices = await getAllSessionsStatus(userId);
    contacts = await getContactsByUser(userId);
  } catch (e) {
    console.error('Failed to get sessions or contacts:', e.message || e);
  }

  if (!session || !phone || !documentUrl) {
    req.flash('error', 'All fields must be filled in');
    return res.redirect('/dashboard/sending');
  }

  try {
    const client = getClientByPhone(session);
    if (!client) {
      req.flash('error', 'Session not found or inactive');
      return res.redirect('/dashboard/sending');
    }

    const to = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    const ext = documentUrl.split('.').pop().toLowerCase();

    const mimeTypes = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
    };

    const mimetype = mimeTypes[ext] || 'application/octet-stream';

    await client.sendMessage(to, {
      document: { url: documentUrl },
      mimetype,
      fileName: fileName || `file.${ext}`,
      caption: caption || '',
    });

	const sql = `INSERT INTO messages (user_id, session, phone, type, content, media_url, file_name, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
	db.query(sql, [userId, session, phone, 'document', caption || '', documentUrl, fileName, mimetype], (err) => {
	  if (err) console.error('Failed to save message:', err);
	});

    req.flash('success', 'Message sent successfully!');
    return res.redirect('/dashboard/sending');
  } catch (error) {
    console.error('Failed to send document message:', error);
    req.flash('error', 'Failed sent message!');
    return res.redirect('/dashboard/sending');
  }
};

exports.location = async (req, res) => {
  const { session, phone, latitude, longitude, name } = req.body;
  const userId = req.session?.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return res.redirect('/login');

  let devices = [];
  let contacts = [];
  let uploads = [];

  try {
    devices = await getAllSessionsStatus(userId);
    contacts = await getContactsByUser(userId);
  } catch (e) {
    console.error('Failed to get sessions or contacts:', e.message || e);
  }

  if (!session || !phone || !latitude || !longitude || !name) {
    req.flash('error', 'All fields must be filled in');
    return res.redirect('/dashboard/sending');
  }

  try {
    const client = getClientByPhone(session);
    if (!client) {
      req.flash('error', 'Session not found or inactive');
      return res.redirect('/dashboard/sending');
    }

    const to = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    await client.sendMessage(to, {
      location: {
        degreesLatitude: parseFloat(latitude),
        degreesLongitude: parseFloat(longitude),
        name,
      }
    });

	const sql = `INSERT INTO messages (user_id, session, phone, type, latitude, longitude, location_name) VALUES (?, ?, ?, ?, ?, ?, ?)`;
	db.query(sql, [userId, session, phone, 'location', parseFloat(latitude), parseFloat(longitude), name], (err) => {
	  if (err) console.error('Failed to save message:', err);
	});

    req.flash('success', 'Message sent successfully!');
    return res.redirect('/dashboard/sending');
  } catch (error) {
    console.error('Failed to send location message:', error);
    req.flash('error', 'Failed sent message!');
    return res.redirect('/dashboard/sending');
  }
};

exports.sticker = async (req, res) => {
  const { session, phone, 'sticker-url': stickerUrl } = req.body;
  const userId = req.session?.user?.id;
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  if (!userId) return res.redirect('/login');

  let devices = [];
  let contacts = [];
  let uploads = [];

  try {
    devices = await getAllSessionsStatus(userId);
    contacts = await getContactsByUser(userId);
  } catch (e) {
    console.error('Failed to retrieve sessions or contacts:', e.message || e);
  }

  if (!session || !phone || !stickerUrl) {
    req.flash('error', 'All fields must be filled in');
    return res.redirect('/dashboard/sending');
  }

  try {
    const client = getClientByPhone(session);
    if (!client) {
      req.flash('error', 'Session not found or inactive');
      return res.redirect('/dashboard/sending');
    }

    const to = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    await client.sendMessage(to, {
      sticker: { url: stickerUrl }
    });
	
	const sql = `INSERT INTO messages (user_id, session, phone, type, media_url) VALUES (?, ?, ?, ?, ?)`;
	db.query(sql, [userId, session, phone, 'sticker', stickerUrl], (err) => {
	  if (err) console.error('Failed to save message:', err);
	});

    req.flash('success', 'Message sent successfully!');
    return res.redirect('/dashboard/sending');
  } catch (error) {
    console.error('Failed to send sticker message:', error);
    req.flash('error', 'Failed sent message!');
    return res.redirect('/dashboard/sending');
  }
};

exports.delete = async (req, res) => {
  const userId = req.session?.user?.id;
  const messageId = req.params.id;

  if (!userId) return res.redirect('/login');

  try {
    db.query('DELETE FROM messages WHERE id = ? AND user_id = ?', [messageId, userId], (err, result) => {
      if (err) {
        console.error('Delete failed:', err);
        req.flash('error', 'Failed to delete message');
        return res.redirect('/dashboard/sending');
      }

    req.flash('success', 'Message sent successfully!');
    return res.redirect('/dashboard/sending');
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    req.flash('error', 'Failed sent message!');
    return res.redirect('/dashboard/sending');
  }
};