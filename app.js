require('dotenv').config();
const db = require('./config/MySQL');
const express = require('express');
const { rimraf } = require('rimraf');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const { WebSocketServer } = require('ws');

const webRouter = require('./routes/web');
const cleanupMiddleware = require('./middleware/cleanupMiddlewares');
const { registerWsClient, startSession } = require('./services/whatsappService');

const PORT = process.env.PORT || 3000;
const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(flash());
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cleanupMiddleware);

app.use('/', webRouter);

app.use((req, res, next) => {
  res.status(404).render('error', {
    title: '404 Not Found',
    message: 'The page you are looking for was not found.',
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on localhost:${PORT}`);

  (async () => {
    const sessionsDir = path.join(__dirname, 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      console.log('Created sessions directory.');
    }

    try {
      const [rows] = await db.promise().query(
        'SELECT phone FROM sessions WHERE connected = 1'
      );
      const dbPhones = rows.map(row => row.phone);

      const folderPhones = fs.readdirSync(sessionsDir).filter(phone => {
        const fullPath = path.join(sessionsDir, phone);
        return fs.lstatSync(fullPath).isDirectory();
      });

      const foldersToDelete = folderPhones.filter(phone => !dbPhones.includes(phone));
      for (const phone of foldersToDelete) {
        const fullPath = path.join(sessionsDir, phone);
        await rimraf(fullPath);
        // console.log(`Deleted session folder for ${phone} (not in DB)`);
      }

      const dbPhonesToUpdate = dbPhones.filter(phone => {
        const fullPath = path.join(sessionsDir, phone);
        if (!fs.existsSync(fullPath)) return true;
        if (fs.readdirSync(fullPath).length === 0) return true;
        return false;
      });

      if (dbPhonesToUpdate.length > 0) {
        await db.promise().query(
          `UPDATE sessions SET connected = 0 WHERE phone IN (${dbPhonesToUpdate.map(() => '?').join(',')})`,
          dbPhonesToUpdate
        );
        // console.log(`Updated connected=0 for sessions without folder or empty folder:`, dbPhonesToUpdate);
      }

      const validPhones = dbPhones.filter(phone => {
        const fullPath = path.join(sessionsDir, phone);
        return fs.existsSync(fullPath) && fs.readdirSync(fullPath).length > 0;
      });

      for (const phone of validPhones) {
        console.log(`Initializing session for ${phone}`);
        await startSession(phone).catch(console.error);
      }

      console.log('All valid sessions initialized.');
    } catch (err) {
      console.error('Failed to initialize sessions:', err);
    }
  })();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams(req.url.replace('/?', ''));
  const phone = urlParams.get('phone');

  if (!phone) {
    ws.close(1008, 'Phone param missing');
    return;
  }

  registerWsClient(phone, ws);
});
