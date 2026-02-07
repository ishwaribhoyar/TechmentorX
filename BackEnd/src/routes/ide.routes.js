const express = require('express');
const router = express.Router();
const workspaceService = require('../services/workspace.service');
const ideAIService = require('../services/ide-ai.service');
const memoryService = require('../services/memory.service');
const terminalService = require('../services/terminal.service');
const gitService = require('../services/git.service');

/**
 * POST /ide/workspace/open
 * Set the current workspace directory
 */
router.post('/workspace/open', async (req, res) => {
    try {
        const { path } = req.body;

        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }

        workspaceService.setWorkspace(path);
        const isEmpty = await workspaceService.isEmptyWorkspace(path);

        res.json({
            success: true,
            workspace: path,
            isNewProject: isEmpty
        });
    } catch (error) {
        console.error('[IDE] Workspace open error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /ide/workspace/files
 * Get all files in the workspace
 */
router.get('/workspace/files', async (req, res) => {
    try {
        const workspace = workspaceService.getWorkspace();

        if (!workspace) {
            return res.status(400).json({ error: 'No workspace selected' });
        }

        const files = await workspaceService.getAllFiles(workspace);
        res.json({ files });
    } catch (error) {
        console.error('[IDE] Files list error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /ide/file
 * Read a file from workspace
 */
router.get('/file', async (req, res) => {
    try {
        const { path } = req.query;

        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }

        const content = await workspaceService.readFile(path);
        res.json({ path, content });
    } catch (error) {
        console.error('[IDE] File read error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/file
 * Write a file to workspace
 */
router.post('/file', async (req, res) => {
    try {
        const { path, content } = req.body;

        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }

        await workspaceService.writeFile(path, content || '');
        res.json({ success: true, path });
    } catch (error) {
        console.error('[IDE] File write error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /ide/file
 * Delete a file from workspace
 */
router.delete('/file', async (req, res) => {
    try {
        const { path } = req.query;

        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }

        await workspaceService.deleteFile(path);
        res.json({ success: true, path });
    } catch (error) {
        console.error('[IDE] File delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/chat
 * Chat with AI about the codebase
 */
router.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const workspace = workspaceService.getWorkspace();

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await ideAIService.chat(message, workspace);
        res.json({ response: result });
    } catch (error) {
        console.error('[IDE] Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/generate
 * Generate a new project from description
 */
router.post('/generate', async (req, res) => {
    try {
        const { description } = req.body;
        const workspace = workspaceService.getWorkspace();

        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        const result = await ideAIService.generateProject(description, workspace);
        res.json(result);
    } catch (error) {
        console.error('[IDE] Generate error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/debug
 * Debug code and explain errors
 */
router.post('/debug', async (req, res) => {
    try {
        const { error: errorMessage, file } = req.body;
        const workspace = workspaceService.getWorkspace();

        if (!errorMessage) {
            return res.status(400).json({ error: 'Error message is required' });
        }

        const result = await ideAIService.debugError(errorMessage, file, workspace);
        res.json(result);
    } catch (error) {
        console.error('[IDE] Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/edit
 * Edit code based on instruction
 */
router.post('/edit', async (req, res) => {
    try {
        const { instruction, file } = req.body;
        const workspace = workspaceService.getWorkspace();

        if (!instruction) {
            return res.status(400).json({ error: 'Instruction is required' });
        }

        const result = await ideAIService.editCode(instruction, file, workspace);
        res.json(result);
    } catch (error) {
        console.error('[IDE] Edit error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/apply
 * Apply file changes to workspace
 */
router.post('/apply', async (req, res) => {
    try {
        const { files } = req.body;
        const workspace = workspaceService.getWorkspace();

        if (!files || !Array.isArray(files)) {
            return res.status(400).json({ error: 'Files array is required' });
        }

        const results = await ideAIService.applyFiles(files, workspace);
        res.json({ results });
    } catch (error) {
        console.error('[IDE] Apply error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /ide/history
 * Get session history
 */
router.get('/history', async (req, res) => {
    try {
        const workspace = workspaceService.getWorkspace();
        const history = await memoryService.getHistory(workspace);
        res.json({ history: history || 'No history yet' });
    } catch (error) {
        console.error('[IDE] History error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ TERMINAL ROUTES ============

/**
 * POST /ide/terminal/exec
 * Execute a command in the terminal
 */
router.post('/terminal/exec', async (req, res) => {
    try {
        const { command } = req.body;
        const workspace = workspaceService.getWorkspace();

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        const result = await terminalService.executeCommand(command, workspace);
        res.json(result);
    } catch (error) {
        console.error('[IDE] Terminal error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/terminal/kill
 * Kill running process
 */
router.post('/terminal/kill', (req, res) => {
    const killed = terminalService.killProcess();
    res.json({ killed });
});

// ============ GIT ROUTES ============

/**
 * GET /ide/git/status
 * Get git status
 */
router.get('/git/status', async (req, res) => {
    try {
        const workspace = workspaceService.getWorkspace();
        const isRepo = await gitService.isGitRepo(workspace);

        if (!isRepo) {
            return res.json({ isRepo: false, files: [] });
        }

        const files = await gitService.status(workspace);
        const branch = await gitService.currentBranch(workspace);
        res.json({ isRepo: true, branch, files });
    } catch (error) {
        console.error('[IDE] Git status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/git/init
 * Initialize git repo
 */
router.post('/git/init', async (req, res) => {
    try {
        const workspace = workspaceService.getWorkspace();
        await gitService.init(workspace);
        res.json({ success: true });
    } catch (error) {
        console.error('[IDE] Git init error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/git/add
 * Stage files
 */
router.post('/git/add', async (req, res) => {
    try {
        const { files = '.' } = req.body;
        const workspace = workspaceService.getWorkspace();
        await gitService.add(workspace, files);
        res.json({ success: true });
    } catch (error) {
        console.error('[IDE] Git add error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/git/commit
 * Commit changes
 */
router.post('/git/commit', async (req, res) => {
    try {
        const { message } = req.body;
        const workspace = workspaceService.getWorkspace();

        if (!message) {
            return res.status(400).json({ error: 'Commit message is required' });
        }

        await gitService.commit(workspace, message);
        res.json({ success: true });
    } catch (error) {
        console.error('[IDE] Git commit error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /ide/git/diff
 * Get diff
 */
router.get('/git/diff', async (req, res) => {
    try {
        const { file } = req.query;
        const workspace = workspaceService.getWorkspace();
        const diff = await gitService.diff(workspace, file);
        res.json({ diff });
    } catch (error) {
        console.error('[IDE] Git diff error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /ide/git/log
 * Get commit log
 */
router.get('/git/log', async (req, res) => {
    try {
        const workspace = workspaceService.getWorkspace();
        const log = await gitService.log(workspace, 20);
        res.json({ log });
    } catch (error) {
        console.error('[IDE] Git log error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/git/push
 * Push to remote
 */
router.post('/git/push', async (req, res) => {
    try {
        const workspace = workspaceService.getWorkspace();
        await gitService.push(workspace);
        res.json({ success: true });
    } catch (error) {
        console.error('[IDE] Git push error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ ENHANCED AI ROUTES ============

/**
 * POST /ide/suggest
 * Get inline code suggestions
 */
router.post('/suggest', async (req, res) => {
    try {
        const { prefix, suffix, file } = req.body;
        const workspace = workspaceService.getWorkspace();
        const suggestion = await ideAIService.getSuggestion(prefix, suffix, file, workspace);
        res.json({ suggestion });
    } catch (error) {
        console.error('[IDE] Suggest error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/explain
 * Explain code
 */
router.post('/explain', async (req, res) => {
    try {
        const { code } = req.body;
        const workspace = workspaceService.getWorkspace();
        const explanation = await ideAIService.explainCode(code, workspace);
        res.json({ explanation });
    } catch (error) {
        console.error('[IDE] Explain error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/optimize
 * Optimize code
 */
router.post('/optimize', async (req, res) => {
    try {
        const { code, file } = req.body;
        const workspace = workspaceService.getWorkspace();
        const result = await ideAIService.optimizeCode(code, file, workspace);
        res.json(result);
    } catch (error) {
        console.error('[IDE] Optimize error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /ide/folder
 * Create a new folder
 */
router.post('/folder', async (req, res) => {
    try {
        const { path } = req.body;
        await workspaceService.createItem(path, 'directory');
        res.json({ success: true, path });
    } catch (error) {
        console.error('[IDE] Folder create error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

