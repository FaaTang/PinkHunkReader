import { useEffect, useState } from 'react'
import { useT } from '../i18n'
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
        aria-label={t('tree.parentFolder.label')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{t('tree.parentFolder.title')}</div>
        <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {pathLabel
            ? t('tree.parentFolder.bodyWithLabel', { path: pathLabel })
            : t('tree.parentFolder.bodyNoLabel')}
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
            className={`toolbar-btn${defaultTarget === 'file' ? ' primary' : ''}`}
            onClick={() => onChoice('file', always)}
          >
            {t('tree.parentFolder.fileOnly')}
          </button>
          <button
            type="button"
            className={`toolbar-btn${defaultTarget === 'parent' ? ' primary' : ''}`}
            onClick={() => onChoice('parent', always)}
          >
            {t('tree.parentFolder.label')}
          </button>
        </div>
      </div>
    </div>
  )
}
