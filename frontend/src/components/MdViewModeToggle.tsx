export type MdViewMode = 'split' | 'edit' | 'preview'

interface Props {
  mode: MdViewMode
  onChange: (mode: MdViewMode) => void
}

const MODES: { id: MdViewMode; label: string; title: string }[] = [
  { id: 'edit', label: 'Edit', title: 'Edit only' },
  { id: 'split', label: 'Split', title: 'Edit and preview side by side' },
  { id: 'preview', label: 'Preview', title: 'Preview only' },
]

export function MdViewModeToggle({ mode, onChange }: Props) {
  return (
    <div className="md-mode-toggle" role="group" aria-label="Markdown view mode">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`md-mode-btn${mode === m.id ? ' active' : ''}`}
          title={m.title}
          aria-pressed={mode === m.id}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
