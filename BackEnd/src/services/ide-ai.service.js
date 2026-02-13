require('dotenv').config();
const OpenAI = require("openai");
const workspaceService = require('./workspace.service');
const memoryService = require('./memory.service');

// AI Provider Configuration
let currentProvider = process.env.AI_PROVIDER || 'openai';
let currentModel = currentProvider === 'openai'
    ? (process.env.OPENAI_MODEL || 'gpt-5-nano')
    : (process.env.OLLAMA_MODEL || 'qwen2.5-coder');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';

console.log(`[AI Service] Using provider: ${currentProvider}, model: ${currentModel}`);

// Get current provider and model
function getConfig() {
    return {
        provider: currentProvider,
        model: currentModel,
        availableProviders: [
            { id: 'openai', name: 'OpenAI (Cloud)', models: ['gpt-5-nano'] },
            { id: 'ollama', name: 'Ollama (Local)', models: ['qwen2.5-coder:latest'] }
        ]
    };
}

// Set provider and model
function setConfig(provider, model) {
    if (provider) currentProvider = provider;
    if (model) currentModel = model;
    console.log(`[AI Service] Switched to provider: ${currentProvider}, model: ${currentModel}`);
    return getConfig();
}

// Call AI based on current provider
async function callAI(messages, options = {}) {
    const { temperature = 0.7, maxTokens = 8192 } = options;

    if (currentProvider === 'ollama') {
        return callOllama(messages, temperature, maxTokens);
    } else {
        return callOpenAI(messages, temperature, maxTokens);
    }
}

// OpenAI API call
async function callOpenAI(messages, temperature, maxTokens) {
    // GPT-5 Nano has lower token limits - cap at 4096
    const cappedTokens = Math.min(maxTokens, 4096);

    const params = {
        model: currentModel,
        messages
    };

    // GPT-5 models use max_completion_tokens and don't support temperature
    if (currentModel.startsWith('gpt-5')) {
        params.max_completion_tokens = cappedTokens;
    } else {
        params.max_tokens = cappedTokens;
        params.temperature = temperature;
    }

    try {
        console.log(`[AI] Calling OpenAI with model: ${currentModel}`);
        const completion = await openai.chat.completions.create(params);
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('[AI] OpenAI API error:', error.message);
        throw error;
    }
}

// Ollama API call - optimized for speed with timeout
async function callOllama(messages, temperature, maxTokens) {
    // Use smaller token count for faster response
    const optimizedTokens = Math.min(maxTokens, 1024);

    try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch(`${ollamaHost}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: currentModel,
                messages,
                stream: false,
                options: {
                    temperature: 0.2,
                    num_predict: optimizedTokens,
                    num_ctx: 2048,
                    repeat_penalty: 1.05,
                    top_k: 20,
                    top_p: 0.8
                }
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama error (${response.status}): ${errorText || response.statusText}`);
        }

        const data = await response.json();
        console.log('[AI] Ollama response received successfully');
        return data.message.content;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Ollama request timed out. Make sure Ollama is running and the model is loaded.');
        }
        console.error('[AI] Ollama error:', error.message);
        throw new Error(`Ollama connection failed: ${error.message}. Is Ollama running on ${ollamaHost}?`);
    }
}

// Advanced Cursor-like system prompt
const getIDESystemPrompt = (context) => `You are an AI coding assistant integrated into an IDE. You can see the user's actual project files.

## YOUR CURRENT PROJECT
${context ? `The user has opened a project. Here are the actual files in their workspace:

${context}

IMPORTANT: When the user asks about "this project", "the code", "explain this", etc., you MUST analyze the ACTUAL FILES shown above. Reference specific file names, functions, classes, and code from the context.` : 'No project loaded yet - workspace is empty.'}

## CREATING/MODIFYING FILES
When creating or modifying files, use this format:

\`\`\`python
# filepath: filename.py
code here...
\`\`\`

\`\`\`javascript
// filepath: filename.js
code here...
\`\`\`

RULES:
1. Wrap code in triple backticks with language
2. First line: # filepath: filename.ext (Python) or // filepath: filename.ext (JS)
3. Use simple filenames (no leading slashes)

## GUIDELINES
- When asked to explain the project: Describe what the actual code does based on the files above
- When asked to improve/fix: Reference specific files and line numbers
- Be concise and practical
- Reference actual file names from the context`;

// Chat with codebase context
async function chat(message, workspacePath) {
    console.log(`[Chat] Starting with workspace: ${workspacePath || 'none'}`);

    try {
        const context = workspacePath
            ? await workspaceService.buildCodebaseContext(workspacePath)
            : '';

        console.log(`[Chat] Context length: ${context.length} chars`);

        const systemPrompt = getIDESystemPrompt(context);
        console.log(`[Chat] System prompt length: ${systemPrompt.length} chars`);

        const response = await callAI([
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
        ]);

        console.log(`[Chat] Got response: ${response?.substring(0, 100)}...`);

        if (workspacePath) {
            try {
                await memoryService.logAction(workspacePath, 'chat', message, response);
            } catch (e) {
                console.log('[Chat] Memory log failed (non-critical)');
            }
        }

        // Parse files from chat responses
        const files = parseFilesFromResponse(response || '');

        return { response: response || 'No response received from AI.', files };
    } catch (error) {
        console.error('[Chat] Error:', error.message);
        return {
            response: `Error: ${error.message}. Please check your API key and try again.`,
            files: []
        };
    }
}

