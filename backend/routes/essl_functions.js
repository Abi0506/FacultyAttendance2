const express = require('express');
const router = express.Router();
const db = require('../db');
const password = require('./passWord');
const { exec } = require('child_process');
require('dotenv').config();
const scriptPath = process.env.PYTHON_SCRIPT_PATH;


function runPythonScript(args) {
  const pythonPath = 'c:\\FacultyAttendance2\\FaceMachine\\venv\\Scripts\\python.exe'; // Update to your venv path
  return new Promise((resolve, reject) => {
    exec(`"${pythonPath}" "${scriptPath}" ${args.join(' ')}`, (error, stdout, stderr) => {
      console.log('Python stdout:', stdout);
      console.log('Python stderr:', stderr);
      if (error) return reject(new Error(stderr || 'Script failed'));
      resolve(stdout.trim());
    });
  });
}



router.post('/edit_user', async (req, res) => {
  const { id, name, dept, email, designation, category } = req.body;
  console.log(req.body);
  try {
    const [name1] = await db.query(`SELECT name FROM staff WHERE staff_id = ?`, [id]);
    if (name1 !== name[0].name) {
      const pythonResult = await runPythonScript(['set_user_credentials', id, name]);
      if (pythonResult.includes('Error')) {
        throw new Error(pythonResult);
      }
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error updating user credentials" });
  }

  try {

    await db.query(
      `UPDATE staff SET name = ?, dept = ?, designation = ?,email=?, category = ? WHERE staff_id = ?`,
      [name, dept, designation, email, category, id]
    );
    res.json({ success: true, message: "User updated successfully" });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

router.post('/add_user', async (req, res) => {
  let { id, name, dept, category, designation, staff_type, intime, outtime, breakmins, breakin, breakout } = req.body;
  try {
    const pythonResult = await runPythonScript(['set_user_credentials', id, name]);
    if (pythonResult.includes('Error')) {
      throw new Error(pythonResult);
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }

  console.log("Category: ", category)
  if (category === -1) {
    console.log("Custom Category processing")
    try {
      const [insertResult] = await db.query(
        `INSERT INTO category (category_description, in_time, out_time, break_in, break_out, break_time_mins) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [staff_type, intime, outtime, breakin, breakout, breakmins]
      );
      category = insertResult.insertId;
    } catch (err) {
      res.status(500).json({ success: false, message: 'Database error' });
    }
  }
  try {
    const plainPassword = id;
    const hashedPassword = await password(plainPassword);
    console.log(category)
    await db.query(
      `INSERT INTO STAFF (staff_id, name, dept, category, password, designation) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, dept, category, hashedPassword, designation]
    );
    res.status(200).json({ success: true, message: `User added successfully` });
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

router.post('/delete_user', async (req, res) => {
  const { id } = req.body;

  if (!/^[A-Za-z]\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const pythonResult = await runPythonScript(['delete_user', id]);
    if (pythonResult.includes('Error')) {
      throw new Error(pythonResult);
    }
    await db.query(`DELETE FROM STAFF WHERE staff_id = ?`, [id]);
    res.status(200).json({ message: `User ${id} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/delete_logs', async (req, res) => {
  try {
    const pythonResult = await runPythonScript(['delete_logs']);
    if (pythonResult.includes('Error')) {
      throw new Error(pythonResult);
    }
    res.status(200).json({ message: 'Logs deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;