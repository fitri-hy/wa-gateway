const db = require('../config/Mysql');

exports.index = async (req, res) => {
  if (!req.session?.user) {
    return res.redirect('/login');
  }

  const userId = req.session.user.id;

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