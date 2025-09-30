// server.js (Node.js)
const { spawn } = require('child_process');
const { exec } = require('child_process');
require('dotenv').config();
const scriptPath = process.env.PYTHON_SCRIPT_PATH;

function startPythonScript() {
  const pythonProcess = spawn('python3', [scriptPath]);

  // Handle Python script output
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    console.log('Restarting Python script...');
    startPythonScript(); // Automatically restart if Python script exits
  });

  // Return the process for external control (e.g., to kill it)
  return pythonProcess;
}

// Export the function to start the Python script
module.exports = { startPythonScript };