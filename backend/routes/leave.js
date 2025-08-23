const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;


router.get('/', async (req, res) => {
    const sql = 'SELECT * FROM `leave`';
    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
      
        const decoded = jwt.verify(token, SECRET_KEY);
        const staff_id = decoded.staff_id;

        const { start_date, end_date, leave_type } = req.body;
        const sql = 'INSERT INTO `leave` (staff_id, start_date, end_date, leave_type) VALUES ( ?, ?, ?, ?)';
        
        const [result] = await db.query(sql, [staff_id, start_date, end_date, leave_type]);
        res.json({ leave_id: result.insertId });

    } catch (err) {
        
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: err.message });
    }
});
router.put('/:leave_id', async (req, res) => {
    const { status } = req.body;
    const { leave_id } = req.params;
    const sql = 'UPDATE `leave` SET status = ? WHERE leave_id = ?';
    try {
        await db.query(sql, [status, leave_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
