const { downloadMediaMessage, getContentType } = require('baileys');

module.exports = {
  command: 'antiviewonce',
  title: 'Anti View Once',
  description: 'To view the content of a view-once message, please reply to it. This action allows you to temporarily access and see the message content.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',
  
  execute: async (msg, sock) => {
    const sender = msg.key.remoteJid;

    const text = msg.message?.conversation
      || msg.message?.extendedTextMessage?.text
      || msg.message?.imageMessage?.caption
      || msg.message?.videoMessage?.caption;

    if (!text?.startsWith('!antiviewonce')) return;

    const context = msg.message?.extendedTextMessage?.contextInfo;

    if (!context || !context.quotedMessage) {
      await sock.sendMessage(sender, {
        text: '⚠️ Tidak ada pesan sekali lihat yang dibalas.',
      }, { quoted: msg });
      return;
    }

    const quotedMessage = context.quotedMessage;

    const isViewOnce =
      quotedMessage?.viewOnceMessage ||
      Object.values(quotedMessage).some(m => m?.viewOnce);

    if (!isViewOnce) {
      await sock.sendMessage(sender, {
        text: '❌ Pesan yang dibalas bukan pesan sekali lihat.',
      }, { quoted: msg });
      return;
    }

    let viewOnceMsg = quotedMessage.viewOnceMessage?.message || quotedMessage;
    let viewOnceType = getContentType(viewOnceMsg);
    let mediaMessage = viewOnceMsg?.[viewOnceType];

    if (!mediaMessage) {
      await sock.sendMessage(sender, {
        text: '❌ Gagal mengambil media dari pesan.',
      }, { quoted: msg });
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
        await sock.sendMessage(sender, {
          image: buffer,
          caption: '📸 Gambar sekali lihat berhasil diungkap.',
        }, { quoted: msg });

      } else if (viewOnceType === 'videoMessage') {
        await sock.sendMessage(sender, {
          video: buffer,
          caption: '🎥 Video sekali lihat berhasil diungkap.',
        }, { quoted: msg });

      } else {
        await sock.sendMessage(sender, {
          text: '⚠️ Jenis media tidak didukung.',
        }, { quoted: msg });
      }

      await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (err) {
      console.error('❌ Error:', err.message);
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
  }
};