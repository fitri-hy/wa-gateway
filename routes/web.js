const express = require('express');
const router = express.Router();
const userMiddleware = require('../middleware/userMiddleware');
const administratorMiddleware = require('../middleware/administratorMiddleware');
const upload = require('../middleware/uploadMiddleware');

const Home = require('../controllers/homeController');
router.get('/', Home.index);

const Auth = require('../controllers/authController');
router.get('/login', Auth.login);
router.post('/login', Auth.loginUser);
router.get('/register', Auth.register);
router.post('/register', Auth.registerUser);
router.get('/forgot-password', Auth.forgot);
router.post('/forgot-password', Auth.forgotPost);
router.get('/logout', Auth.logout);

const Dashboard = require('../controllers/dashboardController');
router.get('/dashboard', userMiddleware, Dashboard.index);

const Session = require('../controllers/sessionController');
router.post('/dashboard', userMiddleware, Session.connect);

const Device = require('../controllers/deviceController');
router.get('/dashboard/devices', userMiddleware, Device.index);
router.post('/dashboard/devices/delete/:phone', userMiddleware, Device.delete);

const Contact = require('../controllers/contactController');
router.get('/dashboard/contact', userMiddleware, Contact.index);
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

module.exports = router;
