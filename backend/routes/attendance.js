const express = require('express');
const router = express.Router();
const db = require('../db');

async function start_end_time() {
  const today = new Date();
  const year = today.getFullYear();
  let start;
  if (today < new Date(`${year}-06-01`)) {
    start = `${year}-01-01`;
  } else {
    start = `${year}-06-01`;
  }
  return [start, today.toISOString().split('T')[0]];
}


function absent_marked(summary) {
  let leaves = 0;
  let num = Number(summary);
  if (num >= 360) {
    num -= 360;
    leaves += 0.5;
    while (num > 240) {
      num -= 240;
      leaves += 0.5;
    }
  }
  return [leaves, Number(summary)];
}

router.post('/flag_time', async (req, res) => {
  try {
    const { staff_id, date, time } = req.body;

    if (!staff_id || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if the flag already exists
    const [existing] = await db.query(
      `SELECT id FROM attendance_flags WHERE staff_id = ? AND date = ? AND time = ?`,
      [staff_id, date, time]
    );

    if (existing.length > 0) {
      // Flag exists → revoke it
      await db.query(
        `DELETE FROM attendance_flags WHERE staff_id = ? AND date = ? AND time = ?`,
        [staff_id, date, time]
      );
      return res.json({ message: 'Flag revoked', revoked: true });
    }

    // Otherwise → insert new flag
    await db.query(
      `INSERT INTO attendance_flags (staff_id, date, time) VALUES (?, ?, ?)`,
      [staff_id, date, time]
    );

    res.json({ message: 'Flagged successfully', revoked: false });
  } catch (err) {
    console.error('Error toggling flag:', err);
    res.status(500).json({ error: 'Failed to toggle flag' });
  }
});


// Fetch all flagged times for a specific date
router.post('/get_flags', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const [rows] = await db.query(
      `SELECT staff_id, \`time\` FROM attendance_flags WHERE \`date\` = ?`,
      [date]
    );

    // Return as { staff_id_timeValue: true }
    const flaggedMap = {};
    rows.forEach(row => {
      const timeStr = row.time.toString().slice(0, 8); // 'HH:MM:SS'
      flaggedMap[`${row.staff_id}_${timeStr}`] = true;
    });

    res.json(flaggedMap);

  } catch (err) {
    console.error('Error fetching flagged times:', err);
    res.status(500).json({ error: 'Failed to fetch flagged times' });
  }
});

// Fetch all flagged times for a staff member in a date range
router.post('/get_flags_for_staff', async (req, res) => {
  try {
    const { staff_id, start_date, end_date } = req.body;
    if (!staff_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'staff_id, start_date and end_date are required' });
    }

    const [rows] = await db.query(
      `SELECT \`date\`, \`time\` FROM attendance_flags 
       WHERE staff_id = ? AND \`date\` BETWEEN ? AND ?`,
      [staff_id, start_date, end_date]
    );

    // Return as { staff_id_date_time: true }
    const flaggedMap = {};
    rows.forEach(row => {
      const timeStr = row.time.toString().slice(0, 8); // 'HH:MM:SS'
      flaggedMap[`${staff_id}_${row.date}_${timeStr}`] = true;
    });

    res.json(flaggedMap);

  } catch (err) {
    console.error('Error fetching flagged times for staff:', err);
    res.status(500).json({ error: 'Failed to fetch flagged times' });
  }
});



