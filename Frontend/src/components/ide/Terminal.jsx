import { useState, useRef, useEffect } from 'react'
import { FiTerminal, FiX, FiMaximize2, FiMinimize2 } from 'react-icons/fi'
import './Terminal.css'

function Terminal({ onClose }) {
    const [input, setInput] = useState('')
    const [history, setHistory] = useState([
        { type: 'system', text: '🚀 Terminal ready. Type commands and press Enter.' }
    ])
    const [isLoading, setIsLoading] = useState(false)
    const [isMaximized, setIsMaximized] = useState(false)
    const outputRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        outputRef.current?.scrollTo(0, outputRef.current.scrollHeight)
    }, [history])

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const command = input.trim()
        setHistory(prev => [...prev, { type: 'input', text: `$ ${command}` }])
        setInput('')
        setIsLoading(true)

        try {
            const response = await fetch('http://localhost:3000/ide/terminal/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            })

            const result = await response.json()

            if (result.error) {
                setHistory(prev => [...prev, { type: 'error', text: result.error }])
            } else {
                setHistory(prev => [...prev, {
                    type: result.success ? 'output' : 'error',
                    text: result.output || 'Command completed'
                }])
            }
        } catch (error) {
            setHistory(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }])
        }

        setIsLoading(false)
    }

    const handleClear = () => {
        setHistory([{ type: 'system', text: 'Terminal cleared.' }])
    }

    return (
        <div className={`terminal-panel ${isMaximized ? 'maximized' : ''}`}>
            <div className="terminal-header">
                <div className="terminal-title">
                    <FiTerminal /> Terminal
                </div>
                <div className="terminal-actions">
                    <button onClick={handleClear} title="Clear">Clear</button>
                    <button onClick={() => setIsMaximized(!isMaximized)} title="Toggle size">
                        {isMaximized ? <FiMinimize2 /> : <FiMaximize2 />}
                    </button>
                    <button onClick={onClose} title="Close">
                        <FiX />
                    </button>
                </div>
            </div>

            <div className="terminal-output" ref={outputRef}>
                {history.map((line, idx) => (
                    <pre key={idx} className={`line ${line.type}`}>{line.text}</pre>
                ))}
                {isLoading && <pre className="line loading">Running...</pre>}
            </div>

            <form className="terminal-input" onSubmit={handleSubmit}>
                <span className="prompt">$</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter command..."
                    disabled={isLoading}
                />
            </form>
        </div>
    )
}

export default Terminal
