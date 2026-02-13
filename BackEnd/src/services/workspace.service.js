const fs = require('fs').promises;
const path = require('path');

// Store current workspace path
let currentWorkspace = null;

/**
 * Validate that a path is within the workspace (security)
 */
function validatePath(filePath) {
    if (!currentWorkspace) {
        throw new Error('No workspace selected');
    }

    // Clean the file path - remove leading slashes and normalize
    let cleanPath = filePath;

    // Remove leading slashes (/, \, or Windows drive letters when they shouldn't be there)
    cleanPath = cleanPath.replace(/^[\/\\]+/, '');

    // Also remove common prefixes like /memory/ that AI might generate
    cleanPath = cleanPath.replace(/^memory[\/\\]/, '');

    // Normalize the path
    const fullPath = path.resolve(currentWorkspace, cleanPath);
    const normalizedWorkspace = path.resolve(currentWorkspace);

    // Check if the resolved path starts with the workspace
    if (!fullPath.startsWith(normalizedWorkspace)) {
        throw new Error('Access denied: Path traversal attempt detected');
    }

    return fullPath;
}

/**
 * Set the current workspace directory
 */
function setWorkspace(workspacePath) {
    // Validate the workspace path exists and is a directory
    currentWorkspace = path.resolve(workspacePath);
    console.log(`[Workspace] Set to: ${currentWorkspace}`);
    return currentWorkspace;
}

/**
 * Get the current workspace
 */
function getWorkspace() {
    return currentWorkspace;
}

/**
 * Check if workspace is empty (new project) or has files (existing project)
 */
async function isEmptyWorkspace(workspacePath) {
    try {
        const items = await fs.readdir(workspacePath);
        // Filter out hidden files
        const visibleItems = items.filter(item => !item.startsWith('.'));
        return visibleItems.length === 0;
    } catch (error) {
        return true;
    }
}

/**
 * Get all files in workspace recursively
 */
async function getAllFiles(dirPath, relativePath = '') {
    const files = [];
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
        // Skip node_modules, .git, and other common ignore patterns
        if (shouldIgnore(item.name)) continue;

        const fullPath = path.join(dirPath, item.name);
        const relPath = path.join(relativePath, item.name);

        if (item.isDirectory()) {
            files.push({
                name: item.name,
                path: relPath,
                type: 'directory',
                children: await getAllFiles(fullPath, relPath)
            });
        } else {
            const stats = await fs.stat(fullPath);
            files.push({
                name: item.name,
                path: relPath,
                type: 'file',
                size: stats.size,
                extension: path.extname(item.name).slice(1)
            });
        }
    }

    return files;
}

/**
 * Patterns to ignore when scanning workspace
 */
function shouldIgnore(name) {
    const ignorePatterns = [
        'node_modules',
        '.git',
        '.vscode',
        '.idea',
        '__pycache__',
        '.DS_Store',
        'dist',
        'build',
        '.next',
        '.env',
        '.env.local'
    ];
    return ignorePatterns.includes(name) || name.startsWith('.');
}

/**
 * Read file content from workspace (with path validation)
 */
async function readFile(filePath) {
    const fullPath = validatePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
}

/**
 * Write content to a file in workspace (with path validation)
 */
async function writeFile(filePath, content) {
    console.log(`[Workspace] writeFile called with: ${filePath}`);
    const fullPath = validatePath(filePath);
    console.log(`[Workspace] Resolved full path: ${fullPath}`);

    const dir = path.dirname(fullPath);

    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    console.log(`[Workspace] ✓ File successfully written: ${fullPath}`);
    return { success: true, path: filePath };
}

/**
 * Create a new file or directory (with path validation)
 */
async function createItem(itemPath, type = 'file', content = '') {
    const fullPath = validatePath(itemPath);

    if (type === 'directory') {
        await fs.mkdir(fullPath, { recursive: true });
    } else {
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
    }

    console.log(`[Workspace] Created ${type}: ${itemPath}`);
    return { success: true, path: itemPath };
}

/**
 * Delete a file from workspace (with path validation)
 */
async function deleteFile(filePath) {
    const fullPath = validatePath(filePath);
    await fs.unlink(fullPath);

    console.log(`[Workspace] File deleted: ${filePath}`);
    return { success: true, path: filePath };
}

/**
 * Build codebase context for AI (formatted string)
 */
async function buildCodebaseContext(workspacePath) {
    if (!workspacePath && !currentWorkspace) {
        return 'No workspace loaded.';
    }

    const workspace = workspacePath || currentWorkspace;
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'html', 'css', 'json', 'md', 'yml', 'yaml'];

    try {
        const files = await getAllFiles(workspace);
        const codeFiles = [];

        function flattenFiles(items, prefix = '') {
            for (const item of items) {
                if (item.type === 'directory') {
                    flattenFiles(item.children, item.path);
                } else if (codeExtensions.includes(item.extension) && item.size < 30000) {
                    codeFiles.push(item);
                }
            }
        }

        flattenFiles(files);

        // Build context string
        let context = `## Project Structure\n`;
        context += `Total files: ${codeFiles.length}\n\n`;

        // Read key files for context
        const keyFiles = codeFiles.slice(0, 20);
        for (const file of keyFiles) {
            try {
                const fullPath = path.join(workspace, file.path);
                const content = await fs.readFile(fullPath, 'utf-8');
                context += `### ${file.path}\n\`\`\`${file.extension}\n${content.substring(0, 3000)}\n\`\`\`\n\n`;
            } catch (e) {
                // Skip unreadable files
            }
        }

        return context;
    } catch (error) {
        return `Error reading workspace: ${error.message}`;
    }
}

/**
 * Get all code files for AI context (array format)
 */
async function getCodebaseContext(maxFiles = 50) {
    if (!currentWorkspace) {
        throw new Error('No workspace selected');
    }

    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'html', 'css', 'json', 'md', 'txt', 'yml', 'yaml'];
    const files = await getAllFiles(currentWorkspace);
    const codeFiles = [];

    function flattenFiles(items) {
        for (const item of items) {
            if (item.type === 'directory') {
                flattenFiles(item.children);
            } else if (codeExtensions.includes(item.extension) && item.size < 50000) {
                codeFiles.push(item);
            }
        }
    }

    flattenFiles(files);

    // Read content for each file (limited)
    const context = [];
    for (const file of codeFiles.slice(0, maxFiles)) {
        try {
            const content = await readFile(file.path);
            context.push({
                path: file.path,
                content: content
            });
        } catch (error) {
            console.log(`[Workspace] Could not read: ${file.path}`);
        }
    }

    return context;
}

module.exports = {
    setWorkspace,
    getWorkspace,
    isEmptyWorkspace,
    getAllFiles,
    readFile,
    writeFile,
    createItem,
    deleteFile,
    buildCodebaseContext,
    getCodebaseContext
};
