const db = require('../config/MySQL');
const pluginManager = require('../services/pluginManager');
const fs = require('fs');
const path = require('path');
const util = require('util');

exports.index = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  try {
    const tables = [
      'auto_replies',
      'broadcasts',
      'contacts',
      'messages',
      'plugins',
      'sessions',
      'uploads',
      'users',
    ];

    function toTitleCase(str) {
      return str
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    const promiseDb = db.promise();

    const counts = await Promise.all(
      tables.map(async (table) => {
        try {
          const [rows] = await promiseDb.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
          return { table: toTitleCase(table), count: rows[0].count };
        } catch (err) {
          console.error(`Failed to get count for table ${table}:`, err);
          return { table: toTitleCase(table), count: 0 };
        }
      })
    );

    const total = counts.reduce((acc, item) => acc + item.count, 0);

    res.render('administrator/index', {
      user_name: req.session.user.name || 'User',
      total,
      counts,
    });
  } catch (error) {
    console.error('Unexpected error in index controller:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

// Users
exports.users = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  const countQuery = `
    SELECT COUNT(*) AS total 
    FROM users 
    WHERE name LIKE ? OR email LIKE ?
  `;
  const countParams = [`%${search}%`, `%${search}%`];

  const dataQuery = `
    SELECT 
      users.id, 
      users.name, 
      users.email, 
      users.role, 
      users.status,
      users.package_start,
      users.package_end,
      packages.id AS package_id,
      packages.name AS package_name,
      packages.description AS package_description,
      packages.duration_days
    FROM users
    LEFT JOIN packages ON users.package_id = packages.id
    WHERE users.name LIKE ? OR users.email LIKE ?
    ORDER BY users.id DESC
    LIMIT ? OFFSET ?
  `;
  const dataParams = [`%${search}%`, `%${search}%`, limit, offset];

  const packagesQuery = 'SELECT id, name, duration_days FROM packages';

  try {
    const query = (sql, params) =>
      new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

    const countResult = await query(countQuery, countParams);
    const totalUsers = countResult[0].total;
    const totalPages = Math.ceil(totalUsers / limit);

    const users = await query(dataQuery, dataParams);
    const packages = await query(packagesQuery);

    res.render('administrator/users', {
      user_id: req.session.user.id,
      users,
      search,
      currentPage: page,
      totalPages,
      packages
    });

  } catch (error) {
    console.error('Unexpected error in users controller:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.usersUpdate = async (req, res) => {
  const { id, name, role, status, package_id } = req.body;

  if (!req.session?.user) {
    return res.redirect('/login');
  }

  if (!name || !role || !status || !package_id) {
    req.flash('error', res.__('flash.All fields are required'));
    return res.redirect('/administrator/users');
  }

  const nameRegex = /^[a-zA-Z\s]{1,25}$/;
  if (!nameRegex.test(name)) {
    req.flash('error', res.__('flash.Name must be max'));
    return res.redirect('/administrator/users');
  }

  try {
  const [userRows] = await db.promise().query(
    `SELECT role, status, package_id, package_start, package_end FROM users WHERE id = ?`,
    [id]
  );

  if (userRows.length === 0) {
    req.flash('error', res.__('flash.User not found'));
    return res.redirect('/administrator/users');
  }

  const existingUser = userRows[0];

  if (existingUser.role === 'superadmin') {
    if (role !== existingUser.role || status !== existingUser.status) {
      req.flash('error', res.__('flash.Role and status of superadmin cannot be changed'));
      return res.redirect('/administrator/users');
    }

    if (parseInt(package_id) !== existingUser.package_id) {
      req.flash('error', res.__('flash.Package of superadmin cannot be changed'));
      return res.redirect('/administrator/users');
    }

    await db.promise().query(
      `UPDATE users SET name = ? WHERE id = ?`,
      [name, id]
    );

    req.flash('success', res.__('flash.Superadmin updated successfully'));
    return res.redirect('/administrator/users');
  }

  if (parseInt(package_id) === existingUser.package_id) {
      await db.promise().query(
        `UPDATE users SET name = ?, role = ?, status = ? WHERE id = ?`,
        [name, role, status, id]
      );
    } else {
      const [packageRows] = await db.promise().query(
        `SELECT duration_days FROM packages WHERE id = ?`,
        [package_id]
      );

      if (packageRows.length === 0) {
        req.flash('error', res.__('flash.Selected package not found'));
        return res.redirect('/administrator/users');
      }

      const duration = packageRows[0].duration_days;
      const now = new Date();

      const package_start = formatDateToMySQL(now);
      const package_end = duration === -1 ? null : formatDateToMySQL(new Date(now.getTime() + (duration - 1) * 86400000));

      await db.promise().query(
        `UPDATE users 
         SET name = ?, role = ?, status = ?, package_id = ?, package_start = ?, package_end = ?
         WHERE id = ?`,
        [name, role, status, package_id, package_start, package_end, id]
      );
    }

    req.flash('success', res.__('flash.User updated successfully'));
    res.redirect('/administrator/users');

  } catch (error) {
    console.error('Error updating user:', error);
    req.flash('error', res.__('flash.Server error while updating user'));
    res.redirect('/administrator/users');
  }

  function formatDateToMySQL(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }
};

exports.usersDelete = (req, res) => {
  const id = req.params.id;
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  
  if (String(req.session.user.id) === String(id)) {
    req.flash('error', res.__('flash.You cannot delete your own account'));
    return res.redirect('/administrator/users');
  }
  
  const checkQuery = `SELECT role FROM users WHERE id = ?`;
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  db.query(checkQuery, [id], (err, results) => {
    if (err) {
      console.error('Query error:', err);
      req.flash('error', res.__('flash.An error occurred while retrieving user data'));
      return res.redirect('/administrator/users');
    }

    if (results.length === 0) {
      req.flash('error', res.__('flash.User not found'));
      return res.redirect('/administrator/users');
    }

    const role = results[0].role;

    if (role === 'superadmin') {
      req.flash('error', res.__('flash.Users with the superadmin role cannot be deleted'));
      return res.redirect('/administrator/users');
    }

    const deleteQuery = `DELETE FROM users WHERE id = ?`;
    db.query(deleteQuery, [id], (err, result) => {
      if (err) {
        console.error('Delete error:', err);
        req.flash('error', res.__('flash.Failed to delete user'));
        return res.redirect('/administrator/users');
      }

      req.flash('success', res.__('flash.User has been successfully deleted'));
      res.redirect('/administrator/users');
    });
  });
};

// Devices
exports.devices = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM sessions d
      JOIN users u ON d.user_id = u.id
      WHERE u.name LIKE ? OR d.phone LIKE ?
    `;
    const countParams = [`%${search}%`, `%${search}%`];

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('Error counting devices:', err);
        return res.status(500).render('error', {
          title: res.__('error.Internal Server Error'),
          message: res.__('error.It seems there was an error'),
		});
      }

      const totalDevices = countResult[0].total;
      const totalPages = Math.ceil(totalDevices / limit);

      const dataQuery = `
        SELECT d.id, d.user_id, d.phone, d.connected, u.name as user_name
        FROM sessions d
        JOIN users u ON d.user_id = u.id
        WHERE u.name LIKE ? OR d.phone LIKE ?
        ORDER BY d.id DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [`%${search}%`, `%${search}%`, limit, offset];

      db.query(dataQuery, dataParams, (err, devices) => {
        if (err) {
          console.error('Error retrieving devices:', err);
          return res.status(500).render('error', {
            title: res.__('error.Internal Server Error'),
            message: res.__('error.It seems there was an error'),
	  	  });
        }

        res.render('administrator/devices', {
          devices,
          search,
          currentPage: page,
          totalPages
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in devices controller:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.devicesDelete = async (req, res) => {
  const phone = req.params.phone;

  if (!req.session?.user) {
    return res.redirect('/login');
  }

  try {
    await db.promise().query('DELETE FROM auto_replies WHERE session_id = ?', [phone]);
    await db.promise().query('DELETE FROM sessions WHERE phone = ?', [phone]);

    req.flash('success', res.__('flash.Sessions deleted successfully'));
  } catch (error) {
    console.error(error);
    req.flash('error', res.__('flash.Failed to delete sessions'));
  }

  res.redirect('/administrator/devices');
};

// Contact
exports.contacts = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM contacts c
      JOIN users u ON c.user_id = u.id
      WHERE u.name LIKE ? OR c.phone LIKE ?
    `;
    const countParams = [`%${search}%`, `%${search}%`];

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('Error counting contacts:', err);
        return res.status(500).render('error', {
          title: res.__('error.Internal Server Error'),
          message: res.__('error.It seems there was an error'),
        });
      }

      const totalContacts = countResult[0].total;
      const totalPages = Math.ceil(totalContacts / limit);

      const dataQuery = `
        SELECT c.id, c.user_id, c.name, c.phone, c.created_at, c.updated_at, u.name AS user_name
        FROM contacts c
        JOIN users u ON c.user_id = u.id
        WHERE u.name LIKE ? OR c.phone LIKE ?
        ORDER BY c.id DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [`%${search}%`, `%${search}%`, limit, offset];

      db.query(dataQuery, dataParams, (err, contacts) => {
        if (err) {
          console.error('Error retrieving contacts:', err);
          return res.status(500).render('error', {
            title: res.__('error.Internal Server Error'),
            message: res.__('error.It seems there was an error'),
          });
        }

        res.render('administrator/contacts', {
          contacts,
          search,
          currentPage: page,
          totalPages,
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in contacts controller:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.contactsDelete = async (req, res) => {
  const contactId = req.params.id;
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  

  try {
    const [[contact]] = await db.promise().query('SELECT * FROM contacts WHERE id = ?', [contactId]);

    if (!contact) {
      req.flash('error', res.__('flash.Contact not found'));
      return res.redirect('/administrator/contacts');
    }

    await db.promise().query('DELETE FROM contacts WHERE id = ?', [contactId]);

    req.flash('success', res.__('flash.Contact deleted successfully'));
  } catch (error) {
    console.error(error);
    req.flash('error', res.__('flash.Failed to delete contact'));
  }

  res.redirect('/administrator/contacts');
};

// File Manager
exports.files = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM uploads f
      JOIN users u ON f.user_id = u.id
      WHERE f.name LIKE ? OR u.name LIKE ?
    `;
    const countParams = [`%${search}%`, `%${search}%`];

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('Error counting files:', err);
        return res.status(500).render('error', {
          title: res.__('error.Internal Server Error'),
          message: res.__('error.It seems there was an error'),
        });
      }

      const totalFiles = countResult[0].total;
      const totalPages = Math.ceil(totalFiles / limit);

      const dataQuery = `
        SELECT f.id, f.user_id, f.name, f.size, f.path, f.created_at, u.name AS user_name
        FROM uploads f
        JOIN users u ON f.user_id = u.id
        WHERE f.name LIKE ? OR u.name LIKE ?
        ORDER BY f.id DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [`%${search}%`, `%${search}%`, limit, offset];

      db.query(dataQuery, dataParams, (err, files) => {
        if (err) {
          console.error('Error retrieving files:', err);
          return res.status(500).render('error', {
            title: res.__('error.Internal Server Error'),
            message: res.__('error.It seems there was an error'),
          });
        }

        res.render('administrator/file-manager', {
          files,
          search,
          currentPage: page,
          totalPages,
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in files controller:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.filesDelete = async (req, res) => {
  const fileId = req.params.id;
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  

  try {
    const [[file]] = await db.promise().query('SELECT * FROM uploads WHERE id = ?', [fileId]);

    if (!file) {
      req.flash('error', res.__('flash.File not found'));
      return res.redirect('/administrator/files');
    }

    const filePath = path.join(__dirname, '..', 'public', file.path);

    await fs.promises.unlink(filePath);
    await db.promise().query('DELETE FROM uploads WHERE id = ?', [fileId]);

    req.flash('success', res.__('flash.File deleted successfully'));
  } catch (error) {
    console.error(error);
    req.flash('error', res.__('flash.Failed to delete file'));
  }

  res.redirect('/administrator/files');
};

// Sending
exports.sending = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM messages
      JOIN users ON messages.user_id = users.id
      WHERE messages.phone LIKE ? OR messages.content LIKE ? OR users.name LIKE ?
    `;
    const countParams = [`%${search}%`, `%${search}%`, `%${search}%`];

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('Error counting data:', err);
        return res.status(500).render('error', {
          title: res.__('error.Internal Server Error'),
          message: res.__('error.It seems there was an error'),
        });
      }

      const totalData = countResult[0].total;
      const totalPages = Math.ceil(totalData / limit);

      const dataQuery = `
        SELECT messages.*, users.name AS user_name
        FROM messages
        JOIN users ON messages.user_id = users.id
        WHERE messages.phone LIKE ? OR messages.content LIKE ? OR users.name LIKE ?
        ORDER BY messages.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset];

      db.query(dataQuery, dataParams, (err, data) => {
        if (err) {
          console.error('Error retrieving data:', err);
          return res.status(500).render('error', {
            title: res.__('error.Internal Server Error'),
            message: res.__('error.It seems there was an error'),
          });
        }

        res.render('administrator/sending', {
          data,
          search,
          currentPage: page,
          totalPages
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in data controller:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.sendingDelete = (req, res) => {
  const messageId = req.params.id;

  if (!req.session?.user) {
    return res.redirect('/login');
  }

  db.query('DELETE FROM messages WHERE id = ?', [messageId], (err, result) => {
    if (err) {
      console.error('Delete failed:', err);
      req.flash('error', res.__('flash.Failed to delete message'));
      return res.redirect('/administrator/sending');
    }

    req.flash('success', res.__('flash.Message deleted successfully'));
    res.redirect('/administrator/sending');
  });
};

// Broadcasts
exports.broadcasts = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM broadcasts 
      JOIN users ON broadcasts.user_id = users.id
      WHERE broadcasts.phone LIKE ? OR broadcasts.content LIKE ? OR users.name LIKE ?
    `;
    const countParams = [`%${search}%`, `%${search}%`, `%${search}%`];

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('Error counting broadcasts:', err);
        return res.status(500).render('error', {
          title: res.__('error.Internal Server Error'),
          message: res.__('error.It seems there was an error'),
        });
      }

      const totalData = countResult[0].total;
      const totalPages = Math.ceil(totalData / limit);

      const dataQuery = `
        SELECT broadcasts.*, users.name AS user_name
        FROM broadcasts
        JOIN users ON broadcasts.user_id = users.id
        WHERE broadcasts.phone LIKE ? OR broadcasts.content LIKE ? OR users.name LIKE ?
        ORDER BY broadcasts.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset];

      db.query(dataQuery, dataParams, (err, data) => {
        if (err) {
          console.error('Error retrieving broadcasts:', err);
          return res.status(500).render('error', {
            title: res.__('error.Internal Server Error'),
            message: res.__('error.It seems there was an error'),
          });
        }

        res.render('administrator/broadcasts', {
          data,
          search,
          currentPage: page,
          totalPages
        });
      });
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.broadcastsDelete = (req, res) => {
  const broadcastId = req.params.id;

  if (!req.session?.user) {
    return res.redirect('/login');
  }

  db.query(
    'DELETE FROM broadcasts WHERE id = ?',
    [broadcastId],
    (err, result) => {
      if (err) {
        console.error('Delete failed:', err);
        req.flash('error', res.__('flash.Failed to delete broadcast'));
        return res.redirect('/administrator/broadcasts');
      }

      req.flash('success', res.__('flash.Broadcast deleted successfully'));
      res.redirect('/administrator/broadcasts');
    }
  );
};

// Auto Reply
exports.autoreply = (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  const countQuery = `
    SELECT COUNT(*) AS total 
    FROM auto_replies
    WHERE title LIKE ? OR prefix LIKE ? OR includes LIKE ? OR category LIKE ?
  `;
  const countParams = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];

  db.query(countQuery, countParams, (err, countResult) => {
    if (err) {
      console.error('Count error:', err);
      return res.status(500).render('error', { 
        title: res.__('error.Internal Server Error'),
        message: res.__('error.It seems there was an error'),
	  });
    }

    const totalData = countResult[0].total;
    const totalPages = Math.ceil(totalData / limit);

    const dataQuery = `
      SELECT auto_replies.*, users.name AS user_name
      FROM auto_replies
      JOIN users ON auto_replies.user_id = users.id
      WHERE title LIKE ? OR prefix LIKE ? OR includes LIKE ? OR category LIKE ?
      ORDER BY auto_replies.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...countParams, limit, offset];

    db.query(dataQuery, dataParams, (err, data) => {
      if (err) {
        console.error('Data error:', err);
        return res.status(500).render('error', { 
          title: res.__('error.Internal Server Error'),
          message: res.__('error.It seems there was an error'),
		});
      }

      res.render('administrator/auto-reply', {
        data,
        search,
        currentPage: page,
        totalPages
      });
    });
  });
};

exports.autoreplyDelete = (req, res) => {
  const replyId = req.params.id;

  if (!req.session?.user) {
    return res.redirect('/login');
  }

  db.query('DELETE FROM auto_replies WHERE id = ?', [replyId], (err, result) => {
    if (err) {
      console.error('Delete error:', err);
      req.flash('error', res.__('flash.Failed to delete auto reply'));
    } else {
      req.flash('success', res.__('flash.Auto reply deleted successfully'));
    }
    res.redirect('/administrator/auto-reply');
  });
};

// Ads
exports.ads = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  const countQuery = `
    SELECT COUNT(*) AS total 
    FROM ads
    WHERE title LIKE ? OR body LIKE ?
  `;
  const countParams = [`%${search}%`, `%${search}%`];

  const dataQuery = `
    SELECT id, title, body, media_type, thumbnail_path, source_url, created_at
    FROM ads
    WHERE title LIKE ? OR body LIKE ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  const dataParams = [`%${search}%`, `%${search}%`, limit, offset];

  try {
    const query = (sql, params) =>
      new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

    const countResult = await query(countQuery, countParams);
    const totalAds = countResult[0].total;
    const totalPages = Math.ceil(totalAds / limit);

    const adsData = await query(dataQuery, dataParams);

    res.render('administrator/ads', {
      user_id: req.session.user.id,
      search,
      currentPage: page,
      totalPages,
      ads: adsData
    });

  } catch (error) {
    console.error('Unexpected error in ads controller:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.adsAdd = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const { title, body, media_type, thumbnail_path, source_url } = req.body;

    const titleRegex = /^.{3,30}$/;
    const bodyRegex = /^.{3,50}$/;
    const urlRegex = /^https?:\/\/[\w\-\.]+\.[a-z]{2,}(\S*)?$/i;

    if (!title || !body || !media_type || !thumbnail_path || !source_url) {
      req.flash('error', res.__('flash.All fields are required'));
      return res.redirect('/administrator/ads');
    }

    if (!titleRegex.test(title)) {
      req.flash('error', res.__('flash.Title must be 3–30 characters'));
      return res.redirect('/administrator/ads');
    }

    if (!bodyRegex.test(body)) {
      req.flash('error', res.__('flash.Body must be 3–50 characters'));
      return res.redirect('/administrator/ads');
    }

    if (!urlRegex.test(thumbnail_path)) {
      req.flash('error', res.__('flash.Thumbnail URL is invalid'));
      return res.redirect('/administrator/ads');
    }

    if (!urlRegex.test(source_url)) {
      req.flash('error', res.__('flash.Source URL is invalid'));
      return res.redirect('/administrator/ads');
    }

    const sql = `
      INSERT INTO ads (title, body, media_type, thumbnail_path, source_url, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    await db.execute(sql, [title, body, media_type, thumbnail_path, source_url]);

    req.flash('success', res.__('flash.Ads added successfully'));
    res.redirect('/administrator/ads');

  } catch (err) {
    console.error('Error adding ad:', err);
    req.flash('error', res.__('flash.Failed to add ads'));
    res.redirect('/administrator/ads');
  }
};

exports.adsEdit = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const id = req.params.id;
    const { title, body, media_type, thumbnail_path, source_url } = req.body;

    if (!id) {
      req.flash('error', res.__('flash.Ads not found'));
      return res.redirect('/administrator/ads');
    }

    const titleRegex = /^.{3,30}$/;
    const bodyRegex = /^.{3,50}$/;
    const urlRegex = /^https?:\/\/[\w\-\.]+\.[a-z]{2,}(\S*)?$/i;

    if (!title || !body || !media_type || !thumbnail_path || !source_url) {
      req.flash('error', res.__('flash.All fields are required'));
      return res.redirect('/administrator/ads');
    }

    if (!titleRegex.test(title)) {
      req.flash('error', res.__('flash.Title must be 3–30 characters'));
      return res.redirect('/administrator/ads');
    }

    if (!bodyRegex.test(body)) {
      req.flash('error', res.__('flash.Body must be 3–50 characters'));
      return res.redirect('/administrator/ads');
    }

    if (!urlRegex.test(thumbnail_path)) {
      req.flash('error', res.__('flash.Thumbnail URL is invalid'));
      return res.redirect('/administrator/ads');
    }

    if (!urlRegex.test(source_url)) {
      req.flash('error', res.__('flash.Source URL is invalid'));
      return res.redirect('/administrator/ads');
    }

    const executeAsync = util.promisify(db.execute).bind(db);
    const rows = await executeAsync('SELECT * FROM ads WHERE id = ?', [id]);

    if (rows.length === 0) {
      req.flash('error', res.__('flash.Ads not found'));
      return res.redirect('/administrator/ads');
    }

    const updateSql = `
      UPDATE ads SET
        title = ?,
        body = ?,
        media_type = ?,
        thumbnail_path = ?,
        source_url = ?
      WHERE id = ?
    `;

    await executeAsync(updateSql, [title, body, media_type, thumbnail_path, source_url, id]);

    req.flash('success', res.__('flash.Ads updated successfully'));
    res.redirect('/administrator/ads');

  } catch (err) {
    console.error('Error updating ad:', err);
    req.flash('error', res.__('flash.Failed to update ads'));
    res.redirect('/administrator/ads');
  }
};

exports.adsDelete = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const id = req.params.id;

    if (!id) {
      req.flash('error', res.__('flash.Ads not found'));
      return res.redirect('/administrator/ads');
    }

    const executeAsync = util.promisify(db.execute).bind(db);

    const rows = await executeAsync('SELECT * FROM ads WHERE id = ?', [id]);
    if (rows.length === 0) {
      req.flash('error', res.__('flash.Ads not found'));
      return res.redirect('/administrator/ads');
    }

    await executeAsync('DELETE FROM ads WHERE id = ?', [id]);

    req.flash('success', res.__('flash.Ads successfully removed'));
    res.redirect('/administrator/ads');

  } catch (err) {
    console.error('Error deleting ad:', err);
    req.flash('error', res.__('flash.Failed to remove ads'));
    res.redirect('/administrator/ads');
  }
};

// Plugin
exports.plugins = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  try {
    let plugins = pluginManager.getPlugins();

    const search = (req.query.search || '').toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const limit = 25;

    if (search) {
      plugins = plugins.filter(p =>
        p.command.toLowerCase().includes(search) ||
        p.title.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search)
      );
    }

    const totalPlugins = plugins.length;
    const totalPages = Math.ceil(totalPlugins / limit);
    const offset = (page - 1) * limit;

    const paginatedPlugins = plugins.slice(offset, offset + limit);

    res.render('administrator/plugins', {
      user_id: req.session.user.id,
      plugins: paginatedPlugins,
      currentPage: page,
      totalPages,
      search
    });
  } catch (error) {
    console.error('Unexpected error in Administrator.plugins:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.pluginPreviewForm = (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const pluginsDir = path.join(__dirname, '../plugins');
  const pluginName = req.query.name;

  if (pluginName) {
    const filePath = path.join(pluginsDir, pluginName);

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Gagal baca file plugin:', err);
        req.flash('error', res.__('flash.Plugin not found'));
        return res.redirect('/administrator/plugins');
      }

      res.render('administrator/plugin-form', {
        user_id: req.session.user.id,
        code: data,
        title: pluginName,
        editing: true
      });
    });
  } else {
    const defaultCode = `const { createContextInfoPlugin } = require('../helpers/pluginContextInfo');

module.exports = {
  command: 'example', // required (use !example)
  title: 'Example Plugin',
  description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  author: 'Your Name',
  github: 'https://github.com/<username>',
  
  execute: async (msg, sock, args, phone) => {
    const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation : '';
    if (text.startsWith('!' + module.exports.command)) {
      const contextInfo = await createContextInfoPlugin(phone);
      
      //=== [START] Your Plugin Functions ===
      await sock.sendMessage(msg.key.remoteJid, { react: { 
        text: '🤖', 
        key: msg.key 
      } });

      const messagePayload = { 
        text: 'Example test Ok!' 
      };
      //=== [END] Your Plugin Functions ===
      
      if (contextInfo) messagePayload.contextInfo = contextInfo;
      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
      return;
    }
  }
};`;

    res.render('administrator/plugin-form', {
      user_id: req.session.user.id,
      code: defaultCode,
      title: '',
      editing: false
    });
  }
};

exports.addPlugin = (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const { title, code } = req.body;

  if (!title || !title.trim()) {
    req.flash('error', res.__('flash.Plugin file name is required'));
    return res.redirect('/administrator/plugins/add');
  }

  let filename = title.trim();
  if (!filename.endsWith('.js')) {
    filename += '.js';
  }

  const pluginsDir = path.join(__dirname, '../plugins');
  const filePath = path.join(pluginsDir, filename);

  if (fs.existsSync(filePath)) {
    req.flash('error', res.__('flash.The plugin file already exists'));
    return res.redirect('/administrator/plugins/add');
  }

  fs.writeFile(filePath, code, 'utf8', err => {
    if (err) {
      console.error('Failed to save plugin file:', err);
      req.flash('error', res.__('flash.Failed to save plugin file'));
      return res.redirect('/administrator/plugins/add');
    }

    req.flash('success', res.__('flash.Plugin saved successfully'));
    res.redirect('/administrator/plugins');
  });
};

exports.editPlugin = (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  let { title, code } = req.body;

  if (!title || !title.trim()) {
    req.flash('error', res.__('flash.Plugin file name is required'));
    return res.redirect(`/administrator/plugins/views?name=${encodeURIComponent(title || '')}`);
  }

  title = title.trim();
  if (!title.endsWith('.js')) {
    title += '.js';
  }

  const pluginsDir = path.join(__dirname, '../plugins');
  const filePath = path.join(pluginsDir, title);

  if (!fs.existsSync(filePath)) {
    req.flash('error', res.__('flash.Plugin file does not exist'));
    return res.redirect('/administrator/plugins');
  }

  fs.writeFile(filePath, code, 'utf8', err => {
    if (err) {
      console.error('Failed to update plugin file:', err);
      req.flash('error', res.__('flash.Failed to update plugin file'));
      return res.redirect(`/administrator/plugins/views?name=${encodeURIComponent(title)}`);
    }

    req.flash('success', res.__('flash.Plugin updated successfully'));
    res.redirect('/administrator/plugins');
  });
};

exports.deletePlugin = (req, res) => {
  const name = req.params.name;

  if (!name) {
    req.flash('error', res.__('flash.Plugin name is mandatory'));
    return res.redirect('/administrator/plugins');
  }

  const pluginsDir = path.join(__dirname, '../plugins');
  const filePath = path.join(pluginsDir, name);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      req.flash('error', res.__('flash.Plugin file not found'));
      return res.redirect('/administrator/plugins');
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Gagal hapus plugin:', err);
        req.flash('error', res.__('flash.Failed to remove plugin'));
        return res.redirect('/administrator/plugins');
      }

      // Hapus record dari database plugins
      const pluginName = name.endsWith('.js') ? name : name;
      db.query('DELETE FROM plugins WHERE name = ?', [pluginName], (err2) => {
        if (err2) {
          console.error('Gagal hapus plugin dari database:', err2);
        }

        // Bersihkan require cache agar plugin tidak load lagi
        try {
          const resolved = require.resolve(filePath);
          delete require.cache[resolved];
        } catch (_) {}

        req.flash('success', res.__('flash.Plugin successfully removed'));
        return res.redirect('/administrator/plugins');
      });
    });
  });
};

// Subscribe
exports.subscribe = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM packages
      WHERE (name LIKE ? OR description LIKE ?)
        AND name <> 'ADMIN'
    `;
    const countParams = [`%${search}%`, `%${search}%`];

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('Error counting packages:', err);
        return res.status(500).render('error', {
          title: res.__('error.Internal Server Error'),
          message: res.__('error.It seems there was an error'),
        });
      }

      const totalPackages = countResult[0].total;
      const totalPages = Math.ceil(totalPackages / limit);

      const dataQuery = `
        SELECT id, name, duration_days, price, description
        FROM packages
        WHERE (name LIKE ? OR description LIKE ?)
          AND name <> 'ADMIN'
        ORDER BY price ASC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [`%${search}%`, `%${search}%`, limit, offset];

      db.query(dataQuery, dataParams, (err, packages) => {
        if (err) {
          console.error('Error retrieving packages:', err);
          return res.status(500).render('error', {
            title: res.__('error.Internal Server Error'),
            message: res.__('error.It seems there was an error'),
          });
        }

        res.render('administrator/subscribe', {
          package: packages,
          search,
          currentPage: page,
          totalPages,
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in subscribe controller:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.addSubscribe = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const { name, duration_days, price, description } = req.body;

    if (!name || name.length < 3 || name.length > 100) {
      req.flash('error', res.__('flash.Name must be between 3 and 100 characters'));
      return res.redirect('/administrator/subscribe');
    }

    const duration = Number(duration_days);
    if (!duration_days || isNaN(duration) || duration < 1) {
      req.flash('error', res.__('flash.Duration must be a number and at least 1 day'));
      return res.redirect('/administrator/subscribe');
    }

    const priceNumber = Number(price);
    if (
      price == null ||
      isNaN(priceNumber) ||
      priceNumber < 0 ||
      !/^\d+(\.\d{1,2})?$/.test(price.toString())
    ) {
      req.flash('error', res.__('flash.Price must be a positive number or zero'));
      return res.redirect('/administrator/subscribe');
    }

    const sql = `INSERT INTO packages (name, duration_days, price, description) VALUES (?, ?, ?, ?)`;
    await db.promise().execute(sql, [name, duration, priceNumber, description || '']);

    req.flash('success', res.__('flash.Subscribe successfully added'));
    res.redirect('/administrator/subscribe');
  } catch (err) {
    console.error('Error adding subscribe:', err);
    req.flash('error', res.__('flash.Failed to add subscribe'));
    res.redirect('/administrator/subscribe');
  }
};

exports.editSubscribe = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const id = req.params.id;
    const { name, duration_days, price, description } = req.body;

    if (!name || name.length < 3 || name.length > 100) {
      req.flash('error', res.__('flash.Name must be between 3 and 100 characters'));
      return res.redirect('/administrator/subscribe');
    }

    const duration = Number(duration_days);
    if (!duration_days || isNaN(duration) || duration < 1) {
      req.flash('error', res.__('flash.Duration must be a number and at least 1 day'));
      return res.redirect('/administrator/subscribe');
    }

    const priceNumber = Number(price);
    if (
      price == null ||
      isNaN(priceNumber) ||
      priceNumber < 0 ||
      !/^\d+(\.\d{1,2})?$/.test(price.toString())
    ) {
      req.flash('error', res.__('flash.Price must be a positive number or zero'));
      return res.redirect('/administrator/subscribe');
    }

    const [rows] = await db.promise().execute('SELECT * FROM packages WHERE id = ?', [id]);
    if (rows.length === 0) {
      req.flash('error', res.__('flash.Subscribe not found'));
      return res.redirect('/administrator/subscribe');
    }

    const sql = `UPDATE packages SET name = ?, duration_days = ?, price = ?, description = ? WHERE id = ?`;
    await db.promise().execute(sql, [name, duration, priceNumber, description || '', id]);

    req.flash('success', res.__('flash.Subscribe successfully updated'));
    res.redirect('/administrator/subscribe');
  } catch (err) {
    console.error('Error updating subscribe:', err);
    req.flash('error', res.__('flash.Failed to update subscribe'));
    res.redirect('/administrator/subscribe');
  }
};

exports.deleteSubscribe = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const id = req.params.id;

    const [rows] = await db.promise().execute('SELECT * FROM packages WHERE id = ?', [id]);
    if (rows.length === 0) {
      req.flash('error', res.__('flash.Subscribe not found'));
      return res.redirect('/administrator/subscribe');
    }

    const sql = `DELETE FROM packages WHERE id = ?`;
    await db.promise().execute(sql, [id]);

    req.flash('success', res.__('flash.Subscribe successfully deleted'));
    res.redirect('/administrator/subscribe');
  } catch (err) {
    console.error('Error deleting subscribe:', err);
    req.flash('error', res.__('flash.Failed to delete subscribe'));
    res.redirect('/administrator/subscribe');
  }
};

exports.language = async (req, res) => {
  function flattenObject(obj, prefix = '') {
    return Object.keys(obj).reduce((acc, k) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        Object.assign(acc, flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  }

  try {
    const langFilePath = path.join(__dirname, '../locales/lang.json');
    const langMap = JSON.parse(fs.readFileSync(langFilePath, 'utf-8'));
    const locales = Object.keys(langMap);

    const translations = {};
    for (const locale of locales) {
      const filePath = path.join(__dirname, '../locales', `${locale}.json`);
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        translations[locale] = flattenObject(raw);
      } else {
        translations[locale] = {};
      }
    }

    const search = (req.query.search || '').toLowerCase();
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = 25;

    const allKeysSet = new Set();
    Object.values(translations).forEach(langObj => {
      Object.keys(langObj).forEach(key => allKeysSet.add(key));
    });
    let allKeys = Array.from(allKeysSet);

    if (search) {
      allKeys = allKeys.filter(key => {
        const enText = (translations['en'] && translations['en'][key]) ? translations['en'][key].toLowerCase() : '';
        return key.toLowerCase().includes(search) || enText.includes(search);
      });
    }

    const totalKeys = allKeys.length;
    const totalPages = Math.ceil(totalKeys / perPage);
    const startIndex = (page - 1) * perPage;
    const paginatedKeys = allKeys.slice(startIndex, startIndex + perPage);

    res.render('administrator/language', {
      user_name: req.session.user?.name || 'User',
      languages: langMap,
      translations,
      keys: paginatedKeys,
      search,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Failed to load languages:', error);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};

exports.editLanguage = (req, res) => {
  const { key, locale, value } = req.body;

  if (!key || !locale) {
    req.flash('error', res.__('flash.Missing key or locale'));
    return res.redirect('/administrator/language');
  }

  if (locale === 'en') {
    req.flash('error', res.__('flash.Editing the default language (EN) is not allowed'));
    return res.redirect('/administrator/language');
  }

  try {
    const langFilePath = path.join(__dirname, '../locales', `${locale}.json`);
    if (!fs.existsSync(langFilePath)) {
      req.flash('error', res.__('flash.Language file not found'));
      return res.redirect('/administrator/language');
    }

    const raw = JSON.parse(fs.readFileSync(langFilePath, 'utf-8'));

    function setNested(obj, path, val) {
      const keys = path.split('.');
      let cur = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!cur[keys[i]]) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = val;
    }

    setNested(raw, key, value);

    fs.writeFileSync(langFilePath, JSON.stringify(raw, null, 2), 'utf-8');

    req.flash('success', res.__('flash.Translation updated successfully', locale));
    res.redirect('/administrator/language');
  } catch (error) {
    console.error('Failed to update language file:', error);
    req.flash('error', res.__('flash.Server error while updating language'));
    res.redirect('/administrator/language');
  }
};

exports.reports = async (req, res) => {
  const query = util.promisify(db.query).bind(db);
  
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.redirect('/login');
    }

    const search = req.query.search ? req.query.search.trim() : '';
    const currentPage = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (currentPage - 1) * perPage;

    const searchCondition = search
      ? `AND (title LIKE ? OR content LIKE ?)`
      : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM reports
      JOIN users ON reports.user_id = users.id
      WHERE reports.user_id = ? ${searchCondition}
    `;

    const countParams = search
      ? [userId, `%${search}%`, `%${search}%`]
      : [userId];

    const countResult = await query(countQuery, countParams);
    const totalReports = countResult[0].total;
    const totalPages = Math.max(1, Math.ceil(totalReports / perPage));

    const dataQuery = `
      SELECT reports.id, reports.user_id, users.name, reports.title, reports.category, reports.content, reports.status, reports.created_at
      FROM reports
      JOIN users ON reports.user_id = users.id
      WHERE reports.user_id = ? ${searchCondition}
      ORDER BY reports.created_at DESC
      LIMIT ? OFFSET ?
    `;


    const dataParams = search
      ? [userId, `%${search}%`, `%${search}%`, perPage, offset]
      : [userId, perPage, offset];

    const reports = await query(dataQuery, dataParams);

    res.render('administrator/reports', {
      reports,
      search,
      currentPage,
      totalPages
    });

  } catch (error) {
    console.error('Failed to get reports:', error);
    res.render('dashboard/reports', {
      reports: [],
      search: '',
      currentPage: 1,
      totalPages: 1
    });
  }
};

exports.editResponse = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.redirect('/login');
    }

    const id = req.body.id;
    const response = req.body.response;
    const status = req.body.status;

    if (!id || !response || !status) {
      req.flash('error', res.__('flash.All fields are required'));
      return res.redirect('/administrator/reports');
    }
	
	const allowedStatuses = ['Pending', 'Rejected', 'Completed'];
    if (!allowedStatuses.includes(status)) {
      req.flash('error', res.__('flash.Invalid status'));
      return res.redirect('/administrator/reports');
    }

    const [result] = await db.promise().query(
      'UPDATE reports SET response = ?, status = ? WHERE id = ?',
      [response, status, id]
    );

    if (result.affectedRows === 0) {
      req.flash('error', res.__('flash.No report found'));
      return res.redirect('/administrator/reports');
    }

    req.flash('success', res.__('flash.Successfully replied to the report'));
    res.redirect('/administrator/reports');
  } catch (error) {
    console.error('Failed to reply:', error);
    req.flash('error', res.__('flash.Failed to reply'));
    res.redirect('/administrator/reports');
  }
};

exports.deleteResponse = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.redirect('/login');
    }

    const id = req.params.id;
    if (!id) {
      req.flash('error', res.__('flash.All fields are required'));
      return res.redirect('/administrator/reports');
    }

    const [result] = await db.promise().query(
      'DELETE FROM reports WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      req.flash('error', res.__('flash.No report found'));
      return res.redirect('/administrator/reports');
    }

    req.flash('success', res.__('flash.Report successfully deleted'));
    res.redirect('/administrator/reports');
  } catch (error) {
    console.error('Failed to delete report:', error);
    req.flash('error', res.__('flash.Failed to delete report'));
    res.redirect('/administrator/reports');
  }
};
