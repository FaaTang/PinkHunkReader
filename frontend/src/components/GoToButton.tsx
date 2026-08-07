import { useAppSettings } from '../settings/AppSettingsContext'
import { formatShortcut } from '../settings/shortcuts'

/** Inline go-to control for file toolbars; shortcut only in hover title. */
export function GoToButton() {
  const { goToTarget, openGoTo, shortcuts } = useAppSettings()
  if (!goToTarget) return null

  const label = goToTarget.kind === 'page' ? 'Go to page' : 'Go to line'
  return (
    <button
      type="button"
      className="toolbar-btn"
      onClick={() => openGoTo()}
      title={`${label} (${formatShortcut(shortcuts.goto)})`}
    >
      {label}
    </button>
  )
}
