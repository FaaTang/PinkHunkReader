import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './styles/theme.css'
import logo from './assets/logo.svg'
import { CloseSaveDialog, type CloseSaveChoice } from './components/CloseSaveDialog'
import { FileTree } from './components/FileTree'
import { GoToDialog } from './components/GoToDialog'
import { OpenMenu } from './components/OpenMenu'
import { SettingsModal } from './components/SettingsModal'
import { UpdateProgressDialog } from './components/UpdateProgressDialog'
import { useAppUpdateManager } from './hooks/useAppUpdateManager'
import { TabBar } from './components/TabBar'
import { ViewerHost } from './components/ViewerHost'
import { useAppFullscreen } from './hooks/useAppFullscreen'
import { AppSettingsProvider, useAppSettings } from './settings/AppSettingsContext'
import { buildSession, loadSession, saveSession } from './settings/session'
import { eventMatchesShortcut, formatShortcut } from './settings/shortcuts'
import type { FileInfo, OpenTab } from './types'
import { isJsonTab, toggleJsonFormat } from './utils/jsonFormat'
import {
  ConfirmQuit,
  GetRoot,
  OpenRoot,
  PickAndOpen,
  PickAndSaveFile,
  ReadText,
  StatFile,
  WriteText,
} from '../wailsjs/go/app/App'
import { EventsOn } from '../wailsjs/runtime/runtime'

function parentDir(path: string): string {
  const slash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return slash >= 0 ? path.slice(0, slash) : path
}

function pathUnderRoot(filePath: string, rootPath: string): boolean {
  if (!rootPath) return false
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const rootN = norm(rootPath)
  const fileN = norm(filePath)
  return fileN === rootN || fileN.startsWith(`${rootN}/`)
}

