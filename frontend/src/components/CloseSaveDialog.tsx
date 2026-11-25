import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import './GoToDialog.css'

export type CloseSaveChoice = 'save' | 'discard' | 'save-all' | 'discard-all' | 'cancel'

interface Props {
  open: boolean
  fileName: string
  /** Files still pending after the current one. */
  remaining?: number
  onChoice: (choice: CloseSaveChoice) => void
}

type Action = { choice: CloseSaveChoice; label: string }

export function CloseSaveDialog({ open, fileName, remaining = 0, onChoice }: Props) {
  const t = useT()
  const actionsRef = useRef<HTMLDivElement>(null)
  const showBulk = remaining > 0
  const actions = useMemo<Action[]>(() => {
    const list: Action[] = [
      { choice: 'save', label: t('dialogs.choice.yesKey') },
      { choice: 'discard', label: t('dialogs.choice.noKey') },
    ]
    if (showBulk) {
      list.push(
        { choice: 'save-all', label: t('dialogs.closeSave.yesToAll') },
        { choice: 'discard-all', label: t('dialogs.closeSave.noToAll') },
      )
    }
    list.push({ choice: 'cancel', label: t('common.cancel') })
    return list
  }, [showBulk, t])
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!open) return
    setSelected(0)
  }, [open, fileName, remaining])

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
      // Letter shortcuts: Yes / No only. Yes to All / No to All have none.
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const ch = e.key.length === 1 ? e.key.toLowerCase() : ''
      if (ch === 'y') {
        e.preventDefault()
        e.stopPropagation()
        onChoice('save')
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
  }, [open, onChoice, actions, selected])

  if (!open) return null
  return (
    <div className="goto-backdrop" onMouseDown={() => onChoice('cancel')}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogs.closeSave.ariaLabel')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{t('dialogs.closeSave.title')}</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {t('dialogs.closeSave.message', { file: fileName })}
          {showBulk
            ? t(
                remaining === 1
                  ? 'dialogs.closeSave.remainingOne'
                  : 'dialogs.closeSave.remainingMany',
                { count: remaining },
              )
            : ''}
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
