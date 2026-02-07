require('dotenv').config();
const OpenAI = require("openai");
const workspaceService = require('./workspace.service');
const memoryService = require('./memory.service');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";

// Advanced Cursor-like system prompt
const getIDESystemPrompt = (context) => `You are an expert AI coding assistant integrated into a modern IDE. You have deep understanding of software development, debugging, and code optimization.

## Your Capabilities
- **Code Generation**: Create complete, production-ready code from descriptions
- **Debugging**: Analyze errors, identify root causes, propose fixes
- **Optimization**: Improve performance, readability, and maintainability
- **Explanation**: Break down complex code into understandable pieces
- **Refactoring**: Restructure code while preserving functionality

## Context Awareness
You have access to the user's codebase:
${context || 'No codebase loaded yet.'}

## Response Format

When generating or modifying code, use this format:
\`\`\`[language]
// filepath: /path/to/file.ext
[code content]
\`\`\`

When creating multiple files, output each with its filepath comment.

## Key Principles
1. **Be precise**: Give exact code, not pseudocode
2. **Be complete**: Include all necessary imports and dependencies
3. **Be contextual**: Reference existing code patterns in the codebase
4. **Be proactive**: Anticipate related changes needed
5. **Be safe**: Never suggest code that could cause data loss without warning

## Error Handling
When debugging:
1. Identify the exact error location
2. Explain WHY the error occurs
3. Provide the FIXED code
4. Explain the fix

## Project Generation
When creating new projects:
1. First create folder structure
2. Create config files (package.json, etc.)
3. Create documentation (README.md)
4. Create source files
5. Provide setup instructions`;

// Chat with codebase context
async function chat(message, workspacePath) {
    const context = workspacePath
        ? await workspaceService.buildCodebaseContext(workspacePath)
        : '';

    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: getIDESystemPrompt(context) },
            { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 8192
    });

    const response = completion.choices[0].message.content;

    if (workspacePath) {
        await memoryService.logAction(workspacePath, 'chat', message, response);
    }

    return response;
}

// Generate a complete project from description
async function generateProject(description, workspacePath) {
    const prompt = `Create a complete project based on this description:

"${description}"

Generate all necessary files including:
1. Project configuration (package.json if Node.js, requirements.txt if Python, etc.)
2. README.md with setup instructions
3. Source code files with proper structure
4. Basic tests if applicable

For each file, use this exact format:
\`\`\`[language]
// filepath: [full relative path]
[complete file contents]
\`\`\`

Create a well-organized folder structure. Be thorough and create production-ready code.`;

    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: getIDESystemPrompt('') },
            { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 16384
    });

    const response = completion.choices[0].message.content;
    const files = parseFilesFromResponse(response);

    if (workspacePath) {
        await memoryService.logAction(workspacePath, 'generate', description, `Generated ${files.length} files`);
    }

    return { response, files };
}

// Debug error in codebase context
async function debugError(error, filePath, workspacePath) {
    const context = workspacePath
        ? await workspaceService.buildCodebaseContext(workspacePath)
        : '';

    let fileContent = '';
    if (filePath && workspacePath) {
        try {
            fileContent = await workspaceService.readFile(filePath);
        } catch (e) { }
    }

    const prompt = `Debug this error:

**Error Message:**
\`\`\`
${error}
\`\`\`

${fileContent ? `**Current File (${filePath}):**
\`\`\`
${fileContent}
\`\`\`
` : ''}

Analyze the error and provide:
1. Root cause explanation
2. The exact fix with complete corrected code
3. Prevention tips

Use the filepath format for any code fixes:
\`\`\`[language]
// filepath: [path]
[corrected code]
\`\`\``;

    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: getIDESystemPrompt(context) },
            { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 8192
    });

    const response = completion.choices[0].message.content;
    const files = parseFilesFromResponse(response);

    if (workspacePath) {
        await memoryService.logAction(workspacePath, 'debug', error.substring(0, 100), `Proposed ${files.length} fixes`);
    }

    return { response, files };
}

