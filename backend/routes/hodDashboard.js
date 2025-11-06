const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Get departments accessible by HOD
router.get('/accessible-departments', verifyToken, async (req, res) => {
    try {
        const staffId = req.user.staff_id;

        const [departments] = await db.execute(
            `SELECT DISTINCT department 
             FROM hod_department_access 
             WHERE staff_id = ?
             ORDER BY department ASC`,
            [staffId]
        );

        res.json({
            success: true,
            departments: departments.map(d => d.department)
        });
    } catch (err) {
        console.error('Error fetching accessible departments:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch accessible departments'
        });
    }
});

// Get daily summary (line graph data) for HOD's departments
router.get('/daily-summary', verifyToken, async (req, res) => {
    const { startDate, endDate } = req.query;
    const staffId = req.user.staff_id;

    if (!startDate || !endDate) {
        return res.status(400).json({
            success: false,
            message: 'startDate and endDate are required'
        });
    }

    try {
        // Get HOD's accessible departments
        const [accessibleDepts] = await db.execute(
            `SELECT DISTINCT department FROM hod_department_access WHERE staff_id = ?`,
            [staffId]
        );

        if (accessibleDepts.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const deptList = accessibleDepts.map(d => d.department);
        const placeholders = deptList.map(() => '?').join(',');

        // Morning late count
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
                AND s.dept IN (${placeholders})
                GROUP BY s.staff_id, l.date, c.in_time
            ) AS l
            WHERE TIMESTAMPDIFF(
                MINUTE, 
                CAST(CONCAT(l.date, ' ', l.in_time) AS DATETIME), 
                CAST(CONCAT(l.date, ' ', l.first_time) AS DATETIME)
            ) > 15
            AND EXISTS (SELECT 1 FROM report r WHERE r.date = l.date)
            GROUP BY l.date
            ORDER BY l.date
        `, [startDate, endDate, ...deptList]);

        // Evening early count
        const [earlyOutRows] = await db.execute(`
            SELECT 
                l.date,
                COUNT(DISTINCT l.staff_id) AS evening_early_count
            FROM (
                SELECT 
                    s.staff_id,
                    l.date,
                    MAX(l.time) AS last_time,
                    c.out_time,
                    COUNT(*) AS log_count
                FROM logs l
                JOIN staff s ON s.staff_id = l.staff_id
                JOIN category c ON c.category_no = s.category
                WHERE l.date BETWEEN ? AND ?
                AND s.dept IN (${placeholders})
                GROUP BY s.staff_id, l.date, c.out_time
                HAVING log_count >= 2
            ) AS l
            WHERE TIMESTAMPDIFF(
                MINUTE, 
                CAST(CONCAT(l.date, ' ', l.last_time) AS DATETIME), 
                CAST(CONCAT(l.date, ' ', l.out_time) AS DATETIME)
            ) > 15
            GROUP BY l.date
            ORDER BY l.date
        `, [startDate, endDate, ...deptList]);

        // Merge the results
        const rows = lateInRows.map(lateIn => {
            const earlyOut = earlyOutRows.find(e =>
                new Date(e.date).getTime() === new Date(lateIn.date).getTime()
            );
            return {
                date: lateIn.date,
                morning_late_count: lateIn.morning_late_count,
                evening_early_count: earlyOut ? earlyOut.evening_early_count : 0
            };
        });

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching daily summary:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch daily summary'
        });
    }
});

// Get staff details for a specific date (for line graph drill-down)
router.get('/daily-staff', verifyToken, async (req, res) => {
    const { date } = req.query;
    const staffId = req.user.staff_id;

    if (!date) {
        return res.status(400).json({
            success: false,
            message: 'date is required'
        });
    }

    try {
        // Get HOD's accessible departments
        const [accessibleDepts] = await db.execute(
            `SELECT DISTINCT department FROM hod_department_access WHERE staff_id = ?`,
            [staffId]
        );

        if (accessibleDepts.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const deptList = accessibleDepts.map(d => d.department);
        const placeholders = deptList.map(() => '?').join(',');

        // Morning late staff
        const [morningRows] = await db.execute(`
            SELECT 
                s.staff_id,
                s.name,
                s.dept,
                MIN(l.time) AS actual_time,
                c.in_time AS expected_time,
                'Late In' AS type,
                TIMESTAMPDIFF(
                    MINUTE, 
                    CAST(CONCAT(l.date, ' ', c.in_time) AS DATETIME), 
                    MIN(CAST(CONCAT(l.date, ' ', l.time) AS DATETIME))
                ) AS minutes_diff
            FROM staff s
            JOIN logs l ON s.staff_id = l.staff_id
            JOIN category c ON c.category_no = s.category
            WHERE l.date = ?
            AND s.dept IN (${placeholders})
            GROUP BY s.staff_id, s.name, s.dept, c.in_time, l.date
            HAVING minutes_diff > 15
            ORDER BY s.dept, s.name
        `, [date, ...deptList]);

        // Evening early staff
        const [eveningRows] = await db.execute(`
            SELECT 
                s.staff_id,
                s.name,
                s.dept,
                MAX(l.time) AS actual_time,
                c.out_time AS expected_time,
                'Early Out' AS type,
                TIMESTAMPDIFF(
                    MINUTE, 
                    MAX(CAST(CONCAT(l.date, ' ', l.time) AS DATETIME)),
                    CAST(CONCAT(l.date, ' ', c.out_time) AS DATETIME)
                ) AS minutes_diff,
                COUNT(*) AS log_count
            FROM staff s
            JOIN logs l ON s.staff_id = l.staff_id
            JOIN category c ON c.category_no = s.category
            WHERE l.date = ?
            AND s.dept IN (${placeholders})
            GROUP BY s.staff_id, s.name, s.dept, c.out_time, l.date
            HAVING minutes_diff > 15 AND log_count >= 2
            ORDER BY s.dept, s.name
        `, [date, ...deptList]);

        const combinedRows = [...morningRows, ...eveningRows];
        res.json({ success: true, data: combinedRows });
    } catch (err) {
        console.error('Error fetching daily staff:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch daily staff details'
        });
    }
});

// Get department summary (table data) for HOD's accessible departments
router.get('/department-summary', verifyToken, async (req, res) => {
    const { startDate, endDate } = req.query;
    const staffId = req.user.staff_id;

    if (!startDate || !endDate) {
        return res.status(400).json({
            success: false,
            message: 'startDate and endDate are required'
        });
    }

    try {
        // Get HOD's accessible departments
        const [accessibleDepts] = await db.execute(
            `SELECT DISTINCT department FROM hod_department_access WHERE staff_id = ?`,
            [staffId]
        );

        if (accessibleDepts.length === 0) {
            return res.json({
                success: true,
                data: {},
                date: [startDate, endDate]
            });
        }

        const deptList = accessibleDepts.map(d => d.department);
        const placeholders = deptList.map(() => '?').join(',');

        // Get staff summary data grouped by department and category
        const [rows] = await db.execute(`
            SELECT 
                s.staff_id,
                s.name,
                s.dept,
                s.designation,
                s.email,
                c.category_description,
                SUM(r.late_mins + IFNULL(r.additional_late_mins, 0)) AS total_late_mins,
                SUM(CASE 
                    WHEN (r.late_mins + IFNULL(r.additional_late_mins, 0)) > 15 
                    THEN (r.late_mins + IFNULL(r.additional_late_mins, 0)) 
                    ELSE 0 
                END) AS filtered_late_mins,
                FLOOR(SUM(CASE 
                    WHEN (r.late_mins + IFNULL(r.additional_late_mins, 0)) > 15 
                    THEN (r.late_mins + IFNULL(r.additional_late_mins, 0)) 
                    ELSE 0 
                END) / 240) AS deducted_days
            FROM report r
            JOIN staff s ON s.staff_id = r.staff_id
            JOIN category c ON c.category_no = s.category
            WHERE r.date BETWEEN ? AND ?
            AND s.dept IN (${placeholders})
            GROUP BY s.dept, s.staff_id, s.name, s.designation, s.email, c.category_description
            ORDER BY s.dept, s.staff_id
        `, [startDate, endDate, ...deptList]);

        // Structure data by category and department
        const result = {};
        for (const row of rows) {
            const category = row.category_description;
            const dept = row.dept;

            if (!result[category]) {
                result[category] = {};
            }
            if (!result[category][dept]) {
                result[category][dept] = [];
            }

            result[category][dept].push({
                staff_id: row.staff_id,
                name: row.name,
                designation: row.designation,
                email: row.email,
                filtered_late_mins: Number(row.filtered_late_mins) || 0,
                total_late_mins: Number(row.total_late_mins) || 0,
                deducted_days: Number(row.deducted_days) || 0,
                dept: row.dept
            });
        }

        res.json({
            success: true,
            data: result,
            date: [startDate, endDate]
        });
    } catch (err) {
        console.error('Error fetching department summary:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch department summary'
        });
    }
});

module.exports = router;
