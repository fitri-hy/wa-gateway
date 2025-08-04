const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');

const EMOJIS = {
  success: '✅',
  error: '❌',
  loading: '⌛',
};

module.exports = {
  command: 'fbdl https://www.facebook.com/watch...',
  title: 'Facebook Downloader',
  description: 'Download videos from Facebook and send them directly via WhatsApp quickly and easily.',
  author: 'Fitri HY',

  execute: async (msg, sock, args) => {
    const sender = msg.key.remoteJid;
    const text = msg.message?.conversation?.trim() || msg.message?.extendedTextMessage?.text?.trim();

    if (!text.startsWith('!fbdl')) return;

    const parts = text.split(' ');
    const url = parts[1];

    if (!url || !url.startsWith('http')) {
      await sock.sendMessage(sender, {
        text: '⚠️ Format salah.\nGunakan: !fbdl <url Facebook>\nContoh: !fbdl https://www.facebook.com/watch/?v=xxxx',
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
        addHeader: ['referer:facebook.com', 'user-agent:googlebot']
      });

      if (!metadata || !metadata.title) throw new Error('Gagal mendapatkan metadata video.');

      const title = metadata.title.replace(/[^\w\s]/gi, '').substring(0, 50);
      const videoPath = path.join(tempDir, `${title}.mp4`);

      await youtubedl(url, {
        output: videoPath,
        noWarnings: true,
        quiet: true,
        format: 'mp4',
        addHeader: ['referer:facebook.com', 'user-agent:googlebot']
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
        text: `❌ Gagal mengunduh video Facebook.\n${err.message || err}`,
      }, { quoted: msg });

      await sock.sendMessage(sender, { react: { text: EMOJIS.error, key: msg.key } });
    }
  }
};
