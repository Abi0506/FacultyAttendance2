const express = require('express');
const router = express.Router();
const db = require('../db'); // your MySQL connection

router.get('/late-summary', async (req, res) => {
    const { range } = req.query;
    const now = new Date();
    let startDate;

    // Determine startDate based on range
    if (range === 'day') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (range === 'week') {
        const first = now.getDate() - now.getDay(); // start of week (Sunday)
        startDate = new Date(now.setDate(first));
    } else if (range === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const formattedStartDate = startDate.toISOString().slice(0, 10);


    try {
        const [rows] = await db.execute(
            `SELECT 
            d.department AS department,
            COALESCE(COUNT(CASE WHEN (r.late_mins + r.additional_late_mins) > 0 THEN 1 END), 0) AS late_count
        FROM (
            SELECT DISTINCT dept AS department
            FROM staff
        ) AS d
        LEFT JOIN staff s ON s.dept = d.department
        LEFT JOIN report r ON r.staff_id = s.staff_id AND r.date >= ?
        GROUP BY d.department
        ORDER BY d.department`,
            [formattedStartDate]
        );

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }

});

module.exports = router;
