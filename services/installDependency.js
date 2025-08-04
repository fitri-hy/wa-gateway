const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function installDependenciesIfNeeded(pluginPath) {
  return new Promise((resolve, reject) => {
    fs.readFile(pluginPath, 'utf8', (err, content) => {
      if (err) return reject(err);

      const regex = /require\(['"`]([^'"`]+)['"`]\)/g;
      const matches = [];
      let match;
      while ((match = regex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      const modules = matches.filter(m => !m.startsWith('.') && !path.isAbsolute(m));

      if (modules.length === 0) {
        return resolve();
      }

      const missingModules = modules.filter(modName => {
        try {
          require.resolve(modName);
          return false;
        } catch {
          return true;
        }
      });

      if (missingModules.length === 0) {
        return resolve();
      }

      console.log(`[Dependency] Installing missing dependencies: ${missingModules.join(', ')}`);

      exec(`npm install ${missingModules.join(' ')}`, { cwd: path.resolve(__dirname, '..') }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Dependency] Failed to install dependencies:`, error);
          return reject(error);
        }
        console.log(stdout);
        resolve();
      });
    });
  });
}

module.exports = {
  installDependenciesIfNeeded,
};
