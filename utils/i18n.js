const path = require('path');
const i18n = require('i18n');

i18n.configure({
  locales: ['en', 'id'],
  directory: path.join(__dirname, '../locales'),
  defaultLocale: 'en',
  cookie: 'lang',
  objectNotation: true,
  updateFiles: false,
  autoReload: false
});

module.exports = i18n;
