const axios = require('axios');
const { createContextInfoPlugin } = require('../helpers/pluginContextInfo');

module.exports = {
  command: 'animu',
  title: 'Anime Random',
  description: 'Send anime Random images or quotes based on type.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',

  execute: async (msg, sock, args, phone) => {
	const validTypes = [
	  "nom", "poke", "cry", "kiss", "pat", "hug", "wink", "face-palm", "quote"
	];

	const waifuPicsTypesMap = {
	  poke: 'poke',
	  cry: 'cry',
	  kiss: 'kiss',
	  pat: 'pat',
	  hug: 'hug',
	  wink: 'wink',
	  'face-palm': 'facepalm',
	  nom: 'nom',
	};
    try {
      const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation.trim() : '';
      if (!text.toLowerCase().startsWith('!animu')) return;

      const contextInfo = await createContextInfoPlugin(phone);

      const splitText = text.split(/\s+/);
      const inputType = splitText[1]?.toLowerCase();

      if (!inputType || !validTypes.includes(inputType)) {
        const reply = `Tipe tidak valid atau belum diberikan!\nGunakan: !animu <type>\nTipe valid: ${validTypes.join(', ')}`;
        await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
        return;
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '⌛', key: msg.key } });

      let messagePayload;

      if (inputType === 'quote') {
        const urlQuote = `https://api.some-random-api.com/animu/quote`;
        const response = await axios.get(urlQuote);
        const data = response.data;

        messagePayload = {
          text: `💬 *Quote dari ${data.anime || 'Unknown anime'}*\n\n"${data.quote || 'No quote found'}"\n\n— ${data.name || 'Unknown character'}`
        };

      } else {
        const waifuType = waifuPicsTypesMap[inputType];
        if (!waifuType) {
          messagePayload = {
            text: `Maaf, tipe *${inputType}* belum tersedia untuk gambar.`
          };
        } else {
          const urlWaifu = `https://api.waifu.pics/sfw/${waifuType}`;
          const response = await axios.get(urlWaifu);
          const data = response.data;

          if (!data.url) {
            messagePayload = { text: 'Gambar tidak ditemukan.' };
          } else {
            messagePayload = {
              image: { url: data.url },
              caption: `🎬 Anime ${inputType}`
            };
          }
        }
      }

      if (contextInfo) messagePayload.contextInfo = contextInfo;

      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
      console.error('[ERROR] animu plugin:', error);
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '⛔', key: msg.key } });
    }
  }
};