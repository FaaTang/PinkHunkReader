import { useEffect, useState } from 'react'
import { useAppSettings, type SettingsSection } from '../settings/AppSettingsContext'
import {
  SHORTCUT_LABELS,
  type ShortcutId,
  bindingFromEvent,
  formatShortcut,
} from '../settings/shortcuts'
import { MAX_RECENT_MAX, MIN_RECENT_MAX } from '../settings/recentFiles'
import type { useAppUpdateManager } from '../hooks/useAppUpdateManager'
import { GetGlobalProxyConfig, GetOpenPlacementPrefs, SaveGlobalProxy, SaveOpenPlacementPrefs } from '../../wailsjs/go/app/App'
import {
  DEFAULT_OPEN_PLACEMENT,
  normalizeOpenPlacement,
  type OpenPlacementMode,
  type OpenPlacementPrefs,
  type OpenPlacementTarget,
} from '../settings/openPlacement'
import './GoToDialog.css'
import './SettingsModal.css'

const ORDER: ShortcutId[] = ['open', 'newFile', 'closeTab', 'save', 'formatJson', 'goto', 'settings', 'fullscreen', 'exitFullscreen']

const NAV: { id: SettingsSection; title: string; description: string }[] = [
  {
    id: 'general',
    title: 'General',
    description: 'Recent files and other preferences',
  },
  {
    id: 'shortcuts',
    title: 'Shortcuts',
    description: 'Keyboard bindings for common actions',
  },
  {
    id: 'proxy',
    title: 'Proxy',
    description: 'HTTP / SOCKS5 for updates',
  },
  {
    id: 'about',
    title: 'About',
    description: 'Version and software updates',
  },
]

type UpdateManager = ReturnType<typeof useAppUpdateManager>

type ProxyDraft = {
  enabled: boolean
  type: 'http' | 'socks5'
  host: string
  port: string
  user: string
  password: string
}

const emptyProxyDraft = (): ProxyDraft => ({
  enabled: false,
  type: 'socks5',
  host: '127.0.0.1',
  port: '1080',
  user: '',
  password: '',
})

interface Props {
  update?: UpdateManager
}

