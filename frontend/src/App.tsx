import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './styles/theme.css'
import logo from './assets/logo.svg'
import { CloseSaveDialog, type CloseSaveChoice } from './components/CloseSaveDialog'
import { FileTree } from './components/FileTree'
import { GoToDialog } from './components/GoToDialog'
import { OpenMenu } from './components/OpenMenu'
import { OpenPlacementDialog, type OpenPlacementChoice } from './components/OpenPlacementDialog'
import {
  OpenParentFolderDialog,
  type OpenParentFolderChoice,
} from './components/OpenParentFolderDialog'
import { SettingsModal } from './components/SettingsModal'
import { UpdateProgressDialog } from './components/UpdateProgressDialog'
import { useAppUpdateManager } from './hooks/useAppUpdateManager'
import { TabBar } from './components/TabBar'
import { ViewerHost } from './components/ViewerHost'
import { useAppFullscreen } from './hooks/useAppFullscreen'
import { AppSettingsProvider, useAppSettings } from './settings/AppSettingsContext'
import {
  buildSession,
  clearLegacyLocalSession,
  loadLegacyLocalSession,
  type SessionState,
  type SessionTab,
} from './settings/session'
import {
  normalizeOpenPlacement,
  DEFAULT_OPEN_PLACEMENT,
  type OpenPlacementPrefs,
} from './settings/openPlacement'
import { eventMatchesShortcut, formatShortcut } from './settings/shortcuts'
import type { FileInfo, OpenTab } from './types'
import { isJsonTab, toggleJsonFormat } from './utils/jsonFormat'
import {
  folderLabel,
  normalizePath,
  parentDir,
  pathUnderRoot,
  pathsEqual,
} from './utils/pathHelpers'
import {
  AddRoot,
  ConfirmQuit,
  GetLaunchInfo,
  GetOpenPlacementPrefs,
  GetRoots,
  InspectPath,
  LoadWindowSession,
  PickAndOpen,
  PickAndSaveFile,
  ReadText,
  RemoveRoot,
  RevealInFileManager,
  SaveOpenPlacementPrefs,
  SaveWindowSession,
  SetRoots,
  SpawnNewWindow,
  SpawnRestoredWindows,
  StatFile,
  WriteText,
} from '../wailsjs/go/app/App'
import { define } from '../wailsjs/go/models'
import { EventsOn, OnFileDrop, OnFileDropOff } from '../wailsjs/runtime/runtime'

function pathUnderAnyRoot(filePath: string, roots: string[]): boolean {
  return roots.some((r) => pathUnderRoot(filePath, r))
}

/** Apply one close-save prompt choice over dirty tabs starting at `index`. */
async function applyCloseSaveChoice(
  choice: CloseSaveChoice,
  dirty: OpenTab[],
  index: number,
  saveTab: (tab: OpenTab) => Promise<boolean>,
): Promise<'next' | 'done' | 'abort'> {
  if (choice === 'cancel') return 'abort'
  if (choice === 'discard') return 'next'
  if (choice === 'discard-all') return 'done'
  if (choice === 'save') {
    const ok = await saveTab(dirty[index])
    return ok ? 'next' : 'abort'
  }
  if (choice === 'save-all') {
    for (let j = index; j < dirty.length; j++) {
      const ok = await saveTab(dirty[j])
      if (!ok) return 'abort'
    }
    return 'done'
  }
  return 'next'
}

const EXPLORER_OPEN_KEY = 'pinkhunk-reader.explorer-open.v1'

