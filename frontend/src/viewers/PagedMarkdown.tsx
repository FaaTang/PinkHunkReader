import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { WriteText, ReadMarkdownOutline } from '../../wailsjs/go/app/App'
import { MonacoEditor } from '../components/MonacoEditor'
import { GoToButton } from '../components/GoToButton'
import { MdOutline, type MdHeadingItem } from '../components/MdOutline'
import { MdViewModeToggle, type MdViewMode } from '../components/MdViewModeToggle'
import { ScrollLoadFooter } from '../components/ScrollLoadFooter'
import { ViewerLoading } from '../components/ViewerLoading'
import {
  appendToMonacoModel,
  calcWindowLines,
  useWindowedFile,
} from '../hooks/useWindowedFile'
import { useMonacoPaging } from '../hooks/useMonacoPaging'
import { useRegisterGoTo } from '../settings/AppSettingsContext'
import { hasOutlinePreference, usePersistedOutlineOpen } from '../hooks/usePersistedOutlineOpen'
import { MarkdownPreview } from './MarkdownPreview'
import './viewers.css'

interface Props {
  path: string
  /** False while the tab is kept mounted but hidden. */
  active?: boolean
  onDirty: (dirty: boolean) => void
  registerSave: (fn: (() => Promise<void>) | null) => void
}

