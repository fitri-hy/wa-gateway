const { createContextInfoPlugin } = require('../helpers/pluginContextInfo');
const axios = require('axios');

module.exports = {
  command: 'translate id Hello, how are you',
  title: 'Google Translate',
  description: 'Automatically translate text from source language to target language using Google Translate unofficial API.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',

  execute: async (msg, sock, args, phone) => {
    const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation : '';

    if (text.startsWith('!translate')) {
      const parts = text.trim().split(' ').filter(Boolean);
      if (parts.length < 3) {
        const contextInfo = await createContextInfoPlugin(phone);
        const messagePayload = { 
          text: 'Format salah.\nGunakan: !translate <kode_bahasa_target> <teks_yang_akan_diterjemahkan>\nContoh: !translate id Hello World'
	    };
        if (contextInfo) messagePayload.contextInfo = contextInfo;
        await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
        return true;
      }

      const targetLang = parts[1];
      const textToTranslate = parts.slice(2).join(' ');

	  await sock.sendMessage(sender, { react: { text: '⌛', key: msg.key } });
	  
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`;
        const { data } = await axios.get(url);

        const translatedText = data[0].map(item => item[0]).join('');
        const detectedLang = data[2];

        const responseText = `🌐 *Terjemahan* (${detectedLang} ➜ ${targetLang}):\n\n${translatedText}`.trim();
		
        const contextInfo = await createContextInfoPlugin(phone);
        const messagePayload = { 
          text: responseText
	    };
        if (contextInfo) messagePayload.contextInfo = contextInfo;
        await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });

        await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });
      } catch (err) {
        console.error('Error:', err);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
      }

      return true;
    }
  }
};
