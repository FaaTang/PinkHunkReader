import './GoToDialog.css'

export type CloseSaveChoice = 'save' | 'discard' | 'cancel'

interface Props {
  open: boolean
  fileName: string
  /** When quitting with multiple dirty files. */
  remaining?: number
  onChoice: (choice: CloseSaveChoice) => void
}

export function CloseSaveDialog({ open, fileName, remaining = 0, onChoice }: Props) {
  if (!open) return null
  return (
    <div className="goto-backdrop" onMouseDown={() => onChoice('cancel')}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved changes"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">Save changes?</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          &quot;{fileName}&quot; has unsaved changes.
          {remaining > 0 ? ` (${remaining} more file${remaining === 1 ? '' : 's'} after this)` : ''}
        </p>
        <div className="goto-actions" style={{ justifyContent: 'stretch', flexWrap: 'wrap' }}>
          <button type="button" className="toolbar-btn" onClick={() => onChoice('cancel')}>
            Cancel
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="toolbar-btn" onClick={() => onChoice('discard')}>
            Don&apos;t save
          </button>
          <button type="button" className="toolbar-btn primary" onClick={() => onChoice('save')}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