router.post('/attendance_viewer', async (req, res) => {
  const { date } = req.body;
  try {
    const [rows] = await db.query(
      `SELECT logs.staff_id, logs.time, staff.name 
       FROM staff JOIN logs ON staff.staff_id = logs.staff_id 
       WHERE date = ? ORDER BY time`, [date]
    );
    const categorized = {};
    for (const { staff_id, name, time } of rows) {
      if (!categorized[staff_id]) categorized[staff_id] = { name, times: [] };
      categorized[staff_id].times.push(time);
    }
    const result = Object.entries(categorized).map(([staff_id, { name, times }]) => ({
      staff_id,
      name,
      IN1: times[0] || null,
      OUT1: times[1] || null,
      IN2: times[2] || null,
      OUT2: times[3] || null,
      IN3: times[4] || null,
      OUT3: times[5] || null,
    }));
    res.json(result);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


async function getAbsentDays(staff_id, fromDate, toDate) {
  const [absents] = await db.query(
    `SELECT COUNT(*) AS absent_days FROM report WHERE staff_id = ? AND date BETWEEN ? AND ? AND attendance = 'A'`,
    [staff_id, fromDate, toDate]
  );
  return absents[0]?.absent_days || 0;
}

// Helper to get total late minutes
async function getTotalLateMins(staff_id, fromDate, toDate) {
  const [result] = await db.query(
    `SELECT SUM(late_mins) AS total_late_mins FROM report WHERE staff_id = ? AND date BETWEEN ? AND ?`,
    [staff_id, fromDate, toDate]
  );
  return result[0]?.total_late_mins || 0;
}

router.get('/department_categories', async (req, res) => {

  try {

    const [rows] = await db.query(`
            SELECT DISTINCT c.category_description, s.dept
            FROM staff s
            JOIN category c ON s.category = c.category_no
            JOIN department d ON s.dept = d.dept
            ORDER BY c.category_description, s.dept
        `);
    const categories = {};
    for (const row of rows) {
      const key = row.category_description;
      if (!categories[key]) {
        categories[key] = [];
      }
      categories[key].push(row.dept);
    }
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching department categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


router.post('/dept_summary', async (req, res) => {
  let { start_date, end_date, category, dept } = req.body;
  const today = new Date();
  const year = today.getFullYear();
  let resetDate = today < new Date(`${year}-06-01`) ? `${year}-01-01` : `${year}-06-01`;

  if (!start_date) start_date = resetDate;
  if (!end_date) end_date = today.toISOString().split('T')[0];
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ error: 'End date cannot be before start date' });
  }

  let rows = [];
  let result = {};

  function addEntry(category, dept, entry) {
    if (!result[category]) result[category] = {};
    if (!result[category][dept]) result[category][dept] = [];
    result[category][dept].push(entry);
  }

  try {
    if (category === 'ALL') {
      [rows] = await db.query(`
        SELECT s.staff_id, s.name, s.dept, s.designation, s.email,
               SUM(r.late_mins) AS summary,
               c.category_description AS category
        FROM report r
        JOIN staff s ON s.staff_id = r.staff_id
        JOIN category c ON c.category_no = s.category
        JOIN department d ON s.dept = d.dept
        WHERE r.date BETWEEN ? AND ?
        ${dept && dept !== 'ALL' ? 'AND s.dept = ?' : ''}
        GROUP BY s.dept, s.staff_id, s.name, s.designation, s.email, c.category_description
        ORDER BY s.staff_id
      `, dept && dept !== 'ALL' ? [start_date, end_date, dept] : [start_date, end_date]);
    } else {
      [rows] = await db.query(`
        SELECT s.staff_id, s.name, s.dept, s.designation, s.email,
               SUM(r.late_mins) AS summary,
               c.category_description AS category
        FROM report r
        JOIN staff s ON s.staff_id = r.staff_id
        JOIN category c ON c.category_no = s.category
        JOIN department d ON s.dept = d.dept
        WHERE r.date BETWEEN ? AND ? AND s.dept = ?
        GROUP BY s.dept, s.staff_id, s.name, s.designation, s.email, c.category_description
        ORDER BY s.staff_id
      `, [start_date, end_date, dept]);
    }

    for (const row of rows) {
      const { dept, summary, category, staff_id, ...rest } = row;
      const [leaves, num1] = absent_marked(summary || 0);
      const absent_days = await getAbsentDays(staff_id, start_date, end_date);
      const total_late_mins = await getTotalLateMins(staff_id, resetDate, today.toISOString().split('T')[0]);
      const [leaves_reset] = absent_marked(total_late_mins);
      const total_absent_days = await getAbsentDays(staff_id, resetDate, today.toISOString().split('T')[0]);
      const total_marked_days = total_absent_days + leaves_reset;

      addEntry(category, dept, {
        staff_id,
        ...rest,
        summary: Number(num1) || 0,
        absent_days: Number(absent_days) || 0,
        total_late_mins: Number(total_late_mins) || 0,
        total_absent_days: Number(total_absent_days) || 0,
        total_marked_days: Number(total_marked_days) || 0,
        dept
      });
    }

    function formatDate(dateStr) {
      if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Invalid date';
      const [yyyy, mm, dd] = dateStr.split('-');
      return `${dd}-${mm}-${yyyy}`;
    }

    const start_Date = formatDate(start_date);
    const end_Date = formatDate(end_date);
    const total_marked_days_col = 'Total Marked Days';

    res.json({ date: [start_Date, end_Date], data: result, total_marked_days_col });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



router.post('/department', async (req, res) => {

  try {

    const [departments] = await db.query('SELECT dept FROM department ORDER BY dept ASC');
    res.json({ success: true, departments });
  } catch (error) {

    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/add_department', async (req, res) => {
  const { dept } = req.body;
  if (!dept || !dept.trim()) {
    return res.status(400).json({ success: false, message: 'Department name cannot be empty' });
  }
  try {
    const [existing] = await db.query('SELECT dept FROM department WHERE dept = ?', [dept.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Department already exists' });
    }
    await db.query('INSERT INTO department (dept) VALUES (?)', [dept.trim()]);
    res.json({ success: true, message: 'Department added successfully' });
  } catch (error) {

    res.status(500).json({ success: false, message: error.message });
  }

});
router.post('/add_designation', async (req, res) => {
  const { designation } = req.body;
  if (!designation || !designation.trim()) {
    return res.status(400).json({ success: false, message: 'Designation name cannot be empty' });
  }
  try {
    const [existing] = await db.query('SELECT designation FROM designation WHERE designation = ?', [designation.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Designation already exists' });
    }
    await db.query('INSERT INTO designation (designation) VALUES (?)', [designation.trim()]);
    res.json({ success: true, message: 'Designation added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/designation', async (req, res) => {

  try {

    const [designations] = await db.query('SELECT designation FROM designation ORDER BY designation ASC');
    res.json({ success: true, designations });
  } catch (error) {

    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/individual_data', async (req, res) => {
  function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }
  function minutesToHHMM(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, '0')}hr${hrs !== 1 ? 's' : ''} ${mins.toString().padStart(2, '0')}mins`;
  }

  const { start_date, end_date, id } = req.body;

  const [start, end] = await start_end_time();
  try {
    const [rows] = await db.query(`
      SELECT logs.date, logs.time
      FROM logs 
      WHERE logs.date BETWEEN ? AND ? AND logs.staff_id = ?
      ORDER BY logs.date, logs.time
    `, [start_date, end_date, id]);

    const [staffInfo] = await db.query(`
      SELECT staff.name, staff.dept, staff.category, staff.designation
      FROM staff
      WHERE staff.staff_id = ?
    `, [id]);

    let [late_mins] = await db.query(`
      SELECT late_mins, date
      FROM report
      WHERE staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start_date, end_date]);

    let [late_mins_1] = await db.query(`
      SELECT SUM(late_mins) AS late_mins
      FROM report
      WHERE staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start_date, end_date]);

    let [total_late_mins] = await db.query(`
      SELECT SUM(late_mins) AS total_late_mins
      FROM report
      WHERE staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start, end]);

    let [absent_days] = await db.query(`
        SELECT
           COUNT(attendance) as absent
        FROM
            report
      WHERE staff_id = ? AND date BETWEEN ? AND ? AND attendance = ?
    `, [id, start_date, end_date, 'A']);

    let [total_absent_days] = await db.query(`
       SELECT
           COUNT(attendance) as absent
        FROM
            report
      WHERE staff_id = ? AND date BETWEEN ? AND ? AND attendance = ?
    `, [id, start, end, 'a']);

    // Get filtered late minutes (between start_date and end_date)
    let [filtered_late_mins] = await db.query(`
      SELECT SUM(late_mins) AS filtered_late_mins
      FROM report
      WHERE staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start_date, end_date]);

    if (!staffInfo.length) return res.status(404).json({ error: 'Staff member not found.' });

    const groupedByDate = {};
    for (const row of rows) {
      if (!groupedByDate[row.date]) groupedByDate[row.date] = [];
      groupedByDate[row.date].push(row.time);
    }

    const result = [];
    for (const [date, times] of Object.entries(groupedByDate)) {
      times.sort();
      const row = { date: date.split('-').reverse().join('-') };
      let totalMinutes = 0;
      for (let i = 0; i < 3; i++) {
        const inTime = times[i * 2] || null;
        const outTime = times[i * 2 + 1] || null;
        row[`IN${i + 1}`] = inTime;
        row[`OUT${i + 1}`] = outTime || (inTime ? "---" : null);
        if (inTime && outTime && outTime !== "---") {
          const inMin = parseTimeToMinutes(inTime);
          const outMin = parseTimeToMinutes(outTime);
          if (outMin > inMin) totalMinutes += (outMin - inMin);
        }
      }
      row.working_hours = totalMinutes > 0 ? minutesToHHMM(totalMinutes) : 'Invalid';
      row.late_mins = late_mins.find(l => l.date === date)?.late_mins || 0;
      result.push(row);
    }

    total_late_mins = total_late_mins[0]?.total_late_mins || 0;
    filtered_late_mins = filtered_late_mins[0]?.filtered_late_mins || 0;
    const [absent_marked1] = absent_marked(total_late_mins);
    if (late_mins_1[0].late_mins === null) {
      late_mins_1[0].late_mins = '0';
    };


    resultData = {
      from: start,
      end: end,
      late_mins: late_mins_1[0].late_mins,
      total_absent_days: total_absent_days[0].absent,
      absent_days: absent_days[0].absent,
      absent_marked: absent_marked1,
      total_late_mins: total_late_mins,
      filtered_late_mins: filtered_late_mins,
      timing: result,
      data: staffInfo
    };
    res.json(resultData);
  } catch (error) {
    console.error('Error in /individual_data:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/applyExemption', async (req, res) => {
  let { exemptionType, staffId, exemptionSession, exemptionDate, exemptionReason, otherReason, start_time, end_time, exemptionStatus } = req.body;

  // 1. Prepare data for the database, converting empty values to null
  const sessionString = Array.isArray(exemptionSession) && exemptionSession.length > 0 ? exemptionSession.join(',') : null;
  const startTimeForDb = start_time || null;
  const endTimeForDb = end_time || null;
  const dateForDb = exemptionDate || null;

  // 2. Check for an identical existing exemption before proceeding
  try {
    const [duplicates] = await db.query(
      `SELECT * FROM exemptions 
       WHERE staffId = ? 
       AND exemptionDate = ? 
       AND exemptionType = ?
       AND COALESCE(exemptionSession, '') = COALESCE(?, '')
       AND COALESCE(start_time, '') = COALESCE(?, '')
       AND COALESCE(end_time, '') = COALESCE(?, '')
       AND (exemptionStatus = 'pending' OR exemptionStatus = 'approved')`,
      [staffId, dateForDb, exemptionType, sessionString, startTimeForDb, endTimeForDb]
    );

    if (duplicates.length > 0) {

      return res.status(409).json({ message: "An identical exemption request is already pending or approved." });
    }
  } catch (error) {
    console.error("Error checking for duplicate exemptions:", error);
    return res.status(500).json({ message: "Failed to check for duplicates" });
  }

  // 3. If no duplicate is found, proceed to add the exemption
  try {
    // Verify staff ID and get the name
    const [staffRows] = await db.query('SELECT name FROM staff WHERE staff_id = ?', [staffId]);
    if (staffRows.length === 0) {
      return res.status(404).json({ message: "Staff ID does not exist" });
    }
    const name = staffRows[0].name;

    // Insert the new exemption
    await db.query(
      `INSERT INTO exemptions 
        (exemptionType, staffId, exemptionStaffName, exemptionSession, exemptionDate, exemptionReason, otherReason, start_time, end_time, exemptionStatus) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exemptionType,
        staffId,
        name,
        sessionString,
        dateForDb,
        exemptionReason,
        otherReason,
        startTimeForDb,
        endTimeForDb,
        exemptionStatus
      ]
    );

    res.status(201).json({ message: "Exemption added successfully" });

  } catch (err) {
    console.error("Error in /applyExemption:", err);
    res.status(500).json({ message: "Failed to add exemption", error: err.message });
  }
});
router.get('/hr_exemptions_all', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM exemptions  ORDER BY exemptionDate DESC');
    res.json({ message: "Exemptions fetched successfully", exemptions: rows });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch exemptions" });
  }
});
router.get("/staff_exemptions/:staffId", async (req, res) => {
  const { staffId } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM exemptions WHERE staffId = ? ORDER BY exemptionDate DESC', [staffId]);
    res.json({ message: "Exemptions fetched successfully", exemptions: rows });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch exemptions" });
  }
});

router.post('/hr_exemptions/approve', async (req, res) => {
  const { exemptionId } = req.body;

  try {
    let sql = 'UPDATE exemptions SET exemptionStatus = "approved" WHERE exemptionId = ?';
    let params = [exemptionId];

    const [result] = await db.query(sql, params);
    if (result.affectedRows > 0) {
      res.json({ message: "Exemption approved successfully" });

      try {
        let sql1 = 'SELECT '
      }
      catch {
        console.error("Error fetching approved exemption details:", error);
        res.status(500).json({ message: "Failed to fetch approved exemption details" });
      }
    } else {
      res.json({ message: "No matching exemption found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to approve exemption" });
  }
});


router.post('/hr_exemptions/reject', async (req, res) => {
  const { exemptionId } = req.body;
  try {
    let sql = 'UPDATE exemptions SET exemptionStatus = "rejected" WHERE exemptionId = ?';
    let params = [exemptionId];
    const [result] = await db.query(sql, params);
    if (result.affectedRows > 0) {
      res.json({ message: "Exemption rejected successfully" });
    } else {
      res.json({ message: "No matching exemption found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to reject exemption" });
  }
});

router.post("/search/getuser", async (req, res) => {
  const { staffId } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM staff WHERE staff_id = ?', [staffId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }
    res.json({ message: "Staff fetched successfully", staff: rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch staff" });
  }
});

router.get('/search/query', async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === '') {
    return res.json([]);
  }

  try {
    const [rows] = await db.query(
      `SELECT staff_id , name, dept, designation, category
       FROM staff
       WHERE staff_id LIKE ? OR name LIKE ?
       LIMIT 5`,
      [`%${q}%`, `%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching staff for search:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get("/categories", async (req, res) => {
  try {
    const [rows] = await db.query("select * from category");
    res.json({ message: "Categories fetched successfully", success: true, categories: rows });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch categories", })
  }
})

router.get('/devices', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT device_id, ip_address, device_name, device_location, maintenance FROM devices');
    res.json({ message: "Devices fetched successfully", success: true, devices: rows });
  } catch (err) {
    console.error("Error fetching devices:", err);
    res.status(500).json({ message: "Failed to fetch devices" });
  }
});

router.post("/add_categories", async (req, res) => {
  const { category_description, in_time, break_in, break_out, out_time, break_time_mins } = req.body;

  try {
    // Append seconds
    const in_time1 = (in_time) ? in_time + ':00' : null;
    const break_in1 = (break_in) ? break_in + ':00' : null;
    const break_out1 = (break_out) ? break_out + ':00' : null;
    const out_time1 = (out_time) ? out_time + ':00' : null;

    // Check if category already exists using SQL
    const [rows] = await db.query(
      `SELECT * FROM category 
       WHERE category_description = ? 
       AND in_time = ? 
       AND break_in = ? 
       AND break_out = ? 
       AND out_time = ? 
       AND break_time_mins = ?`,
      [category_description, in_time1, break_in1, break_out1, out_time1, break_time_mins]
    );

    if (rows.length > 0) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const [countResult] = await db.query("SELECT COUNT(*) AS total FROM category");
    let count = Number(countResult[0].total) + 1;

    await db.query(
      "INSERT INTO category (category_no, category_description, in_time, break_in, break_out, out_time, break_time_mins) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [count, category_description, in_time1, break_in1, break_out1, out_time1, break_time_mins]
    );

    res.json({ message: "Category added successfully", success: true });
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({ message: "Failed to add category" });
  }
});

router.post("/categories/delete", async (req, res) => {
  const { category_no } = req.body;

  try {
    // Check if category exists
    const [categoryRows] = await db.query("SELECT * FROM category WHERE category_no = ?", [category_no]);
    if (categoryRows.length === 0) {
      return res.status(404).json({ message: "Category not found", success: false });
    }

    // Check if category is linked to any staff
    const [staffRows] = await db.query("SELECT * FROM staff WHERE category = ?", [category_no]);

    if (staffRows.length > 0) {
      return res.status(400).json({ message: "Cannot delete category: It is linked to staff", success: false });

    }

    // Delete the category
    await db.query("DELETE FROM category WHERE category_no = ?", [category_no]);
    res.json({ message: "Category deleted successfully", success: true });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ message: "Failed to delete category", success: false });
  }
});

router.get('/staff', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.staff_id, s.name, s.dept, s.designation, s.email, s.category, c.category_description
      FROM staff s
      LEFT JOIN category c ON s.category = c.category_no
    `);
    res.json({ message: "Staff fetched successfully", success: true, staff: rows });
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).json({ message: "Failed to fetch staff", success: false });
  }
});

router.post('/devices/add', async (req, res) => {
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


router.post('/devices/update', async (req, res) => {
  let { id, ip_address, device_name, device_location } = req.body;

  try {
    await db.query('UPDATE devices SET ip_address = ?, device_name = ?, device_location = ?  WHERE device_id = ?', [ip_address, device_name, device_location, id]);
    res.json({ message: "Device updated successfully", success: true });
  } catch (err) {
    console.error("Error updating device:", err);
    res.status(500).json({ message: "Failed to update device" });
  }
});
router.post('/devices/delete', async (req, res) => {
  let { id } = req.body;
  try {
    await db.query('DELETE FROM devices WHERE device_id = ?', [id]);
    res.json({ message: "Device deleted successfully", success: true });
  } catch (err) {
    console.error("Error deleting device:", err);
    res.status(500).json({ message: "Failed to delete device" });
  }
});



router.get('/get_user/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(`
          SELECT 
            staff.staff_id,
            staff.name,
            staff.dept,
            staff.email,
            staff.designation,
            staff.category,
            category.category_description,
            category.in_time,
            category.out_time,
            category.break_in,
            category.break_out,
            category.break_time_mins
          FROM staff
          JOIN category ON staff.category = category.category_no
          WHERE staff.staff_id = ?
        `, [id]);
    if (rows.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
});

router.post('/devices/toggle_maintenance', async (req, res) => {
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



module.exports = router;

