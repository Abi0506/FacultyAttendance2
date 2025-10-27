const express = require('express');
const router = express.Router();
const db = require('../db'); // your MySQL connection

// For bar graph
router.get('/late-summary', async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
    }

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
            LEFT JOIN report r 
                ON r.staff_id = s.staff_id 
                AND r.date BETWEEN ? AND ?
            GROUP BY d.department
            ORDER BY d.department`,
            [startDate, endDate]
        );

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// For late staff table
router.get('/late-staff', async (req, res) => {
    const { startDate, endDate, department } = req.query;

    if (!startDate || !endDate || !department) {
        return res.status(400).json({ error: 'startDate, endDate and department are required' });
    }

    try {
        const [rows] = await db.execute(
            `SELECT 
                s.staff_id, s.name,
                SUM(CASE WHEN (r.late_mins + r.additional_late_mins) > 0 THEN 1 ELSE 0 END) AS late_count
            FROM staff s
            JOIN report r ON r.staff_id = s.staff_id
            WHERE r.date BETWEEN ? AND ?
            AND s.dept = ?
            GROUP BY s.staff_id, s.name
            HAVING late_count > 0
            `,
            [startDate, endDate, department]
        );

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// For line graph
router.get('/daily-summary', async (req, res) => {
    let { startDate, endDate } = req.query;
    // convert date format
    console.log(startDate, endDate);

    if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
    }

    try {
        // Morning late
        const [lateInRows] = await db.execute(`
            SELECT 
                l.date,
                COUNT(DISTINCT l.staff_id) AS morning_late_count
            FROM (
                SELECT 
                    s.staff_id,
                    l.date,
                    MIN(l.time) AS first_time,
                    c.in_time
                FROM logs l
                JOIN staff s ON s.staff_id = l.staff_id
                JOIN category c ON c.category_no = s.category
                WHERE l.date BETWEEN ? AND ?
                GROUP BY s.staff_id, l.date, c.in_time
            ) AS l
            WHERE TIMESTAMPDIFF(
                MINUTE, 
                CAST(CONCAT(l.date, ' ', l.in_time) AS DATETIME), 
                CAST(CONCAT(l.date, ' ', l.first_time) AS DATETIME)
            ) > 15
            GROUP BY l.date
            ORDER BY l.date
        `, [startDate, endDate]);

        // Evening early
        const [earlyOutRows] = await db.execute(`
            SELECT 
                l.date,
                COUNT(DISTINCT l.staff_id) AS evening_early_count
            FROM (
                SELECT 
                    s.staff_id,
                    l.date,
                    MAX(l.time) AS last_time,
                    c.out_time
                FROM logs l
                JOIN staff s ON s.staff_id = l.staff_id
                JOIN category c ON c.category_no = s.category
                WHERE l.date BETWEEN ? AND ?
                GROUP BY s.staff_id, l.date, c.out_time
            ) AS l
            WHERE TIMESTAMPDIFF(
                MINUTE, 
                CAST(CONCAT(l.date, ' ', l.last_time) AS DATETIME), 
                CAST(CONCAT(l.date, ' ', l.out_time) AS DATETIME)
            ) < 15
            GROUP BY l.date
            ORDER BY l.date
        `, [startDate, endDate]);

        // Merge the two
        const rows = lateInRows.map(lateIn => {
            const earlyOut = earlyOutRows.find(e => new Date(e.date).getTime() === new Date(lateIn.date).getTime());
            return {
                date: lateIn.date,
                morning_late_count: lateIn.morning_late_count,
                evening_early_count: earlyOut ? earlyOut.evening_early_count : 0
            };
        });

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching daily summary" });
    }
});



module.exports = router;
