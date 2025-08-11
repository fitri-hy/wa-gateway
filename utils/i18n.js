const path = require('path');
const fs = require('fs');
const i18n = require('i18n');

const langFilePath = path.join(__dirname, '../locales/lang.json');
const langData = JSON.parse(fs.readFileSync(langFilePath, 'utf-8'));
const locales = Object.keys(langData);

i18n.configure({
  locales,
  directory: path.join(__dirname, '../locales'),
  defaultLocale: 'en',
  cookie: 'lang',
  objectNotation: true,
  updateFiles: false,
  autoReload: false
});

module.exports = i18n;
