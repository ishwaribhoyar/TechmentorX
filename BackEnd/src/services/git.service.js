const { exec } = require('child_process');
const path = require('path');

// Execute git command
function execGit(command, workspacePath) {
    return new Promise((resolve, reject) => {
        exec(`git ${command}`, { cwd: workspacePath }, (error, stdout, stderr) => {
            if (error && !stderr.includes('nothing to commit')) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

// Check if directory is a git repo
async function isGitRepo(workspacePath) {
    try {
        await execGit('rev-parse --is-inside-work-tree', workspacePath);
        return true;
    } catch {
        return false;
    }
}

// Initialize git repo
async function init(workspacePath) {
    return execGit('init', workspacePath);
}

// Get status
async function status(workspacePath) {
    const output = await execGit('status --porcelain', workspacePath);
    const files = output.split('\n').filter(Boolean).map(line => {
        const status = line.substring(0, 2).trim();
        const file = line.substring(3);
        return { status, file };
    });
    return files;
}

// Get diff
async function diff(workspacePath, file = '') {
    const command = file ? `diff -- "${file}"` : 'diff';
    return execGit(command, workspacePath);
}

// Get diff for staged files
async function diffStaged(workspacePath) {
    return execGit('diff --cached', workspacePath);
}

// Stage files
async function add(workspacePath, files = '.') {
    const fileList = Array.isArray(files) ? files.join(' ') : files;
    return execGit(`add ${fileList}`, workspacePath);
}

// Unstage files
async function reset(workspacePath, files) {
    const fileList = Array.isArray(files) ? files.join(' ') : files;
    return execGit(`reset HEAD -- ${fileList}`, workspacePath);
}

// Commit
async function commit(workspacePath, message) {
    return execGit(`commit -m "${message.replace(/"/g, '\\"')}"`, workspacePath);
}

// Get log
async function log(workspacePath, count = 10) {
    const output = await execGit(`log --oneline -n ${count}`, workspacePath);
    return output.split('\n').filter(Boolean).map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return { hash, message: messageParts.join(' ') };
    });
}

// Get current branch
async function currentBranch(workspacePath) {
    return execGit('branch --show-current', workspacePath);
}

// Get all branches
async function branches(workspacePath) {
    const output = await execGit('branch', workspacePath);
    return output.split('\n').filter(Boolean).map(b => ({
        name: b.replace('*', '').trim(),
        current: b.startsWith('*')
    }));
}

// Checkout branch
async function checkout(workspacePath, branch) {
    return execGit(`checkout ${branch}`, workspacePath);
}

// Create new branch
async function createBranch(workspacePath, branch) {
    return execGit(`checkout -b ${branch}`, workspacePath);
}

// Push
async function push(workspacePath, remote = 'origin', branch = '') {
    const branchArg = branch || await currentBranch(workspacePath);
    return execGit(`push ${remote} ${branchArg}`, workspacePath);
}

// Pull
async function pull(workspacePath) {
    return execGit('pull', workspacePath);
}

// Get remotes
async function remotes(workspacePath) {
    const output = await execGit('remote -v', workspacePath);
    const lines = output.split('\n').filter(Boolean);
    const remoteMap = {};
    lines.forEach(line => {
        const [name, url] = line.split('\t');
        if (!remoteMap[name]) {
            remoteMap[name] = url.split(' ')[0];
        }
    });
    return Object.entries(remoteMap).map(([name, url]) => ({ name, url }));
}

module.exports = {
    isGitRepo,
    init,
    status,
    diff,
    diffStaged,
    add,
    reset,
    commit,
    log,
    currentBranch,
    branches,
    checkout,
    createBranch,
    push,
    pull,
    remotes
};
