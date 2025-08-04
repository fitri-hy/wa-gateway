const db = require('../config/Mysql');

function formatDate(date) {
  const d = new Date(date);
  const pad = (n) => n.toString().padStart(2, '0');

  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}


function replaceEmptyWithDash(obj) {
  const newObj = {};
  for (const key in obj) {
    const value = obj[key];
    newObj[key] = (value === null || value === '' || value === undefined) ? '-' : value;
  }
  return newObj;
}

exports.index = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.redirect('/login');

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
        const [rows] = await promiseDb.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
        return { table: toTitleCase(table), count: rows[0].count };
      })
    );

    const latestData = {};
    await Promise.all(
      tables.map(async (table) => {
        let rows = [];

        switch(table) {
          case 'auto_replies':
			rows = (await promiseDb.query(`
			  SELECT ar.*, u.name AS user_name, s.phone AS session_phone
			  FROM auto_replies ar
			  LEFT JOIN users u ON ar.user_id = u.id
			  LEFT JOIN sessions s ON ar.session_id = s.id
			  ORDER BY ar.created_at DESC
			  LIMIT 10
			`))[0];

			rows = rows.map(({id, user_id, session_id, session_phone, ...rest}) => {
			  if (rest.created_at) {
				rest.created_at = formatDate(rest.created_at);
			  }
			  rest.session_id = session_phone || '-';
			  return replaceEmptyWithDash(rest);
			});
            break;

          case 'broadcasts':
            rows = (await promiseDb.query(`
              SELECT b.*, u.name AS user_name, s.phone AS session_phone
              FROM broadcasts b
              LEFT JOIN users u ON b.user_id = u.id
              LEFT JOIN sessions s ON b.session = s.id
              ORDER BY b.created_at DESC
              LIMIT 10
            `))[0];
			rows = rows.map(({ id, user_id, session, session_phone, ...rest }) => {
			  if (rest.created_at) {
				rest.created_at = formatDate(rest.created_at);
			  }
			  return replaceEmptyWithDash(rest);
			});
            break;

          case 'contacts':
            rows = (await promiseDb.query(`
              SELECT c.*, u.name AS user_name
              FROM contacts c
              LEFT JOIN users u ON c.user_id = u.id
              ORDER BY c.created_at DESC
              LIMIT 10
            `))[0];
			rows = rows.map(({id, user_id, updated_at, ...rest}) => {
			  if (rest.created_at) {
				rest.created_at = formatDate(rest.created_at);
			  }
			  return replaceEmptyWithDash(rest);
			});
            break;

          case 'messages':
            rows = (await promiseDb.query(`
              SELECT m.*, u.name AS user_name, s.phone AS session_phone
              FROM messages m
              LEFT JOIN users u ON m.user_id = u.id
              LEFT JOIN sessions s ON m.session = s.id
              ORDER BY m.created_at DESC
              LIMIT 10
            `))[0];
			rows = rows.map(({ id, user_id, session, session_phone, ...rest }) => {
			  if (rest.created_at) {
				rest.created_at = formatDate(rest.created_at);
			  }
			  return replaceEmptyWithDash(rest);
			});
            break;

          case 'sessions':
            rows = (await promiseDb.query(`
              SELECT s.*, u.name AS user_name
              FROM sessions s
              LEFT JOIN users u ON s.user_id = u.id
              ORDER BY s.id DESC
              LIMIT 10
            `))[0];
			rows = rows.map(({id, user_id, ...rest}) => {
			  if (rest.created_at) {
				rest.created_at = formatDate(rest.created_at);
			  }

			  if ('connected' in rest) {
				rest.connected = rest.connected === 1 ? 'Connected' : 'Disconnected';
			  }

			  return replaceEmptyWithDash(rest);
			});
            break;

          case 'uploads':
            rows = (await promiseDb.query(`
              SELECT up.*, u.name AS user_name
              FROM uploads up
              LEFT JOIN users u ON up.user_id = u.id
              ORDER BY up.created_at DESC
              LIMIT 10
            `))[0];
			rows = rows.map(({id, user_id, ...rest}) => {
			  if (rest.created_at) {
				rest.created_at = formatDate(rest.created_at);
			  }
			  return replaceEmptyWithDash(rest);
			});
            break;

          case 'users':
            rows = (await promiseDb.query(`
              SELECT *
              FROM users
              ORDER BY id DESC
              LIMIT 10
            `))[0];
            rows = rows.map(({id, password, token, ...rest}) => rest);
            break;

          case 'plugins':
            rows = (await promiseDb.query(`
              SELECT *
              FROM plugins
              ORDER BY id DESC
              LIMIT 10
            `))[0];

            for (let i = 0; i < rows.length; i++) {
              const enableIds = rows[i].enable ? rows[i].enable.split(',').map(id => id.trim()).filter(id => id) : [];
              if (enableIds.length > 0) {
                const placeholders = enableIds.map(() => '?').join(',');
                const [sessions] = await promiseDb.query(`
                  SELECT phone FROM sessions WHERE id IN (${placeholders})
                `, enableIds);

                rows[i].enable = sessions.map(s => s.phone).join(', ');
              } else {
                rows[i].enable = '-';
              }

              const { id, user_id, ...rest } = rows[i];
              rows[i] = rest;
            }
            break;

          default:
            const [columns] = await promiseDb.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'created_at'`);
            let orderColumn = 'id';
            if (columns.length > 0) orderColumn = 'created_at';

            rows = (await promiseDb.query(`
              SELECT * FROM \`${table}\`
              ORDER BY \`${orderColumn}\` DESC
              LIMIT 10
            `))[0];
			rows = rows.map(({id, user_id, ...rest}) => {
			  if (rest.created_at) {
				rest.created_at = formatDate(rest.created_at);
			  }
			  return replaceEmptyWithDash(rest);
			});
        }

        latestData[toTitleCase(table)] = rows;
      })
    );

    const total = counts.reduce((acc, item) => acc + item.count, 0);

    res.render('administrator/index', {
      user_name: req.session.user.name,
      total,
      counts,
      latestData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
	  message: 'Server Error'
	});
  }
};
