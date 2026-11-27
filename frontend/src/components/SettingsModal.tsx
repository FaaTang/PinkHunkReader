import { useEffect, useState } from 'react'
import { getLangPref, setLangPref, useT, type LangPref, type TranslationKey } from '../i18n'
import { useAppSettings, type SettingsSection } from '../settings/AppSettingsContext'
import {
  shortcutLabel,
  type ShortcutId,
  bindingFromEvent,
  formatShortcut,
} from '../settings/shortcuts'
import { MAX_RECENT_MAX, MIN_RECENT_MAX } from '../settings/recentFiles'
import {
  DEFAULT_AUTO_SAVE_INTERVAL_SECONDS,
  MAX_AUTO_SAVE_INTERVAL_SECONDS,
  MIN_AUTO_SAVE_INTERVAL_SECONDS,
  clampAutoSaveIntervalSeconds,
} from '../settings/autoSavePreferences'
import {
  DEFAULT_LARGE_FILE_THRESHOLD_MB,
  MIN_LARGE_FILE_THRESHOLD_MB,
  clampLargeFileThresholdMB,
  normalizeEditorPrefs,
  type EditorPrefs,
} from '../settings/editorPreferences'
import type { useAppUpdateManager } from '../hooks/useAppUpdateManager'
import { GetEditorPrefs, GetGlobalProxyConfig, GetOpenPlacementPrefs, GetShellIntegrationPrefs, SaveEditorPrefs, SaveGlobalProxy, SaveOpenPlacementPrefs, SaveShellIntegrationPrefs } from '../../wailsjs/go/app/App'
import {
  DEFAULT_OPEN_PLACEMENT,
  normalizeOpenPlacement,
  type OpenParentFolderMode,
  type OpenParentFolderTarget,
  type OpenPlacementMode,
  type OpenPlacementPrefs,
  type OpenPlacementTarget,
} from '../settings/openPlacement'
import { DEFAULT_ACCENT_HEX, type ThemeMode } from '../settings/themePreferences'
import './GoToDialog.css'
import './SettingsModal.css'

const ORDER: ShortcutId[] = [
  'open',
  'openFolder',
  'newFile',
  'closeTab',
  'save',
  'formatJson',
  'goto',
  'toggleExplorer',
  'settings',
  'fullscreen',
  'exitFullscreen',
]

const THEME_MODE_OPTIONS: {
  id: ThemeMode
  titleKey: TranslationKey
  descriptionKey: TranslationKey
}[] = [
  {
    id: 'system',
    titleKey: 'settings.appearance.themeSystem',
    descriptionKey: 'settings.appearance.themeSystemDescription',
  },
  {
    id: 'light',
    titleKey: 'settings.appearance.themeLight',
    descriptionKey: 'settings.appearance.themeLightDescription',
  },
  {
    id: 'dark',
    titleKey: 'settings.appearance.themeDark',
    descriptionKey: 'settings.appearance.themeDarkDescription',
  },
]

const LANGUAGE_OPTIONS: {
  id: LangPref
  titleKey: TranslationKey
  descriptionKey: TranslationKey
}[] = [
  {
    id: 'system',
    titleKey: 'settings.language.system',
    descriptionKey: 'settings.language.systemDescription',
  },
  {
    id: 'en',
    titleKey: 'settings.language.english',
    descriptionKey: 'settings.language.englishDescription',
  },
  {
    id: 'zh',
    titleKey: 'settings.language.zh',
    descriptionKey: 'settings.language.zhDescription',
  },
]

