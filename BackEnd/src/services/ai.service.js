require('dotenv').config();
const OpenAI = require("openai");

// Import the shared config from ide-ai.service
const ideAIService = require('./ide-ai.service');

// OpenAI Setup
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';

function getSystemPrompt() {
    return `You are a senior code reviewer. Be CONCISE and PRACTICAL.

OUTPUT FORMAT (use exactly this structure):

## 🔍 Quick Summary
One sentence describing what the code does.

## ⚠️ Issues Found
- **Issue 1**: Brief description → **Fix**: How to fix it
- **Issue 2**: Brief description → **Fix**: How to fix it
(List only actual problems, max 5)

## ✅ Fixed Code
\`\`\`[language]
// Complete fixed and optimized code here
\`\`\`

## 💡 Quick Tips
- Tip 1
- Tip 2
(Max 3 practical tips)

RULES:
- Be brief, not verbose
- ALWAYS provide the complete fixed code
- Use simple language
- Skip obvious/minor issues
- Focus on real bugs and improvements`;
}

// Call Ollama API - optimized for speed
async function callOllama(model, messages) {
    try {
        // Add timeout using AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch(`${ollamaHost}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                options: {
                    temperature: 0.3,
                    num_predict: 2048,
                    num_ctx: 4096,
                    repeat_penalty: 1.1
                }
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`Ollama error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return data.message.content;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Ollama request timed out. Is the model loaded?');
        }
        if (error.message.includes('ECONNREFUSED')) {
            throw new Error('Cannot connect to Ollama. Run: ollama serve');
        }
        throw new Error(`Ollama failed: ${error.message}`);
    }
}

// Generate content using dynamically selected model
async function generateContent(prompt) {
    // Get current config from the shared service
    const config = ideAIService.getConfig();
    console.log(`[AI Service] Using provider: ${config.provider}, model: ${config.model}`);

    try {
        const messages = [
            { role: "system", content: getSystemPrompt() },
            { role: "user", content: prompt }
        ];

        if (config.provider === 'ollama') {
            // Use Ollama
            return await callOllama(config.model, messages);
        } else {
            // Use OpenAI
            const params = {
                model: config.model,
                messages
            };

            // GPT-5 models use max_completion_tokens and don't support temperature
            if (config.model.startsWith('gpt-5')) {
                params.max_completion_tokens = 4096;
            } else {
                params.max_tokens = 4096;
                params.temperature = 0.7;
            }

            const completion = await openai.chat.completions.create(params);
            const response = completion.choices[0].message.content;
            console.log(`[AI Service] Response generated successfully`);
            return response;
        }

    } catch (error) {
        console.error(`[AI Service] Error:`, error.message);
        throw error;
    }
}

module.exports = generateContent;