function loadExplorerOpen(): boolean {
  try {
    const raw = localStorage.getItem(EXPLORER_OPEN_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

function AppShell() {
  const [roots, setRoots] = useState<string[]>([])
  const [windowId, setWindowId] = useState('')
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Open a folder or file to start')
  const [saving, setSaving] = useState(false)
  const [treeRefresh, setTreeRefresh] = useState(0)
  const [revealPath, setRevealPath] = useState<string | null>(null)
  const [revealNonce, setRevealNonce] = useState(0)
  const [untitledSeq, setUntitledSeq] = useState(1)
  const [sessionReady, setSessionReady] = useState(false)
  const [explorerOpen, setExplorerOpenState] = useState(loadExplorerOpen)
  const setExplorerOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setExplorerOpenState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      try {
        localStorage.setItem(EXPLORER_OPEN_KEY, next ? '1' : '0')
      } catch {
        /* ignore quota / private mode */
      }
      return next
    })
  }, [])
  const [closePrompt, setClosePrompt] = useState<{
    path: string
    name: string
    remaining: number
  } | null>(null)
  const [placementPrompt, setPlacementPrompt] = useState<{
    pathLabel: string
    defaultTarget: OpenPlacementChoice
  } | null>(null)
  const [parentFolderPrompt, setParentFolderPrompt] = useState<{
    pathLabel: string
    defaultTarget: OpenParentFolderChoice
  } | null>(null)

  const pagedSaveRef = useRef<(() => Promise<void>) | null>(null)
  const tabsRef = useRef(tabs)
  const activePathRef = useRef(activePath)
  const rootsRef = useRef(roots)
  const windowIdRef = useRef(windowId)
  const untitledSeqRef = useRef(untitledSeq)
  const closeResolverRef = useRef<((c: CloseSaveChoice) => void) | null>(null)
  const placementResolverRef = useRef<((c: OpenPlacementChoice | 'cancel') => void) | null>(null)
  const parentFolderResolverRef = useRef<((c: OpenParentFolderChoice | 'cancel') => void) | null>(null)
  const quittingRef = useRef(false)

  tabsRef.current = tabs
  activePathRef.current = activePath
  rootsRef.current = roots
  windowIdRef.current = windowId
  untitledSeqRef.current = untitledSeq

  const { fullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useAppFullscreen()
  const {
    shortcuts,
    openGoTo,
    openSettings,
    goToOpen,
    settingsOpen,
    goToTarget,
    rememberRecent,
  } = useAppSettings()

  const update = useAppUpdateManager({
    onPromptUpdate: () => openSettings('about'),
  })

  const activeTab = useMemo(
    () => tabs.find((t) => t.path === activePath) ?? null,
    [tabs, activePath],
  )

  const syncRootsFromBackend = useCallback(async () => {
    try {
      const next = await GetRoots()
      setRoots(Array.isArray(next) ? next : [])
    } catch {
      /* ignore */
    }
  }, [])

  const ensureRoot = useCallback(async (path: string) => {
    const abs = normalizePath(path.trim())
    if (!abs) return
    if (rootsRef.current.some((r) => pathsEqual(r, abs))) {
      setTreeRefresh((n) => n + 1)
      return
    }
    await AddRoot(abs)
    setRoots((prev) => (prev.some((r) => pathsEqual(r, abs)) ? prev : [...prev, abs]))
    setStatus(abs)
    setTreeRefresh((n) => n + 1)
  }, [])

  const persistSession = useCallback(() => {
    const id = windowIdRef.current
    if (!id) return
    const state = buildSession(
      id,
      rootsRef.current,
      activePathRef.current,
      tabsRef.current,
      untitledSeqRef.current,
    )
    void SaveWindowSession(define.WindowSessionState.createFrom({
      version: state.version,
      windowId: state.windowId,
      roots: state.roots,
      activePath: state.activePath ?? '',
      untitledSeq: state.untitledSeq,
      tabs: state.tabs.map((t) => ({
        path: t.path,
        name: t.name,
        kind: t.kind,
        editable: t.editable,
        largeMode: t.largeMode,
        size: t.size,
        dirty: t.dirty,
        untitled: Boolean(t.untitled),
        languageHint: t.languageHint ?? '',
        content: t.content ?? '',
      })),
    })).catch(() => {
      /* ignore persist errors */
    })
  }, [])

  useEffect(() => {
    if (!sessionReady) return
    const t = window.setTimeout(() => persistSession(), 200)
    return () => window.clearTimeout(t)
  }, [tabs, activePath, roots, untitledSeq, sessionReady, persistSession])

  const askCloseSave = useCallback((tab: OpenTab, remaining: number) => {
    return new Promise<CloseSaveChoice>((resolve) => {
      closeResolverRef.current = resolve
      setClosePrompt({ path: tab.path, name: tab.name, remaining })
    })
  }, [])

  const askOpenPlacement = useCallback((pathLabel: string, defaultTarget: OpenPlacementChoice) => {
    return new Promise<OpenPlacementChoice | 'cancel'>((resolve) => {
      placementResolverRef.current = resolve
      setPlacementPrompt({ pathLabel, defaultTarget })
    })
  }, [])

  const askOpenParentFolder = useCallback((pathLabel: string, defaultTarget: OpenParentFolderChoice) => {
    return new Promise<OpenParentFolderChoice | 'cancel'>((resolve) => {
      parentFolderResolverRef.current = resolve
      setParentFolderPrompt({ pathLabel, defaultTarget })
    })
  }, [])

  const loadOpenPrefs = useCallback(async (): Promise<OpenPlacementPrefs> => {
    try {
      return normalizeOpenPlacement(await GetOpenPlacementPrefs())
    } catch {
      return normalizeOpenPlacement(DEFAULT_OPEN_PLACEMENT)
    }
  }, [])

  const saveOpenPrefsPatch = useCallback(async (patch: Partial<OpenPlacementPrefs>) => {
    const current = await loadOpenPrefs()
    await SaveOpenPlacementPrefs({ ...current, ...patch })
  }, [loadOpenPrefs])

  const openFile = useCallback(async (path: string) => {
    setError('')
    try {
      const info: FileInfo = await StatFile(path)
      if (info.isDir) return

      let content = ''

      if (info.kind === 'pdf' || info.kind === 'image' || info.kind === 'word' || info.kind === 'excel') {
        setStatus(`${info.name} · ${(info.size / 1024).toFixed(1)} KB`)
      } else if (info.largeMode) {
        setStatus(`${info.name} · paged (viewport × 2)`)
      } else if (info.editable || info.kind === 'markdown' || info.kind === 'text') {
        content = await ReadText(path)
        setStatus(`${info.name} · ${(info.size / 1024).toFixed(1)} KB`)
      } else {
        setStatus(`${info.name} · unsupported type`)
      }

      const tab: OpenTab = {
        path: info.path,
        name: info.name,
        kind: info.kind,
        editable: info.editable,
        largeMode: info.largeMode,
        size: info.size,
        content,
        dirty: false,
      }

      setTabs((prev) => {
        if (prev.some((t) => t.path === info.path || t.path === path)) {
          return prev.map((t) =>
            (t.path === info.path || t.path === path) ? { ...tab, dirty: t.dirty, content: t.dirty ? t.content : tab.content } : t,
          )
        }
        return [...prev, tab]
      })
      setActivePath(info.path)
      rememberRecent(info.path)
    } catch (e) {
      setError(String(e))
    }
  }, [rememberRecent])

  const restoreTabsFromSession = useCallback(async (session: SessionState, cancelled: () => boolean) => {
    const restored: OpenTab[] = []
    const hasRoots = session.roots.length > 0
    for (const st of session.tabs) {
      if (cancelled()) return []
      if (st.untitled) {
        restored.push({
          path: st.path,
          name: st.name,
          kind: st.kind || 'text',
          editable: true,
          largeMode: false,
          size: st.content?.length ?? 0,
          content: st.content ?? '',
          dirty: Boolean(st.dirty || (st.content ?? '').length > 0),
          untitled: true,
          languageHint: st.languageHint,
        })
        continue
      }
      if (st.largeMode || st.kind === 'pdf' || st.kind === 'image' || st.kind === 'word' || st.kind === 'excel') {
        try {
          if (hasRoots) {
            const info = await StatFile(st.path)
            restored.push({
              path: info.path,
              name: info.name,
              kind: info.kind,
              editable: info.editable,
              largeMode: info.largeMode,
              size: info.size,
              content: '',
              dirty: false,
            })
          }
        } catch {
          /* missing file — skip */
        }
        continue
      }
      if (typeof st.content === 'string') {
        restored.push({
          path: st.path,
          name: st.name,
          kind: st.kind,
          editable: st.editable,
          largeMode: false,
          size: st.size,
          content: st.content,
          dirty: st.dirty,
          languageHint: st.languageHint,
        })
        continue
      }
      try {
        if (!hasRoots) continue
        const info = await StatFile(st.path)
        const content = (info.editable || info.kind === 'markdown' || info.kind === 'text') && !info.largeMode
          ? await ReadText(st.path)
          : ''
        restored.push({
          path: info.path,
          name: info.name,
          kind: info.kind,
          editable: info.editable,
          largeMode: info.largeMode,
          size: info.size,
          content,
          dirty: false,
        })
      } catch {
        /* skip */
      }
    }
    return restored
  }, [])

  const applySessionState = useCallback(async (session: SessionState, cancelled: () => boolean) => {
    if (session.roots.length) {
      await SetRoots(session.roots)
      if (cancelled()) return
      setRoots(session.roots)
      setStatus(session.roots.join(' · '))
    }
    if (!cancelled()) setUntitledSeq(Math.max(1, session.untitledSeq || 1))
    const restored = await restoreTabsFromSession(session, cancelled)
    if (cancelled() || !restored.length) return
    setTabs(restored)
    const active = restored.find((t) => t.path === session.activePath)?.path ?? restored[0].path
    setActivePath(active)
    setStatus(`Restored ${restored.length} tab${restored.length === 1 ? '' : 's'}`)
  }, [restoreTabsFromSession])

  // Launch: window id, crash restore, CLI open, legacy migration.
  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled
    ;(async () => {
      try {
        const launch = await GetLaunchInfo()
        if (cancelled) return
        const id = String(launch?.windowId || '').trim()
        if (id) setWindowId(id)
        try {
          await SpawnRestoredWindows()
        } catch {
          /* sibling spawn best-effort */
        }
        if (cancelled) return

        if (launch?.shouldRestore && id) {
          const raw = await LoadWindowSession(id)
          const session: SessionState = {
            version: 2,
            windowId: id,
            roots: Array.isArray(raw?.roots) ? raw.roots.filter(Boolean) : [],
            activePath: raw?.activePath || null,
            untitledSeq: raw?.untitledSeq || 1,
            tabs: (raw?.tabs ?? []) as SessionTab[],
          }
          if (session.roots.length || session.tabs.length) {
            await applySessionState(session, isCancelled)
          }
        } else if (launch?.openPath) {
          if (launch.openIsDir) {
            await ensureRoot(launch.openPath)
          } else {
            const label = launch.openPath.split(/[/\\]/).pop() || launch.openPath
            let prefs = normalizeOpenPlacement(DEFAULT_OPEN_PLACEMENT)
            try {
              prefs = normalizeOpenPlacement(await GetOpenPlacementPrefs())
            } catch {
              /* defaults */
            }
            let parentChoice: OpenParentFolderChoice | 'cancel' = prefs.parentFolderTarget
            if (prefs.parentFolderMode !== 'always') {
              parentChoice = await askOpenParentFolder(label, prefs.parentFolderTarget)
            }
            if (!cancelled && parentChoice !== 'cancel') {
              const rootPath =
                parentChoice === 'file' ? launch.openPath : parentDir(launch.openPath)
              await ensureRoot(rootPath)
              await openFile(launch.openPath)
            }
          }
        } else {
          const legacy = loadLegacyLocalSession()
          if (legacy && (legacy.roots.length || legacy.tabs.length)) {
            const migrated = { ...legacy, windowId: id || legacy.windowId }
            await applySessionState(migrated, isCancelled)
            clearLegacyLocalSession()
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setSessionReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applySessionState, askOpenParentFolder, ensureRoot, openFile])

  const resolveOpenPlacement = useCallback(async (pathLabel: string): Promise<OpenPlacementChoice | 'cancel'> => {
    if (rootsRef.current.length === 0) return 'current'
    const prefs = await loadOpenPrefs()
    if (prefs.mode === 'always') return prefs.target
    return askOpenPlacement(pathLabel, prefs.target)
  }, [askOpenPlacement, loadOpenPrefs])

  const resolveOpenParentFolder = useCallback(async (
    pathLabel: string,
  ): Promise<OpenParentFolderChoice | 'cancel'> => {
    const prefs = await loadOpenPrefs()
    if (prefs.parentFolderMode === 'always') return prefs.parentFolderTarget
    return askOpenParentFolder(pathLabel, prefs.parentFolderTarget)
  }, [askOpenParentFolder, loadOpenPrefs])

  const openPathWithChoice = useCallback(async (
    path: string,
    isDir: boolean,
    choice: OpenPlacementChoice,
    parentFolderChoice?: OpenParentFolderChoice,
  ) => {
    const label = isDir ? folderLabel(path) : path.split(/[/\\]/).pop() || path
    if (choice === 'new') {
      await SpawnNewWindow(path, isDir)
      setStatus(`Opened in new window · ${label}`)
      return
    }
    if (isDir) {
      await ensureRoot(path)
      setStatus(`Opened folder · ${label}`)
      return
    }
    if (!pathUnderAnyRoot(path, rootsRef.current)) {
      let parentChoice = parentFolderChoice
      if (!parentChoice) {
        const resolved = await resolveOpenParentFolder(label)
        if (resolved === 'cancel') return
        parentChoice = resolved
      }
      const rootPath = parentChoice === 'file' ? path : parentDir(path)
      await ensureRoot(rootPath)
    }
    await openFile(path)
  }, [ensureRoot, openFile, resolveOpenParentFolder])

  const openPathInPlacement = useCallback(async (path: string, isDir: boolean) => {
    const label = isDir ? folderLabel(path) : path.split(/[/\\]/).pop() || path
    const choice = await resolveOpenPlacement(label)
    if (choice === 'cancel') return
    await openPathWithChoice(path, isDir, choice)
  }, [openPathWithChoice, resolveOpenPlacement])

  const openDroppedPaths = useCallback(async (paths: string[]) => {
    const unique = [...new Set(paths.map((p) => normalizePath(p)).filter(Boolean))]
    if (!unique.length) return
    setError('')
    try {
      const items: { path: string; isDir: boolean }[] = []
      for (const path of unique) {
        const probed = await InspectPath(path)
        if (!probed?.path) continue
        items.push({ path: probed.path, isDir: Boolean(probed.isDir) })
      }
      if (!items.length) {
        setError('No valid files or folders to open')
        return
      }
      const summary =
        items.length === 1
          ? items[0].isDir
            ? folderLabel(items[0].path)
            : items[0].path.split(/[/\\]/).pop() || items[0].path
          : `${items.length} items`
      const choice = await resolveOpenPlacement(summary)
      if (choice === 'cancel') return
      const needsParentAsk =
        choice === 'current' &&
        items.some((item) => !item.isDir && !pathUnderAnyRoot(item.path, rootsRef.current))
      let parentFolderChoice: OpenParentFolderChoice | undefined
      if (needsParentAsk) {
        const resolved = await resolveOpenParentFolder(summary)
        if (resolved === 'cancel') return
        parentFolderChoice = resolved
      }
      for (const item of items) {
        await openPathWithChoice(item.path, item.isDir, choice, parentFolderChoice)
      }
      if (items.length > 1 && choice === 'current') {
        setStatus(`Opened ${items.length} items`)
      }
    } catch (e) {
      setError(String(e))
    }
  }, [openPathWithChoice, resolveOpenParentFolder, resolveOpenPlacement])

  const openPicked = useCallback(async (mode: 'file' | 'folder') => {
    setError('')
    try {
      const picked = await PickAndOpen(mode)
      if (!picked?.path) return
      await openPathInPlacement(picked.path, Boolean(picked.isDir))
    } catch (e) {
      setError(String(e))
    }
  }, [openPathInPlacement])

  const openRecent = useCallback(async (path: string) => {
    setError('')
    try {
      if (pathUnderAnyRoot(path, rootsRef.current)) {
        await openFile(path)
        return
      }
      await openPathInPlacement(path, false)
    } catch (e) {
      setError(String(e))
    }
  }, [openFile, openPathInPlacement])

  const newFile = useCallback(() => {
    const n = untitledSeqRef.current
    setUntitledSeq(n + 1)
    const path = `untitled:${n}`
    const tab: OpenTab = {
      path,
      name: `Untitled-${n}`,
      kind: 'text',
      editable: true,
      largeMode: false,
      size: 0,
      content: '',
      dirty: false,
      untitled: true,
    }
    // Drop focus from File menu / toolbar so Monaco can take the caret.
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
    setTabs((prev) => [...prev, tab])
    setActivePath(path)
    setStatus(`New file · ${tab.name}`)
  }, [])

  const updateActiveContent = useCallback((content: string) => {
    if (!activePath) return
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activePath ? { ...t, content, dirty: true } : t,
      ),
    )
  }, [activePath])

  const markDirty = useCallback((dirty: boolean) => {
    if (!activePath) return
    setTabs((prev) =>
      prev.map((t) => (t.path === activePath ? { ...t, dirty } : t)),
    )
  }, [activePath])

  const registerPagedSave = useCallback((fn: (() => Promise<void>) | null) => {
    pagedSaveRef.current = fn
  }, [])

  const saveTab = useCallback(async (tab: OpenTab): Promise<boolean> => {
    if (!tab.editable) return true
    setSaving(true)
    setError('')
    try {
      if (tab.untitled) {
        const dest = await PickAndSaveFile(tab.name.includes('.') ? tab.name : `${tab.name}.txt`)
        if (!dest) return false
        await WriteText(dest, tab.content)
        const info = await StatFile(dest)
        await syncRootsFromBackend()
        setTabs((prev) =>
          prev.map((t) =>
            t.path === tab.path
              ? {
                  ...t,
                  path: info.path,
                  name: info.name,
                  kind: info.kind,
                  editable: info.editable,
                  largeMode: info.largeMode,
                  size: info.size,
                  dirty: false,
                  untitled: false,
                }
              : t,
          ),
        )
        setActivePath(info.path)
        rememberRecent(info.path)
        setStatus(`Saved ${info.name}`)
        setTreeRefresh((x) => x + 1)
        return true
      }
      if (tab.largeMode) {
        if (activePathRef.current === tab.path) {
          const savePaged = pagedSaveRef.current
          if (!savePaged) throw new Error('Paged editor is not ready')
          await savePaged()
        } else {
          throw new Error('Switch to the paged tab to save it')
        }
      } else {
        await WriteText(tab.path, tab.content)
      }
      setTabs((prev) =>
        prev.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)),
      )
      setStatus(`Saved ${tab.name}`)
      return true
    } catch (e) {
      setError(String(e))
      return false
    } finally {
      setSaving(false)
    }
  }, [rememberRecent, syncRootsFromBackend])

  const saveActive = useCallback(async () => {
    if (!activeTab || !activeTab.editable) return
    await saveTab(activeTab)
  }, [activeTab, saveTab])

  const removeTab = useCallback((path: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path)
      if (activePathRef.current === path) {
        setActivePath(next.length ? next[next.length - 1].path : null)
      }
      return next
    })
  }, [])

  const closeTab = useCallback(async (path: string) => {
    const tab = tabsRef.current.find((t) => t.path === path)
    if (!tab) return
    if (tab.dirty) {
      const choice = await askCloseSave(tab, 0)
      const result = await applyCloseSaveChoice(choice, [tab], 0, saveTab)
      if (result === 'abort') return
    }
    removeTab(path)
  }, [askCloseSave, removeTab, saveTab])

  const closeTabs = useCallback(async (paths: string[]) => {
    if (!paths.length) return
    const drop = new Set(paths)
    const targets = tabsRef.current.filter((t) => drop.has(t.path))
    if (!targets.length) return
    const dirty = targets.filter((t) => t.dirty && t.editable)
    for (let i = 0; i < dirty.length; i++) {
      const tab = dirty[i]
      const choice = await askCloseSave(tab, dirty.length - i - 1)
      const result = await applyCloseSaveChoice(choice, dirty, i, saveTab)
      if (result === 'abort') return
      if (result === 'done') break
    }
    setTabs((prev) => {
      const next = prev.filter((t) => !drop.has(t.path))
      if (activePathRef.current && drop.has(activePathRef.current)) {
        setActivePath(next.length ? next[next.length - 1].path : null)
      }
      return next
    })
  }, [askCloseSave, saveTab])

  const closeTabsToLeft = useCallback(async (path: string) => {
    const idx = tabsRef.current.findIndex((t) => t.path === path)
    if (idx <= 0) return
    await closeTabs(tabsRef.current.slice(0, idx).map((t) => t.path))
  }, [closeTabs])

  const closeTabsToRight = useCallback(async (path: string) => {
    const idx = tabsRef.current.findIndex((t) => t.path === path)
    if (idx < 0 || idx >= tabsRef.current.length - 1) return
    await closeTabs(tabsRef.current.slice(idx + 1).map((t) => t.path))
  }, [closeTabs])

  const closeAllTabs = useCallback(async () => {
    await closeTabs(tabsRef.current.map((t) => t.path))
  }, [closeTabs])

  const removeFromWorkspace = useCallback(async (rootPath: string) => {
    setError('')
    const target = rootsRef.current.find((r) => pathsEqual(r, rootPath)) ?? rootPath
    const remainingRoots = rootsRef.current.filter((r) => !pathsEqual(r, target))
    const affected = tabsRef.current.filter((t) => {
      if (t.untitled) return false
      if (!pathUnderRoot(t.path, target)) return false
      // Keep tabs still covered by another remaining root.
      return !pathUnderAnyRoot(t.path, remainingRoots)
    })
    const dirty = affected.filter((t) => t.dirty && t.editable)
    for (let i = 0; i < dirty.length; i++) {
      const tab = dirty[i]
      const choice = await askCloseSave(tab, dirty.length - i - 1)
      const result = await applyCloseSaveChoice(choice, dirty, i, saveTab)
      if (result === 'abort') return
      if (result === 'done') break
    }
    try {
      await RemoveRoot(target)
      const drop = new Set(affected.map((t) => t.path))
      setTabs((prev) => {
        const next = prev.filter((t) => !drop.has(t.path))
        if (activePathRef.current && drop.has(activePathRef.current)) {
          setActivePath(next.length ? next[next.length - 1].path : null)
        }
        return next
      })
      setRoots(remainingRoots)
      setTreeRefresh((n) => n + 1)
      setStatus(
        remainingRoots.length
          ? `Removed ${folderLabel(target)} from workspace`
          : 'No workspace',
      )
    } catch (e) {
      setError(String(e))
    }
  }, [askCloseSave, saveTab])

  const removeAllFromWorkspace = useCallback(async () => {
    setError('')
    if (!rootsRef.current.length) return
    const affected = tabsRef.current.filter((t) => {
      if (t.untitled) return false
      return pathUnderAnyRoot(t.path, rootsRef.current)
    })
    const dirty = affected.filter((t) => t.dirty && t.editable)
    for (let i = 0; i < dirty.length; i++) {
      const tab = dirty[i]
      const choice = await askCloseSave(tab, dirty.length - i - 1)
      const result = await applyCloseSaveChoice(choice, dirty, i, saveTab)
      if (result === 'abort') return
      if (result === 'done') break
    }
    try {
      await SetRoots([])
      const drop = new Set(affected.map((t) => t.path))
      setTabs((prev) => {
        const next = prev.filter((t) => !drop.has(t.path))
        if (activePathRef.current && drop.has(activePathRef.current)) {
          setActivePath(next.length ? next[next.length - 1].path : null)
        }
        return next
      })
      setRoots([])
      setTreeRefresh((n) => n + 1)
      setStatus('No workspace')
    } catch (e) {
      setError(String(e))
    }
  }, [askCloseSave, saveTab])

  const formatActiveJson = useCallback(() => {
    const tab = activeTab
    if (!tab?.editable || tab.largeMode || !activePath) return
    const result = toggleJsonFormat(tab.content)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activePath
          ? { ...t, content: result.text, dirty: true, languageHint: 'json' }
          : t,
      ),
    )
    setStatus(result.mode === 'pretty' ? 'JSON formatted' : 'JSON compacted')
    setError('')
  }, [activePath, activeTab])

  const selectTab = useCallback((path: string) => {
    if (path === activePath) return
    setActivePath(path)
  }, [activePath])

  const locateInExplorer = useCallback((path: string) => {
    if (!path || path.startsWith('untitled:')) return
    if (!pathUnderAnyRoot(path, rootsRef.current)) {
      setStatus('File is not in the current workspace')
      return
    }
    setExplorerOpen(true)
    setActivePath(path)
    setRevealPath(path)
    setRevealNonce((n) => n + 1)
  }, [setExplorerOpen])

  const revealInOs = useCallback(async (path: string) => {
    if (!path || path.startsWith('untitled:')) return
    try {
      await RevealInFileManager(path)
      setStatus(`Opened in file manager · ${folderLabel(path)}`)
      setError('')
    } catch (e) {
      setError(String(e))
    }
  }, [])

  const refreshWorkspace = useCallback(async () => {
    setError('')
    setTreeRefresh((n) => n + 1)
    if (!activePath) {
      setStatus('Explorer refreshed')
      return
    }
    const tab = tabs.find((t) => t.path === activePath)
    if (!tab || tab.untitled) {
      setStatus('Explorer refreshed')
      return
    }
    if (tab.dirty) {
      const choice = await askCloseSave(tab, 0)
      const result = await applyCloseSaveChoice(choice, [tab], 0, saveTab)
      if (result === 'abort') return
    }
    try {
      setTabs((prev) => prev.filter((t) => t.path !== activePath))
      setActivePath(null)
      await openFile(activePath)
      setStatus(`Refreshed ${tab.name}`)
    } catch (e) {
      setError(String(e))
    }
  }, [activePath, askCloseSave, openFile, saveTab, tabs])

  const handleClosePrompt = useCallback((choice: CloseSaveChoice) => {
    const resolve = closeResolverRef.current
    closeResolverRef.current = null
    setClosePrompt(null)
    resolve?.(choice)
  }, [])

  const handlePlacementChoice = useCallback((choice: OpenPlacementChoice, always: boolean) => {
    const resolve = placementResolverRef.current
    placementResolverRef.current = null
    setPlacementPrompt(null)
    if (always) {
      void saveOpenPrefsPatch({ target: choice, mode: 'always' }).catch(() => {
        /* ignore */
      })
    }
    resolve?.(choice)
  }, [saveOpenPrefsPatch])

  const handlePlacementCancel = useCallback(() => {
    const resolve = placementResolverRef.current
    placementResolverRef.current = null
    setPlacementPrompt(null)
    resolve?.('cancel')
  }, [])

  const handleParentFolderChoice = useCallback((choice: OpenParentFolderChoice, always: boolean) => {
    const resolve = parentFolderResolverRef.current
    parentFolderResolverRef.current = null
    setParentFolderPrompt(null)
    if (always) {
      void saveOpenPrefsPatch({ parentFolderTarget: choice, parentFolderMode: 'always' }).catch(() => {
        /* ignore */
      })
    }
    resolve?.(choice)
  }, [saveOpenPrefsPatch])

  const handleParentFolderCancel = useCallback(() => {
    const resolve = parentFolderResolverRef.current
    parentFolderResolverRef.current = null
    setParentFolderPrompt(null)
    resolve?.('cancel')
  }, [])

  const handleQuitRequested = useCallback(async () => {
    if (quittingRef.current) return
    quittingRef.current = true
    try {
      // Window close: cache session (including unsaved) and quit without a save prompt.
      persistSession()
      await ConfirmQuit()
    } catch (e) {
      setError(String(e))
      quittingRef.current = false
    }
  }, [persistSession])

  useEffect(() => {
    const off = EventsOn('app:quit-requested', () => {
      void handleQuitRequested()
    })
    return () => {
      off()
    }
  }, [handleQuitRequested])

  useEffect(() => {
    OnFileDrop((_x, _y, paths) => {
      if (!paths?.length) return
      void openDroppedPaths(paths)
    }, true)
    return () => {
      OnFileDropOff()
    }
  }, [openDroppedPaths])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable

      if (closePrompt || placementPrompt || parentFolderPrompt) return

      if (goToOpen || settingsOpen) {
        if (eventMatchesShortcut(e, shortcuts.exitFullscreen) && fullscreen && !typing) {
          e.preventDefault()
          exitFullscreen()
        }
        return
      }

      if (eventMatchesShortcut(e, shortcuts.settings)) {
        if (typing && !(e.ctrlKey || e.metaKey)) return
        e.preventDefault()
        e.stopPropagation()
        openSettings()
        return
      }
      if (eventMatchesShortcut(e, shortcuts.open)) {
        if (typing && !(e.ctrlKey || e.metaKey)) return
        e.preventDefault()
        e.stopPropagation()
        void openPicked('file')
        return
      }
      if (eventMatchesShortcut(e, shortcuts.newFile)) {
        if (typing && !(e.ctrlKey || e.metaKey)) return
        e.preventDefault()
        e.stopPropagation()
        newFile()
        return
      }
      if (eventMatchesShortcut(e, shortcuts.closeTab)) {
        if (typing && !(e.ctrlKey || e.metaKey)) return
        if (!activePathRef.current) return
        e.preventDefault()
        e.stopPropagation()
        void closeTab(activePathRef.current)
        return
      }
      if (eventMatchesShortcut(e, shortcuts.save)) {
        if (typing && !(e.ctrlKey || e.metaKey)) return
        e.preventDefault()
        e.stopPropagation()
        void saveActive()
        return
      }
      if (eventMatchesShortcut(e, shortcuts.formatJson)) {
        if (typing && !(e.ctrlKey || e.metaKey)) return
        e.preventDefault()
        e.stopPropagation()
        formatActiveJson()
        return
      }
      if (eventMatchesShortcut(e, shortcuts.toggleExplorer)) {
        if (typing && !(e.ctrlKey || e.metaKey)) return
        e.preventDefault()
        e.stopPropagation()
        setExplorerOpen((o) => !o)
        return
      }
      if (eventMatchesShortcut(e, shortcuts.goto)) {
        if (!goToTarget) return
        e.preventDefault()
        e.stopPropagation()
        openGoTo()
        return
      }
      if (eventMatchesShortcut(e, shortcuts.fullscreen)) {
        e.preventDefault()
        e.stopPropagation()
        void toggleFullscreen()
        return
      }
      if (eventMatchesShortcut(e, shortcuts.exitFullscreen) && fullscreen) {
        e.preventDefault()
        e.stopPropagation()
        exitFullscreen()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    shortcuts,
    saveActive,
    openPicked,
    newFile,
    closeTab,
    formatActiveJson,
    openGoTo,
    openSettings,
    toggleFullscreen,
    exitFullscreen,
    fullscreen,
    goToOpen,
    settingsOpen,
    goToTarget,
    closePrompt,
    placementPrompt,
    parentFolderPrompt,
    setExplorerOpen,
  ])

  const hasWorkspace = roots.length > 0 || tabs.length > 0
  const rootsSummary = roots.length
    ? roots.map(folderLabel).join(' · ')
    : 'No workspace'
  const locatablePaths = useMemo(
    () => tabs.filter((t) => !t.untitled && pathUnderAnyRoot(t.path, roots)).map((t) => t.path),
    [tabs, roots],
  )
  const showJsonFormat =
    Boolean(activeTab?.editable)
    && !activeTab?.largeMode
    && Boolean(activeTab && isJsonTab(activeTab.path, activeTab.name))

  return (
    <div className={`layout${fullscreen ? ' is-fullscreen' : ''}${explorerOpen ? '' : ' sidebar-collapsed'}`}>
      <header className="toolbar">
        <OpenMenu
          onOpenFile={() => void openPicked('file')}
          onOpenFolder={() => void openPicked('folder')}
          onOpenRecent={(p) => void openRecent(p)}
          onNewFile={newFile}
        />
        <button
          type="button"
          className={`toolbar-btn${explorerOpen ? ' active-toggle' : ''}`}
          onClick={() => setExplorerOpen((o) => !o)}
          title={`${explorerOpen ? 'Hide explorer' : 'Show explorer'} (${formatShortcut(shortcuts.toggleExplorer)})`}
        >
          {explorerOpen ? 'Hide explorer' : 'Explorer'}
        </button>
        {activeTab?.editable ? (
          <button
            type="button"
            className="toolbar-btn"
            disabled={(!activeTab.dirty && !activeTab.untitled) || saving}
            onClick={() => void saveActive()}
            title={`Save (${formatShortcut(shortcuts.save)})`}
          >
            Save
          </button>
        ) : null}
        {showJsonFormat ? (
          <button
            type="button"
            className="toolbar-btn"
            onClick={formatActiveJson}
            title={`Format / minify JSON (${formatShortcut(shortcuts.formatJson)})`}
          >
            Format JSON
          </button>
        ) : null}
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => void toggleFullscreen()}
          title={`Full screen (${formatShortcut(shortcuts.fullscreen)})`}
        >
          {fullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => openSettings()}
          title={`Settings (${formatShortcut(shortcuts.settings)})`}
        >
          Settings
        </button>
        <div className="root-path" title={roots.join('\n')}>{rootsSummary}</div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="body">
        <aside className="sidebar" style={{ ['--wails-drop-target' as string]: 'drop' }}>
          <div className="sidebar-title">
            <span className="sidebar-title-text">Explorer</span>
            <button
              type="button"
              className="sidebar-refresh"
              title="Remove all folders"
              disabled={!roots.length}
              onClick={() => void removeAllFromWorkspace()}
            >
              ⊟
            </button>
            <button
              type="button"
              className="sidebar-refresh"
              title="Refresh"
              disabled={!roots.length}
              onClick={() => void refreshWorkspace()}
            >
              ↻
            </button>
          </div>
          {roots.length ? (
            <>
              <div className="sidebar-tree-wrap">
                <FileTree
                  roots={roots}
                  refreshToken={treeRefresh}
                  activePath={activePath}
                  revealPath={revealPath}
                  revealNonce={revealNonce}
                  onOpenFile={(p) => void openFile(p)}
                  onRemoveFromWorkspace={(p) => void removeFromWorkspace(p)}
                  onRemoveAllFromWorkspace={() => void removeAllFromWorkspace()}
                  onRevealInOs={(p) => void revealInOs(p)}
                  onRevealResult={(ok, message) => {
                    setStatus(message)
                    if (!ok) setError(message)
                    else setError('')
                  }}
                />
              </div>
              <div className="sidebar-drop-hint sidebar-drop-hint-footer">
                Drop files or folders here to open
              </div>
            </>
          ) : (
            <div className="sidebar-drop-hint">
              <div className="sidebar-drop-hint-title">Drop files or folders here</div>
              <div className="sidebar-drop-hint-sub">
                Or use File → Open / Open Folder
              </div>
            </div>
          )}
        </aside>

        <section className="main">
          {!hasWorkspace ? (
            <div className="empty" style={{ ['--wails-drop-target' as string]: 'drop' }}>
              <img src={logo} width={64} height={64} alt="" style={{ borderRadius: 14 }} />
              <h2>PinkHunkReader</h2>
              <div>Browse folders · Markdown live preview · PDF / images</div>
              <OpenMenu
                onOpenFile={() => void openPicked('file')}
                onOpenFolder={() => void openPicked('folder')}
                onOpenRecent={(p) => void openRecent(p)}
                onNewFile={newFile}
              />
              <div className="empty-drop-hint">Drop files or folders here to open</div>
            </div>
          ) : (
            <>
              <TabBar
                tabs={tabs}
                activePath={activePath}
                locatablePaths={locatablePaths}
                onSelect={selectTab}
                onClose={(p) => void closeTab(p)}
                onCloseLeft={(p) => void closeTabsToLeft(p)}
                onCloseRight={(p) => void closeTabsToRight(p)}
                onCloseAll={() => void closeAllTabs()}
                onLocate={locateInExplorer}
                onRevealInOs={(p) => void revealInOs(p)}
              />
              {activeTab ? (
                <ViewerHost
                  tab={activeTab}
                  onChange={updateActiveContent}
                  onDirty={markDirty}
                  registerSave={registerPagedSave}
                />
              ) : (
                <div className="empty">
                  <div>Select a file from the explorer or create a new file</div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="status">
        <span>{status}</span>
        {activeTab?.dirty ? <span style={{ color: 'var(--ph-accent)' }}>Unsaved</span> : null}
        {activeTab?.untitled ? <span>Untitled</span> : null}
        {activeTab?.largeMode ? <span>Paged</span> : null}
      </footer>

      {fullscreen ? (
        <button
          type="button"
          className="fs-exit-fab"
          onClick={() => exitFullscreen()}
          title={`Exit full screen (${formatShortcut(shortcuts.fullscreen)} / ${formatShortcut(shortcuts.exitFullscreen)})`}
        >
          Exit full screen · {formatShortcut(shortcuts.fullscreen)}
        </button>
      ) : null}

      <CloseSaveDialog
        open={Boolean(closePrompt)}
        fileName={closePrompt?.name ?? ''}
        remaining={closePrompt?.remaining ?? 0}
        onChoice={handleClosePrompt}
      />
      <OpenPlacementDialog
        open={Boolean(placementPrompt)}
        pathLabel={placementPrompt?.pathLabel ?? ''}
        defaultTarget={placementPrompt?.defaultTarget ?? 'current'}
        onChoice={handlePlacementChoice}
        onCancel={handlePlacementCancel}
      />
      <OpenParentFolderDialog
        open={Boolean(parentFolderPrompt)}
        pathLabel={parentFolderPrompt?.pathLabel ?? ''}
        defaultTarget={parentFolderPrompt?.defaultTarget ?? 'file'}
        onChoice={handleParentFolderChoice}
        onCancel={handleParentFolderCancel}
      />
      <SettingsModal update={update} />
      <UpdateProgressDialog
        open={update.progress.open}
        version={update.progress.version}
        status={update.progress.status}
        percent={update.progress.percent}
        downloaded={update.progress.downloaded}
        total={update.progress.total}
        message={update.progress.message}
        formatBytes={update.formatBytes}
        canInstall={update.canInstall}
        onHide={update.hideProgress}
        onInstall={() => void update.installUpdate()}
      />
      <GoToDialog />
    </div>
  )
}

export default function App() {
  return (
    <AppSettingsProvider>
      <AppShell />
    </AppSettingsProvider>
  )
}
