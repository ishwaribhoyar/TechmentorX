import Editor from '@monaco-editor/react'
import { FiX, FiPlay } from 'react-icons/fi'
import './CodeEditor.css'

function CodeEditor({ filePath, content, onChange, onClose, onRun, openFiles = [], onSwitchFile, onCloseFile }) {

    const getLanguage = (path) => {
        if (!path) return 'plaintext'
        const ext = path.split('.').pop()?.toLowerCase()
        const langMap = {
            'js': 'javascript', 'jsx': 'javascript',
            'ts': 'typescript', 'tsx': 'typescript',
            'py': 'python', 'html': 'html', 'css': 'css',
            'json': 'json', 'md': 'markdown', 'txt': 'plaintext',
            'java': 'java', 'cpp': 'cpp', 'c': 'c'
        }
        return langMap[ext] || 'plaintext'
    }

    const getFileName = (path) => {
        if (!path) return ''
        return path.split(/[/\\]/).pop()
    }

    const isRunnable = (path) => {
        if (!path) return false
        const ext = path.split('.').pop()?.toLowerCase()
        return ['py', 'js', 'ts'].includes(ext)
    }

    return (
        <div className="code-editor">
            {filePath ? (
                <>
                    <div className="editor-header">
                        <div className="file-tabs">
                            {openFiles.length > 0 ? (
                                openFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className={`file-tab ${file === filePath ? 'active' : ''}`}
                                        onClick={() => onSwitchFile && onSwitchFile(file)}
                                    >
                                        <span className="tab-name">{getFileName(file)}</span>
                                        <button
                                            className="tab-close"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onCloseFile && onCloseFile(file)
                                            }}
                                        >
                                            <FiX />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="file-tab active">
                                    <span className="tab-name">{getFileName(filePath)}</span>
                                    <button
                                        className="tab-close"
                                        onClick={() => onClose && onClose()}
                                    >
                                        <FiX />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="editor-actions">
                            {isRunnable(filePath) && onRun && (
                                <button className="run-btn" onClick={onRun} title="Run file">
                                    <FiPlay /> Run
                                </button>
                            )}
                        </div>
                    </div>
                    <Editor
                        height="calc(100% - 40px)"
                        language={getLanguage(filePath)}
                        value={content}
                        onChange={onChange}
                        theme="vs-dark"
                        options={{
                            fontSize: 14,
                            fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
                            minimap: { enabled: false },
                            wordWrap: 'on',
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            padding: { top: 10 }
                        }}
                    />
                </>
            ) : (
                <div className="editor-placeholder">
                    <div className="placeholder-content">
                        <span className="placeholder-icon">📝</span>
                        <p>Select a file to edit</p>
                        <p className="placeholder-hint">or ask AI to generate code</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CodeEditor