function AppShell() {
  const [root, setRoot] = useState('')
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Open a folder or file to start')
  const [saving, setSaving] = useState(false)
  const [treeRefresh, setTreeRefresh] = useState(0)
  const [untitledSeq, setUntitledSeq] = useState(1)
  const [sessionReady, setSessionReady] = useState(false)
  const [closePrompt, setClosePrompt] = useState<{
    path: string
    name: string
    remaining: number
    mode: 'tab' | 'quit'
  } | null>(null)
  const pagedSaveRef = useRef<(() => Promise<void>) | null>(null)
  const tabsRef = useRef(tabs)
  const activePathRef = useRef(activePath)
  const rootRef = useRef(root)
  const untitledSeqRef = useRef(untitledSeq)
  const closeResolverRef = useRef<((c: CloseSaveChoice) => void) | null>(null)
  const quittingRef = useRef(false)

  tabsRef.current = tabs
  activePathRef.current = activePath
  rootRef.current = root
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

  const persistSession = useCallback(() => {
    saveSession(buildSession(
      rootRef.current,
      activePathRef.current,
      tabsRef.current,
      untitledSeqRef.current,
    ))
  }, [])

  useEffect(() => {
    if (!sessionReady) return
    const t = window.setTimeout(() => persistSession(), 200)
    return () => window.clearTimeout(t)
  }, [tabs, activePath, root, untitledSeq, sessionReady, persistSession])

  const askCloseSave = useCallback((tab: OpenTab, remaining: number, mode: 'tab' | 'quit') => {
    return new Promise<CloseSaveChoice>((resolve) => {
      closeResolverRef.current = resolve
      setClosePrompt({ path: tab.path, name: tab.name, remaining, mode })
    })
  }, [])

  const openFile = useCallback(async (path: string) => {
    setError('')
    try {
      const info: FileInfo = await StatFile(path)
      if (info.isDir) return

      let content = ''

      if (info.kind === 'pdf' || info.kind === 'image' || info.kind === 'word' || info.kind === 'excel') {
        // filled by viewer via ReadBytes
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

  // Restore last session (Notepad++-style: tabs not actively closed come back).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const session = loadSession()
      if (!session || !session.tabs.length) {
        if (!cancelled) setSessionReady(true)
        return
      }
      try {
        if (session.root) {
          await OpenRoot(session.root)
          if (!cancelled) {
            setRoot(session.root)
            setStatus(session.root)
          }
        }
        if (!cancelled) setUntitledSeq(Math.max(1, session.untitledSeq || 1))

        const restored: OpenTab[] = []
        for (const st of session.tabs) {
          if (cancelled) return
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
              if (session.root) {
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
          if (typeof st.content === 'string' && (st.dirty || st.content.length >= 0)) {
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
            if (!session.root) continue
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
        if (!cancelled && restored.length) {
          setTabs(restored)
          const active = restored.find((t) => t.path === session.activePath)?.path ?? restored[0].path
          setActivePath(active)
          setStatus(`Restored ${restored.length} tab${restored.length === 1 ? '' : 's'}`)
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
  }, [])

  const openPicked = useCallback(async (mode: 'file' | 'folder') => {
    setError('')
    try {
      const picked = await PickAndOpen(mode)
      if (!picked?.path) return
      if (picked.isDir) {
        setRoot(picked.path)
        setStatus(picked.path)
        setTreeRefresh((n) => n + 1)
        return
      }
      const parent = parentDir(picked.path)
      setRoot(parent)
      setStatus(parent)
      setTreeRefresh((n) => n + 1)
      await openFile(picked.path)
    } catch (e) {
      setError(String(e))
    }
  }, [openFile])

  const openRecent = useCallback(async (path: string) => {
    setError('')
    try {
      let currentRoot = root
      try {
        currentRoot = (await GetRoot()) || root
      } catch {
        /* ignore */
      }
      if (!pathUnderRoot(path, currentRoot)) {
        const parent = parentDir(path)
        await OpenRoot(parent)
        setRoot(parent)
        setStatus(parent)
        setTreeRefresh((n) => n + 1)
        await openFile(path)
        return
      }
      await openFile(path)
    } catch (e) {
      setError(String(e))
    }
  }, [openFile, root])

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
        setRoot(parentDir(info.path))
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
  }, [rememberRecent])

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
      const choice = await askCloseSave(tab, 0, 'tab')
      if (choice === 'cancel') return
      if (choice === 'save') {
        const ok = await saveTab(tab)
        if (!ok) return
      }
    }
    removeTab(path)
  }, [askCloseSave, removeTab, saveTab])

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
      const choice = await askCloseSave(tab, 0, 'tab')
      if (choice === 'cancel') return
      if (choice === 'save') {
        const ok = await saveTab(tab)
        if (!ok) return
      }
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

  const handleQuitRequested = useCallback(async () => {
    if (quittingRef.current) return
    quittingRef.current = true
    try {
      persistSession()
      const dirty = tabsRef.current.filter((t) => t.dirty && t.editable)
      for (let i = 0; i < dirty.length; i++) {
        const tab = dirty[i]
        const choice = await askCloseSave(tab, dirty.length - i - 1, 'quit')
        if (choice === 'cancel') {
          quittingRef.current = false
          return
        }
        if (choice === 'save') {
          const ok = await saveTab(tab)
          if (!ok) {
            quittingRef.current = false
            return
          }
        }
      }
      persistSession()
      await ConfirmQuit()
    } catch (e) {
      setError(String(e))
      quittingRef.current = false
    }
  }, [askCloseSave, persistSession, saveTab])

  useEffect(() => {
    const off = EventsOn('app:quit-requested', () => {
      void handleQuitRequested()
    })
    return () => {
      off()
    }
  }, [handleQuitRequested])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable

      if (closePrompt) return

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
  ])

  const hasWorkspace = Boolean(root) || tabs.length > 0
  const showJsonFormat =
    Boolean(activeTab?.editable)
    && !activeTab?.largeMode
    && Boolean(activeTab && isJsonTab(activeTab.path, activeTab.name))

  return (
    <div className={`layout${fullscreen ? ' is-fullscreen' : ''}`}>
      <header className="toolbar">
        <OpenMenu
          onOpenFile={() => void openPicked('file')}
          onOpenFolder={() => void openPicked('folder')}
          onOpenRecent={(p) => void openRecent(p)}
          onNewFile={newFile}
        />
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
        <div className="root-path" title={root}>{root || 'No workspace'}</div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="body">
        <aside className="sidebar">
          <div className="sidebar-title">
            <span className="sidebar-title-text">Explorer</span>
            <button
              type="button"
              className="sidebar-refresh"
              title="Refresh"
              disabled={!root}
              onClick={() => void refreshWorkspace()}
            >
              ↻
            </button>
          </div>
          {root ? (
            <FileTree
              root={root}
              refreshToken={treeRefresh}
              activePath={activePath}
              onOpenFile={(p) => void openFile(p)}
            />
          ) : (
            <div className="empty" style={{ padding: 16, fontSize: 12 }}>
              Use File → Open or Open Folder
            </div>
          )}
        </aside>

        <section className="main">
          {!hasWorkspace ? (
            <div className="empty">
              <img src={logo} width={64} height={64} alt="" style={{ borderRadius: 14 }} />
              <h2>PinkHunkReader</h2>
              <div>Browse folders · Markdown live preview · PDF / images</div>
              <OpenMenu
                onOpenFile={() => void openPicked('file')}
                onOpenFolder={() => void openPicked('folder')}
                onOpenRecent={(p) => void openRecent(p)}
                onNewFile={newFile}
              />
            </div>
          ) : (
            <>
              <TabBar
                tabs={tabs}
                activePath={activePath}
                onSelect={selectTab}
                onClose={(p) => void closeTab(p)}
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
