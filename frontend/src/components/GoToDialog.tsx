import { useEffect, useRef, useState } from 'react'
import { useAppSettings } from '../settings/AppSettingsContext'
import './GoToDialog.css'

export function GoToDialog() {
  const { goToOpen, closeGoTo, goToTarget } = useAppSettings()
  const [draft, setDraft] = useState('1')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!goToOpen || !goToTarget) return
    setDraft(String(goToTarget.current || 1))
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(t)
  }, [goToOpen, goToTarget])

  if (!goToOpen || !goToTarget) return null

  const label = goToTarget.kind === 'page' ? 'Page' : 'Line'
  const title = goToTarget.kind === 'page' ? 'Go to page' : 'Go to line'

  const submit = () => {
    const n = Math.min(
      goToTarget.max || Number.MAX_SAFE_INTEGER,
      Math.max(1, Math.floor(Number(draft) || 1)),
    )
    void goToTarget.go(n)
    closeGoTo()
  }

  return (
    <div className="goto-backdrop" onMouseDown={closeGoTo}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{title}</div>
        <label className="goto-label">
          {label}
          {goToTarget.max > 0 ? ` (1–${goToTarget.max})` : ''}
          <input
            ref={inputRef}
            className="goto-input"
            value={draft}
            inputMode="numeric"
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                closeGoTo()
              }
            }}
          />
        </label>
        <div className="goto-actions">
          <button type="button" className="toolbar-btn" onClick={closeGoTo}>
            Cancel
          </button>
          <button type="button" className="toolbar-btn primary" onClick={submit}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
