const fs = require('fs').promises;
const path = require('path');

/**
 * Append entry to history.md in the workspace
 * @param {string} workspacePath - Path to the workspace
 * @param {string} action - Type of action (chat, generate, debug, edit, apply, optimize)
 * @param {string} request - User's request/input
 * @param {string} summary - Summary of what was done
 */
async function logAction(workspacePath, action, request, summary) {
    if (!workspacePath) return;

    const historyPath = path.join(workspacePath, 'history.md');
    const timestamp = new Date().toISOString();

    let entry = `\n## ${timestamp}\n`;
    entry += `**Action**: ${action}\n`;
    entry += `**Request**: ${request.substring(0, 200)}${request.length > 200 ? '...' : ''}\n`;
    entry += `**Result**: ${summary}\n`;
    entry += `---\n`;

    try {
        // Check if history.md exists
        let existingContent = '';
        try {
            existingContent = await fs.readFile(historyPath, 'utf-8');
        } catch (e) {
            // File doesn't exist, create with header
            existingContent = `# Project History\n\nThis file tracks all AI-assisted changes made to this project.\n\n---\n`;
        }

        await fs.writeFile(historyPath, existingContent + entry, 'utf-8');
        console.log(`[Memory] Logged action: ${action}`);
    } catch (error) {
        console.error(`[Memory] Error logging action:`, error.message);
    }
}

/**
 * Get history content
 * @param {string} workspacePath - Optional workspace path
 */
async function getHistory(workspacePath) {
    if (!workspacePath) return null;

    const historyPath = path.join(workspacePath, 'history.md');

    try {
        return await fs.readFile(historyPath, 'utf-8');
    } catch (error) {
        return null;
    }
}

module.exports = {
    logAction,
    getHistory
};
