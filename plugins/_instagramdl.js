const { createContextInfoPlugin } = require('../helpers/pluginContextInfo');
const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');

module.exports = {
  command: 'igdl <url>',
  title: 'Instagram Downloader',
  description: 'Download videos or reels from Instagram and send them directly to WhatsApp contacts.',
  author: 'Fitri HY',

  execute: async (msg, sock, args, phone) => {
    const sender = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    if (!text?.startsWith('!igdl ')) return;

    const url = text.split(' ')[1];
    if (!url || !url.startsWith('http')) {
      const contextInfo = await createContextInfoPlugin(phone);
      const messagePayload = { 
        text: 'Format salah.\nGunakan: !igdl <url Instagram>\nContoh: !igdl https://www.instagram.com/p/xxxxxxx/',
      };
      if (contextInfo) messagePayload.contextInfo = contextInfo;
      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
      return true;
    }

    const tempDir = path.join(__dirname, '../public/uploads/.temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    await sock.sendMessage(sender, { react: { text: '⌛', key: msg.key } });

    try {
      const meta = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['referer:instagram.com', 'user-agent:googlebot']
      });

      if (!meta?.title && !meta?.id) throw new Error('Gagal mendapatkan metadata video.');

      const safeTitle = (meta.title || meta.id).replace(/[^\w\s]/gi, '').slice(0, 50);
      const videoPath = path.join(tempDir, `${safeTitle}.mp4`);

      await youtubedl(url, { output: videoPath, quiet: true, format: 'mp4', noWarnings: true });

      const contextInfo = await createContextInfoPlugin(phone);
      const messagePayload = { 
        video: { url: videoPath },
        mimetype: 'video/mp4',
        caption: `📥 *Instagram Video*\n\n✅ Video berhasil diunduh.`,
      };
      if (contextInfo) messagePayload.contextInfo = contextInfo;
      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });

      fs.unlink(videoPath, err => err && console.error('Gagal hapus file:', err));

      await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
  }
};
