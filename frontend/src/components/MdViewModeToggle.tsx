import { useT, type TranslationKey } from '../i18n'

export type MdViewMode = 'split' | 'edit' | 'preview'

interface Props {
  mode: MdViewMode
  onChange: (mode: MdViewMode) => void
}

const MODES: { id: MdViewMode; label: TranslationKey; title: TranslationKey }[] = [
  { id: 'edit', label: 'dialogs.mdViewMode.edit', title: 'dialogs.mdViewMode.editTitle' },
  { id: 'split', label: 'dialogs.mdViewMode.split', title: 'dialogs.mdViewMode.splitTitle' },
  {
    id: 'preview',
    label: 'dialogs.mdViewMode.preview',
    title: 'dialogs.mdViewMode.previewTitle',
  },
]

export function MdViewModeToggle({ mode, onChange }: Props) {
  const t = useT()
  return (
    <div className="md-mode-toggle" role="group" aria-label={t('dialogs.mdViewMode.group')}>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`md-mode-btn${mode === m.id ? ' active' : ''}`}
          title={t(m.title)}
          aria-pressed={mode === m.id}
          onClick={() => onChange(m.id)}
        >
          {t(m.label)}
        </button>
      ))}
    </div>
  )
}