export function SettingsModal({ update }: Props) {
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
  const [proxyDraft, setProxyDraft] = useState<ProxyDraft>(emptyProxyDraft)
  const [proxyBusy, setProxyBusy] = useState(false)
  const [proxyError, setProxyError] = useState('')
  const [proxyStatus, setProxyStatus] = useState('')
  const [openPlacement, setOpenPlacement] = useState<OpenPlacementPrefs>(DEFAULT_OPEN_PLACEMENT)
  const [openPlacementStatus, setOpenPlacementStatus] = useState('')

  useEffect(() => {
    if (!settingsOpen) setCapturing(null)
  }, [settingsOpen])

  useEffect(() => {
    if (settingsOpen) setRecentDraft(String(recentMax))
  }, [settingsOpen, recentMax])

  useEffect(() => {
    if (settingsOpen && settingsSection === 'about') {
      void update?.refreshAppInfo()
    }
  }, [settingsOpen, settingsSection, update])

  useEffect(() => {
    if (!settingsOpen || settingsSection !== 'general') return
    let cancelled = false
    ;(async () => {
      try {
        const prefs = normalizeOpenPlacement(await GetOpenPlacementPrefs())
        if (!cancelled) {
          setOpenPlacement(prefs)
          setOpenPlacementStatus('')
        }
      } catch (e) {
        if (!cancelled) setOpenPlacementStatus(String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [settingsOpen, settingsSection])

  const applyOpenPlacement = async (next: OpenPlacementPrefs) => {
    setOpenPlacement(next)
    setOpenPlacementStatus('')
    try {
      const saved = normalizeOpenPlacement(await SaveOpenPlacementPrefs(next))
      setOpenPlacement(saved)
    } catch (e) {
      setOpenPlacementStatus(String(e))
    }
  }

  useEffect(() => {
    if (!settingsOpen || settingsSection !== 'proxy') return
    let cancelled = false
    void (async () => {
      setProxyError('')
      setProxyStatus('')
      try {
        const res = await GetGlobalProxyConfig() as {
          success?: boolean
          message?: string
          data?: Partial<ProxyDraft> & { port?: number; type?: string }
        }
        if (cancelled) return
        if (!res?.success || !res.data) {
          setProxyError(res?.message || 'Failed to load proxy settings')
          return
        }
        const type = String(res.data.type || 'socks5').toLowerCase() === 'http' ? 'http' : 'socks5'
        setProxyDraft({
          enabled: Boolean(res.data.enabled),
          type,
          host: String(res.data.host || '127.0.0.1'),
          port: String(res.data.port || (type === 'http' ? 8080 : 1080)),
          user: String(res.data.user || ''),
          password: String(res.data.password || ''),
        })
      } catch (e) {
        if (!cancelled) setProxyError(String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [settingsOpen, settingsSection])

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

  const saveProxy = async () => {
    setProxyBusy(true)
    setProxyError('')
    setProxyStatus('')
    try {
      const port = Math.floor(Number(proxyDraft.port))
      const res = await SaveGlobalProxy({
        enabled: proxyDraft.enabled,
        type: proxyDraft.type,
        host: proxyDraft.host.trim(),
        port: Number.isFinite(port) ? port : (proxyDraft.type === 'http' ? 8080 : 1080),
        user: proxyDraft.user.trim(),
        password: proxyDraft.password,
      }) as { success?: boolean; message?: string; data?: Partial<ProxyDraft> & { port?: number; type?: string } }
      if (!res?.success) {
        setProxyError(res?.message || 'Failed to save proxy settings')
        return
      }
      if (res.data) {
        const type = String(res.data.type || proxyDraft.type).toLowerCase() === 'http' ? 'http' : 'socks5'
        setProxyDraft({
          enabled: Boolean(res.data.enabled),
          type,
          host: String(res.data.host || ''),
          port: String(res.data.port || (type === 'http' ? 8080 : 1080)),
          user: String(res.data.user || ''),
          password: String(res.data.password || ''),
        })
      }
      setProxyStatus(proxyDraft.enabled
        ? 'Proxy enabled for update downloads'
        : 'Proxy disabled · system proxy (if any) still applies')
    } catch (e) {
      setProxyError(String(e))
    } finally {
      setProxyBusy(false)
    }
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
            ) : null}

            {settingsSection === 'general' ? (
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
                  <div className="settings-row">
                    <span className="settings-row-label">
                      Open in
                      <span className="settings-row-sub">
                        When continuing to open files or folders
                      </span>
                    </span>
                    <select
                      className="settings-select"
                      value={openPlacement.target}
                      onChange={(e) =>
                        void applyOpenPlacement({
                          ...openPlacement,
                          target: e.target.value as OpenPlacementTarget,
                        })
                      }
                      aria-label="Open in"
                    >
                      <option value="current">Current window</option>
                      <option value="new">New window</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">
                      When already open
                      <span className="settings-row-sub">
                        Ask each time, or always use the preference above
                      </span>
                    </span>
                    <select
                      className="settings-select"
                      value={openPlacement.mode}
                      onChange={(e) =>
                        void applyOpenPlacement({
                          ...openPlacement,
                          mode: e.target.value as OpenPlacementMode,
                        })
                      }
                      aria-label="When already open"
                    >
                      <option value="ask">Ask every time</option>
                      <option value="always">Always use preference</option>
                    </select>
                  </div>
                  {openPlacementStatus ? (
                    <div className="settings-hint" style={{ color: 'var(--ph-danger)' }}>
                      {openPlacementStatus}
                    </div>
                  ) : null}
                </div>
                <div className="settings-actions">
                  <span style={{ flex: 1 }} />
                  <button type="button" className="toolbar-btn primary" onClick={closeSettings}>
                    Done
                  </button>
                </div>
              </>
            ) : null}

            {settingsSection === 'proxy' ? (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">Proxy</div>
                  <div className="settings-section-desc">
                    Used for GitHub update checks and downloads. When disabled, system proxy env vars still apply.
                  </div>
                </div>
                <div className="settings-list">
                  <div className="settings-row settings-row-stack">
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={proxyDraft.enabled}
                        onChange={(e) => setProxyDraft((p) => ({ ...p, enabled: e.target.checked }))}
                      />
                      Enable global proxy
                    </label>
                  </div>
                  <div className={`settings-proxy-grid${proxyDraft.enabled ? '' : ' disabled'}`}>
                    <label className="settings-field">
                      <span>Type</span>
                      <select
                        value={proxyDraft.type}
                        disabled={!proxyDraft.enabled}
                        onChange={(e) => {
                          const type = e.target.value === 'http' ? 'http' : 'socks5'
                          setProxyDraft((p) => ({
                            ...p,
                            type,
                            port: p.port || String(type === 'http' ? 8080 : 1080),
                          }))
                        }}
                      >
                        <option value="socks5">SOCKS5</option>
                        <option value="http">HTTP</option>
                      </select>
                    </label>
                    <label className="settings-field">
                      <span>Port</span>
                      <input
                        className="settings-number"
                        type="number"
                        min={1}
                        max={65535}
                        disabled={!proxyDraft.enabled}
                        value={proxyDraft.port}
                        onChange={(e) => setProxyDraft((p) => ({ ...p, port: e.target.value.replace(/[^\d]/g, '') }))}
                      />
                    </label>
                    <label className="settings-field settings-field-span">
                      <span>Host</span>
                      <input
                        className="settings-text"
                        disabled={!proxyDraft.enabled}
                        value={proxyDraft.host}
                        placeholder="127.0.0.1"
                        onChange={(e) => setProxyDraft((p) => ({ ...p, host: e.target.value }))}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Username</span>
                      <input
                        className="settings-text"
                        disabled={!proxyDraft.enabled}
                        value={proxyDraft.user}
                        onChange={(e) => setProxyDraft((p) => ({ ...p, user: e.target.value }))}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Password</span>
                      <input
                        className="settings-text"
                        type="password"
                        disabled={!proxyDraft.enabled}
                        value={proxyDraft.password}
                        onChange={(e) => setProxyDraft((p) => ({ ...p, password: e.target.value }))}
                      />
                    </label>
                  </div>
                  {proxyError ? <div className="settings-error">{proxyError}</div> : null}
                  {proxyStatus ? <p className="settings-hint">{proxyStatus}</p> : null}
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="toolbar-btn primary"
                    disabled={proxyBusy}
                    onClick={() => void saveProxy()}
                  >
                    {proxyBusy ? 'Saving…' : 'Save proxy'}
                  </button>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="toolbar-btn" onClick={closeSettings}>
                    Done
                  </button>
                </div>
              </>
            ) : null}

            {settingsSection === 'about' ? (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">About</div>
                  <div className="settings-section-desc">
                    Version info and GitHub Release updates.
                  </div>
                </div>
                <div className="settings-list">
                  <div className="settings-row settings-row-stack">
                    <span className="settings-row-label">
                      PinkHunkReader
                      <span className="settings-row-sub">
                        v{update?.appInfo?.version || '…'}
                        {update?.appInfo?.author ? ` · ${update.appInfo.author}` : ''}
                      </span>
                    </span>
                    {update?.appInfo?.repoUrl ? (
                      <a className="settings-link" href={update.appInfo.repoUrl} target="_blank" rel="noreferrer">
                        GitHub
                      </a>
                    ) : null}
                  </div>
                  <div className="settings-row settings-row-stack">
                    <span className="settings-row-label">
                      Updates
                      <span className="settings-row-sub">{update?.status || 'Not checked'}</span>
                    </span>
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={update?.prefs.autoPromptEnabled !== false}
                        onChange={(e) => update?.setAutoPrompt(e.target.checked)}
                      />
                      Auto-prompt when an update is available
                    </label>
                  </div>
                  {update?.lastUpdate?.hasUpdate && update.lastUpdate.releaseNotes ? (
                    <div className="settings-notes">
                      <div className="settings-notes-title">
                        {update.lastUpdate.releaseName || `v${update.lastUpdate.latestVersion}`}
                      </div>
                      <pre className="settings-notes-body">{update.lastUpdate.releaseNotes}</pre>
                    </div>
                  ) : null}
                  {update?.error ? <div className="settings-error">{update.error}</div> : null}
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="toolbar-btn"
                    disabled={update?.busy}
                    onClick={() => void update?.checkForUpdates(false)}
                  >
                    Check for updates
                  </button>
                  {update?.lastUpdate?.hasUpdate && !update.canInstall ? (
                    <button
                      type="button"
                      className="toolbar-btn primary"
                      disabled={update.busy}
                      onClick={() => void update.downloadUpdate()}
                    >
                      Download
                      {update.lastUpdate.assetSize
                        ? ` (${update.formatBytes(update.lastUpdate.assetSize)})`
                        : ''}
                    </button>
                  ) : null}
                  {update?.canInstall ? (
                    <>
                      <button
                        type="button"
                        className="toolbar-btn primary"
                        disabled={update.busy}
                        onClick={() => void update.installUpdate()}
                      >
                        Install and restart
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        disabled={update.busy}
                        onClick={() => void update.openDownloadedPackage()}
                      >
                        Open package
                      </button>
                    </>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  <button type="button" className="toolbar-btn" onClick={closeSettings}>
                    Done
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
