const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/MySQL');
const { sendMail } = require('../config/SMTP');

const otpStore = {};
const OTP_WAIT_SECONDS = 60 * 1000; // 60 second
const OTP_EXPIRATION = 5 * 60 * 1000; // 5 minutes

exports.login = async (req, res) => {
  if (req.session && req.session.user) {
    const role = req.session.user.role;
    if (role === 'admin') {
      return res.redirect('/administrator');
    } else if (role === 'user') {
      return res.redirect('/dashboard');
    } else {
      req.session.destroy(() => {
        return res.redirect('/login');
      });
    }
  }
  res.render('login');
};

exports.register = async (req, res) => {
  if (req.session && req.session.user) {
    const role = req.session.user.role;
    if (role === 'admin') {
      return res.redirect('/administrator');
    } else if (role === 'user') {
      return res.redirect('/dashboard');
    } else {
      req.session.destroy(() => {
        return res.redirect('/login');
      });
    }
  }
  res.render('register');
};

exports.forgot = (req, res) => {
  res.render('forgot-password', {
    showOtp: false,
    message: null,
    messageType: null,
    email: '',
    otpTimeout: 0
  });
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'Please enter both email and password');
    return res.redirect('/login');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    req.flash('error', 'Invalid email format');
    return res.redirect('/login');
  }

  db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], async (err, results) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Server errort');
      return res.redirect('/login');
    }

    if (results.length === 0) {
      req.flash('error', 'Email is incorrect or not registered');
      return res.redirect('/login');
    }

    const user = results[0];
	
	if (user.status === 'inactive') {
      req.flash('error', 'Your account is inactive. Please contact support.');
      return res.redirect('/login');
    }
	
	if (user.status === 'suspended') {
      req.flash('error', 'Your account is suspended. Please contact support.');
      return res.redirect('/login');
    }
	
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      req.flash('error', 'Incorrect password');
      return res.redirect('/login');
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      token: user.token,
      role: user.role,
      status: user.status,
    };

    if (user.role === 'admin') {
      return res.redirect('/administrator');
    } else if (user.role === 'user') {
      return res.redirect('/dashboard');
    } else {
      req.session.destroy(() => {
        return res.redirect('/login');
      });
    }
  });
};

exports.registerUser = async (req, res) => {
  const { name, email, password, 're-password': confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    req.flash('error', 'All fields are required!');
    return res.redirect('/register');
  }
  
  const nameRegex = /^[a-zA-Z\s]{1,25}$/;
  if (!nameRegex.test(name)) {
    req.flash('error', 'Name must be max 25 characters and contain only letters and spaces.');
    return res.redirect('/register');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    req.flash('error', 'Invalid email format!');
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.flash('error', 'Password must be at least 6 characters!');
    return res.redirect('/register');
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match!');
    return res.redirect('/register');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const role = 'user';
    const status = 'active';

    db.query(
      'INSERT INTO users (name, email, password, token, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email.toLowerCase(), hashedPassword, token, role, status],
      (err) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            req.flash('error', 'Email already registered!');
            return res.redirect('/register');
          }
          console.error(err);
          req.flash('error', 'Error registering user!');
          return res.redirect('/register');
        }

        res.redirect('/login');
      }
    );
  } catch (err) {
    console.error(err);
	req.flash('error', 'Server error!');
	return res.redirect('/register');
  }
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
	  return res.status(500).render('error', {
		title: '500 Internal Server Error',
		message: 'Error logging out',
	  });
    }
    res.redirect('/login');
  });
};

exports.forgotPost = (req, res) => {
  const { email, otp } = req.body;

  if (!email) {
    return res.render('forgot-password', {
      message: 'Email is required',
      messageType: 'error',
      showOtp: false,
      email: '',
      otpTimeout: 0
    });
  }

  const lowerEmail = email.toLowerCase();
  const now = Date.now();

  if (!otp) {
    db.query('SELECT * FROM users WHERE email = ?', [lowerEmail], async (err, results) => {
      if (err) {
        console.error(err);
        return res.render('forgot-password', {
          message: 'Server error',
          messageType: 'error',
          email,
          showOtp: false,
          otpTimeout: 0
        });
      }

      if (results.length === 0) {
        return res.render('forgot-password', {
          message: 'Email not registered',
          messageType: 'error',
          email,
          showOtp: false,
          otpTimeout: 0
        });
      }

      const record = otpStore[lowerEmail];
      if (record && now - record.lastSent < OTP_WAIT_SECONDS) {
        const waitTime = Math.ceil((OTP_WAIT_SECONDS - (now - record.lastSent)) / 1000);
        return res.render('forgot-password', {
          message: `Please wait ${waitTime} seconds before requesting a new OTP.`,
          messageType: 'error',
          email,
          showOtp: true,
          otpTimeout: waitTime
        });
      }

      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore[lowerEmail] = {
        code: generatedOtp,
        expires: now + OTP_EXPIRATION,
        lastSent: now
      };

      try {
        await sendMail({
          to: email,
          subject: 'Your OTP Code',
          text: `Your OTP code is: ${generatedOtp}`
        });

        return res.render('forgot-password', {
          message: 'OTP sent to your email. Please enter OTP below.',
          messageType: 'success',
          showOtp: true,
          email,
          otpTimeout: OTP_WAIT_SECONDS / 1000
        });
      } catch (error) {
        console.error(error);
        return res.render('forgot-password', {
          message: 'Failed to send OTP email',
          messageType: 'error',
          email,
          showOtp: false,
          otpTimeout: 0
        });
      }
    });
  } else {
    const record = otpStore[lowerEmail];
    if (!record) {
      return res.render('forgot-password', {
        message: 'Please request OTP first',
        messageType: 'error',
        email,
        showOtp: false,
        otpTimeout: 0
      });
    }

    if (now > record.expires) {
      delete otpStore[lowerEmail];
      return res.render('forgot-password', {
        message: 'OTP expired. Please request again',
        messageType: 'error',
        email,
        showOtp: false,
        otpTimeout: 0
      });
    }

    if (otp !== record.code) {
      return res.render('forgot-password', {
        message: 'Invalid OTP code',
        messageType: 'error',
        email,
        showOtp: true,
        otpTimeout: 0
      });
    }

    const newPassword = crypto.randomBytes(4).toString('hex');

    bcrypt.hash(newPassword, 10, async (err, hashedPassword) => {
      if (err) {
        console.error(err);
        return res.render('forgot-password', {
          message: 'Server error',
          messageType: 'error',
          email,
          showOtp: true,
          otpTimeout: 0
        });
      }

      db.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, lowerEmail], async (err2) => {
        if (err2) {
          console.error(err2);
          return res.render('forgot-password', {
            message: 'Failed to update password',
            messageType: 'error',
            email,
            showOtp: true,
            otpTimeout: 0
          });
        }

        try {
          await sendMail({
            to: email,
            subject: 'Your New Password',
            text: `Your new password is: ${newPassword}\nPlease login and change your password immediately.`
          });

          delete otpStore[lowerEmail];
          return res.render('forgot-password', {
            message: 'New password sent to your email. Please check your inbox.',
            messageType: 'success',
            email: '',
            showOtp: false,
            otpTimeout: 0
          });
        } catch (error) {
          console.error(error);
          return res.render('forgot-password', {
            message: 'Failed to send new password email',
            messageType: 'error',
            email,
            showOtp: true,
            otpTimeout: 0
          });
        }
      });
    });
  }
};