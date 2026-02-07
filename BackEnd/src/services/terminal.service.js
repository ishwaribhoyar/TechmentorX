const { spawn } = require('child_process');
const path = require('path');

let currentProcess = null;
let outputBuffer = '';

// Execute a command in the workspace
async function executeCommand(command, workspacePath) {
    return new Promise((resolve, reject) => {
        outputBuffer = '';

        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'powershell.exe' : '/bin/bash';
        const shellArgs = isWindows ? ['-Command', command] : ['-c', command];

        currentProcess = spawn(shell, shellArgs, {
            cwd: workspacePath,
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        currentProcess.stdout.on('data', (data) => {
            outputBuffer += data.toString();
        });

        currentProcess.stderr.on('data', (data) => {
            outputBuffer += data.toString();
        });

        currentProcess.on('close', (code) => {
            currentProcess = null;
            resolve({
                output: outputBuffer,
                exitCode: code,
                success: code === 0
            });
        });

        currentProcess.on('error', (error) => {
            currentProcess = null;
            reject(error);
        });

        // Timeout after 60 seconds
        setTimeout(() => {
            if (currentProcess) {
                currentProcess.kill();
                reject(new Error('Command timed out after 60 seconds'));
            }
        }, 60000);
    });
}

// Kill current running process
function killProcess() {
    if (currentProcess) {
        currentProcess.kill();
        currentProcess = null;
        return true;
    }
    return false;
}

// Get current output buffer
function getOutput() {
    return outputBuffer;
}

// Check if a process is running
function isRunning() {
    return currentProcess !== null;
}

// Run npm install
async function npmInstall(workspacePath) {
    return executeCommand('npm install', workspacePath);
}

// Run npm start/dev
async function npmStart(workspacePath) {
    return executeCommand('npm run dev || npm start', workspacePath);
}

// Run any npm script
async function npmScript(script, workspacePath) {
    return executeCommand(`npm run ${script}`, workspacePath);
}

module.exports = {
    executeCommand,
    killProcess,
    getOutput,
    isRunning,
    npmInstall,
    npmStart,
    npmScript
};