// Edit code with natural language
async function editCode(instruction, filePath, workspacePath) {
    const context = workspacePath
        ? await workspaceService.buildCodebaseContext(workspacePath)
        : '';

    let fileContent = '';
    if (filePath && workspacePath) {
        try {
            fileContent = await workspaceService.readFile(filePath);
        } catch (e) { }
    }

    const prompt = `Modify this code according to the instruction:

**Instruction:** ${instruction}

${fileContent ? `**Current File (${filePath}):**
\`\`\`
${fileContent}
\`\`\`

Provide the COMPLETE updated file, not just the changed parts.` : 'Create a new file if needed.'}

Use the filepath format:
\`\`\`[language]
// filepath: ${filePath || '[choose appropriate path]'}
[complete updated code]
\`\`\``;

    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: getIDESystemPrompt(context) },
            { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 8192
    });

    const response = completion.choices[0].message.content;
    const files = parseFilesFromResponse(response);

    if (workspacePath) {
        await memoryService.logAction(workspacePath, 'edit', instruction, `Modified ${files.length} files`);
    }

    return { response, files };
}

// Inline code suggestions
async function getSuggestion(prefix, suffix, filePath, workspacePath) {
    const context = workspacePath
        ? await workspaceService.buildCodebaseContext(workspacePath)
        : '';

    const prompt = `Complete this code. Only output the completion, nothing else.

File: ${filePath}
Code before cursor:
\`\`\`
${prefix}
\`\`\`

Code after cursor:
\`\`\`
${suffix}
\`\`\`

Provide ONLY the code that should be inserted at the cursor position. No explanations.`;

    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: "You are a code completion engine. Output ONLY the code to insert. No markdown, no explanations." },
            { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 256
    });

    return completion.choices[0].message.content.trim();
}

// Explain code
async function explainCode(code, workspacePath) {
    const context = workspacePath
        ? await workspaceService.buildCodebaseContext(workspacePath)
        : '';

    const prompt = `Explain this code in detail:

\`\`\`
${code}
\`\`\`

Provide:
1. Overall purpose
2. Line-by-line breakdown
3. Key concepts used
4. Potential improvements`;

    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: getIDESystemPrompt(context) },
            { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096
    });

    return completion.choices[0].message.content;
}

// Optimize code
async function optimizeCode(code, filePath, workspacePath) {
    const prompt = `Optimize this code for better performance, readability, and maintainability:

\`\`\`
${code}
\`\`\`

Provide the optimized version with explanations of what was improved.

Use the filepath format:
\`\`\`[language]
// filepath: ${filePath || 'optimized.js'}
[optimized code]
\`\`\``;

    const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: getIDESystemPrompt('') },
            { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 8192
    });

    const response = completion.choices[0].message.content;
    const files = parseFilesFromResponse(response);

    if (workspacePath) {
        await memoryService.logAction(workspacePath, 'optimize', `Optimized ${filePath}`, response.substring(0, 200));
    }

    return { response, files };
}

// Parse files from AI response
function parseFilesFromResponse(response) {
    const files = [];
    const codeBlockRegex = /```[\w]*\n\/\/ filepath: (.+)\n([\s\S]*?)```/g;

    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
        files.push({
            path: match[1].trim(),
            content: match[2].trim()
        });
    }

    return files;
}

// Apply generated files to workspace
async function applyFiles(files, workspacePath) {
    const results = [];
    for (const file of files) {
        try {
            await workspaceService.writeFile(file.path, file.content);
            results.push({ path: file.path, success: true });
        } catch (error) {
            results.push({ path: file.path, success: false, error: error.message });
        }
    }

    await memoryService.logAction(workspacePath, 'apply', `Applied ${files.length} files`, JSON.stringify(results));
    return results;
}

module.exports = {
    chat,
    generateProject,
    debugError,
    editCode,
    getSuggestion,
    explainCode,
    optimizeCode,
    applyFiles,
    parseFilesFromResponse
};
