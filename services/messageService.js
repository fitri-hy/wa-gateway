const db = require('../config/Mysql');

async function messageService(sock, msg) {
  if (!msg.message) return;

  const sender = msg.key.remoteJid;
  const isGroup = sender.endsWith('@g.us');
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    '';

  if (!text) return;

  const sessionPhone = sock.user.id.split(':')[0];

  db.query('SELECT id FROM sessions WHERE phone = ?', [sessionPhone], (err, sessionRows) => {
    if (err) {
      console.error('DB error finding session:', err);
      return;
    }
    if (!sessionRows.length) return;

    const sessionId = sessionRows[0].id;

    db.query('SELECT * FROM auto_replies WHERE session_id = ?', [sessionId], async (err, rules) => {
      if (err || !rules.length) return;

      for (let rule of rules) {
        if (
          (rule.category === 'Private' && isGroup) ||
          (rule.category === 'Group' && !isGroup)
        ) continue;

        const isMatch = rule.includes === 'Exactly'
          ? text.trim() === rule.prefix.trim()
          : text.includes(rule.prefix);

        if (!isMatch) continue;

        if (rule.type === 'Location') {
          let locationData;
          try {
            locationData = JSON.parse(rule.response);
          } catch (e) {
            console.error('Failed to parse location JSON:', e);
            locationData = null;
          }

          if (
            locationData &&
            locationData.lat !== undefined &&
            locationData.lng !== undefined
          ) {
            const locationMessage = {
              location: {
                degreesLatitude: parseFloat(locationData.lat),
                degreesLongitude: parseFloat(locationData.lng),
                name: locationData.name || '',
                address: locationData.address || ''
              }
            };

            await sock.sendMessage(sender, locationMessage);
            return;
          } else {
            await sock.sendMessage(sender, { text: rule.response || '' });
            return;
          }
        }

        if (rule.file) {
          const url = rule.file;
          let message = {};

          switch (rule.type) {
            case 'Image':
              message = { image: { url }, caption: rule.response || '' };
              break;
            case 'Video':
              message = { video: { url }, caption: rule.response || '' };
              break;
            case 'Audio':
              message = { audio: { url }, mimetype: 'audio/mp4' };
              break;
            case 'Document':
			  message = { 
				document: { url }, 
				fileName: rule.fileName || 'file', 
				caption: rule.response || ''
			  };
			  break;
            case 'Sticker':
              message = { sticker: { url } };
              break;
            default:
              message = { text: rule.response || '' };
          }

          await sock.sendMessage(sender, message);
        } else {
          await sock.sendMessage(sender, { text: rule.response || '' });
        }

        break;
      }
    });
  });
}

module.exports = {
  messageService,
};
