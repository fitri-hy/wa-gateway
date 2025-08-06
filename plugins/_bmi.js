module.exports = {
  command: 'bmi 170 65',
  title: 'Calculator BMI',
  description: 'Use this tool to calculate your Body Mass Index (BMI) based on your height and weight to find out your weight category.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',

  execute: async (msg, sock, args, phone) => {
    const text = msg?.message?.conversation?.trim();
    if (!text?.startsWith('!bmi')) return false;
	
	await sock.sendMessage(msg.key.remoteJid, { react: { text: '⌛', key: msg.key } });

    try {
      const jid = msg.key.remoteJid;
      const [, tinggiStr, beratStr] = text.split(' ');
      const tinggi = parseFloat(tinggiStr);
      const berat = parseFloat(beratStr);

      if (!tinggi || !berat) {
        await sock.sendMessage(jid, {
          text: 'Format salah.\nGunakan: !bmi <tinggi_cm> <berat_kg>\nContoh: !bmi 170 65'
        }, { quoted: msg });
        return true;
      }
	  
      const bmi = berat / ((tinggi / 100) ** 2);
      const kategori = bmi < 18.5 ? 'Kurus' : bmi < 24.9 ? 'Normal' : bmi < 29.9 ? 'Kelebihan berat badan' : 'Obesitas';

      const reply = `*Hasil Perhitungan BMI*\n\nTinggi: ${tinggi} cm\nBerat: ${berat} kg\nBMI: ${bmi.toFixed(2)}\nKategori: *${kategori}*`;
      await sock.sendMessage(jid, { text: reply }, { quoted: msg });
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      console.error('Error:', err.message);
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }

    return true;
  }
};
