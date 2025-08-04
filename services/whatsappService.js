const path = require('path');
const fs = require('fs');
const { rimraf } = require('rimraf');
const QRCode = require('qrcode');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const db = require('../config/MySQL');
const { messageService } = require('./messageService');
const pluginService = require('./pluginService');

const silentLogger = pino({ level: 'silent' });
const clients = {};
const wsClients = {};
const retryCount = {};

const sockToPhone = new Map();

async function startSession(phone) {
  const sessionDir = path.join(__dirname, '..', 'sessions', phone);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: silentLogger,
  });

  clients[phone] = { sock, saveCreds };
  sockToPhone.set(sock, phone);
  retryCount[phone] = retryCount[phone] || 0;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && wsClients[phone]) {
      QRCode.toDataURL(qr).then((dataUrl) => {
        wsClients[phone].send(JSON.stringify({ qr: dataUrl }));
      });
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error;
      const status = error?.output?.statusCode || 0;

      if (status === DisconnectReason.loggedOut) {
        retryCount[phone] = 0;

        console.log(`${phone} Logged out`);

        db.query(
          'DELETE FROM sessions WHERE phone = ?',
          [phone],
          (err) => {
            if (err) console.error(`Error update session disconnected: ${err}`);
          }
        );

        delete clients[phone];
		sockToPhone.delete(sock);

        if (wsClients[phone]) {
          wsClients[phone].send(JSON.stringify({ loggedOut: true }));
          wsClients[phone].close();
          delete wsClients[phone];
        }

        try {
          await rimraf(sessionDir);
          console.log(`${phone} Session folder deleted.`);
        } catch (err) {
          console.error(`Failed to delete session folder for ${phone}:`, err);
        }

        return;
      } else {
        retryCount[phone]++;
        if (retryCount[phone] > 5) {
          console.log(`Too many retries for ${phone}, stop reconnecting.`);
          return;
        }

        db.query(
          'UPDATE sessions SET connected = 0 WHERE phone = ?',
          [phone],
          (err) => {
            if (err) console.error(`Error update session disconnected: ${err}`);
          }
        );

        console.log(`${phone} disconnected unexpectedly, retry #${retryCount[phone]}, reconnecting in 10 seconds...`);
        setTimeout(() => {
          startSession(phone).catch(console.error);
        }, 10000);
      }
    }

    if (connection === 'open') {
      retryCount[phone] = 0;
      console.log(`${phone} connected`);

      if (wsClients[phone]) {
        wsClients[phone].send(JSON.stringify({ connected: true }));
      }

      db.query(
        'UPDATE sessions SET connected = 1 WHERE phone = ?',
        [phone],
        (err) => {
          if (err) console.error(`Error update session connected: ${err}`);
        }
      );
    }
  });

  sock.ev.on('creds.update', saveCreds);
  
  // Auto Reply
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !messages || !messages[0]) return;
    const msg = messages[0];

    await messageService(sock, msg);
	
	const plugins = pluginService.getPlugins();
    const currentPhone = sockToPhone.get(sock);

    for (const plugin of plugins) {
      const allowed = plugin.allowedPhones;
      if (Array.isArray(allowed) && !allowed.includes(currentPhone)) continue;

      try {
        await plugin.execute(msg, sock, [], currentPhone);
      } catch (err) {
        console.error(`Plugin error (${plugin.command || 'unknown'}): ${err.message}`);
      }
    }
  });
}

function registerWsClient(phone, ws) {
  wsClients[phone] = ws;

  ws.on('close', () => {
    delete wsClients[phone];
  });

  ws.on('message', (msg) => {
    console.log(`WS message from ${phone}: ${msg}`);
  });
}

function isSessionExist(phone) {
  const sessionDir = path.join(__dirname, '..', 'sessions', phone);
  return fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;
}

async function getAllSessionsStatus(userId) {
  return new Promise((resolve, reject) => {
    db.query('SELECT phone, connected FROM sessions WHERE user_id = ?', [userId], (err, results) => {
      if (err) return reject(err);

      const sessionsDir = path.join(__dirname, '..', 'sessions');
      const existingFolders = fs.existsSync(sessionsDir) ? fs.readdirSync(sessionsDir) : [];

      const filtered = results.filter(row => existingFolders.includes(row.phone));

      const formatted = filtered.map(row => ({
        phone: row.phone,
        connected: row.connected === 1
      }));

      resolve(formatted);
    });
  });
}

async function deleteSession(phone) {
  if (clients[phone]) {
    try {
      clients[phone].sock.ev.removeAllListeners();
      clients[phone].sock.end();
    } catch {}
    delete clients[phone];
  }

  if (wsClients[phone]) {
    try {
      wsClients[phone].send(JSON.stringify({ deleted: true }));
      wsClients[phone].close();
    } catch {}
    delete wsClients[phone];
  }

  await new Promise((resolve, reject) => {
    db.query('DELETE FROM sessions WHERE phone = ?', [phone], (err) => {
      if (err) {
        console.error('Error deleting session from DB:', err);
        reject(err);
        return;
      }
      resolve();
    });
  });

  const sessionDir = path.join(__dirname, '..', 'sessions', phone);
  await rimraf(sessionDir);
}

function getClientByPhone(phone) {
  return clients[phone]?.sock || null;
}

module.exports = {
  startSession,
  registerWsClient,
  isSessionExist,
  getAllSessionsStatus,
  deleteSession,
  getClientByPhone
};
