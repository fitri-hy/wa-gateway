const express = require('express');
const router = express.Router();
const { loginLimiterCheck, registerLimiterCheck } = require('../middleware/rateLimiterMiddleware.js');
const userMiddleware = require('../middleware/userMiddleware');
const administratorMiddleware = require('../middleware/administratorMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { recaptcha, recaptchaMiddleware } = require('../middleware/recaptchaMiddleware');

const Home = require('../controllers/homeController');
router.get('/', Home.index);

const Agreement = require('../controllers/agreementController');
router.get('/privacy-policy', Agreement.privacy);
router.get('/terms-conditions', Agreement.term);

const Auth = require('../controllers/authController');
router.get('/login', loginLimiterCheck, Auth.login);
router.post('/login', recaptchaMiddleware, Auth.loginUser);
router.get('/register', registerLimiterCheck, Auth.register);
router.post('/register', recaptchaMiddleware, Auth.registerUser);
router.get('/forgot-password', Auth.forgot);
router.post('/forgot-password', recaptchaMiddleware, Auth.forgotPost);
router.post('/login-google', Auth.googleLogin);
router.get('/logout', Auth.logout);

const Dashboard = require('../controllers/dashboardController');
router.get('/dashboard', userMiddleware, Dashboard.index);
router.get('/dashboard/api/stats', userMiddleware, Dashboard.apiStats);

const Session = require('../controllers/sessionController');
router.post('/dashboard', userMiddleware, Session.connect);

const Device = require('../controllers/deviceController');
router.get('/dashboard/devices', userMiddleware, Device.index);
router.post('/dashboard/devices/delete/:phone', userMiddleware, Device.delete);

const Contact = require('../controllers/contactController');
router.get('/dashboard/contact', userMiddleware, Contact.index);
router.post('/dashboard/contact/import', userMiddleware, upload.single('file'), Contact.import);
router.post('/dashboard/contact/save', userMiddleware, Contact.store);
router.post('/dashboard/contact/update/:id', userMiddleware, Contact.update);
router.post('/dashboard/contact/delete/:id', userMiddleware, Contact.delete);

const FileManager = require('../controllers/fileManagerController');
router.get('/dashboard/file-manager', userMiddleware, FileManager.index);
router.post('/dashboard/file-manager/upload', userMiddleware, upload.single('file'), FileManager.upload);
router.post('/dashboard/file-manager/delete/:id', userMiddleware, FileManager.deleteFile);

const Sending = require('../controllers/sendingController');
router.get('/dashboard/sending', userMiddleware, Sending.index);
router.post('/dashboard/sending/delete/:id', userMiddleware, Sending.delete);
router.post('/dashboard/sending/text-message', userMiddleware, Sending.text);
router.post('/dashboard/sending/image-message', userMiddleware, Sending.image);
router.post('/dashboard/sending/video-message', userMiddleware, Sending.video);
router.post('/dashboard/sending/audio-message', userMiddleware, Sending.audio);
router.post('/dashboard/sending/document-message', userMiddleware, Sending.document);
router.post('/dashboard/sending/location-message', userMiddleware, Sending.location);
router.post('/dashboard/sending/sticker-message', userMiddleware, Sending.sticker);

const Broadcast = require('../controllers/broadcastController');
router.get('/dashboard/broadcast', userMiddleware, Broadcast.index);
router.post('/dashboard/broadcast/delete/:id', userMiddleware, Broadcast.delete);
router.post('/dashboard/broadcast/text-message', userMiddleware, Broadcast.text);
router.post('/dashboard/broadcast/image-message', userMiddleware, Broadcast.image);
router.post('/dashboard/broadcast/video-message', userMiddleware, Broadcast.video);
router.post('/dashboard/broadcast/audio-message', userMiddleware, Broadcast.audio);
router.post('/dashboard/broadcast/document-message', userMiddleware, Broadcast.document);
router.post('/dashboard/broadcast/location-message', userMiddleware, Broadcast.location);
router.post('/dashboard/broadcast/sticker-message', userMiddleware, Broadcast.sticker);

const AutoReply = require('../controllers/autoReplyController');
router.get('/dashboard/auto-reply', userMiddleware, AutoReply.index);
router.post('/dashboard/auto-reply/create', userMiddleware, AutoReply.create);
router.post('/dashboard/auto-reply/delete/:id', AutoReply.delete);

const Plugin = require('../controllers/pluginController');
router.get('/dashboard/plugin', userMiddleware, Plugin.index);
router.post('/dashboard/plugin/enable', userMiddleware, Plugin.enablePlugin);

const RestApi = require('../controllers/restApiController');
router.get('/dashboard/rest-api', userMiddleware, RestApi.index);
router.post('/dashboard/rest-api/regenerate-token', userMiddleware, RestApi.regenerateToken);

const Reports = require('../controllers/reportsController');
router.get('/dashboard/reports', userMiddleware, Reports.index);
router.post('/dashboard/reports/add', userMiddleware, Reports.addReport);

const Settings = require('../controllers/settingsController');
router.get('/dashboard/settings', userMiddleware, Settings.index);
router.post('/dashboard/settings/update', userMiddleware, Settings.update);
router.post('/dashboard/settings/password', userMiddleware, Settings.password);

const { sendMessage } = require('../controllers/webhookController');
router.post('/api/webhook', sendMessage);

const Administrator = require('../controllers/administratorController');
router.get('/administrator', administratorMiddleware, Administrator.index);
router.get('/administrator/users', administratorMiddleware, Administrator.users);
router.post('/administrator/users/update', administratorMiddleware, Administrator.usersUpdate);
router.post('/administrator/users/delete/:id', administratorMiddleware, Administrator.usersDelete);
router.get('/administrator/devices', administratorMiddleware, Administrator.devices);
router.post('/administrator/devices/delete/:phone', administratorMiddleware, Administrator.devicesDelete);
router.get('/administrator/contacts', administratorMiddleware, Administrator.contacts);
router.post('/administrator/contacts/delete/:id', administratorMiddleware, Administrator.contactsDelete);
router.get('/administrator/files', administratorMiddleware, Administrator.files);
router.post('/administrator/files/delete/:id', administratorMiddleware, Administrator.filesDelete);
router.get('/administrator/sending', administratorMiddleware, Administrator.sending);
router.post('/administrator/sending/delete/:id', administratorMiddleware, Administrator.sendingDelete);
router.get('/administrator/broadcasts', administratorMiddleware, Administrator.broadcasts);
router.post('/administrator/broadcasts/delete/:id', administratorMiddleware, Administrator.broadcastsDelete);
router.get('/administrator/auto-reply', administratorMiddleware, Administrator.autoreply);
router.post('/administrator/auto-reply/delete/:id', administratorMiddleware, Administrator.autoreplyDelete);
router.get('/administrator/ads', administratorMiddleware, Administrator.ads);
router.post('/administrator/ads/add', administratorMiddleware, Administrator.adsAdd);
router.post('/administrator/ads/edit/:id', administratorMiddleware, Administrator.adsEdit);
router.post('/administrator/ads/delete/:id', administratorMiddleware, Administrator.adsDelete);
router.get('/administrator/plugins', administratorMiddleware, Administrator.plugins);
router.get('/administrator/plugins/views', administratorMiddleware, Administrator.pluginPreviewForm);
router.post('/administrator/plugins/add', administratorMiddleware, Administrator.addPlugin);
router.post('/administrator/plugins/edit', administratorMiddleware, Administrator.editPlugin);
router.post('/administrator/plugins/delete/:name', administratorMiddleware, Administrator.deletePlugin);
router.get('/administrator/subscribe', administratorMiddleware, Administrator.subscribe);
router.post('/administrator/subscribe/add', administratorMiddleware, Administrator.addSubscribe);
router.post('/administrator/subscribe/edit/:id', administratorMiddleware, Administrator.editSubscribe);
router.post('/administrator/subscribe/delete/:id', administratorMiddleware, Administrator.deleteSubscribe);
router.get('/administrator/language', administratorMiddleware, Administrator.language);
router.post('/administrator/language/edit', administratorMiddleware, Administrator.editLanguage);
router.get('/administrator/reports', administratorMiddleware, Administrator.reports);
router.post('/administrator/reports', administratorMiddleware, Administrator.editResponse);
router.post('/administrator/reports/delete/:id', administratorMiddleware, Administrator.deleteResponse );

router.get('/lang', (req, res) => {
  const currentLang = req.getLocale();
  const nextLang = currentLang === 'en' ? 'id' : 'en';
  res.cookie('lang', nextLang, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });
  const referer = req.get('Referer');
  if (referer) {
    res.redirect(referer);
  } else {
    res.redirect('/');
  }
});


module.exports = router;
