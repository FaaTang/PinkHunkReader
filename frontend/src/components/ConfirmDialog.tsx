import { useEffect, useMemo, useRef, useState } from 'react'
import './GoToDialog.css'

export type ConfirmChoice = 'confirm' | 'cancel'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onChoice: (choice: ConfirmChoice) => void
}

type Action = { choice: ConfirmChoice; label: string }

/** Shared Yes / Cancel prompt (same chrome as CloseSave / KeepMissing). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Yes(Y)',
  cancelLabel = 'Cancel',
  onChoice,
}: Props) {
  const actionsRef = useRef<HTMLDivElement>(null)
  const actions = useMemo<Action[]>(
    () => [
      { choice: 'confirm', label: confirmLabel },
      { choice: 'cancel', label: cancelLabel },
    ],
    [confirmLabel, cancelLabel],
  )
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!open) return
    setSelected(0)
  }, [open, title, message])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const buttons = actionsRef.current?.querySelectorAll<HTMLButtonElement>('button')
      buttons?.[selected]?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, selected])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onChoice('cancel')
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        setSelected((i) => (i - 1 + actions.length) % actions.length)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        setSelected((i) => (i + 1) % actions.length)
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        onChoice(actions[selected]?.choice ?? 'cancel')
        return
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const ch = e.key.length === 1 ? e.key.toLowerCase() : ''
      if (ch === 'y') {
        e.preventDefault()
        e.stopPropagation()
        onChoice('confirm')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onChoice, actions, selected])

  if (!open) return null
  return (
    <div className="goto-backdrop" onMouseDown={() => onChoice('cancel')}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{title}</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {message}
        </p>
        <div className="goto-actions" style={{ flexWrap: 'wrap' }} ref={actionsRef}>
          {actions.map((action, index) => (
            <button
              key={action.choice}
              type="button"
              className={`toolbar-btn${index === selected ? ' primary' : ''}`}
              onFocus={() => setSelected(index)}
              onClick={() => onChoice(action.choice)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
