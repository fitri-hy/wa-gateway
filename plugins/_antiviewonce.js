const { createContextInfoPlugin } = require('../helpers/pluginContextInfo');
const { downloadMediaMessage, getContentType } = require('baileys');

module.exports = {
  command: 'antiviewonce',
  title: 'Anti View Once',
  description: 'To view the content of a view-once message, please reply to it. This action allows you to temporarily access and see the message content.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',
  
  execute: async (msg, sock, args, phone) => {
    const sender = msg.key.remoteJid;

    const text = msg.message?.conversation
      || msg.message?.extendedTextMessage?.text
      || msg.message?.imageMessage?.caption
      || msg.message?.videoMessage?.caption;

    if (!text?.startsWith('!antiviewonce')) return;

    const context = msg.message?.extendedTextMessage?.contextInfo;

    if (!context || !context.quotedMessage) {
      const contextInfo = await createContextInfoPlugin(phone);
      const messagePayload = { 
	    text: 'Tidak ada pesan sekali lihat yang dibalas.' 
	  };
      if (contextInfo) messagePayload.contextInfo = contextInfo;
      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
      return true;
    }

    const quotedMessage = context.quotedMessage;

    const isViewOnce =
      quotedMessage?.viewOnceMessage ||
      Object.values(quotedMessage).some(m => m?.viewOnce);

    if (!isViewOnce) {
      const contextInfo = await createContextInfoPlugin(phone);
      const messagePayload = { 
	    text: 'Pesan yang dibalas bukan pesan sekali lihat.' 
	  };
      if (contextInfo) messagePayload.contextInfo = contextInfo;
      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
      return true;
    }

    let viewOnceMsg = quotedMessage.viewOnceMessage?.message || quotedMessage;
    let viewOnceType = getContentType(viewOnceMsg);
    let mediaMessage = viewOnceMsg?.[viewOnceType];

    if (!mediaMessage) {
      const contextInfo = await createContextInfoPlugin(phone);
      const messagePayload = { 
	    text: 'Gagal mengambil media dari pesan.' 
	  };
      if (contextInfo) messagePayload.contextInfo = contextInfo;
      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
      return;
    }

    if (mediaMessage.viewOnce) delete mediaMessage.viewOnce;

    await sock.sendMessage(sender, { react: { text: '⌛', key: msg.key } });

    try {
      const buffer = await downloadMediaMessage(
        { message: { [viewOnceType]: mediaMessage } },
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      if (viewOnceType === 'imageMessage') {
		  
        const contextInfo = await createContextInfoPlugin(phone);
        const messagePayload = { 
          image: buffer,
          caption: '📸 Gambar sekali lihat berhasil diungkap.',
	    };
        if (contextInfo) messagePayload.contextInfo = contextInfo;
        await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });

      } else if (viewOnceType === 'videoMessage') {
		  
        const contextInfo = await createContextInfoPlugin(phone);
        const messagePayload = { 
          video: buffer,
          caption: '🎥 Video sekali lihat berhasil diungkap.',
	    };
        if (contextInfo) messagePayload.contextInfo = contextInfo;
        await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });

      } else {
        const contextInfo = await createContextInfoPlugin(phone);
        const messagePayload = { 
          text: '⚠️ Jenis media tidak didukung.',
	    };
        if (contextInfo) messagePayload.contextInfo = contextInfo;
        await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
      }

      await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (err) {
      console.error('❌ Error:', err.message);
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
  }
};