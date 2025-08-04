const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');

const EMOJIS = {
  success: '✅',
  error: '❌',
  loading: '⌛',
};

module.exports = {
  command: 'ytdl https://www.youtube.com/watch...',
  title: 'YouTube Downloader',
  description: 'Download videos from YouTube and send them directly to WhatsApp contacts without hassle.',
  author: 'Fitri HY',

  execute: async (msg, sock, args) => {
    const sender = msg.key.remoteJid;
    const text = msg.message?.conversation?.trim() || msg.message?.extendedTextMessage?.text?.trim();

    if (!text.startsWith('!ytdl')) return;

    const parts = text.split(' ');
    const url = parts[1];

    if (!url || !url.startsWith('http')) {
      await sock.sendMessage(sender, {
        text: '⚠️ Format salah.\nGunakan: !ytdl <url YouTube>\nContoh: !ytdl https://youtube.com/watch?v=xxxx',
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(sender, { react: { text: EMOJIS.loading, key: msg.key } });

    const tempDir = path.join(__dirname, '../public/uploads/.temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
      const metadata = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['referer:youtube.com', 'user-agent:googlebot']
      });

      if (!metadata || !metadata.title) throw new Error('Gagal mendapatkan metadata video.');

      const title = metadata.title.replace(/[^\w\s]/gi, '').substring(0, 50);
      const videoPath = path.join(tempDir, `${title}.mp4`);

      await youtubedl(url, {
        output: videoPath,
        noWarnings: true,
        quiet: true,
        format: 'mp4',
      });

      await sock.sendMessage(sender, {
        video: { url: videoPath },
        mimetype: 'video/mp4',
        caption: `📥 *${metadata.title}*\n\n✅ Video berhasil diunduh.`,
      }, { quoted: msg });

      fs.unlink(videoPath, (err) => {
        if (err) {
          console.error('Gagal hapus file:', err);
        }
      });

      await sock.sendMessage(sender, { react: { text: EMOJIS.success, key: msg.key } });

    } catch (err) {
      console.error('Error:', err);
      await sock.sendMessage(sender, {
        text: `❌ Gagal mengunduh video.\n${err.message || err}`,
      }, { quoted: msg });

      await sock.sendMessage(sender, { react: { text: EMOJIS.error, key: msg.key } });
    }
  }
};
