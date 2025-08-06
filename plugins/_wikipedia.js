const fs = require('fs');
const { join } = require('path');
const axios = require('axios');

module.exports = {
  command: 'wiki indonesia',
  title: 'Wikipedia Search',
  description: 'Searches Wikipedia using specific keywords and displays a complete summary of relevant articles for easy reference.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',

  execute: async (msg, sock, args, phone) => {
    if (!module.exports.allowedPhones?.includes(phone)) return false;

    const sender = msg.key.remoteJid;
    const text = msg.message?.conversation || '';
    if (!text.startsWith('!wiki')) return false;

    const query = text.slice(6).trim();
    if (!query) {
      await sock.sendMessage(sender, {
        text: 'Mohon masukkan kata kunci untuk pencarian Wikipedia.\nContoh: !wiki Indonesia'
      }, { quoted: msg });
      return true;
    }

    try {
      await sock.sendMessage(sender, { react: { text: '⌛', key: msg.key } });
    } catch {}

    try {
      const { data } = await axios.get(`https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);

      let message = `*${data.title}*\n${data.description ? `_${data.description}_\n` : ''}`;
      if (data.extract) {
        const extract = data.extract.length > 1900 ? data.extract.slice(0, 1900) + '...' : data.extract;
        message += `\n${extract}\n`;
      }
      if (data.timestamp) {
        const lastEdit = new Date(data.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        message += `\n🕒 Terakhir diperbarui: ${lastEdit}\n`;
      }
      if (data.content_urls?.desktop?.page) message += `\n🔗 Baca lebih lanjut: ${data.content_urls.desktop.page}\n`;
      if (data.titles?.normalized) message += `📌 Judul Normalisasi: ${data.titles.normalized}`;

      if (data.thumbnail?.source) {
        await sock.sendMessage(sender, { image: { url: data.thumbnail.source }, caption: message }, { quoted: msg });
      } else {
        await sock.sendMessage(sender, { text: message }, { quoted: msg });
      }

      await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }

    return true;
  }
};
