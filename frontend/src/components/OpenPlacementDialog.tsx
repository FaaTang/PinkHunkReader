import { useEffect, useState } from 'react'
import { useT } from '../i18n'
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
  const t = useT()
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
        aria-label={t('tree.placement.ariaLabel')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{t('tree.placement.title')}</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {pathLabel
            ? t('tree.placement.bodyWithLabel', { path: pathLabel })
            : t('tree.placement.bodyNoLabel')}
        </p>
        <label className="goto-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={always}
            onChange={(e) => setAlways(e.target.checked)}
          />
          <span>{t('tree.dialog.alwaysUse')}</span>
        </label>
        <div className="goto-actions" style={{ justifyContent: 'stretch', flexWrap: 'wrap' }}>
          <button type="button" className="toolbar-btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className={`toolbar-btn${defaultTarget === 'new' ? ' primary' : ''}`}
            onClick={() => onChoice('new', always)}
          >
            {t('tree.placement.newWindow')}
          </button>
          <button
            type="button"
            className={`toolbar-btn${defaultTarget === 'current' ? ' primary' : ''}`}
            onClick={() => onChoice('current', always)}
          >
            {t('tree.placement.currentWorkspace')}
          </button>
        </div>
      </div>
    </div>
  )
}
