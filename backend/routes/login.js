const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;
const db = require('../db');
const nodemailer = require('nodemailer');
const crypto = require('crypto');


// Set up gmail access
// Be sure to use app password and not regular password
require('dotenv').config();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


router.post('/login', async (req, res) => {
  console.log("Login request received");
  const { userIdorEmail, password, remember } = req.body;
  console.log("User ID or Email:", userIdorEmail);
  const [rows] = await db.query('SELECT staff_id, password,designation FROM staff WHERE staff_id = ? or email = ?', [userIdorEmail, userIdorEmail]);
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const jwtExpiry = remember ? '7d' : '1h';
  const token = jwt.sign({ staff_id: user.staff_id, designation: user.designation }, SECRET_KEY, { expiresIn: jwtExpiry });

  const cookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  };
  if (remember) {
    cookieOptions.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  }
  // If remember is false, do not set maxAge (session cookie)
  res.cookie('token', token, cookieOptions);

  res.json({ message: 'Logged in successfully', designation: user.designation, staff_id: user.staff_id });
});

router.get('/check_session', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    res.clearCookie('token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });

    const token = jwt.sign({ staff_id: decoded.staff_id, designation: decoded.designation }, SECRET_KEY, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ message: 'Valid token', designation: decoded.designation, staff_id: decoded.staff_id });

  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});


router.post('/reset-password', async (req, res) => {
  const { UserOrEmail, frontendOrigin } = req.body;
  if (!UserOrEmail) {
    return res.status(400).json({ success: false, message: 'User ID or Email is required' });
  }
  try {
    const [rows] = await db.query(
      'SELECT staff_id, email FROM staff WHERE staff_id = ? OR email = ?',
      [UserOrEmail, UserOrEmail]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No user found with this User ID or Email' });
    }
    const user = rows[0];
    if (!user.email) {
      return res.status(400).json({ success: false, message: 'No email associated with this account' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const expiry = Date.now() + 15 * 60 * 1000;

    await db.query('DELETE FROM password_resets WHERE user_id = ?', [user.staff_id]);
    await db.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = ?, expires_at = ?',
      [user.staff_id, hashedToken, expiry, hashedToken, expiry]
    );

    // Use frontendOrigin dynamically
    const origin = frontendOrigin || process.env.FRONTEND_URL;
    const resetLink = `${origin}/reset-password?token=${resetToken}&id=${user.staff_id}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click the link below to reset your password. This link is valid for 15 minutes.</p>
             <a href="${resetLink}">${resetLink}</a>`
    };
    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: 'Password reset link sent to your email' });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


router.get('/reset-password', async (req, res) => {
  const { token, id } = req.query;
  if (!token || !id) {
    return res.status(400).json({ success: false, message: 'Invalid or missing token/id' });
  }

  try {
    const [rows] = await db.query(
      'SELECT token, expires_at FROM password_resets WHERE user_id = ? ',
      [id]
    );

    if (rows.length === 0) {
      console.log("No reset record found for user ID:", id);
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const record = rows[0];
    if (Date.now() > record.expires_at) {
      console.log("Token expired for user ID:", id);
      return res.status(400).json({ success: false, message: 'Token has expired' });
    }

    const isValid = await bcrypt.compare(token, record.token);

    if (!isValid) {
      console.log("Invalid token provided for user ID:", id);
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    return res.json({ success: true, message: 'Token is valid' });

  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/reset-password/confirm', async (req, res) => {
  const { token, id, newPassword } = req.body;

  if (!token || !id || !newPassword) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  try {
    const [rows] = await db.query('SELECT token, expires_at FROM password_resets WHERE user_id = ?', [id]);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const record = rows[0];

    if (Date.now() > record.expires_at) {
      return res.status(400).json({ success: false, message: 'Token has expired' });
    }

    const isValid = await bcrypt.compare(token, record.token);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Update staff and delete reset token
    await db.query('UPDATE staff SET password = ? WHERE staff_id = ?', [hashedPassword, id]);
    await db.query('DELETE FROM password_resets WHERE user_id = ?', [id]);
    return res.json({ success: true, message: 'Password updated successfully' });

  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


module.exports = router;

