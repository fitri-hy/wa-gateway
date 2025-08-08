const { createContextInfoPlugin } = require('../helpers/pluginContextInfo');
const axios = require('axios');

module.exports = {
  command: 'bmkg',
  title: 'BMKG Earthquake',
  description: 'Displays the latest earthquake updates from BMKG, including location, magnitude, depth, and time of occurrence.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',


  execute: async (msg, sock, args, phone) => {
    const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation.trim() : '';

    if (!text.startsWith('!bmkg')) return false;
	
	await sock.sendMessage(msg.key.remoteJid, { react: { text: '⌛', key: msg.key } });

    try {
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
	  
      const contextInfo = await createContextInfoPlugin(phone);
      const messagePayload = { 
        text: `*3 Gempa Terkini BMKG:*\n\n${responseText}`
	  };
      if (contextInfo) messagePayload.contextInfo = contextInfo;
      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      console.error('Error:', err.message);
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
	return true;
  }
};