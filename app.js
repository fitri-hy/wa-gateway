require('dotenv').config();
const express = require('express');
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
  
  const sessionsDir = path.join(__dirname, 'sessions');
  if (fs.existsSync(sessionsDir)) {
    const phones = fs.readdirSync(sessionsDir);
    phones.forEach(phone => {
      const sessionPath = path.join(sessionsDir, phone);
      if (fs.lstatSync(sessionPath).isDirectory()) {
        startSession(phone).catch(console.error);
      }
    });
  }
  
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
