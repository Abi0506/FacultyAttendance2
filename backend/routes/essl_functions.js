const express = require('express');
const router = express.Router();
const db = require('../db');
const password = require('./passWord');
const { exec } = require('child_process');
require('dotenv').config();
const scriptPath = process.env.PYTHON_SCRIPT_PATH;

function runPythonScript(args) {
  const pythonPath = process.env.PYTHON_PATH_VENV; // Update to your venv path
  return new Promise((resolve, reject) => {
    exec(`"${pythonPath}" "${scriptPath}" ${args.join(' ')}`, (error, stdout, stderr) => {
      console.log('Python stdout:', stdout);
      console.log('Python stderr:', stderr);
      if (error) return reject(new Error(stderr || 'Script failed'));
      resolve(stdout.trim());
    });
  });
}





router.post('/add_user', async (req, res) => {
  let { id, name, dept, category, designation, email, staff_type, intime, outtime, breakmins, breakin, breakout } = req.body;
  
  try {
    const pythonResult = await runPythonScript(['set_user_credentials', id, name]);
    if (pythonResult.includes('Error')) {
      throw new Error(pythonResult);
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }

  console.log("Category: ", category);
  if (category === -1) {
    
    try {
      const [insertResult] = await db.query(
        `INSERT INTO category (category_description, in_time, out_time, break_in, break_out, break_time_mins) VALUES (?, ?, ?, ?, ?, ?)`,
        [staff_type, intime, outtime, breakin, breakout, breakmins]
      );
      category = insertResult.insertId;
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Database error' });
      return;
    }
  }
  try {
    const plainPassword = id;
    const hashedPassword = await password(plainPassword);
    await db.query(
      `INSERT INTO staff (staff_id, name, dept, category, password, designation, email) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, dept, category, hashedPassword, designation, email]
    );
    res.status(200).json({ success: true, message: `User added successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

router.post('/edit_user', async (req, res) => {
  const { id, name, dept, designation, email, category } = req.body;

  try {
    await db.query(
      `UPDATE staff SET name = ?, dept = ?, designation = ?, email = ?, category = ? WHERE staff_id = ?`,
      [name, dept, designation, email, category, id]
    );
    res.json({ success: true, message: "User updated successfully" });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

router.get('/get_user/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT staff_id, name, dept, designation, email, category FROM staff WHERE staff_id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

router.post('/delete_user', async (req, res) => {
  const { id } = req.body;



  try {
    const pythonResult = await runPythonScript(['delete_user', id]);
    if (pythonResult.includes('Error')) {
      throw new Error(pythonResult);
    }
     await db.query(`SET FOREIGN_KEY_CHECKS = 0;
                    DELETE FROM staff WHERE staff_id = ?;
                    SET FOREIGN_KEY_CHECKS = 1;`, [id]);
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