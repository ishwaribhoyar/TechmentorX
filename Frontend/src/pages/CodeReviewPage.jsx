import { useState, useEffect } from 'react'
import "prismjs/themes/prism-tomorrow.css"
import Editor from "react-simple-code-editor"
import prism from "prismjs"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.css"
import axios from 'axios'
import '../App.css'

const API_BASE = 'http://localhost:3000'

function CodeReviewPage() {
    const [code, setCode] = useState(` function sum() {
  return 1 + 1
}`)
    const [review, setReview] = useState(``)
    const [isLoading, setIsLoading] = useState(false)
    const [isRunning, setIsRunning] = useState(false)
    const [terminalOutput, setTerminalOutput] = useState('')

    // Model selector state
    const [aiConfig, setAiConfig] = useState({ provider: 'openai', model: 'gpt-5-nano', availableProviders: [] })
    const [showModelSelector, setShowModelSelector] = useState(false)

    useEffect(() => {
        prism.highlightAll()
        fetchAIConfig()
    }, [])

    const fetchAIConfig = async () => {
        try {
            const response = await axios.get(`${API_BASE}/ide/config`)
            setAiConfig(response.data)
        } catch (error) {
            console.error('Failed to fetch AI config:', error)
        }
    }

    const handleModelChange = async (provider, model) => {
        try {
            const response = await axios.post(`${API_BASE}/ide/config`, { provider, model })
            setAiConfig(response.data)
            setShowModelSelector(false)
        } catch (error) {
            console.error('Failed to set AI config:', error)
        }
    }

    async function reviewCode() {
        setIsLoading(true)
        setReview('')
        try {
            const response = await axios.post(`${API_BASE}/ai/get-review`, { code })
            // Backend returns { review: string } or { error: string }
            const reviewText = response.data.review || response.data.error || 'No review received'
            setReview(reviewText)
        } catch (error) {
            const errMsg = error.response?.data?.error || error.message
            setReview(`❌ Error: ${errMsg}. Make sure the backend is running.`)
        }
        setIsLoading(false)
    }

    async function runCode() {
        setIsRunning(true)
        setTerminalOutput('Running...\n')
        try {
            // First, save the code to a temp file then run it
            const response = await axios.post(`${API_BASE}/ide/run-code`, {
                code,
                language: 'javascript' // Default to JS, could be detected
            })
            setTerminalOutput(response.data.output || 'No output')
        } catch (error) {
            const errMsg = error.response?.data?.error || error.message
            setTerminalOutput(`❌ Error: ${errMsg}`)
        }
        setIsRunning(false)
    }

    return (
        <>
            <header className="code-review-header">
                <h1>🔍 AI Code Review</h1>
                <div className="model-selector-wrapper">
                    <button
                        onClick={() => setShowModelSelector(!showModelSelector)}
                        className="model-selector-btn"
                    >
                        🤖 {aiConfig.model}
                    </button>
                    {showModelSelector && (
                        <div className="model-dropdown">
                            <div className="dropdown-header">Select AI Model</div>
                            {aiConfig.availableProviders?.map(provider => (
                                <div key={provider.id} className="provider-group">
                                    <div className="provider-name">{provider.name}</div>
                                    {provider.models.map(model => (
                                        <div
                                            key={model}
                                            className={`model-option ${aiConfig.provider === provider.id && aiConfig.model === model ? 'selected' : ''}`}
                                            onClick={() => handleModelChange(provider.id, model)}
                                        >
                                            {model}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </header>
            <main>
                <div className="left">
                    <div className="code">
                        <Editor
                            value={code}
                            onValueChange={code => setCode(code)}
                            highlight={code => prism.highlight(code, prism.languages.javascript, "javascript")}
                            padding={10}
                            style={{
                                fontFamily: '"Fira code", "Fira Mono", monospace',
                                fontSize: 16,
                                border: "1px solid #ddd",
                                borderRadius: "5px",
                                height: "100%",
                                width: "100%"
                            }}
                        />
                    </div>
                    <div className="button-group">
                        <div
                            onClick={reviewCode}
                            className={`review ${isLoading ? 'loading' : ''}`}
                        >
                            {isLoading ? 'Reviewing...' : '🔍 Review'}
                        </div>
                        <div
                            onClick={runCode}
                            className={`review run-btn ${isRunning ? 'loading' : ''}`}
                        >
                            {isRunning ? 'Running...' : '▶️ Run'}
                        </div>
                    </div>
                    {terminalOutput && (
                        <div className="terminal-output">
                            <div className="terminal-header">📟 Output</div>
                            <pre>{terminalOutput}</pre>
                        </div>
                    )}
                </div>
                <div className="right">
                    <Markdown rehypePlugins={[rehypeHighlight]}>{review}</Markdown>
                </div>
            </main>
        </>
    )
}

export default CodeReviewPage
