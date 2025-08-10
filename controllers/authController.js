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
    if (role === 'admin' || role === 'superadmin') {
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
    if (role === 'admin' || role === 'superadmin') {
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
    req.flash('error', res.__('flash.Please enter both email and password'));
    return res.redirect('/login');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    req.flash('error', res.__('flash.Invalid email format'));
    return res.redirect('/login');
  }

  db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], async (err, results) => {
    if (err) {
      console.error(err);
      req.flash('error', res.__('flash.Server error'));
      return res.redirect('/login');
    }

    if (results.length === 0) {
      req.flash('error', res.__('flash.Email is incorrect or not registered'));
      return res.redirect('/login');
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      req.flash('error', res.__('flash.Incorrect password'));
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

    if (user.status === 'inactive') {
      req.flash('error', res.__('flash.Your account is inactive'));
      return res.redirect('/login');
    }

    if (user.status === 'suspended') {
      req.flash('error', res.__('flash.Your account is suspended'));
      return res.redirect('/login');
    }

    if (user.role === 'admin' || user.role === 'superadmin') {
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
    req.flash('error', res.__('flash.All fields are required'));
    return res.redirect('/register');
  }
  
  const nameRegex = /^[a-zA-Z\s]{1,25}$/;
  if (!nameRegex.test(name)) {
    req.flash('error', res.__('flash.Name must be max 25 characters and contain only letters and spaces'));
    return res.redirect('/register');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    req.flash('error', res.__('flash.Invalid email format'));
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.flash('error', res.__('flash.Password must be at least 6 characters'));
    return res.redirect('/register');
  }

  if (password !== confirmPassword) {
    req.flash('error', res.__('flash.Passwords do not match'));
    return res.redirect('/register');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const role = 'user';
    const status = 'active';

    const [packageRows] = await db.promise().query(
      'SELECT duration_days FROM packages WHERE id = ?',
      [1]
    );

    if (packageRows.length === 0) {
      req.flash('error', res.__('flash.Default package not found'));
      return res.redirect('/register');
    }

    const durationDays = packageRows[0].duration_days;
    if (durationDays <= 0) {
      req.flash('error', res.__('flash.Invalid package duration'));
      return res.redirect('/register');
    }

    const packageStart = new Date();
    const packageEnd = new Date(packageStart);
    packageEnd.setDate(packageEnd.getDate() + durationDays - 1);

	function formatDateToMySQL(date) {
	  const yyyy = date.getFullYear();
	  const mm = String(date.getMonth() + 1).padStart(2, '0');
	  const dd = String(date.getDate()).padStart(2, '0');
	  const hh = String(date.getHours()).padStart(2, '0');
	  const mi = String(date.getMinutes()).padStart(2, '0');
	  const ss = String(date.getSeconds()).padStart(2, '0');
	  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
	}

    const packageStartStr = formatDateToMySQL(packageStart);
    const packageEndStr = formatDateToMySQL(packageEnd);

    await db.promise().query(
      `INSERT INTO users 
       (name, email, password, token, role, status, package_id, package_start, package_end) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email.toLowerCase(), hashedPassword, token, role, status, 1, packageStartStr, packageEndStr]
    );

    res.redirect('/login');

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      req.flash('error', res.__('flash.Email already registered'));
      return res.redirect('/register');
    }
    console.error(err);
    req.flash('error', res.__('flash.Server error'));
    return res.redirect('/register');
  }
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
	  return res.status(500).render('error', {
        title: res.__('error.Internal Server Error'),
        message: res.__('error.It seems there was an error'),
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