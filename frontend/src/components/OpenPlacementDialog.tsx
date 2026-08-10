import { useEffect, useState } from 'react'
import './GoToDialog.css'

export type OpenPlacementChoice = 'current' | 'new'

interface Props {
  open: boolean
  pathLabel: string
  defaultTarget: OpenPlacementChoice
  onChoice: (choice: OpenPlacementChoice, always: boolean) => void
  onCancel: () => void
}

export function OpenPlacementDialog({
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
        aria-label="Open placement"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">Open where?</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          A workspace is already open. Choose how to open
          {pathLabel ? ` “${pathLabel}”` : ' the selection'}.
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
            className={`toolbar-btn${defaultTarget === 'new' ? ' primary' : ''}`}
            onClick={() => onChoice('new', always)}
          >
            New window
          </button>
          <button
            type="button"
            className={`toolbar-btn${defaultTarget === 'current' ? ' primary' : ''}`}
            onClick={() => onChoice('current', always)}
          >
            Current workspace
          </button>
        </div>
      </div>
    </div>
  )
}