export function PagedMarkdown({ path, active = true, onDirty, registerSave }: Props) {
  const {
    content, startLine, endLine, totalLines, windowLines,
    hasNext, loading, error, pageNext, ensureAhead, ensureThrough, ensureAll,
    setWindowLines, setModelBridge, getLoadedContent,
  } = useWindowedFile(path)
  const paging = useMonacoPaging()
  const previewRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef(1)
  const nearBottomRef = useRef(false)
  const applyingDiskRef = useRef(false)
  const [editorReady, setEditorReady] = useState(false)
  const [headings, setHeadings] = useState<MdHeadingItem[]>([])
  const [activeLine, setActiveLine] = useState(1)
  const [mode, setMode] = useState<MdViewMode>('split')
  const [nearBottom, setNearBottom] = useState(false)
  const [liveContent, setLiveContent] = useState('')
  const [outlineOpen, setOutlineOpen] = usePersistedOutlineOpen(path, true)
  const deferredContent = useDeferredValue(liveContent || content)

  paging.optsRef.current = {
    hasNext,
    loading,
    windowLines,
    pageNext,
    ensureAhead,
    setWindowLines,
    calcWindowLines,
  }

  useEffect(() => {
    let cancelled = false
    setHeadings([])
    nearBottomRef.current = false
    setNearBottom(false)
    setLiveContent('')
    void ReadMarkdownOutline(path)
      .then((rows) => {
        if (cancelled) return
        const list = (rows ?? []).map((r) => ({
          level: r.level,
          title: r.title,
          line: r.line,
        }))
        setHeadings(list)
        if (!hasOutlinePreference(path)) {
          setOutlineOpen(list.length > 0)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHeadings([])
          if (!hasOutlinePreference(path)) setOutlineOpen(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [path, setOutlineOpen])

  useEffect(() => {
    if (!editorReady) {
      setModelBridge(null)
      return
    }
    const ed = paging.editorRef.current
    const model = ed?.getModel?.()
    if (!model) return

    setModelBridge({
      replace: (text) => {
        applyingDiskRef.current = true
        const st = ed.getScrollTop?.() ?? 0
        model.setValue(text)
        ed.setScrollTop?.(st)
        setLiveContent(text)
        applyingDiskRef.current = false
      },
      append: (chunk) => {
        applyingDiskRef.current = true
        appendToMonacoModel(model, chunk)
        setLiveContent(ed.getValue?.() ?? '')
        applyingDiskRef.current = false
      },
    })
    // Disk load may finish before the bridge is ready.
    const loaded = getLoadedContent()
    if (loaded && !(ed.getValue?.() ?? '')) {
      applyingDiskRef.current = true
      model.setValue(loaded)
      setLiveContent(loaded)
      applyingDiskRef.current = false
    }
    return () => setModelBridge(null)
  }, [editorReady, getLoadedContent, paging.editorRef, setModelBridge])

  const { checkAhead } = paging
  useEffect(() => {
    if (!hasNext || !editorReady) return
    const t = window.setTimeout(() => checkAhead(), 0)
    return () => window.clearTimeout(t)
  }, [loading, hasNext, endLine, editorReady, checkAhead])

  useEffect(() => {
    if (!editorReady) return
    const ed = paging.editorRef.current
    if (!ed) return
    let lineTimer = 0
    const onScroll = () => {
      const ranges = ed.getVisibleRanges?.() as { startLineNumber: number }[] | undefined
      const top = ranges?.[0]?.startLineNumber ?? 1
      if (top !== activeLineRef.current) {
        activeLineRef.current = top
        window.clearTimeout(lineTimer)
        lineTimer = window.setTimeout(() => setActiveLine(top), 120)
      }
      const layout = ed.getLayoutInfo?.() ?? { height: 0 }
      const atEnd =
        (ed.getScrollTop?.() ?? 0) + layout.height >= (ed.getScrollHeight?.() ?? 0) - 120
      if (atEnd !== nearBottomRef.current) {
        nearBottomRef.current = atEnd
        setNearBottom(atEnd)
      }
    }
    const d = ed.onDidScrollChange?.(onScroll)
    onScroll()
    return () => {
      window.clearTimeout(lineTimer)
      d?.dispose?.()
    }
  }, [editorReady, paging.editorRef])

  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const onScroll = () => {
      const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 120
      if (atEnd !== nearBottomRef.current) {
        nearBottomRef.current = atEnd
        setNearBottom(atEnd)
      }
      if (atEnd && hasNext) void pageNext()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [hasNext, pageNext])

  const jumpToLine = useCallback(async (line: number, title: string) => {
    await ensureThrough(line)
    const ed = paging.editorRef.current
    if (ed) {
      ed.revealLineNearTop?.(line)
      activeLineRef.current = line
      setActiveLine(line)
    }
    const root = previewRef.current
    if (root) {
      const heads = root.querySelectorAll('h1,h2,h3,h4,h5,h6')
      for (const h of Array.from(heads)) {
        if ((h.textContent ?? '').trim() === title) {
          h.scrollIntoView({ block: 'start' })
          break
        }
      }
    }
  }, [ensureThrough, paging.editorRef])

  useEffect(() => {
    if (mode === 'preview') return
    const t = window.setTimeout(() => paging.editorRef.current?.layout?.(), 0)
    return () => window.clearTimeout(t)
  }, [mode, paging.editorRef])

  useEffect(() => {
    const save = async () => {
      await ensureAll()
      const text = paging.editorRef.current?.getValue?.() ?? ''
      await WriteText(path, text)
      onDirty(false)
    }
    registerSave(save)
    return () => registerSave(null)
  }, [ensureAll, onDirty, path, paging.editorRef, registerSave])

  const bottomLoading = loading && endLine > 0 && nearBottom
  const bootLoading = !error && (endLine === 0 || !editorReady)

  useEffect(() => {
    if (!active || mode === 'preview') return
    const t = window.setTimeout(() => paging.editorRef.current?.layout?.(), 0)
    return () => window.clearTimeout(t)
  }, [active, mode, paging.editorRef])

  useRegisterGoTo(
    active
      ? {
          kind: 'line',
          current: Math.max(1, activeLine || 1),
          max: Math.max(totalLines || endLine || 1, 1),
          go: async (n) => {
            const line = Math.max(1, n)
            await ensureThrough(line)
            const ed = paging.editorRef.current
            ed?.revealLineNearTop?.(line)
            ed?.setPosition?.({ lineNumber: line, column: 1 })
            setActiveLine(line)
          },
        }
      : null,
  )

  return (
    <div className="viewer-single">
      <div className="md-view-bar">
        <GoToButton />
        <button
          type="button"
          className={`toolbar-btn${outlineOpen && headings.length > 0 ? ' active-toggle' : ''}`}
          disabled={headings.length === 0}
          onClick={() => setOutlineOpen((o) => !o)}
          title={headings.length ? (outlineOpen ? 'Hide outline' : 'Show outline') : 'No headings'}
        >
          {outlineOpen && headings.length > 0 ? 'Hide outline' : 'Outline'}
        </button>
        <MdViewModeToggle mode={mode} onChange={setMode} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--ph-fg-4)' }}>
          {mode === 'split' ? 'Edit + Preview' : mode === 'edit' ? 'Edit only' : 'Preview only'}
          {' · '}
          preloaded {startLine}–{endLine}{totalLines > 0 ? ` / ${totalLines}` : ''}
        </span>
      </div>
      <div className="md-body">
        <ViewerLoading visible={bootLoading} label="Loading document…" />
        <MdOutline
          headings={headings}
          activeLine={activeLine}
          open={outlineOpen}
          onSelect={(line, title) => void jumpToLine(line, title)}
        />
        <div className={`viewer-split mode-${mode}`}>
          <div className="viewer-pane viewer-pane-edit">
            <div className="pane-label">Edit (paged)</div>
            <div className="editor-wrap">
              <MonacoEditor
                height="100%"
                language="markdown"
                theme="light"
                defaultValue=""
                onMount={(ed, monaco) => {
                  paging.handleMount(ed, monaco)
                  setEditorReady(true)
                  ed.onDidChangeModelContent?.(() => {
                    if (applyingDiskRef.current) return
                    setLiveContent(ed.getValue?.() ?? '')
                    onDirty(true)
                  })
                }}
                options={{
                  readOnly: false,
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: true,
                  automaticLayout: true,
                  renderWhitespace: 'none',
                  quickSuggestions: false,
                  occurrencesHighlight: 'off' as any,
                  renderLineHighlight: 'line',
                  stickyScroll: { enabled: false },
                }}
              />
            </div>
          </div>
          <div className="viewer-pane viewer-pane-preview">
            <div className="pane-label">
              Preview (preloaded {startLine}–{endLine}{totalLines > 0 ? ` / ${totalLines}` : ''})
            </div>
            <div className="preview-wrap" ref={previewRef}>
              <MarkdownPreview content={deferredContent} />
            </div>
          </div>
        </div>
      </div>
      <ScrollLoadFooter visible={bottomLoading} />
      <div className="large-bar">
        <span>
          Preloaded {startLine}–{endLine}
          {totalLines > 0 ? ` / ${totalLines}` : ''}
          {' · '}
          prefetch {windowLines}/page
          {loading ? ' · Loading…' : hasNext ? ' · scroll to load more' : ' · end of file'}
        </span>
        {error ? <span style={{ color: 'var(--ph-danger)' }}>{error}</span> : null}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="toolbar-btn"
          disabled={!hasNext || loading}
          onClick={() => void pageNext()}
        >
          Load more
        </button>
      </div>
    </div>
  )
}
