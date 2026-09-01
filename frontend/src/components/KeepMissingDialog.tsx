import { useEffect, useMemo, useRef, useState } from 'react'
import './GoToDialog.css'

export type KeepMissingChoice = 'keep' | 'discard'

interface Props {
  open: boolean
  /** Full path shown in the message. */
  filePath: string
  /** When false, only notify that the source is gone (OK closes). */
  canKeep: boolean
  onChoice: (choice: KeepMissingChoice) => void
}

type Action = { choice: KeepMissingChoice; label: string }

/** Notepad++-style prompt when an open file disappears from disk. */
export function KeepMissingDialog({ open, filePath, canKeep, onChoice }: Props) {
  const actionsRef = useRef<HTMLDivElement>(null)
  const actions = useMemo<Action[]>(() => {
    if (canKeep) {
      return [
        { choice: 'keep', label: 'Yes(Y)' },
        { choice: 'discard', label: 'No(N)' },
      ]
    }
    return [{ choice: 'discard', label: 'OK' }]
  }, [canKeep])
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!open) return
    setSelected(0)
  }, [open, filePath, canKeep])

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
        onChoice('discard')
        return
      }
      if (canKeep && e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        setSelected((i) => (i - 1 + actions.length) % actions.length)
        return
      }
      if (canKeep && e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        setSelected((i) => (i + 1) % actions.length)
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        onChoice(actions[selected]?.choice ?? 'discard')
        return
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (!canKeep) return
      const ch = e.key.length === 1 ? e.key.toLowerCase() : ''
      if (ch === 'y') {
        e.preventDefault()
        e.stopPropagation()
        onChoice('keep')
        return
      }
      if (ch === 'n') {
        e.preventDefault()
        e.stopPropagation()
        onChoice('discard')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onChoice, actions, selected, canKeep])

  if (!open) return null
  return (
    <div className="goto-backdrop" onMouseDown={() => onChoice('discard')}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={canKeep ? 'Keep file' : 'Source file missing'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{canKeep ? 'Keep file?' : 'Source file missing'}</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          The file &quot;{filePath}&quot; is no longer available.
          {canKeep ? ' Keep it in the editor?' : ''}
        </p>
        <div className="goto-actions" style={{ flexWrap: 'wrap' }} ref={actionsRef}>
          {actions.map((action, index) => (
            <button
              key={`${action.choice}-${action.label}`}
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
