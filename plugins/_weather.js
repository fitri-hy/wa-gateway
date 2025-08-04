const fs = require('fs');
const { join } = require('path');
const axios = require('axios');

module.exports = {
  command: 'weather jakarta',
  title: 'Weather Info',
  description: 'Displays detailed current weather information such as temperature, humidity, and conditions based on the city name provided.',
  author: 'Fitri HY',
  github: 'https://github.com/fitri-hy',
  
  execute: async (msg, sock, args, phone) => {
    const text = typeof msg?.message?.conversation === 'string' ? msg.message.conversation : '';
    if (text.startsWith('!weather')) {
      const cityName = text.slice(9).trim();

      if (!cityName) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'Mohon masukkan nama kota.\nContoh: !weather Jakarta'
        }, { quoted: msg });
        return true;
      }

      try {
        await sock.sendMessage(msg.key.remoteJid, {
          react: { text: '⌛', key: msg.key }
        });
      } catch {}

      try {
        const url = `https://wttr.in/${encodeURIComponent(cityName)}?format=%t|%C|%w|%h&lang=id&m`;
        const response = await axios.get(url);
        const weatherData = response.data;

        const weatherParts = weatherData.split('|');
        if (weatherParts.length < 4) throw new Error('Response format tidak sesuai');

        const temperature = weatherParts[0];
        const condition = weatherParts[1];
        const wind = weatherParts[2];
        const humidity = weatherParts[3];

        const weatherJson = {
          temperature: temperature.trim(),
          condition: condition.trim(),
          wind: wind.trim(),
          humidity: humidity.trim()
        };

        const weatherText = `*Cuaca di ${cityName}:*\n\n🌡️ *Suhu:* ${weatherJson.temperature}\n🌤️ *Kondisi:* ${weatherJson.condition}\n🌬️ *Angin:* ${weatherJson.wind}\n💧 *Kelembapan:* ${weatherJson.humidity}`.trim();

        await sock.sendMessage(msg.key.remoteJid, { text: weatherText }, { quoted: msg });

        await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } });

      } catch (err) {
        console.error('Error:', err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `Maaf, gagal mendapatkan informasi cuaca untuk "${cityName}".`
        }, { quoted: msg });
        await sock.sendMessage(msg.key.remoteJid, { react: { text: '❌', key: msg.key } });
      }

      return true;
    }
  }
};
