const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

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
    console.error(`Gagal baca plugin ${file}:`, err);
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
      console.log(`Plugin ditambahkan: ${file}`);
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
        console.log(`Plugin diupdate: ${file}`);
      } else {
        pluginsCache.push(plugin);
        console.log(`Plugin ditambahkan saat update: ${file}`);
      }
    }
  }
});

watcher.on('unlink', filePath => {
  const file = path.basename(filePath);
  if (file.endsWith('.js')) {
    pluginsCache = pluginsCache.filter(p => p.command !== path.parse(file).name);
    console.log(`Plugin dihapus: ${file}`);
  }
});

function getPlugins() {
  return pluginsCache;
}

module.exports = { getPlugins };
