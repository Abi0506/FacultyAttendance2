const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming you have a db.js file for database connection

// Route to get user access records
router.get('/access-control', async (req, res) => {
    try {
        const accessRecords = await db.query('SELECT * FROM user_access');
        res.json(accessRecords);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Route to update user access records
router.post('/access-control', async (req, res) => {
    const { userId, page, accessGranted } = req.body;
    try {
        await db.query('INSERT INTO user_access (user_id, page, access_granted) VALUES (?, ?, ?)', [userId, page, accessGranted]);
        res.status(201).send('Access record created');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Route to get user access records
router.get('/access', async (req, res) => {
    try {
        const accessRecords = await db.query('SELECT * FROM user_access');
        res.json(accessRecords);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to update user access
router.post('/access', async (req, res) => {
    const { userId, page, accessGranted } = req.body;
    try {
        await db.query('INSERT INTO user_access (user_id, page, access_granted) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE access_granted = ?', [userId, page, accessGranted, accessGranted]);
        res.status(201).json({ message: 'Access updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;