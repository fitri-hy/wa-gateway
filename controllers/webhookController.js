const db = require('../config/MySQL');
const { getClientByPhone } = require('../services/whatsappService');

function validateAndGetClient(token, session, callback) {
  if (!token || !session) {
    return callback({ status: 400, message: 'Bad Request: Missing required fields.' });
  }

  db.query('SELECT * FROM users WHERE token = ?', [token], (err, userResults) => {
    if (err) return callback({ status: 500, message: 'Internal server error.' });

    if (userResults.length === 0) {
      return callback({ status: 401, message: 'Unauthorized: Invalid token.' });
    }

    const user = userResults[0];

    db.query(
      'SELECT * FROM sessions WHERE phone = ? AND user_id = ? AND connected = 1',
      [session, user.id],
      (err, sessionResults) => {
        if (err) return callback({ status: 500, message: 'Internal server error.' });

        if (sessionResults.length === 0) {
          return callback({ status: 404, message: 'Session not found or not connected.' });
        }

        const client = getClientByPhone(session);
        if (!client) {
          return callback({ status: 503, message: 'WhatsApp client not active for this session.' });
        }

        callback(null, { user, client });
      }
    );
  });
}

function SendingMessage(req, res) {
  const token = req.headers.token;
  const { session, to, type, content } = req.body;

  if (!to || !type || !content) {
    return res.status(400).json({ message: 'Bad Request: Missing required fields.' });
  }

  validateAndGetClient(token, session, (err, { client } = {}) => {
    if (err) {
      return res.status(err.status).json({ message: err.message });
    }

    const toJid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    let messagePayload;

    switch (type) {
      case 'text':
        messagePayload = { text: content };
        break;

      case 'image':
        if (!content.image_url) return res.status(400).json({ message: 'Missing image_url.' });
        messagePayload = { image: { url: content.image_url }, caption: content.caption || '' };
        break;

      case 'video':
        if (!content.video_url) return res.status(400).json({ message: 'Missing video_url.' });
        messagePayload = { video: { url: content.video_url }, caption: content.caption || '' };
        break;

      case 'audio':
        if (!content.audio_url) return res.status(400).json({ message: 'Missing audio_url.' });
        messagePayload = { audio: { url: content.audio_url }, mimetype: 'audio/mpeg' };
        break;

      case 'document':
        if (!content.document_url) return res.status(400).json({ message: 'Missing document_url.' });

        const mimetype = content.mimetype || 'application/octet-stream';
        const ext = mimetype.split('/')[1] || 'bin';
        const fileName = content.fileName || `file.${ext}`;

        messagePayload = {
          document: { url: content.document_url },
          mimetype,
          fileName,
          caption: content.caption || ''
        };
        break;

      case 'location':
        const { degreesLatitude, degreesLongitude, name } = content;
        if (
          degreesLatitude === undefined || 
          degreesLongitude === undefined || 
          typeof degreesLatitude !== 'number' || 
          typeof degreesLongitude !== 'number'
        ) {
          return res.status(400).json({ message: 'Invalid or missing latitude/longitude.' });
        }
        messagePayload = {
          location: {
            degreesLatitude,
            degreesLongitude,
            name: name || ''
          }
        };
        break;

      case 'sticker':
        if (!content.url) return res.status(400).json({ message: 'Missing sticker url.' });
        messagePayload = { sticker: { url: content.url } };
        break;

      default:
        return res.status(400).json({ message: 'Invalid message type.' });
    }

    client.sendMessage(toJid, messagePayload)
      .then(() => res.status(200).json({ message: 'Message sent successfully.' }))
      .catch((error) => {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Failed to send message.' });
      });
  });
}

exports.sendMessage = SendingMessage;
