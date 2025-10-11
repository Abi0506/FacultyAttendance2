const express = require("express");
const router = express.Router();
const { exec } = require("child_process");

const scriptPath = process.env.PYTHON_SCRIPT_PATH2;
const pythonPath = process.env.PYTHON_PATH_VENV;

// Function to run Python
function runPythonFunction(funcName, args = []) {
  return new Promise((resolve, reject) => {
    const cmd = `${pythonPath} "${scriptPath}" ${funcName} ${args.join(" ")}`;
    exec(cmd, (error, stdout, stderr) => {
      console.log("Python stdout:", stdout);
      console.log("Python stderr:", stderr);
      if (error) return reject(new Error(stderr || "Script failed"));
      resolve(stdout.trim());
    });
  });
}

// POST /instant_logs
router.post("/instant", async (req, res) => {
  const { date, type } = req.body;
  if (!date || !type) {
    return res.status(400).json({ status: "error", message: "date and type are required" });
  }

  try {
    const result = await runPythonFunction(
      type,
      [date]
    );
    res.json({ status: "success", result });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
