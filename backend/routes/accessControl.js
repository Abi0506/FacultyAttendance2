const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming you have a db.js file for database connection

// Get access roles for pages
router.get('/access-roles', async (req, res) => {
    try {
        const accessRoles = await db.query('SELECT * FROM access_roles');
        res.json(accessRoles);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get user access records
router.get('/user-access', async (req, res) => {
    try {
        const userAccess = await db.query('SELECT * FROM user_access');
        res.json(userAccess);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;