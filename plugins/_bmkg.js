const axios = require('axios');

const EMOJIS = {
  success: '✅',
  error: '❌',
  loading: '⌛',
};

module.exports = {
  command: 'bmkg',
  title: 'BMKG Earthquake',
  description: 'Displays the latest earthquake updates from BMKG, including location, magnitude, depth, and time of occurrence.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',


  execute: async (msg, sock, args, phone) => {
    const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation.trim() : '';

    if (!text.startsWith('!bmkg')) return false;

    try {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: EMOJIS.loading, key: msg.key } });

      const url = 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json';
      const { data } = await axios.get(url);

      const gempaList = data.Infogempa.gempa.slice(0, 3);

      const responseText = gempaList.map((gempa, index) => {
        return `#${index + 1}️⃣\n` +
          `📅 *Tanggal:* ${gempa.Tanggal}\n` +
          `⏰ *Jam:* ${gempa.Jam} WIB\n` +
          `📍 *Lokasi:* ${gempa.Wilayah}\n` +
          `📈 *Magnitudo:* ${gempa.Magnitude}\n` +
          `📏 *Kedalaman:* ${gempa.Kedalaman}\n` +
          `📌 *Koordinat:* ${gempa.Coordinates}\n` +
          `⚠️ *Potensi:* ${gempa.Potensi}\n` +
          (gempa.Dirasakan ? `😯 *Dirasakan:* ${gempa.Dirasakan}` : '') +
          `\n`;
      }).join('\n');

      await sock.sendMessage(msg.key.remoteJid, {
        text: `🌏 *3 Gempa Terkini BMKG:*\n\n${responseText}`
      }, { quoted: msg });

      await sock.sendMessage(msg.key.remoteJid, { react: { text: EMOJIS.success, key: msg.key } });

      return true;
    } catch (err) {
      console.error('Error:', err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Gagal mengambil data gempa dari BMKG.'
      }, { quoted: msg });
      await sock.sendMessage(msg.key.remoteJid, { react: { text: EMOJIS.error, key: msg.key } });
      return true;
    }
  }
};