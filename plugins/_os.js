const os = require('os');
const { createContextInfoPlugin } = require('../helpers/pluginContextInfo');

module.exports = {
  command: 'os',
  title: 'OS Info',
  description: 'Displays complete information about the operating system, hardware, network, and environment.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',

  execute: async (msg, sock, args, phone) => {
    try {
      const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation : '';
      if (!text.startsWith('!' + module.exports.command)) return;

      const contextInfo = await createContextInfoPlugin(phone);

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '⌛', key: msg.key } });

      function formatUptime(seconds) {
        const days = Math.floor(seconds / (3600*24));
        seconds %= 3600*24;
        const h = Math.floor(seconds / 3600);
        seconds %= 3600;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${days}d ${h}h ${m}m ${s}s`;
      }

      function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        const kb = bytes / 1024;
        if (kb < 1024) return kb.toFixed(2) + ' KB';
        const mb = kb / 1024;
        if (mb < 1024) return mb.toFixed(2) + ' MB';
        const gb = mb / 1024;
        if (gb < 1024) return gb.toFixed(2) + ' GB';
        return (gb / 1024).toFixed(2) + ' TB';
      }

      function getIPAddresses() {
        const nets = os.networkInterfaces();
        const results = [];
        for (const name of Object.keys(nets)) {
          for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
              results.push(`${name}: ${net.address}`);
            }
          }
        }
        return results.join('\n');
      }

      const hostname = os.hostname();
      const osType = os.type();
      const osRelease = os.release();
      const osPlatform = os.platform();
      const arch = os.arch();
      const uptime = os.uptime();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const loadAvg = os.loadavg();
      const cpuInfo = os.cpus();
      const cpuModel = cpuInfo[0]?.model || 'Unknown';
      const cpuCores = cpuInfo.length;
      const cpuSpeed = cpuInfo[0]?.speed || 'Unknown';
      const ipAddresses = getIPAddresses();
      const userInfo = os.userInfo();

      const osInfoMessage =
        `🖥️ *Info Sistem Operasi & Hardware Lengkap:*\n\n` +
        `• Hostname       : ${hostname}\n` +
        `• User           : ${userInfo.username} (UID: ${userInfo.uid})\n` +
        `• Tipe OS        : ${osType}\n` +
        `• Versi OS       : ${osRelease}\n` +
        `• Platform       : ${osPlatform}\n` +
        `• Arsitektur     : ${arch}\n` +
        `• Uptime         : ${formatUptime(uptime)}\n` +
        `• CPU Model      : ${cpuModel}\n` +
        `• CPU Cores      : ${cpuCores}\n` +
        `• CPU Speed      : ${cpuSpeed} MHz\n` +
        `• Total RAM      : ${formatBytes(totalMem)}\n` +
        `• Memori Bebas   : ${formatBytes(freeMem)}\n` +
        `• Load Average   : ${loadAvg.map(l => l.toFixed(2)).join(', ')} (1, 5, 15 menit)\n` +
        `• IP Address     :\n${ipAddresses || 'Tidak ditemukan'}`;

      const messagePayload = { text: osInfoMessage };
      if (contextInfo) messagePayload.contextInfo = contextInfo;

      await sock.sendMessage(msg.key.remoteJid, messagePayload, { quoted: msg });
	  await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });
    } catch (error) {
      console.error('[ERROR] OS info plugin:', error);
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '⛔', key: msg.key } });
    }
  }
};