// Generate a complete project from description
async function generateProject(description, workspacePath) {
    const prompt = `Create a complete project based on this description:

"${description}"

Generate all necessary files including:
1. Project configuration(package.json if Node.js, requirements.txt if Python, etc.)
    2. README.md with setup instructions
3. Source code files with proper structure
4. Basic tests if applicable

For each file, use this exact format:
\`\`\`[language]
// filepath: [full relative path]
[complete file contents]
\`\`\`

Create a well-organized folder structure. Be thorough and create production-ready code.`;

    const response = await callAI([
        { role: "system", content: getIDESystemPrompt('') },
        { role: "user", content: prompt }
    ], { maxTokens: 16384 });

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

    const response = await callAI([
        { role: "system", content: getIDESystemPrompt(context) },
        { role: "user", content: prompt }
    ], { temperature: 0.5 });

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

    const response = await callAI([
        { role: "system", content: getIDESystemPrompt(context) },
        { role: "user", content: prompt }
    ], { temperature: 0.5 });

    const files = parseFilesFromResponse(response);

    if (workspacePath) {
        await memoryService.logAction(workspacePath, 'edit', instruction, `Modified ${files.length} files`);
    }

    return { response, files };
}

// Inline code suggestions
async function getSuggestion(prefix, suffix, filePath, workspacePath) {
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

    const response = await callAI([
        { role: "system", content: "You are a code completion engine. Output ONLY the code to insert. No markdown, no explanations." },
        { role: "user", content: prompt }
    ], { temperature: 0.2, maxTokens: 256 });

    return response.trim();
}

// Explain code
async function explainCode(code, workspacePath) {
    try {
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

        const response = await callAI([
            { role: "system", content: getIDESystemPrompt(context) },
            { role: "user", content: prompt }
        ], { maxTokens: 4096 });

        return response;
    } catch (error) {
        console.error('[explainCode] Error:', error.message);
        return `Error explaining code: ${error.message}`;
    }
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

    const response = await callAI([
        { role: "system", content: getIDESystemPrompt('') },
        { role: "user", content: prompt }
    ], { temperature: 0.5 });

    const files = parseFilesFromResponse(response);

    if (workspacePath) {
        await memoryService.logAction(workspacePath, 'optimize', `Optimized ${filePath}`, response.substring(0, 200));
    }

    return { response, files };
}

// Parse files from AI response - improved to handle multiple formats
function parseFilesFromResponse(response) {
    const files = [];

    // Match multiple filepath formats:
    // 1. // filepath: path
    // 2. # filepath: path  
    // 3. filepath: path
    // 4. File: path
    const patterns = [
        /```[\w]*\n(?:\/\/|#)?\s*filepath:\s*(.+?)\n([\s\S]*?)```/gi,
        /```[\w]*\n(?:\/\/|#)?\s*file:\s*(.+?)\n([\s\S]*?)```/gi,
        /```(\w+)\n([\s\S]*?)```/g  // Fallback: just code blocks
    ];

    let match;
    const foundPaths = new Set();

    // Try first two patterns (with explicit filepath)
    for (let i = 0; i < 2; i++) {
        while ((match = patterns[i].exec(response)) !== null) {
            const path = match[1].trim();
            if (!foundPaths.has(path)) {
                foundPaths.add(path);
                files.push({
                    path: path,
                    content: match[2].trim()
                });
            }
        }
    }

    // If no explicit filepaths found, try to infer from code blocks
    if (files.length === 0) {
        const codeBlockMatch = /```(\w+)\n([\s\S]*?)```/g;
        let counter = 0;
        while ((match = codeBlockMatch.exec(response)) !== null) {
            const lang = match[1].toLowerCase();
            const content = match[2].trim();

            // Skip if it's just a small snippet or explanation
            if (content.length > 50 && content.includes('\n')) {
                const ext = { python: 'py', javascript: 'js', typescript: 'ts', java: 'java', html: 'html', css: 'css' }[lang] || lang;
                const filename = `generated_${counter++}.${ext}`;
                files.push({ path: filename, content });
            }
        }
    }

    return files;
}

// Apply generated files to workspace
async function applyFiles(files, workspacePath) {
    console.log(`[ApplyFiles] Starting to apply ${files.length} files to workspace: ${workspacePath}`);

    const results = [];
    for (const file of files) {
        console.log(`[ApplyFiles] Writing file: ${file.path}`);
        try {
            await workspaceService.writeFile(file.path, file.content);
            results.push({ path: file.path, success: true });
            console.log(`[ApplyFiles] ✓ Successfully wrote: ${file.path}`);
        } catch (error) {
            console.error(`[ApplyFiles] ✗ Failed to write ${file.path}:`, error.message);
            results.push({ path: file.path, success: false, error: error.message });
        }
    }

    try {
        await memoryService.logAction(workspacePath, 'apply', `Applied ${files.length} files`, JSON.stringify(results));
    } catch (e) {
        console.log('[ApplyFiles] Memory log failed (non-critical)');
    }

    return results;
}

module.exports = {
    getConfig,
    setConfig,
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
