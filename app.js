require('dotenv').config();
const db = require('./config/MySQL');
const express = require('express');
const { rimraf } = require('rimraf');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const { WebSocketServer } = require('ws');

const webRouter = require('./routes/web');
const cleanupMiddleware = require('./middleware/cleanupMiddlewares');
const { registerWsClient, startSession } = require('./services/whatsappService');
const i18n = require('./utils/i18n');

const PORT = process.env.PORT || 3000;
const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(flash());
app.use(i18n.init);

app.use((req, res, next) => {
  const protocol = req.protocol;
  const host = req.get('host');
  res.locals.__ = res.__;
  res.locals.BASE_URL = `${protocol}://${host}`;
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
    title: res.__('error.Not Found'),
    message: res.__('error.The page you are looking for was not found'),
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on localhost:${PORT}`);
/*
  (async () => {
    const sessionsDir = path.join(__dirname, 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      //console.log('Created sessions directory.');
    }

    try {
      const [rows] = await db.promise().query(
        'SELECT id, phone FROM sessions WHERE connected = 1'
      );
      const dbSessions = rows; 

      const dbPhones = dbSessions.map(row => row.phone);

      const folderPhones = fs.readdirSync(sessionsDir).filter(phone => {
        const fullPath = path.join(sessionsDir, phone);
        return fs.lstatSync(fullPath).isDirectory();
      });

      const foldersToDelete = folderPhones.filter(phone => !dbPhones.includes(phone));

      for (const phone of foldersToDelete) {
        const fullPath = path.join(sessionsDir, phone);
        await rimraf(fullPath);
        //console.log(`Deleted session folder for ${phone} (not in DB)`);
      }

      const sessionsToUpdate = [];
      const sessionsToDelete = [];

      for (const session of dbSessions) {
        const fullPath = path.join(sessionsDir, session.phone);

        if (!fs.existsSync(fullPath) || fs.readdirSync(fullPath).length === 0) {
          sessionsToDelete.push(session.id);
        } else {
          // Folder ada dan tidak kosong, tidak perlu update
        }
      }

      if (sessionsToDelete.length > 0) {
        await db.promise().query(
          `DELETE FROM auto_replies WHERE session_id IN (${sessionsToDelete.map(() => '?').join(',')})`,
          sessionsToDelete
        );

        await db.promise().query(
          `DELETE FROM sessions WHERE id IN (${sessionsToDelete.map(() => '?').join(',')})`,
          sessionsToDelete
        );

        //console.log(`Deleted sessions and related auto_replies for session IDs:`, sessionsToDelete);
      }

      const validSessions = dbSessions.filter(session => {
        const fullPath = path.join(sessionsDir, session.phone);
        return fs.existsSync(fullPath) && fs.readdirSync(fullPath).length > 0;
      });

      for (const session of validSessions) {
        console.log(`Initializing session for ${session.phone}`);
        await startSession(session.phone).catch(console.error);
      }

      //console.log('All valid sessions initialized.');
    } catch (err) {
      console.error('Failed to initialize sessions:', err);
    }
  })();
*/
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
