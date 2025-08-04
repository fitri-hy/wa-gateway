module.exports = {
  command: 'ping',
  title: 'Ping',
  description: 'Tests the server status by sending a ping request and waiting for the response to check connectivity.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',
  
  execute: async (msg, sock, args, phone) => {
    const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation : '';
	
    if (text.startsWith('!ping')) {
	  await sock.sendMessage(msg.key.remoteJid, { react: { text: '⌛', key: msg.key } });
      await sock.sendMessage(msg.key.remoteJid, {
        text: 'pong!'
      }, { quoted: msg });
	  await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });

      return true;
    }
  }
};
