const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const db = require('../config/MySQL');

const pluginsDir = path.join(__dirname, '../plugins');
let pluginsCache = [];

function loadPlugin(file) {
  try {
    const pluginPath = path.join(pluginsDir, file);
    delete require.cache[require.resolve(pluginPath)];
    const pluginModule = require(pluginPath);

    return {
      name: file,
      command: pluginModule.command || '',
      title: pluginModule.title || '',
      description: pluginModule.description || '',
      author: pluginModule.author || '',
      github: pluginModule.github || ''
    };
  } catch (err) {
    // console.error(`Gagal baca plugin ${file}:`, err);
    return null;
  }
}

function loadAllPlugins() {
  const files = fs.readdirSync(pluginsDir);
  pluginsCache = files
    .filter(f => f.endsWith('.js'))
    .map(loadPlugin)
    .filter(p => p !== null);
}

loadAllPlugins();

const watcher = chokidar.watch(pluginsDir, {
  ignoreInitial: true
});

watcher.on('add', filePath => {
  const file = path.basename(filePath);
  if (file.endsWith('.js')) {
    const plugin = loadPlugin(file);
    if (plugin) {
      pluginsCache.push(plugin);
      console.log(`[PluginManager] Add: ${file} (cache: ${pluginsCache.length})`);
    }
  }
});

watcher.on('change', filePath => {
  const file = path.basename(filePath);
  if (file.endsWith('.js')) {
    const plugin = loadPlugin(file);
    if (plugin) {
      const idx = pluginsCache.findIndex(p => p.command === plugin.command);
      if (idx !== -1) {
        pluginsCache[idx] = plugin;
        console.log(`[PluginManager] Change: ${file} (cache: ${pluginsCache.length})`);
      } else {
        pluginsCache.push(plugin);
        console.log(`[PluginManager] Change (new): ${file} (cache: ${pluginsCache.length})`);
      }
    }
  }
});

watcher.on('unlink', filePath => {
  const file = path.basename(filePath);
  if (file.endsWith('.js')) {
    const before = pluginsCache.length;
    pluginsCache = pluginsCache.filter(p => p.name !== file);
    console.log(`[PluginManager] Unlink: ${file} (cache: ${before} -> ${pluginsCache.length})`);
    // Bersihkan dari database juga
    db.query('DELETE FROM plugins WHERE name = ?', [file], (err) => {
      if (err) console.error('Gagal hapus plugin dari database:', err);
    });
  }
});

function getPlugins() {
  return pluginsCache;
}

module.exports = { getPlugins };
