import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { FiSend, FiCode, FiAlertCircle, FiZap, FiCheck, FiX } from 'react-icons/fi'
import './AIChat.css'

function AIChat({ onSendMessage, messages, pendingFiles, onApplyFiles, onRejectFiles, isLoading }) {
    const [input, setInput] = useState('')
    const messagesEndRef = useRef(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = () => {
        if (input.trim() && !isLoading) {
            onSendMessage(input.trim())
            setInput('')
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const quickActions = [
        { icon: <FiCode />, label: 'Explain', prompt: 'Explain this project to me' },
        { icon: <FiAlertCircle />, label: 'Debug', prompt: 'Help me debug this code' },
        { icon: <FiZap />, label: 'Optimize', prompt: 'Optimize and improve this code' }
    ]

    return (
        <div className="ai-chat">
            <div className="chat-header">
                <h3>🤖 AI Assistant</h3>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-welcome">
                        <p>👋 Hi! I'm your AI coding assistant.</p>
                        <p>I can help you:</p>
                        <ul>
                            <li>Generate new projects from descriptions</li>
                            <li>Explain and understand code</li>
                            <li>Debug errors and fix bugs</li>
                            <li>Refactor and optimize code</li>
                        </ul>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role}`}>
                        <div className="message-content">
                            <Markdown rehypePlugins={[rehypeHighlight]}>{msg.content}</Markdown>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="message assistant loading">
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}

                {pendingFiles && pendingFiles.length > 0 && (
                    <div className="pending-changes">
                        <h4>📝 Pending Changes</h4>
                        <ul>
                            {pendingFiles.map((file, idx) => (
                                <li key={idx}>{file.path}</li>
                            ))}
                        </ul>
                        <div className="change-actions">
                            <button className="btn-apply" onClick={onApplyFiles}>
                                <FiCheck /> Apply All
                            </button>
                            <button className="btn-reject" onClick={onRejectFiles}>
                                <FiX /> Reject
                            </button>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="quick-actions">
                {quickActions.map((action, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSendMessage(action.prompt)}
                        disabled={isLoading}
                    >
                        {action.icon} {action.label}
                    </button>
                ))}
            </div>

            <div className="chat-input">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything about your code..."
                    rows={2}
                    disabled={isLoading}
                />
                <button onClick={handleSend} disabled={isLoading || !input.trim()}>
                    <FiSend />
                </button>
            </div>
        </div>
    )
}

export default AIChat
