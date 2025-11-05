
const { spawn } = require('child_process');

require('dotenv').config();
const scriptPath = process.env.PYTHON_SCRIPT_PATH1;

function startPythonScript() {
    // console.log("Sciprt", scriptPath)
    const pythonProcess = spawn(process.env.PYTHON_PROCESS_PATH, [scriptPath]);

    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
    });

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