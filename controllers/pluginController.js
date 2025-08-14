const pluginService = require('../services/pluginService');
const db = require('../config/MySQL');

async function getPluginEnableList(pluginName) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT enable FROM plugins WHERE name = ? LIMIT 1';
    db.query(sql, [pluginName], (err, results) => {
      if (err) return reject(err);
      if (results.length === 0) return resolve(null);
      const enable = results[0].enable || '';
      const list = enable === '' ? [] : enable.split(',').map(x => x.trim());
      resolve(list);
    });
  });
}

async function updatePluginEnableList(pluginName, enableList) {
  return new Promise((resolve, reject) => {
    const newEnable = enableList.join(',');
    const sql = 'UPDATE plugins SET enable = ? WHERE name = ?';
    db.query(sql, [newEnable, pluginName], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function getSessionByUserId(userId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, phone, connected FROM sessions WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

exports.index = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) return res.redirect('/login');

    const userSessions = await getSessionByUserId(userId);
    const plugins = pluginService.getPlugins();

    const search = req.query.search?.toLowerCase() || '';

    const filteredPlugins = plugins.filter(plugin =>
      plugin.title?.toLowerCase().includes(search) ||
      plugin.description?.toLowerCase().includes(search)
    );

    const pluginList = await Promise.all(filteredPlugins.map(async plugin => {
      const enableList = await getPluginEnableList(plugin.fileName) || [];

      const sessions = userSessions.filter(sess => sess.connected === 1).map(sess => ({
        sessionId: sess.id,
        phone: sess.phone,
        connected: true,
        enabled: enableList.includes(String(sess.id))
      }));

      return {
        fileName: plugin.fileName,
        command: plugin.command || 'N/A',
        title: plugin.title || 'N/A',
        description: plugin.description || 'N/A',
        author: plugin.author || 'N/A',
        github: plugin.github || '#',
        sessions
      };
    }));

    res.render('dashboard/plugin', {
      plugins: pluginList,
      search,
      // pagination dihapus
    });

  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};


exports.enablePlugin = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { pluginName, sessionId, enable } = req.body;
    if (!pluginName || !sessionId || typeof enable === 'undefined') {
      return res.status(400).json({ error: 'pluginName, sessionId, and enable are required' });
    }

    const userSessions = await getSessionByUserId(userId);
    const sessionIds = userSessions.map(s => String(s.id));
    if (!sessionIds.includes(String(sessionId))) {
	  return res.status(403).render('error', {
        title: res.__('error.Forbidden'),
        message: res.__('error.Access to this page'),
      });
    }

    const enableList = await getPluginEnableList(pluginName);
    if (enableList === null) 
	return res.status(404).render('error', {
      title: res.__('error.Not Found'),
      message: res.__('error.The page you are looking for was not found'),
    });

    const sessionIdStr = String(sessionId);

    if (enable) {
      if (!enableList.includes(sessionIdStr)) {
        enableList.push(sessionIdStr);
      }
    } else {
      const idx = enableList.indexOf(sessionIdStr);
      if (idx !== -1) {
        enableList.splice(idx, 1);
      }
    }

    await updatePluginEnableList(pluginName, enableList);

    return res.json({ success: true, enableList });
  } catch (err) {
    console.error(err);
	return res.status(500).render('error', {
      title: res.__('error.Internal Server Error'),
      message: res.__('error.It seems there was an error'),
    });
  }
};
