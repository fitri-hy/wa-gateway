const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');

module.exports = {
  command: 'ytdl https://www.youtube.com/watch...',
  title: 'YouTube Downloader',
  description: 'Download videos from YouTube and send them directly to WhatsApp contacts without hassle.',
  author: 'Fitri HY',

  execute: async (msg, sock) => {
    const sender = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    if (!text?.startsWith('!ytdl ')) return;

    const url = text.split(' ')[1];
    if (!url || !url.startsWith('http')) {
      return await sock.sendMessage(sender, { text: 'Format salah.\nGunakan: !ytdl <url YouTube>\nContoh: !ytdl https://youtube.com/watch?v=xxxx' }, { quoted: msg });
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
        addHeader: ['referer:youtube.com', 'user-agent:googlebot']
      });

      if (!meta?.title) throw new Error('Gagal mendapatkan metadata video.');

      const safeTitle = meta.title.replace(/[^\w\s]/gi, '').slice(0, 50);
      const videoPath = path.join(tempDir, `${safeTitle}.mp4`);

      await youtubedl(url, { output: videoPath, quiet: true, format: 'mp4', noWarnings: true });

      await sock.sendMessage(sender, {
        video: { url: videoPath },
        mimetype: 'video/mp4',
        caption: `📥 *${meta.title}*\n\n✅ Video berhasil diunduh.`,
      }, { quoted: msg });

      fs.unlink(videoPath, err => err && console.error('Gagal hapus file:', err));

      await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
  }
};