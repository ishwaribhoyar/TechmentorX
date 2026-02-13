import { useState, useEffect } from 'react'
import axios from 'axios'
import { FiTerminal, FiGitBranch, FiPlus, FiFile, FiSettings } from 'react-icons/fi'
import WorkspaceSelector from '../components/ide/WorkspaceSelector'
import FileTree from '../components/ide/FileTree'
import CodeEditor from '../components/ide/CodeEditor'
import AIChat from '../components/ide/AIChat'
import Terminal from '../components/ide/Terminal'
import GitPanel from '../components/ide/GitPanel'
import './IDEPage.css'

const API_BASE = 'http://localhost:3000/ide'

function IDEPage() {
    const [workspace, setWorkspace] = useState(null)
    const [isNewProject, setIsNewProject] = useState(false)
    const [files, setFiles] = useState([])
    const [isLoadingFiles, setIsLoadingFiles] = useState(false)
    const [currentFile, setCurrentFile] = useState(null)
    const [fileContent, setFileContent] = useState('')
    const [openFiles, setOpenFiles] = useState([]) // Track all open files for tabs
    const [messages, setMessages] = useState([])
    const [pendingFiles, setPendingFiles] = useState([])
    const [isAILoading, setIsAILoading] = useState(false)

    // Panel visibility
    const [showTerminal, setShowTerminal] = useState(false)
    const [showGitPanel, setShowGitPanel] = useState(false)
    const [showNewFileModal, setShowNewFileModal] = useState(false)
    const [newFileName, setNewFileName] = useState('')

    // Model selector state
    const [aiConfig, setAiConfig] = useState({ provider: 'openai', model: 'gpt-5-nano', availableProviders: [] })
    const [showModelSelector, setShowModelSelector] = useState(false)

    // Fetch AI config on mount
    useEffect(() => {
        fetchAIConfig()
    }, [])

    const fetchAIConfig = async () => {
        try {
            const response = await axios.get(`${API_BASE}/config`)
            setAiConfig(response.data)
        } catch (error) {
            console.error('Failed to fetch AI config:', error)
        }
    }

    const handleModelChange = async (provider, model) => {
        try {
            const response = await axios.post(`${API_BASE}/config`, { provider, model })
            setAiConfig(response.data)
            setShowModelSelector(false)
        } catch (error) {
            console.error('Failed to set AI config:', error)
        }
    }
    // Open workspace
    const handleWorkspaceSelected = async (path) => {
        try {
            const response = await axios.post(`${API_BASE}/workspace/open`, { path })
            setWorkspace(path)
            setIsNewProject(response.data.isNewProject)
            loadFiles()
        } catch (error) {
            console.error('Failed to open workspace:', error)
            alert('Failed to open workspace. Make sure the path exists.')
        }
    }

    // Load file tree
    const loadFiles = async () => {
        setIsLoadingFiles(true)
        try {
            const response = await axios.get(`${API_BASE}/workspace/files`)
            setFiles(response.data.files || [])
        } catch (error) {
            console.error('Failed to load files:', error)
        }
        setIsLoadingFiles(false)
    }

    // Select and load a file
    const handleFileSelect = async (filePath) => {
        try {
            const response = await axios.get(`${API_BASE}/file`, { params: { path: filePath } })
            setCurrentFile(filePath)
            setFileContent(response.data.content)

            // Add to open files if not already open
            setOpenFiles(prev => {
                if (!prev.includes(filePath)) {
                    return [...prev, filePath]
                }
                return prev
            })
        } catch (error) {
            console.error('Failed to load file:', error)
        }
    }

    // Close a file tab
    const handleCloseFile = (filePath) => {
        setOpenFiles(prev => prev.filter(f => f !== filePath))

        // If closing current file, switch to another open file or clear
        if (filePath === currentFile) {
            const remaining = openFiles.filter(f => f !== filePath)
            if (remaining.length > 0) {
                handleFileSelect(remaining[remaining.length - 1])
            } else {
                setCurrentFile(null)
                setFileContent('')
            }
        }
    }

    // Run current file in terminal
    const handleRunFile = async () => {
        if (!currentFile) return

        if (!workspace) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Please select a workspace folder first before running files.'
            }])
            return
        }

        setShowTerminal(true)

        const ext = currentFile.split('.').pop()?.toLowerCase()
        let command = ''

        if (ext === 'py') {
            command = `python "${currentFile}"`
        } else if (ext === 'js') {
            command = `node "${currentFile}"`
        } else if (ext === 'ts') {
            command = `npx ts-node "${currentFile}"`
        } else {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Cannot run .${ext} files directly. Supported: .py, .js, .ts`
            }])
            return
        }

        try {
            const response = await axios.post(`${API_BASE}/terminal/exec`, { command })
            const output = response.data.output || 'No output'
            const status = response.data.success ? '✅' : '❌'
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `${status} **Running ${currentFile}:**\n\`\`\`\n${output}\n\`\`\``
            }])
        } catch (error) {
            const errMsg = error.response?.data?.error || error.message
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ **Failed to run file:** ${errMsg}`
            }])
            console.error('Failed to run file:', error)
        }
    }

    // Save file content
    const handleContentChange = async (newContent) => {
        setFileContent(newContent)
        if (currentFile) {
            try {
                await axios.post(`${API_BASE}/file`, { path: currentFile, content: newContent })
            } catch (error) {
                console.error('Failed to save file:', error)
            }
        }
    }

    // Create new file
    const handleCreateFile = async () => {
        if (!newFileName.trim()) return
        try {
            await axios.post(`${API_BASE}/file`, { path: newFileName, content: '' })
            setShowNewFileModal(false)
            setNewFileName('')
            loadFiles()
            handleFileSelect(newFileName)
        } catch (error) {
            console.error('Failed to create file:', error)
        }
    }

    // Send message to AI
    const handleSendMessage = async (message) => {
        setMessages(prev => [...prev, { role: 'user', content: message }])
        setIsAILoading(true)

        try {
            let response

            // Check if it's a project generation request
            if (isNewProject &&
                (message.toLowerCase().includes('build') ||
                    message.toLowerCase().includes('create') ||
                    message.toLowerCase().includes('generate'))) {
                response = await axios.post(`${API_BASE}/generate`, { description: message })
            } else if (message.toLowerCase().includes('debug') || message.toLowerCase().includes('error')) {
                response = await axios.post(`${API_BASE}/debug`, {
                    error: message,
                    file: currentFile
                })
            } else if (message.toLowerCase().includes('explain') && fileContent) {
                // Only use /explain if we have actual file content
                const explainRes = await axios.post(`${API_BASE}/explain`, { code: fileContent })
                response = { data: { response: explainRes.data.explanation || 'No explanation received' } }
            } else if (message.toLowerCase().includes('optimize') && fileContent) {
                response = await axios.post(`${API_BASE}/optimize`, { code: fileContent, file: currentFile })
            } else if (message.toLowerCase().includes('edit') ||
                message.toLowerCase().includes('modify') ||
                message.toLowerCase().includes('refactor')) {
                response = await axios.post(`${API_BASE}/edit`, {
                    instruction: message,
                    file: currentFile
                })
            } else {
                // Use chat for general questions including "explain this project"
                response = await axios.post(`${API_BASE}/chat`, { message })
            }

            setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }])

            // AUTO-APPLY files if AI generated any
            if (response.data.files && response.data.files.length > 0) {
                try {
                    await axios.post(`${API_BASE}/apply`, { files: response.data.files })
                    loadFiles() // Refresh file tree

                    // Show success message
                    const fileNames = response.data.files.map(f => f.path).join(', ')
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: `✅ **Files created/updated automatically:**\n${response.data.files.map(f => `- \`${f.path}\``).join('\n')}`
                    }])

                    // If a single file was created, open it
                    if (response.data.files.length === 1) {
                        handleFileSelect(response.data.files[0].path)
                    }
                } catch (applyError) {
                    console.error('Failed to auto-apply files:', applyError)
                    // Fallback to pending if auto-apply fails
                    setPendingFiles(response.data.files)
                }
            }
        } catch (error) {
            console.error('AI error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Sorry, something went wrong. Please check your API key and try again.'
            }])
        }

        setIsAILoading(false)
    }

    // Apply pending file changes
    const handleApplyFiles = async () => {
        try {
            await axios.post(`${API_BASE}/apply`, { files: pendingFiles })
            setPendingFiles([])
            loadFiles()
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '✅ Changes applied successfully!'
            }])
        } catch (error) {
            console.error('Failed to apply changes:', error)
        }
    }

    // Reject pending changes
    const handleRejectFiles = () => {
        setPendingFiles([])
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '🚫 Changes rejected.'
        }])
    }

    // Close workspace
    const handleCloseWorkspace = () => {
        setWorkspace(null)
        setFiles([])
        setCurrentFile(null)
        setFileContent('')
        setMessages([])
        setPendingFiles([])
    }

    // If no workspace selected, show selector
    if (!workspace) {
        return <WorkspaceSelector onWorkspaceSelected={handleWorkspaceSelected} />
    }

    return (
        <div className="ide-container">
            <div className="ide-toolbar">
                <div className="toolbar-left">
                    <span className="workspace-name">📁 {workspace.split(/[\\/]/).pop()}</span>
                </div>
                <div className="toolbar-actions">
                    {/* Model Selector */}
                    <div className="model-selector-wrapper">
                        <button
                            onClick={() => setShowModelSelector(!showModelSelector)}
                            title="AI Model"
                            className={showModelSelector ? 'active' : ''}
                        >
                            <FiSettings /> {aiConfig.model}
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
                    <button onClick={() => setShowNewFileModal(true)} title="New File">
                        <FiPlus /> <FiFile />
                    </button>
                    <button onClick={() => setShowTerminal(!showTerminal)} title="Terminal" className={showTerminal ? 'active' : ''}>
                        <FiTerminal />
                    </button>
                    <button onClick={() => setShowGitPanel(!showGitPanel)} title="Git" className={showGitPanel ? 'active' : ''}>
                        <FiGitBranch />
                    </button>
                    <button onClick={handleCloseWorkspace} className="close-workspace">✕ Close</button>
                </div>
            </div>

            <div className="ide-main">
                <div className="ide-sidebar">
                    <FileTree
                        files={files}
                        onFileSelect={handleFileSelect}
                        isLoading={isLoadingFiles}
                    />
                </div>

                <div className="ide-center">
                    <div className="ide-editor">
                        <CodeEditor
                            filePath={currentFile}
                            content={fileContent}
                            onChange={handleContentChange}
                            openFiles={openFiles}
                            onSwitchFile={handleFileSelect}
                            onCloseFile={handleCloseFile}
                            onRun={handleRunFile}
                            onClose={() => handleCloseFile(currentFile)}
                        />
                    </div>
                    {showTerminal && (
                        <Terminal onClose={() => setShowTerminal(false)} />
                    )}
                </div>

                <div className="ide-right">
                    {showGitPanel ? (
                        <GitPanel onClose={() => setShowGitPanel(false)} />
                    ) : (
                        <AIChat
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            pendingFiles={pendingFiles}
                            onApplyFiles={handleApplyFiles}
                            onRejectFiles={handleRejectFiles}
                            isLoading={isAILoading}
                        />
                    )}
                </div>
            </div>

            {/* New File Modal */}
            {showNewFileModal && (
                <div className="modal-overlay" onClick={() => setShowNewFileModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Create New File</h3>
                        <input
                            type="text"
                            value={newFileName}
                            onChange={e => setNewFileName(e.target.value)}
                            placeholder="Enter file path (e.g., src/index.js)"
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button onClick={handleCreateFile}>Create</button>
                            <button onClick={() => setShowNewFileModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default IDEPage
