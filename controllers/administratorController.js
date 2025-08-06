const db = require('../config/Mysql');

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
      message: 'Server Error',
    });
  }
};

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
        return res.status(500).render('error', { message: 'Database error' });
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
          return res.status(500).render('error', { message: 'Database error' });
        }

        res.render('administrator/users', {
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
      message: 'Server Error',
    });
  }
};

exports.usersUpdate = (req, res) => {
  const { id, name, role, status } = req.body;
  const query = `UPDATE users SET name=?, role=?, status=? WHERE id=?`;

  db.query(query, [name, role, status, id], (err, result) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Failed to update user data.');
      return res.redirect('/administrator/users');
    }

    req.flash('success', 'User updated successfully.');
    res.redirect('/administrator/users');
  });
};

exports.usersDelete = (req, res) => {
  const id = req.params.id;
  const checkQuery = `SELECT role FROM users WHERE id = ?`;

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

    if (role === 'admin') {
      req.flash('error', 'Users with admin role cannot be deleted.');
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
