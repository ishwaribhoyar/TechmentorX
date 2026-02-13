import { useState } from 'react'
import { FiFolder, FiFolderPlus, FiClock, FiSettings } from 'react-icons/fi'
import './WorkspaceSelector.css'

function WorkspaceSelector({ onWorkspaceSelected }) {
    const [recentWorkspaces] = useState([])
    const [folderPath, setFolderPath] = useState('')
    const [showManualInput, setShowManualInput] = useState(false)

    // Use native OS file picker (File System Access API)
    const handleOpenFolder = async () => {
        try {
            // Check if the File System Access API is available
            if ('showDirectoryPicker' in window) {
                const dirHandle = await window.showDirectoryPicker({
                    mode: 'readwrite'
                })

                // Get the path - for Chrome/Edge, we need to request permission
                // The actual path isn't directly accessible for security reasons
                // But we can use the directory name and handle
                const name = dirHandle.name

                // For now, prompt user for the full path since browsers don't expose it
                const userPath = prompt(
                    `Selected folder: "${name}"\n\nPlease enter the full path to this folder:`,
                    `C:\\Users\\${name}`
                )

                if (userPath) {
                    onWorkspaceSelected(userPath.trim())
                }
            } else {
                // Fallback to manual input for unsupported browsers
                setShowManualInput(true)
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening folder:', error)
                // Fallback to manual input
                setShowManualInput(true)
            }
        }
    }

    const handleConfirmPath = async () => {
        if (folderPath.trim()) {
            onWorkspaceSelected(folderPath.trim())
        }
    }

    const handleCreateNew = () => {
        setShowManualInput(true)
        setFolderPath('')
    }

    return (
        <div className="workspace-selector">
            <div className="workspace-header">
                <h1>🚀 AI IDE</h1>
                <p>Select a workspace to start coding with AI assistance</p>
            </div>

            <div className="workspace-options">
                <div className="option-card" onClick={handleOpenFolder}>
                    <FiFolder className="option-icon" />
                    <h3>Open Folder</h3>
                    <p>Select from file explorer</p>
                </div>

                <div className="option-card" onClick={handleCreateNew}>
                    <FiFolderPlus className="option-icon" />
                    <h3>New Project</h3>
                    <p>Create a new project with AI</p>
                </div>
            </div>

            {showManualInput && (
                <div className="manual-input-section">
                    <input
                        type="text"
                        value={folderPath}
                        onChange={(e) => setFolderPath(e.target.value)}
                        placeholder="Enter folder path (e.g., C:\Projects\my-app)"
                        className="path-input"
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmPath()}
                    />
                    <div className="input-buttons">
                        <button onClick={handleConfirmPath} className="btn-primary">
                            Open Workspace
                        </button>
                        <button onClick={() => setShowManualInput(false)} className="btn-secondary">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {recentWorkspaces.length > 0 && (
                <div className="recent-section">
                    <h3><FiClock /> Recent Workspaces</h3>
                    <ul>
                        {recentWorkspaces.map((ws, idx) => (
                            <li key={idx} onClick={() => onWorkspaceSelected(ws.path)}>
                                {ws.name}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default WorkspaceSelector
