const util = require('util');
const db = require('../config/MySQL');
const axios = require('axios');

const query = util.promisify(db.query).bind(db);

async function getPackagePrice(packageId) {
  const rows = await query('SELECT price FROM packages WHERE id = ?', [packageId]);
  return rows.length > 0 ? parseFloat(rows[0].price) : null;
}

async function getUserPackagePrice(userId) {
  const rows = await query('SELECT package_id FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) return null;
  return getPackagePrice(rows[0].package_id);
}

async function getUserIdByPhone(phone) {
  const rows = await query('SELECT user_id FROM sessions WHERE phone = ?', [phone]);
  return rows.length > 0 ? rows[0].user_id : null;
}

async function getAllAds() {
  return await query('SELECT * FROM ads');
}

async function fetchThumbnailBufferFromUrl(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Error fetching thumbnail from URL:', error);
    return null;
  }
}

async function createContextInfoPlugin(phone) {
  const userId = await getUserIdByPhone(phone);
  if (!userId) return null;

  const price = await getUserPackagePrice(userId);

  if (price === 0) {
    const ads = await getAllAds();
    if (ads.length === 0) return null;

    const randomAd = ads[Math.floor(Math.random() * ads.length)];

    const thumbnailBuffer = await fetchThumbnailBufferFromUrl(randomAd.thumbnail_path);
    if (!thumbnailBuffer) return null;

    return {
      externalAdReply: {
        title: randomAd.title,
        body: randomAd.body,
        mediaType: randomAd.media_type,
        thumbnail: thumbnailBuffer,
        sourceUrl: randomAd.source_url,
        showAdAttribution: true
      }
    };
  }

  return null;
}

module.exports = {
  createContextInfoPlugin
};