const NAV: { id: SettingsSection; titleKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  {
    id: 'general',
    titleKey: 'settings.nav.general.title',
    descriptionKey: 'settings.nav.general.description',
  },
  {
    id: 'appearance',
    titleKey: 'settings.nav.appearance.title',
    descriptionKey: 'settings.nav.appearance.description',
  },
  {
    id: 'shortcuts',
    titleKey: 'settings.nav.shortcuts.title',
    descriptionKey: 'settings.nav.shortcuts.description',
  },
  {
    id: 'proxy',
    titleKey: 'settings.nav.proxy.title',
    descriptionKey: 'settings.nav.proxy.description',
  },
  {
    id: 'about',
    titleKey: 'settings.nav.about.title',
    descriptionKey: 'settings.nav.about.description',
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
  const t = useT()
  // Read on every render: useT() re-renders this component when the resolved language changes.
  const langPref = getLangPref()
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
    autoSave,
    setAutoSaveEnabled,
    setAutoSaveIntervalSeconds,
    theme,
    setThemeMode,
    setThemeAccent,
    resetThemeAccent,
    darkMode,
    viewers,
    setPdfDarkInvert,
  } = useAppSettings()
  const [capturing, setCapturing] = useState<ShortcutId | null>(null)
  const [recentDraft, setRecentDraft] = useState(String(recentMax))
  const [autoSaveIntervalDraft, setAutoSaveIntervalDraft] = useState(String(autoSave.intervalSeconds))
  const [proxyDraft, setProxyDraft] = useState<ProxyDraft>(emptyProxyDraft)
  const [proxyBusy, setProxyBusy] = useState(false)
  const [proxyError, setProxyError] = useState('')
  const [proxyStatus, setProxyStatus] = useState('')
  const [openPlacement, setOpenPlacement] = useState<OpenPlacementPrefs>(DEFAULT_OPEN_PLACEMENT)
  const [openPlacementStatus, setOpenPlacementStatus] = useState('')
  const [shellContextMenu, setShellContextMenu] = useState(true)
  const [shellStatus, setShellStatus] = useState('')
  const [shellBusy, setShellBusy] = useState(false)
  const [editorPrefs, setEditorPrefs] = useState<EditorPrefs>(() => normalizeEditorPrefs(null))
  const [largeFileDraft, setLargeFileDraft] = useState(String(DEFAULT_LARGE_FILE_THRESHOLD_MB))
  const [editorPrefsStatus, setEditorPrefsStatus] = useState('')

  useEffect(() => {
    if (!settingsOpen) setCapturing(null)
  }, [settingsOpen])

  useEffect(() => {
    if (settingsOpen) {
      setRecentDraft(String(recentMax))
      setAutoSaveIntervalDraft(String(autoSave.intervalSeconds))
      setLargeFileDraft(String(editorPrefs.largeFileThresholdMB))
    }
  }, [settingsOpen, recentMax, autoSave.intervalSeconds, editorPrefs.largeFileThresholdMB])

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
      try {
        const prefs = normalizeEditorPrefs(await GetEditorPrefs())
        if (!cancelled) {
          setEditorPrefs(prefs)
          setLargeFileDraft(String(prefs.largeFileThresholdMB))
          setEditorPrefsStatus('')
        }
      } catch (e) {
        if (!cancelled) setEditorPrefsStatus(String(e))
      }
      try {
        const prefs = await GetShellIntegrationPrefs()
        if (!cancelled) {
          setShellContextMenu(Boolean(prefs?.contextMenu ?? true))
          setShellStatus('')
        }
      } catch (e) {
        if (!cancelled) setShellStatus(String(e))
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

  const applyShellContextMenu = async (enabled: boolean) => {
    setShellContextMenu(enabled)
    setShellStatus('')
    setShellBusy(true)
    try {
      const saved = await SaveShellIntegrationPrefs({ contextMenu: enabled })
      setShellContextMenu(saved?.contextMenu !== false)
    } catch (e) {
      setShellStatus(String(e))
      setShellContextMenu(!enabled)
    } finally {
      setShellBusy(false)
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
          setProxyError(res?.message || t('settings.proxy.loadFailed'))
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

  const applyAutoSaveInterval = () => {
    const n = Math.floor(Number(autoSaveIntervalDraft))
    if (!Number.isFinite(n)) {
      setAutoSaveIntervalDraft(String(autoSave.intervalSeconds))
      return
    }
    const clamped = clampAutoSaveIntervalSeconds(n)
    setAutoSaveIntervalSeconds(clamped)
    setAutoSaveIntervalDraft(String(clamped))
  }

  const applyLargeFileThreshold = async () => {
    const n = Math.floor(Number(largeFileDraft))
    if (!Number.isFinite(n)) {
      setLargeFileDraft(String(editorPrefs.largeFileThresholdMB))
      return
    }
    const next = normalizeEditorPrefs({ largeFileThresholdMB: clampLargeFileThresholdMB(n) })
    if (n < MIN_LARGE_FILE_THRESHOLD_MB) {
      setLargeFileDraft(String(next.largeFileThresholdMB))
    }
    setEditorPrefsStatus('')
    try {
      const saved = normalizeEditorPrefs(await SaveEditorPrefs(next))
      setEditorPrefs(saved)
      setLargeFileDraft(String(saved.largeFileThresholdMB))
    } catch (e) {
      setEditorPrefsStatus(String(e))
      setLargeFileDraft(String(editorPrefs.largeFileThresholdMB))
    }
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
        setProxyError(res?.message || t('settings.proxy.saveFailed'))
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
        ? t('settings.proxy.enabledStatus')
        : t('settings.proxy.disabledStatus'))
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
        aria-label={t('common.settings')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="settings-title">{t('common.settings')}</div>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label={t('settings.navLabel')}>
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item${settingsSection === item.id ? ' active' : ''}`}
                onClick={() => setSettingsSection(item.id)}
              >
                <span className="settings-nav-title">{t(item.titleKey)}</span>
                <span className="settings-nav-desc">{t(item.descriptionKey)}</span>
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            {settingsSection === 'shortcuts' ? (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">{t('settings.shortcuts.title')}</div>
                  <div className="settings-section-desc">
                    {t('settings.shortcuts.description')}
                  </div>
                </div>
                <div className="settings-list">
                  {ORDER.map((id) => (
                    <div key={id} className="settings-row">
                      <span className="settings-row-label">{shortcutLabel(id, t)}</span>
                      <button
                        type="button"
                        className={`settings-binding${capturing === id ? ' capturing' : ''}`}
                        onClick={() => setCapturing(id)}
                      >
                        {capturing === id ? t('settings.shortcuts.pressKeys') : formatShortcut(shortcuts[id])}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="settings-hint">
                  {t('settings.shortcuts.hint')}
                </p>
                <div className="settings-actions">
                  <button type="button" className="toolbar-btn" onClick={resetShortcuts}>
                    {t('settings.shortcuts.reset')}
                  </button>
                  <button type="button" className="toolbar-btn primary" onClick={closeSettings}>
                    {t('common.done')}
                  </button>
                </div>
              </>
            ) : null}

            {settingsSection === 'appearance' ? (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">{t('settings.appearance.title')}</div>
                  <div className="settings-section-desc">
                    {t('settings.appearance.description')}
                  </div>
                </div>
                <div className="settings-list">
                  <div className="settings-row settings-row-stack">
                    <span className="settings-row-label">
                      {t('settings.appearance.themeModeTitle')}
                      <span className="settings-row-sub">{t('settings.appearance.themeModeDescription')}</span>
                    </span>
                    <div className="settings-theme-modes">
                      {THEME_MODE_OPTIONS.map((opt) => {
                        const active = theme.mode === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`settings-theme-mode${active ? ' active' : ''}`}
                            onClick={() => setThemeMode(opt.id)}
                          >
                            <span className="settings-theme-mode-title">{t(opt.titleKey)}</span>
                            <span className="settings-theme-mode-desc">{t(opt.descriptionKey)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">
                      {t('settings.appearance.accentTitle')}
                      <span className="settings-row-sub">{t('settings.appearance.accentDescription')}</span>
                    </span>
                    <div className="settings-accent-row">
                      <input
                        type="color"
                        className="settings-accent-swatch"
                        value={theme.accent}
                        onChange={(e) => setThemeAccent(e.target.value)}
                        aria-label={t('settings.appearance.accentAria')}
                      />
                      <code className="settings-accent-hex">{theme.accent}</code>
                      <button
                        type="button"
                        className="toolbar-btn"
                        disabled={theme.accent === DEFAULT_ACCENT_HEX}
                        onClick={resetThemeAccent}
                      >
                        {t('common.reset')}
                      </button>
                    </div>
                  </div>
                  <div className="settings-row settings-row-stack">
                    <span className="settings-row-label">
                      {t('settings.appearance.languageTitle')}
                      <span className="settings-row-sub">
                        {t('settings.appearance.languageDescription')}
                      </span>
                    </span>
                    <div className="settings-theme-modes">
                      {LANGUAGE_OPTIONS.map((opt) => {
                        const active = langPref === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`settings-theme-mode${active ? ' active' : ''}`}
                            onClick={() => setLangPref(opt.id)}
                          >
                            <span className="settings-theme-mode-title">{t(opt.titleKey)}</span>
                            <span className="settings-theme-mode-desc">{t(opt.descriptionKey)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="settings-row settings-row-stack">
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={viewers.pdfDarkInvert}
                        disabled={!darkMode}
                        onChange={(e) => setPdfDarkInvert(e.target.checked)}
                      />
                      <span>
                        {t('settings.appearance.pdfDarkInvertTitle')}
                        <span className="settings-row-sub">
                          {darkMode
                            ? t('settings.appearance.pdfDarkInvertDescription')
                            : t('settings.appearance.pdfDarkInvertLightHint')}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
                <div className="settings-actions">
                  <button type="button" className="toolbar-btn primary" onClick={closeSettings}>
                    {t('common.done')}
                  </button>
                </div>
              </>
            ) : null}

            {settingsSection === 'general' ? (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">{t('settings.general.title')}</div>
                  <div className="settings-section-desc">
                    {t('settings.general.description')}
                  </div>
                </div>
                <div className="settings-list">
                  <div className="settings-row">
                    <span className="settings-row-label">
                      {t('settings.general.recentMaxTitle')}
                      <span className="settings-row-sub">
                        {t('settings.general.recentMaxRange', { min: MIN_RECENT_MAX, max: MAX_RECENT_MAX, default: 10 })}
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
                      aria-label={t('settings.general.recentMaxAria')}
                    />
                  </div>
                  <div className="settings-row settings-row-stack">
                    <span className="settings-row-label">
                      {t('settings.general.savedRecentlyTitle')}
                      <span className="settings-row-sub">
                        {recentFiles.length === 1
                          ? t('settings.general.recentItemsOne')
                          : t('settings.general.recentItemsMany', { count: recentFiles.length })}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="toolbar-btn"
                      disabled={recentFiles.length === 0}
                      onClick={clearRecent}
                    >
                      {t('settings.general.clearRecent')}
                    </button>
                  </div>
                  <div className="settings-row settings-row-stack">
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={autoSave.enabled}
                        onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                      />
                      <span>
                        {t('settings.general.autoSaveTitle')}
                        <span className="settings-row-sub">
                          {t('settings.general.autoSaveDescription')}
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">
                      {t('settings.general.autoSaveIntervalTitle')}
                      <span className="settings-row-sub">
                        {t('settings.general.autoSaveIntervalRange', {
                          min: MIN_AUTO_SAVE_INTERVAL_SECONDS,
                          max: MAX_AUTO_SAVE_INTERVAL_SECONDS,
                          default: DEFAULT_AUTO_SAVE_INTERVAL_SECONDS,
                        })}
                      </span>
                    </span>
                    <input
                      className="settings-number"
                      type="number"
                      min={MIN_AUTO_SAVE_INTERVAL_SECONDS}
                      max={MAX_AUTO_SAVE_INTERVAL_SECONDS}
                      value={autoSaveIntervalDraft}
                      disabled={!autoSave.enabled}
                      onChange={(e) => setAutoSaveIntervalDraft(e.target.value.replace(/[^\d]/g, ''))}
                      onBlur={applyAutoSaveInterval}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          applyAutoSaveInterval()
                        }
                      }}
                      aria-label={t('settings.general.autoSaveIntervalAria')}
                    />
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">
                      {t('settings.general.largeFileTitle')}
                      <span className="settings-row-sub">
                        {t('settings.general.largeFileDescription', {
                          min: MIN_LARGE_FILE_THRESHOLD_MB,
                          default: DEFAULT_LARGE_FILE_THRESHOLD_MB,
                        })}
                      </span>
                    </span>
                    <input
                      className="settings-number"
                      type="number"
                      min={MIN_LARGE_FILE_THRESHOLD_MB}
                      value={largeFileDraft}
                      onChange={(e) => setLargeFileDraft(e.target.value.replace(/[^\d]/g, ''))}
                      onBlur={() => void applyLargeFileThreshold()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void applyLargeFileThreshold()
                        }
                      }}
                      aria-label={t('settings.general.largeFileAria')}
                    />
                  </div>
                  {editorPrefsStatus ? (
                    <div className="settings-hint" style={{ color: 'var(--ph-danger)' }}>
                      {editorPrefsStatus}
                    </div>
                  ) : null}
                  <div className="settings-row settings-row-stack">
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={shellContextMenu}
                        disabled={shellBusy}
                        onChange={(e) => void applyShellContextMenu(e.target.checked)}
                      />
                      <span>
                        {t('settings.general.shellMenuTitle')}
                        <span className="settings-row-sub">
                          {t('settings.general.shellMenuDescription')}
                        </span>
                      </span>
                    </label>
                  </div>
                  {shellStatus ? (
                    <div className="settings-hint" style={{ color: 'var(--ph-danger)' }}>
                      {shellStatus}
                    </div>
                  ) : null}
                  <div className="settings-row">
                    <span className="settings-row-label">
                      {t('settings.general.openInTitle')}
                      <span className="settings-row-sub">
                        {t('settings.general.openInDescription')}
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
                      aria-label={t('settings.general.openInAria')}
                    >
                      <option value="current">{t('settings.general.openInCurrent')}</option>
                      <option value="new">{t('settings.general.openInNew')}</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">
                      {t('settings.general.whenOpenTitle')}
                      <span className="settings-row-sub">
                        {t('settings.general.whenOpenDescription')}
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
                      aria-label={t('settings.general.whenOpenAria')}
                    >
                      <option value="ask">{t('settings.general.askEveryTime')}</option>
                      <option value="always">{t('settings.general.alwaysUsePreference')}</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">
                      {t('settings.general.parentFolderTitle')}
                      <span className="settings-row-sub">
                        {t('settings.general.parentFolderDescription')}
                      </span>
                    </span>
                    <select
                      className="settings-select"
                      value={openPlacement.parentFolderTarget}
                      onChange={(e) =>
                        void applyOpenPlacement({
                          ...openPlacement,
                          parentFolderTarget: e.target.value as OpenParentFolderTarget,
                        })
                      }
                      aria-label={t('settings.general.parentFolderAria')}
                    >
                      <option value="parent">{t('settings.general.parentFolderOpenParent')}</option>
                      <option value="file">{t('settings.general.parentFolderFileOnly')}</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">
                      {t('settings.general.parentFolderModeTitle')}
                      <span className="settings-row-sub">
                        {t('settings.general.parentFolderModeDescription')}
                      </span>
                    </span>
                    <select
                      className="settings-select"
                      value={openPlacement.parentFolderMode}
                      onChange={(e) =>
                        void applyOpenPlacement({
                          ...openPlacement,
                          parentFolderMode: e.target.value as OpenParentFolderMode,
                        })
                      }
                      aria-label={t('settings.general.parentFolderModeAria')}
                    >
                      <option value="ask">{t('settings.general.askEveryTime')}</option>
                      <option value="always">{t('settings.general.alwaysUsePreference')}</option>
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
                    {t('common.done')}
                  </button>
                </div>
              </>
            ) : null}

            {settingsSection === 'proxy' ? (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">{t('settings.proxy.title')}</div>
                  <div className="settings-section-desc">
                    {t('settings.proxy.description')}
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
                      {t('settings.proxy.enable')}
                    </label>
                  </div>
                  <div className={`settings-proxy-grid${proxyDraft.enabled ? '' : ' disabled'}`}>
                    <label className="settings-field">
                      <span>{t('settings.proxy.type')}</span>
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
                      <span>{t('settings.proxy.port')}</span>
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
                      <span>{t('settings.proxy.host')}</span>
                      <input
                        className="settings-text"
                        disabled={!proxyDraft.enabled}
                        value={proxyDraft.host}
                        placeholder="127.0.0.1"
                        onChange={(e) => setProxyDraft((p) => ({ ...p, host: e.target.value }))}
                      />
                    </label>
                    <label className="settings-field">
                      <span>{t('settings.proxy.username')}</span>
                      <input
                        className="settings-text"
                        disabled={!proxyDraft.enabled}
                        value={proxyDraft.user}
                        onChange={(e) => setProxyDraft((p) => ({ ...p, user: e.target.value }))}
                      />
                    </label>
                    <label className="settings-field">
                      <span>{t('settings.proxy.password')}</span>
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
                    {proxyBusy ? t('settings.proxy.saving') : t('settings.proxy.save')}
                  </button>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="toolbar-btn" onClick={closeSettings}>
                    {t('common.done')}
                  </button>
                </div>
              </>
            ) : null}

            {settingsSection === 'about' ? (
              <>
                <div className="settings-section-head">
                  <div className="settings-section-title">{t('settings.about.title')}</div>
                  <div className="settings-section-desc">
                    {t('settings.about.description')}
                  </div>
                </div>
                <div className="settings-list">
                  <div className="settings-row settings-row-stack">
                    <span className="settings-row-label">
                      PinkHunkReader
                      <span className="settings-row-sub">
                        {t('settings.about.version', { version: update?.appInfo?.version || '…' })}
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
                      {t('settings.about.updatesTitle')}
                      <span className="settings-row-sub">{update?.status || t('settings.about.notChecked')}</span>
                    </span>
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={update?.prefs.autoPromptEnabled !== false}
                        onChange={(e) => update?.setAutoPrompt(e.target.checked)}
                      />
                      {t('settings.about.autoPrompt')}
                    </label>
                  </div>
                  {update?.lastUpdate?.hasUpdate && update.lastUpdate.releaseNotes ? (
                    <div className="settings-notes">
                      <div className="settings-notes-title">
                        {update.lastUpdate.releaseName
                          || t('settings.about.version', { version: update.lastUpdate.latestVersion })}
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
                    {t('settings.about.checkForUpdates')}
                  </button>
                  {update
                    && update.progress.status !== 'idle'
                    && !update.progress.open ? (
                    <button
                      type="button"
                      className="toolbar-btn primary"
                      onClick={() => update.showProgress()}
                    >
                      {update.progress.status === 'done'
                        ? t('settings.about.showUpdate')
                        : update.progress.status === 'error'
                          ? t('settings.about.showDownloadError')
                          : update.progress.status === 'cancelled'
                            ? t('settings.about.showCancelledDownload')
                            : update.progress.status === 'paused'
                              ? t('settings.about.showPausedDownload', { percent: Math.round(update.progress.percent) })
                              : t('settings.about.showDownloadProgress', { percent: Math.round(update.progress.percent) })}
                    </button>
                  ) : null}
                  {update?.lastUpdate?.hasUpdate
                    && !update.canInstall
                    && update.progress.status !== 'start'
                    && update.progress.status !== 'downloading'
                    && update.progress.status !== 'paused' ? (
                    <button
                      type="button"
                      className="toolbar-btn primary"
                      disabled={update.busy}
                      onClick={() => void update.downloadUpdate()}
                    >
                      {t('common.download')}
                      {update.lastUpdate.assetSize
                        ? t('settings.about.downloadSizeSuffix', {
                          size: update.formatBytes(update.lastUpdate.assetSize),
                        })
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
                        {t('settings.about.installAndRestart')}
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        disabled={update.busy}
                        onClick={() => void update.openDownloadedPackage()}
                      >
                        {t('settings.about.openPackage')}
                      </button>
                    </>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  <button type="button" className="toolbar-btn" onClick={closeSettings}>
                    {t('common.done')}
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
