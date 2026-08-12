import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DEFAULT_SHORTCUTS,
  type ShortcutId,
  type ShortcutMap,
  loadShortcuts,
  saveShortcuts,
} from './shortcuts'
import {
  DEFAULT_RECENT_MAX,
  type RecentFile,
  clearRecentFiles,
  loadRecentFiles,
  loadRecentMax,
  pushRecentFile,
  saveRecentMax,
  trimRecentFiles,
} from './recentFiles'
import {
  type AutoSavePreferences,
  loadAutoSavePreferences,
  saveAutoSavePreferences,
} from './autoSavePreferences'

export type GoToKind = 'page' | 'line'

export interface GoToTarget {
  kind: GoToKind
  current: number
  max: number
  go: (n: number) => void | Promise<void>
}

export type SettingsSection = 'shortcuts' | 'general' | 'proxy' | 'about'

interface AppSettingsValue {
  shortcuts: ShortcutMap
  setShortcut: (id: ShortcutId, binding: ShortcutMap[ShortcutId]) => void
  resetShortcuts: () => void
  recentFiles: RecentFile[]
  recentMax: number
  setRecentMax: (n: number) => void
  rememberRecent: (path: string) => void
  clearRecent: () => void
  autoSave: AutoSavePreferences
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveIntervalSeconds: (seconds: number) => void
  goToTarget: GoToTarget | null
  registerGoTo: (target: GoToTarget | null) => void
  goToOpen: boolean
  openGoTo: () => void
  closeGoTo: () => void
  settingsOpen: boolean
  settingsSection: SettingsSection
  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
  setSettingsSection: (section: SettingsSection) => void
}

const AppSettingsContext = createContext<AppSettingsValue | null>(null)

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => loadShortcuts())
  const [recentMax, setRecentMaxState] = useState(() => loadRecentMax())
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => loadRecentFiles(loadRecentMax()))
  const [autoSave, setAutoSaveState] = useState<AutoSavePreferences>(() => loadAutoSavePreferences())
  const [goToOpen, setGoToOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general')
  const goToTargetRef = useRef<GoToTarget | null>(null)
  const [goToTarget, setGoToTarget] = useState<GoToTarget | null>(null)

  const setShortcut = useCallback((id: ShortcutId, binding: ShortcutMap[ShortcutId]) => {
    setShortcuts((prev) => {
      const next = { ...prev, [id]: binding }
      saveShortcuts(next)
      return next
    })
  }, [])

  const resetShortcuts = useCallback(() => {
    const next = { ...DEFAULT_SHORTCUTS }
    saveShortcuts(next)
    setShortcuts(next)
  }, [])

  const setRecentMax = useCallback((n: number) => {
    const clamped = saveRecentMax(n)
    setRecentMaxState(clamped)
    setRecentFiles(trimRecentFiles(clamped))
  }, [])

  const rememberRecent = useCallback((path: string) => {
    setRecentFiles(pushRecentFile(path, recentMax))
  }, [recentMax])

  const clearRecent = useCallback(() => {
    setRecentFiles(clearRecentFiles())
  }, [])

  const setAutoSaveEnabled = useCallback((enabled: boolean) => {
    setAutoSaveState((prev) => saveAutoSavePreferences({ ...prev, enabled }))
  }, [])

  const setAutoSaveIntervalSeconds = useCallback((seconds: number) => {
    setAutoSaveState((prev) => saveAutoSavePreferences({ ...prev, intervalSeconds: seconds }))
  }, [])

  const registerGoTo = useCallback((target: GoToTarget | null) => {
    goToTargetRef.current = target
    setGoToTarget(target)
  }, [])

  const value = useMemo<AppSettingsValue>(() => ({
    shortcuts,
    setShortcut,
    resetShortcuts,
    recentFiles,
    recentMax,
    setRecentMax,
    rememberRecent,
    clearRecent,
    autoSave,
    setAutoSaveEnabled,
    setAutoSaveIntervalSeconds,
    goToTarget,
    registerGoTo,
    goToOpen,
    openGoTo: () => {
      if (goToTargetRef.current) setGoToOpen(true)
    },
    closeGoTo: () => setGoToOpen(false),
    settingsOpen,
    settingsSection,
    openSettings: (section = 'general') => {
      setSettingsSection(section)
      setSettingsOpen(true)
    },
    closeSettings: () => setSettingsOpen(false),
    setSettingsSection,
  }), [
    shortcuts,
    setShortcut,
    resetShortcuts,
    recentFiles,
    recentMax,
    setRecentMax,
    rememberRecent,
    clearRecent,
    autoSave,
    setAutoSaveEnabled,
    setAutoSaveIntervalSeconds,
    goToTarget,
    registerGoTo,
    goToOpen,
    settingsOpen,
    settingsSection,
  ])

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error('useAppSettings requires AppSettingsProvider')
  return ctx
}

/** Register a go-to target while the viewer is mounted. */
export function useRegisterGoTo(target: GoToTarget | null) {
  const { registerGoTo } = useAppSettings()
  const goRef = useRef(target?.go)
  goRef.current = target?.go

  const kind = target?.kind
  const current = target?.current
  const max = target?.max
  const enabled = Boolean(target)

  useEffect(() => {
    if (!enabled || !kind || current == null || max == null) {
      registerGoTo(null)
      return () => registerGoTo(null)
    }
    registerGoTo({
      kind,
      current,
      max,
      go: (n) => {
        void goRef.current?.(n)
      },
    })
    return () => registerGoTo(null)
  }, [registerGoTo, enabled, kind, current, max])
}

export { DEFAULT_RECENT_MAX }
