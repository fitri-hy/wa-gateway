const { Octokit } = require('@octokit/rest');
const axios = require('axios');

const octokit = new Octokit();

const EMOJIS = {
  success: '✅',
  error: '❌',
  loading: '⌛',
};

module.exports = {
  command: 'github fitri-hy',
  title: 'Github Stalker',
  description: 'Stalk user GitHub profile info by username',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',

  execute: async (msg, sock, args, phone) => {
    const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation.trim() : '';

    if (!text.startsWith('!github')) return false;

    const parts = text.split(' ');
    if (parts.length < 2) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Format salah. Gunakan: !github <username>'
      }, { quoted: msg });
      return true;
    }

    const username = parts[1].trim();

    try {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: EMOJIS.loading, key: msg.key } });

      const { data } = await octokit.users.getByUsername({ username });

      const avatarUrl = data.avatar_url;
      const response = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
      const imgBuffer = Buffer.from(response.data, 'binary');

      const profileText = 
        `👤 *${data.name || username}*\n` +
        `🔗 https://github.com/${username}\n` +
        `🏢 ${data.company || '-'}\n` +
        `📍 ${data.location || '-'}\n` +
        `📅 Bergabung: ${new Date(data.created_at).toLocaleDateString()}\n` +
        `👥 Followers: ${data.followers}\n` +
        `👣 Following: ${data.following}\n` +
        `📦 Repos: ${data.public_repos}\n` +
        `✉️ Email: ${data.email || '-'}\n` +
        `💬 Bio: ${data.bio || '-'}`;

      await sock.sendMessage(msg.key.remoteJid, {
        image: imgBuffer,
        caption: profileText
      }, { quoted: msg });

      await sock.sendMessage(msg.key.remoteJid, { react: { text: EMOJIS.success, key: msg.key } });

      return true;
    } catch (err) {
      console.error('Error:', err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Gagal mengambil data github untuk user *${username}*. Pastikan username benar.`
      }, { quoted: msg });

      await sock.sendMessage(msg.key.remoteJid, { react: { text: EMOJIS.error, key: msg.key } });
      return true;
    }
  }
};
