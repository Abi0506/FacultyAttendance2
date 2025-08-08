const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;
const db = require('../db');



router.post('/login', async (req, res) => {
  console.log("Login request received");
  const { userId, password } = req.body;
  const [rows] = await db.query('SELECT staff_id, password,designation FROM staff WHERE staff_id = ?', [userId]);
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ staff_id: user.staff_id, designation: user.designation }, SECRET_KEY, { expiresIn: '7d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

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


module.exports = router;

