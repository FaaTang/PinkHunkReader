import { useEffect, useState } from 'react'
import { useAppSettings, type SettingsSection } from '../settings/AppSettingsContext'
import {
  SHORTCUT_LABELS,
  type ShortcutId,
  bindingFromEvent,
  formatShortcut,
} from '../settings/shortcuts'
import { MAX_RECENT_MAX, MIN_RECENT_MAX } from '../settings/recentFiles'
import './GoToDialog.css'
import './SettingsModal.css'

const ORDER: ShortcutId[] = ['open', 'newFile', 'save', 'formatJson', 'goto', 'fullscreen', 'exitFullscreen']

const NAV: { id: SettingsSection; title: string; description: string }[] = [
  {
    id: 'shortcuts',
    title: 'Shortcuts',
    description: 'Keyboard bindings for common actions',
  },
  {
    id: 'general',
    title: 'General',
    description: 'Recent files and other preferences',
  },
]

export function SettingsModal() {
  const {
    settingsOpen,
    closeSettings,
    settingsSection,
    setSettingsSection,
    shortcuts,
    setShortcut,
    resetShortcuts,
    recentMax,
    setRecentMax,
    clearRecent,
    recentFiles,
  } = useAppSettings()
  const [capturing, setCapturing] = useState<ShortcutId | null>(null)
  const [recentDraft, setRecentDraft] = useState(String(recentMax))

  useEffect(() => {
    if (!settingsOpen) setCapturing(null)
  }, [settingsOpen])

  useEffect(() => {
    if (settingsOpen) setRecentDraft(String(recentMax))
  }, [settingsOpen, recentMax])

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturing(null)
        return
      }
      const b = bindingFromEvent(e)
      if (!b) return
      setShortcut(capturing, b)
      setCapturing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, setShortcut])

  if (!settingsOpen) return null

  const applyRecentMax = () => {
    const n = Math.floor(Number(recentDraft))
    if (!Number.isFinite(n)) {
      setRecentDraft(String(recentMax))
      return
    }
    setRecentMax(n)
  }

  return (
    <div className="settings-backdrop" onMouseDown={closeSettings}>
      <div
        className="settings-dialog settings-dialog-grouped"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="settings-title">Settings</div>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings groups">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item${settingsSection === item.id ? ' active' : ''}`}
                onClick={() => setSettingsSection(item.id)}
              >
                <span className="settings-nav-title">{item.title}</span>
                <span className="settings-nav-desc">{item.description}</span>
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            {settingsSection === 'shortcuts' ? (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">Shortcuts</div>
                  <div className="settings-section-desc">
                    Click a binding, then press the new keys. Escape cancels capture.
                  </div>
                </div>
                <div className="settings-list">
                  {ORDER.map((id) => (
                    <div key={id} className="settings-row">
                      <span className="settings-row-label">{SHORTCUT_LABELS[id]}</span>
                      <button
                        type="button"
                        className={`settings-binding${capturing === id ? ' capturing' : ''}`}
                        onClick={() => setCapturing(id)}
                      >
                        {capturing === id ? 'Press keys…' : formatShortcut(shortcuts[id])}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="settings-hint">
                  Defaults use Ctrl on Windows and Cmd on macOS for Save / Go to.
                </p>
                <div className="settings-actions">
                  <button type="button" className="toolbar-btn" onClick={resetShortcuts}>
                    Reset shortcuts
                  </button>
                  <button type="button" className="toolbar-btn primary" onClick={closeSettings}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">General</div>
                  <div className="settings-section-desc">
                    Recent files appear under the Open menu.
                  </div>
                </div>
                <div className="settings-list">
                  <div className="settings-row">
                    <span className="settings-row-label">
                      Recent files to keep
                      <span className="settings-row-sub">
                        {MIN_RECENT_MAX}–{MAX_RECENT_MAX} (default 10)
                      </span>
                    </span>
                    <input
                      className="settings-number"
                      type="number"
                      min={MIN_RECENT_MAX}
                      max={MAX_RECENT_MAX}
                      value={recentDraft}
                      onChange={(e) => setRecentDraft(e.target.value.replace(/[^\d]/g, ''))}
                      onBlur={applyRecentMax}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          applyRecentMax()
                        }
                      }}
                      aria-label="Recent files to keep"
                    />
                  </div>
                  <div className="settings-row settings-row-stack">
                    <span className="settings-row-label">
                      Saved recently
                      <span className="settings-row-sub">
                        {recentFiles.length} file{recentFiles.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="toolbar-btn"
                      disabled={recentFiles.length === 0}
                      onClick={clearRecent}
                    >
                      Clear list
                    </button>
                  </div>
                </div>
                <div className="settings-actions">
                  <span style={{ flex: 1 }} />
                  <button type="button" className="toolbar-btn primary" onClick={closeSettings}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
