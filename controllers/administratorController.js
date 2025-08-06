const db = require('../config/Mysql');
const fs = require('fs');
const path = require('path');

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
      title: '500 Internal Server Error',
      message: 'Server Error',
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

  try {
    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM users 
      WHERE name LIKE ? OR email LIKE ?
    `;
    const countParams = [`%${search}%`, `%${search}%`];

    db.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('Error counting users:', err);
        return res.status(500).render('error', {
		  title: '500 Internal Server Error',
		  message: 'Server Error',
		});
      }

      const totalUsers = countResult[0].total;
      const totalPages = Math.ceil(totalUsers / limit);

      const dataQuery = `
        SELECT id, name, email, role, status 
        FROM users 
        WHERE name LIKE ? OR email LIKE ?
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [`%${search}%`, `%${search}%`, limit, offset];

      db.query(dataQuery, dataParams, (err, users) => {
        if (err) {
          console.error('Error retrieving users:', err);
          return res.status(500).render('error', {
		    title: '500 Internal Server Error',
		    message: 'Server Error',
		  });
        }

        res.render('administrator/users', {
          user_id: req.session.user.id,
          users,
          search,
          currentPage: page,
          totalPages
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in users controller:', error);
    res.status(500).render('error', {
      title: '500 Internal Server Error',
      message: 'Server Error',
    });
  }
};

exports.usersUpdate = (req, res) => {
  const { id, name, role, status } = req.body;
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  if (!name || !role || !status) {
    req.flash('error', 'All fields are required!');
    return res.redirect('/administrator/users');
  }

  const nameRegex = /^[a-zA-Z\s]{1,25}$/;
  if (!nameRegex.test(name)) {
    req.flash('error', 'Name must be max 25 characters and contain only letters and spaces.');
    return res.redirect('/administrator/users');
  }

  const getUserQuery = `SELECT role, status FROM users WHERE id = ?`;
  db.query(getUserQuery, [id], (err, results) => {
    if (err || results.length === 0) {
      console.error(err);
      req.flash('error', 'User not found.');
      return res.redirect('/administrator/users');
    }

    const existingRole = results[0].role;
    const existingStatus = results[0].status;

    if (existingRole === 'superadmin') {
      if (role !== existingRole || status !== existingStatus) {
        req.flash('error', 'Role and status of superadmin cannot be changed.');
        return res.redirect('/administrator/users');
      }
      const updateQuery = `UPDATE users SET name = ? WHERE id = ?`;
      const params = [name, id];

      db.query(updateQuery, params, (updateErr, result) => {
        if (updateErr) {
          console.error(updateErr);
          req.flash('error', 'Failed to update user data.');
          return res.redirect('/administrator/users');
        }

        req.flash('success', 'User name updated successfully.');
        return res.redirect('/administrator/users');
      });
    } else {
      const updateQuery = `UPDATE users SET name = ?, role = ?, status = ? WHERE id = ?`;
      const params = [name, role, status, id];

      db.query(updateQuery, params, (updateErr, result) => {
        if (updateErr) {
          console.error(updateErr);
          req.flash('error', 'Failed to update user data.');
          return res.redirect('/administrator/users');
        }

        req.flash('success', 'User updated successfully.');
        return res.redirect('/administrator/users');
      });
    }
  });
};

exports.usersDelete = (req, res) => {
  const id = req.params.id;
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  
  if (String(req.session.user.id) === String(id)) {
    req.flash('error', 'You cannot delete your own account.');
    return res.redirect('/administrator/users');
  }
  
  const checkQuery = `SELECT role FROM users WHERE id = ?`;
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  db.query(checkQuery, [id], (err, results) => {
    if (err) {
      console.error('Query error:', err);
      req.flash('error', 'An error occurred while retrieving user data.');
      return res.redirect('/administrator/users');
    }

    if (results.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/administrator/users');
    }

    const role = results[0].role;

    if (role === 'superadmin') {
      req.flash('error', 'Users with the superadmin role cannot be deleted.');
      return res.redirect('/administrator/users');
    }

    const deleteQuery = `DELETE FROM users WHERE id = ?`;
    db.query(deleteQuery, [id], (err, result) => {
      if (err) {
        console.error('Delete error:', err);
        req.flash('error', 'Failed to delete user.');
        return res.redirect('/administrator/users');
      }

      req.flash('success', 'User has been successfully deleted.');
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
		  title: '500 Internal Server Error',
		  message: 'Server Error',
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
		    title: '500 Internal Server Error',
		    message: 'Server Error',
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
      title: '500 Internal Server Error',
      message: 'Server Error',
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

    req.flash('success', 'Sessions deleted successfully.');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Failed to delete sessions.');
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
          title: '500 Internal Server Error',
          message: 'Server Error',
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
            title: '500 Internal Server Error',
            message: 'Server Error',
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
      title: '500 Internal Server Error',
      message: 'Server Error',
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
      req.flash('error', 'Contact not found.');
      return res.redirect('/administrator/contacts');
    }

    await db.promise().query('DELETE FROM contacts WHERE id = ?', [contactId]);

    req.flash('success', 'Contact deleted successfully.');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Failed to delete contact.');
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
          title: '500 Internal Server Error',
          message: 'Server Error',
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
            title: '500 Internal Server Error',
            message: 'Server Error',
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
      title: '500 Internal Server Error',
      message: 'Server Error',
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
      req.flash('error', 'File not found.');
      return res.redirect('/administrator/files');
    }

    const filePath = path.join(__dirname, '..', 'public', file.path);

    await fs.promises.unlink(filePath);
    await db.promise().query('DELETE FROM uploads WHERE id = ?', [fileId]);

    req.flash('success', 'File deleted successfully.');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Failed to delete file.');
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
          title: '500 Internal Server Error',
          message: 'Server Error',
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
            title: '500 Internal Server Error',
            message: 'Server Error',
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
      title: '500 Internal Server Error',
      message: 'Server Error',
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
      req.flash('error', 'Failed to delete message');
      return res.redirect('/administrator/sending');
    }

    req.flash('success', 'Message deleted successfully!');
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
          title: 'Server Error',
          message: 'Failed to count broadcasts'
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
            title: 'Server Error',
            message: 'Failed to fetch broadcasts'
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
      title: 'Server Error',
      message: 'Unexpected error occurred'
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
        req.flash('error', 'Failed to delete broadcast');
        return res.redirect('/administrator/broadcasts');
      }

      req.flash('success', 'Broadcast deleted successfully');
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
      return res.status(500).render('error', { title: 'Server Error', message: 'Failed to count auto replies' });
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
        return res.status(500).render('error', { title: 'Server Error', message: 'Failed to fetch auto replies' });
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
      req.flash('error', 'Failed to delete auto reply');
    } else {
      req.flash('success', 'Auto reply deleted successfully');
    }
    res.redirect('/administrator/auto-reply');
  });
};
