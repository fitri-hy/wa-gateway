const axios = require('axios');

module.exports = {
  command: 'country indonesia',
  title: 'Country Info',
  description: 'Displays detailed information about a country based on its name, including capital, population, region, language, and more.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',

  execute: async (msg, sock, args, phone) => {
    const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation.trim() : '';

    if (!text.startsWith('!country')) return false;

    const parts = text.split(' ').filter(Boolean);
    if (parts.length < 2) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: 'Format salah.\nGunakan: !country <nama_negara>\nContoh: !country japan'
      }, { quoted: msg });
      return true;
    }

    const countryName = parts.slice(1).join(' ');
	
	await sock.sendMessage(msg.key.remoteJid, { react: { text: '⌛', key: msg.key } });

    try {
      const { data } = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}`);
      const country = data[0];

      const {
        flag,
        name,
        capital,
        region,
        subregion,
        population,
        currencies,
        timezones,
        cca2,
        ccn3,
        cca3,
        cioc,
        maps
      } = country;

      const currencyText = currencies
        ? Object.values(currencies)
            .map(c => `${c.name} (${c.symbol})`)
            .join(', ')
        : 'N/A';
		
      const responseText = `
*${flag} ${name.common} (${name.official})*

📍 *Capital:* ${capital?.[0] || 'N/A'}
🌍 *Region:* ${region}
🌐 *Subregion:* ${subregion}
👥 *Population:* ${population.toLocaleString()}
💰 *Currency:* ${currencyText}
🕒 *Timezones:* ${timezones?.join(', ') || 'N/A'}

🔤 *Codes:*
• CCA2: ${cca2}
• CCN3: ${ccn3}
• CCA3: ${cca3}
• CIOC: ${cioc || 'N/A'}

🗺️ *Map:* ${maps.googleMaps}
      `.trim();

      await sock.sendMessage(msg.key.remoteJid, { text: responseText }, { quoted: msg });
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      console.error('Error:', err.message);
      await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }

    return true;
  }
};
