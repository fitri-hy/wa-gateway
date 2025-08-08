const db = require('../config/Mysql');
const { createContextInfoIfFreePackage } = require('../helpers/contextInfo');

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

  db.query('SELECT id, user_id FROM sessions WHERE phone = ?', [sessionPhone], async (err, sessionRows) => {
    if (err) {
      console.error('DB error finding session:', err);
      return;
    }
    if (!sessionRows.length) return;

    const sessionId = sessionRows[0].id;
    const userId = sessionRows[0].user_id;

    if (!userId) {
      db.query('SELECT id FROM users WHERE phone = ?', [sessionPhone], async (err2, userRows) => {
        if (err2 || !userRows.length) return;
        const fallbackUserId = userRows[0].id;
        await processAutoReplies(sessionId, fallbackUserId);
      });
    } else {
      await processAutoReplies(sessionId, userId);
    }

    async function processAutoReplies(sessionId, userId) {
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

          const contextInfo = await createContextInfoIfFreePackage(userId);

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
                },
                contextInfo
              };

              await sock.sendMessage(sender, locationMessage);
              return;
            } else {
              await sock.sendMessage(sender, { text: rule.response || '', contextInfo });
              return;
            }
          }

          if (rule.file) {
            const url = rule.file;
            let message = {};

            switch (rule.type) {
              case 'Image':
                message = { image: { url }, caption: rule.response || '', contextInfo };
                break;
              case 'Video':
                message = { video: { url }, caption: rule.response || '', contextInfo };
                break;
              case 'Audio':
                message = { audio: { url }, mimetype: 'audio/mp4', contextInfo };
                break;
              case 'Document':
                message = {
                  document: { url },
                  fileName: rule.fileName || 'file',
                  caption: rule.response || '',
                  contextInfo
                };
                break;
              case 'Sticker':
                message = { sticker: { url }, contextInfo };
                break;
              default:
                message = { text: rule.response || '', contextInfo };
            }

            await sock.sendMessage(sender, message);
          } else {
            await sock.sendMessage(sender, { text: rule.response || '', contextInfo });
          }

          break;
        }
      });
    }
  });
}

module.exports = {
  messageService,
};
