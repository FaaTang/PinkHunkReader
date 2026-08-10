import { useEffect, useState } from 'react'
import './GoToDialog.css'

export type OpenParentFolderChoice = 'parent' | 'file'

interface Props {
  open: boolean
  pathLabel: string
  defaultTarget: OpenParentFolderChoice
  onChoice: (choice: OpenParentFolderChoice, always: boolean) => void
  onCancel: () => void
}

export function OpenParentFolderDialog({
  open,
  pathLabel,
  defaultTarget,
  onChoice,
  onCancel,
}: Props) {
  const [always, setAlways] = useState(false)
  useEffect(() => {
    if (open) setAlways(false)
  }, [open])
  if (!open) return null
  return (
    <div className="goto-backdrop" onMouseDown={onCancel}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Open parent folder"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">Open parent folder?</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Choose whether to add the parent folder to Explorer when opening
          {pathLabel ? ` “${pathLabel}”` : ' the file'}.
        </p>
        <label className="goto-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={always}
            onChange={(e) => setAlways(e.target.checked)}
          />
          <span>Always use this choice</span>
        </label>
        <div className="goto-actions" style={{ justifyContent: 'stretch', flexWrap: 'wrap' }}>
          <button type="button" className="toolbar-btn" onClick={onCancel}>
            Cancel
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className={`toolbar-btn${defaultTarget === 'file' ? ' primary' : ''}`}
            onClick={() => onChoice('file', always)}
          >
            File only
          </button>
          <button
            type="button"
            className={`toolbar-btn${defaultTarget === 'parent' ? ' primary' : ''}`}
            onClick={() => onChoice('parent', always)}
          >
            Open parent folder
          </button>
        </div>
      </div>
    </div>
  )
}
