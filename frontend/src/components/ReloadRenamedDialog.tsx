import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import './GoToDialog.css'

export type ReloadRenamedChoice = 'reload' | 'keep'

interface Props {
  open: boolean
  oldPath: string
  newPath: string
  onChoice: (choice: ReloadRenamedChoice) => void
}

type Action = { choice: ReloadRenamedChoice; label: string }

/** Notepad++-style prompt when an open file was renamed on disk. */
export function ReloadRenamedDialog({ open, oldPath, newPath, onChoice }: Props) {
  const t = useT()
  const actionsRef = useRef<HTMLDivElement>(null)
  const actions = useMemo<Action[]>(
    () => [
      { choice: 'reload', label: t('dialogs.choice.yesKey') },
      { choice: 'keep', label: t('dialogs.choice.noKey') },
    ],
    [t],
  )
  const [selected, setSelected] = useState(0)
  const oldName = oldPath.split(/[/\\]/).pop() || oldPath
  const newName = newPath.split(/[/\\]/).pop() || newPath

  useEffect(() => {
    if (!open) return
    setSelected(0)
  }, [open, oldPath, newPath])

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
        onChoice('keep')
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
        onChoice(actions[selected]?.choice ?? 'keep')
        return
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const ch = e.key.length === 1 ? e.key.toLowerCase() : ''
      if (ch === 'y') {
        e.preventDefault()
        e.stopPropagation()
        onChoice('reload')
        return
      }
      if (ch === 'n') {
        e.preventDefault()
        e.stopPropagation()
        onChoice('keep')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onChoice, actions, selected])

  if (!open) return null
  return (
    <div className="goto-backdrop" onMouseDown={() => onChoice('keep')}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogs.reloadRenamed.ariaLabel')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{t('dialogs.reloadRenamed.title')}</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {t('dialogs.reloadRenamed.message', { old: oldName, new: newName })}
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
