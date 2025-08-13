const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const db = require('../config/MySQL');
const { installDependenciesIfNeeded } = require('../services/installDependency');

const pluginsDir = path.join(__dirname, '../plugins');
let plugins = [];

let lastAllowedPhonesCache = {};
let skipPlugins = new Set();

function findPluginIndex(fileName) {
  return plugins.findIndex(p => p.fileName === fileName);
}

async function insertPluginIfNotExists(name) {
  const cleanName = name.trim();
  return new Promise((resolve, reject) => {
    const sqlInsert = `
      INSERT INTO plugins (name) VALUES (?)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `;
    db.query(sqlInsert, [cleanName], (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

async function cleanPluginEnableValues() {
  return new Promise((resolve, reject) => {
    const sqlGetPlugins = 'SELECT id, enable FROM plugins';
    db.query(sqlGetPlugins, (err, plugins) => {
      if (err) return reject(err);

      const sqlGetSessions = 'SELECT id FROM sessions';
      db.query(sqlGetSessions, (err2, sessions) => {
        if (err2) return reject(err2);

        const validSessionIds = sessions.map(s => s.id.toString());

        const updates = [];

        for (const plugin of plugins) {
          if (!plugin.enable) continue;

          const enableIds = plugin.enable.split(',').map(s => s.trim());
          const filteredIds = enableIds.filter(id => validSessionIds.includes(id));

          if (filteredIds.join(',') !== plugin.enable) {
            updates.push(new Promise((res, rej) => {
              const newEnable = filteredIds.join(',');
              const sqlUpdate = 'UPDATE plugins SET enable = ? WHERE id = ?';
              db.query(sqlUpdate, [newEnable, plugin.id], (err3) => {
                if (err3) return rej(err3);
                res();
              });
            }));
          }
        }

        Promise.all(updates)
          .then(() => resolve())
          .catch(reject);
      });
    });
  });
}

async function getEnabledSessionsForPlugin(pluginName) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT s.phone FROM plugins p
      JOIN sessions s ON FIND_IN_SET(s.id, p.enable)
      WHERE p.name = ?
    `;
    db.query(sql, [pluginName], (err, results) => {
      if (err) return reject(err);
      const phones = results.map(r => r.phone);
      resolve(phones);
    });
  });
}

async function syncPluginsDB() {
  return new Promise((resolve, reject) => {
    const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));

    const sql = 'SELECT id, name FROM plugins ORDER BY id DESC';
    db.query(sql, (err, results) => {
      if (err) return reject(err);

      const dbPluginNames = results.map(r => r.name);
      const toDelete = dbPluginNames.filter(dbName => !files.includes(dbName));

      if (toDelete.length === 0) {
        return resolve();
      }

      const placeholders = toDelete.map(() => '?').join(',');
      const deleteSql = `DELETE FROM plugins WHERE name IN (${placeholders})`;

      db.query(deleteSql, toDelete, (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

async function reloadSinglePlugin(file) {
  if (skipPlugins.has(file)) {
    console.warn(`[Plugin] Skip ${file} karena sebelumnya error`);
    return;
  }
  
  try {
    const pluginPath = path.join(pluginsDir, file);
	
	await installDependenciesIfNeeded(pluginPath);
	
    delete require.cache[require.resolve(pluginPath)];

    const pluginModule = require(pluginPath);

    if (pluginModule && typeof pluginModule.execute === 'function') {
      const allowedPhones = await getEnabledSessionsForPlugin(file);

      const index = findPluginIndex(file);
      if (index !== -1) {
        plugins[index] = pluginModule;
        plugins[index].fileName = file;
        plugins[index].allowedPhones = allowedPhones;
      } else {
        pluginModule.fileName = file;
        pluginModule.allowedPhones = allowedPhones;
        plugins.push(pluginModule);
      }

      lastAllowedPhonesCache[file] = allowedPhones;

      await insertPluginIfNotExists(file);

      //console.log(`[Plugin] Plugin ${file} was successfully reloaded and allowedPhones was updated.`);
    } else {
      console.warn(`[Plugin] Plugin file ${file} does not have execute() function.`);
    }
  } catch (err) {
    console.error(`[Plugin] Error reload plugin ${file}: ${err.message}`);
	skipPlugins.add(file);
  }
}

async function loadPlugins() {
  plugins = [];
  
  await cleanPluginEnableValues();

  await syncPluginsDB();

  const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));

  for (const file of files) {
    await reloadSinglePlugin(file);
  }

  return plugins;
}

async function checkAndReloadPluginsIfNeeded() {
  try {
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const phones = await getEnabledSessionsForPlugin(file);
      const cached = lastAllowedPhonesCache[file] || [];

      if (
        phones.length !== cached.length ||
        phones.some((p, i) => p !== cached[i])
      ) {
        //console.log(`[Plugin] Changes detected in plugin ${file}, just reload this plugin.`);
        await reloadSinglePlugin(file);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

async function cleanAndReloadIfNeeded() {
  try {
    await cleanPluginEnableValues();
    await checkAndReloadPluginsIfNeeded();
  } catch (err) {
    console.error('Error:', err);
  }
}

loadPlugins();

chokidar.watch(pluginsDir).on('all', async (event, filePath) => {
  if (filePath.endsWith('.js')) {
    const file = path.basename(filePath);
    //console.log(`[Plugin Watcher] ${event}: ${file}`);
    await reloadSinglePlugin(file);
  }
});

setInterval(checkAndReloadPluginsIfNeeded, 10 * 1000);
setInterval(cleanAndReloadIfNeeded, 10 * 1000);

module.exports = {
  getPlugins: () => plugins,
  loadPlugins,
};
