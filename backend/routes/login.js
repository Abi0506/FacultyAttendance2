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
  const { userIdorEmail, password, remember } = req.body;
  const [rows] = await db.query('SELECT staff_id, password, designation, access_role FROM staff WHERE staff_id = ? or email = ?', [userIdorEmail, userIdorEmail]);
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const jwtExpiry = remember ? '7d' : '1h';
  const token = jwt.sign({ staff_id: user.staff_id, access_role: user.access_role }, SECRET_KEY, { expiresIn: jwtExpiry });

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

  res.json({ message: 'Logged in successfully', access_role: user.access_role, staff_id: user.staff_id });
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

    const token = jwt.sign({ staff_id: decoded.staff_id, access_role: decoded.access_role }, SECRET_KEY, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ message: 'Valid token', access_role: decoded.access_role, staff_id: decoded.staff_id });

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
      'SELECT staff_id, email,name FROM staff WHERE staff_id = ? OR email = ?',
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

    if (!user.email) {
      user.email = 'hr@psgitech.ac.in'
    }

    const mailOptions = {
      from: `Faculty Biometric Attendance`,
      to: user.email,
      subject: 'Password Reset Request – Faculty Biometric Attendance',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; padding: 24px; background-color: #fafafa;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #004aad;">Faculty Attendance System</h2>
          </div>
    
          <p>Dear <strong>${user.name}</strong>,</p>
    
          <p>We received a request to reset your password for your Faculty Attendance System account.</p>
          <p>
            To proceed, please click the button below. This link will remain valid for <strong>15 minutes</strong>.
          </p>
    
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #004aad; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
               Reset Password
            </a>
          </div>
    
          <p>If the button above doesn’t work, you can copy and paste the link below into your browser:</p>
          <p style="word-break: break-all; color: #004aad;">
            <a href="${resetLink}">${resetLink}</a>
          </p>
    
          <p>If you did not request this password reset, please ignore this email. Your account will remain secure.</p>
    
          <br>
          <p>Kind regards,</p>
          <p>
             Faculty Biometric Attendance<br>
          </p>
    
          <hr style="margin-top: 30px;">
          <p style="font-size: 12px; color: #777; text-align: center;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: `Password reset link sent to ${user.email}` });
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

