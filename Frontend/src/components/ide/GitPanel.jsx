import { useState, useEffect } from 'react'
import { FiGitBranch, FiGitCommit, FiPlus, FiMinus, FiCheck, FiRefreshCw } from 'react-icons/fi'
import './GitPanel.css'

function GitPanel({ onClose }) {
    const [status, setStatus] = useState({ isRepo: false, files: [], branch: '' })
    const [commitMessage, setCommitMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState('')

    const fetchStatus = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('http://localhost:3000/ide/git/status')
            const data = await response.json()
            setStatus(data)
        } catch (error) {
            setMessage('Failed to get git status')
        }
        setIsLoading(false)
    }

    useEffect(() => {
        fetchStatus()
    }, [])

    const handleInit = async () => {
        setIsLoading(true)
        try {
            await fetch('http://localhost:3000/ide/git/init', { method: 'POST' })
            setMessage('Git repository initialized!')
            fetchStatus()
        } catch (error) {
            setMessage('Failed to initialize git')
        }
        setIsLoading(false)
    }

    const handleStageAll = async () => {
        setIsLoading(true)
        try {
            await fetch('http://localhost:3000/ide/git/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: '.' })
            })
            setMessage('All files staged')
            fetchStatus()
        } catch (error) {
            setMessage('Failed to stage files')
        }
        setIsLoading(false)
    }

    const handleCommit = async () => {
        if (!commitMessage.trim()) {
            setMessage('Please enter a commit message')
            return
        }

        setIsLoading(true)
        try {
            await fetch('http://localhost:3000/ide/git/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: commitMessage })
            })
            setMessage('Changes committed!')
            setCommitMessage('')
            fetchStatus()
        } catch (error) {
            setMessage('Failed to commit')
        }
        setIsLoading(false)
    }

    const handlePush = async () => {
        setIsLoading(true)
        try {
            await fetch('http://localhost:3000/ide/git/push', { method: 'POST' })
            setMessage('Pushed to remote!')
        } catch (error) {
            setMessage('Failed to push: ' + error.message)
        }
        setIsLoading(false)
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'M': return <FiGitCommit className="modified" />
            case 'A': return <FiPlus className="added" />
            case 'D': return <FiMinus className="deleted" />
            case '?': return <FiPlus className="untracked" />
            default: return null
        }
    }

    return (
        <div className="git-panel">
            <div className="git-header">
                <div className="git-title">
                    <FiGitBranch />
                    {status.isRepo ? `Branch: ${status.branch || 'main'}` : 'Git'}
                </div>
                <button onClick={fetchStatus} disabled={isLoading} title="Refresh">
                    <FiRefreshCw className={isLoading ? 'spinning' : ''} />
                </button>
            </div>

            {message && <div className="git-message">{message}</div>}

            {!status.isRepo ? (
                <div className="git-empty">
                    <p>Not a git repository</p>
                    <button onClick={handleInit} disabled={isLoading}>
                        Initialize Repository
                    </button>
                </div>
            ) : (
                <>
                    <div className="git-changes">
                        <div className="changes-header">
                            <span>Changes ({status.files.length})</span>
                            <button onClick={handleStageAll} disabled={isLoading || status.files.length === 0}>
                                Stage All
                            </button>
                        </div>

                        {status.files.length === 0 ? (
                            <p className="no-changes">No changes</p>
                        ) : (
                            <ul className="file-list">
                                {status.files.map((file, idx) => (
                                    <li key={idx}>
                                        {getStatusIcon(file.status)}
                                        <span className="file-name">{file.file}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="git-commit">
                        <input
                            type="text"
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Commit message..."
                            disabled={isLoading}
                        />
                        <div className="commit-actions">
                            <button onClick={handleCommit} disabled={isLoading || !commitMessage.trim()}>
                                <FiCheck /> Commit
                            </button>
                            <button onClick={handlePush} disabled={isLoading}>
                                Push
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default GitPanel
