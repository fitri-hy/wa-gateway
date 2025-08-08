const axios = require('axios');
const { createContextInfoPlugin } = require('../helpers/pluginContextInfo');

module.exports = {
  command: 'animal',
  title: 'Animal Random',
  description: 'Send random pictures and facts about animals.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',

  execute: async (msg, sock, args, phone) => {
    const validTypes = [
      "fox", "cat", "birb", "panda", "red_panda", "racoon", "koala",
      "kangaroo", "whale", "dog", "bird"
    ];
    try {
      const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation.trim() : '';
      if (!text.toLowerCase().startsWith('!animal')) return;

      const contextInfo = await createContextInfoPlugin(phone);

      const splitText = text.split(/\s+/);
      const inputType = splitText[1]?.toLowerCase();

      if (!inputType || !validTypes.includes(inputType)) {
        const reply = `Tipe tidak valid atau belum diberikan!\nGunakan: !animal <type>\nTipe valid: ${validTypes.join(', ')}`;
        await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
        return;
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '⌛', key: msg.key } });

      const url = `https://api.some-random-api.com/animal/${inputType}`;
      const response = await axios.get(url);
      const data = response.data;

      if (!data || !data.image || !data.fact) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'Gambar atau fakta tidak ditemukan.'
        }, { quoted: msg });
        return;
      }

      const messagePayload = {
        image: { url: data.image },
        caption: `🦄 *Hewan*: ${inputType}\n📚 *Fakta*: ${data.fact}`
      };

      if (contextInfo) messagePayload.contextInfo = contextInfo;

      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
      console.error('[ERROR] animal plugin:', error);
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '⛔', key: msg.key } });
    }
  }
};
