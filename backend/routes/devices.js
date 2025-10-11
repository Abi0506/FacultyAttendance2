
const express = require('express');
const router = express.Router();
const db = require('../db');


router.post('/toggle_maintenance', async (req, res) => {
    const { id } = req.body;
    try {
        const [rows] = await db.query('SELECT maintenance FROM devices WHERE device_id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        const newMaintenance = rows[0].maintenance ? 0 : 1;
        await db.query('UPDATE devices SET maintenance = ? WHERE device_id = ?', [newMaintenance, id]);
        res.json({ success: true, message: `Device maintenance ${newMaintenance ? 'enabled' : 'disabled'}` });
    } catch (err) {
        console.error("Error toggling maintenance:", err);
        res.status(500).json({ success: false, message: "Failed to toggle maintenance" });
    }
});

router.get('/all', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT device_id, ip_address, device_name, device_location, maintenance FROM devices');
        res.json({ message: "Devices fetched successfully", success: true, devices: rows });
    } catch (err) {
        console.error("Error fetching devices:", err);
        res.status(500).json({ message: "Failed to fetch devices" });
    }
});
router.post('/add', async (req, res) => {
    let { ip_address, device_name, device_location, maintenance } = req.body;

    try {
        const [result] = await db.query(
            'INSERT INTO devices (ip_address, device_name, device_location, maintenance) VALUES (?, ?, ?, ?)',
            [ip_address, device_name, device_location, maintenance || 0]
        );

        const [rows] = await db.query('SELECT * FROM devices WHERE device_id = ?', [result.insertId]);
        res.json({ message: "Device added successfully", success: true, device: rows[0] });
    } catch (err) {
        console.error("Error adding device:", err);
        res.status(500).json({ message: "Failed to add device" });
    }
});


router.post('/update', async (req, res) => {
    let { id, ip_address, device_name, device_location } = req.body;

    try {
        await db.query('UPDATE devices SET ip_address = ?, device_name = ?, device_location = ?  WHERE device_id = ?', [ip_address, device_name, device_location, id]);
        res.json({ message: "Device updated successfully", success: true });
    } catch (err) {
        console.error("Error updating device:", err);
        res.status(500).json({ message: "Failed to update device" });
    }
});
router.post('/delete', async (req, res) => {
    let { id } = req.body;
    try {
        await db.query('DELETE FROM devices WHERE device_id = ?', [id]);
        res.json({ message: "Device deleted successfully", success: true });
    } catch (err) {
        console.error("Error deleting device:", err);
        res.status(500).json({ message: "Failed to delete device" });
    }
});



module.exports = router