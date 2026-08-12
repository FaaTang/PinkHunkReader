import { useEffect, useRef, useState } from 'react'
import { WriteText } from '../../wailsjs/go/app/App'
import { MonacoEditor } from '../components/MonacoEditor'
import { GoToButton } from '../components/GoToButton'
import { ScrollLoadFooter } from '../components/ScrollLoadFooter'
import { ViewerLoading } from '../components/ViewerLoading'
import {
  appendToMonacoModel,
  calcWindowLines,
  useWindowedFile,
} from '../hooks/useWindowedFile'
import { useMonacoPaging } from '../hooks/useMonacoPaging'
import { useRegisterGoTo } from '../settings/AppSettingsContext'
import { langFromPath } from '../utils/lang'
import './viewers.css'

interface Props {
  path: string
  /** False while the tab is kept mounted but hidden. */
  active?: boolean
  onDirty: (dirty: boolean) => void
  registerSave: (fn: (() => Promise<void>) | null) => void
}

export function PagedText({ path, active = true, onDirty, registerSave }: Props) {
  const {
    startLine, endLine, totalLines, windowLines,
    hasNext, loading, error, pageNext, ensureAhead, ensureThrough, ensureAll,
    setWindowLines, setModelBridge, getLoadedContent,
  } = useWindowedFile(path)
  const paging = useMonacoPaging()
  const nearBottomRef = useRef(false)
  const applyingDiskRef = useRef(false)
  const [editorReady, setEditorReady] = useState(false)
  const [nearBottom, setNearBottom] = useState(false)

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
        applyingDiskRef.current = false
      },
      append: (chunk) => {
        applyingDiskRef.current = true
        appendToMonacoModel(model, chunk)
        applyingDiskRef.current = false
      },
    })
    const loaded = getLoadedContent()
    if (loaded && !(ed.getValue?.() ?? '')) {
      applyingDiskRef.current = true
      model.setValue(loaded)
      applyingDiskRef.current = false
    }
    return () => setModelBridge(null)
  }, [editorReady, getLoadedContent, paging.editorRef, setModelBridge])

  useEffect(() => {
    nearBottomRef.current = false
    setNearBottom(false)
  }, [path])

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
    const onScroll = () => {
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
    return () => d?.dispose?.()
  }, [editorReady, paging.editorRef])

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
    if (!active) return
    const t = window.setTimeout(() => paging.editorRef.current?.layout?.(), 0)
    return () => window.clearTimeout(t)
  }, [active, paging.editorRef])

  useRegisterGoTo(
    active
      ? {
          kind: 'line',
          current: Math.max(1, endLine || 1),
          max: Math.max(totalLines || endLine || 1, 1),
          go: async (n) => {
            const line = Math.max(1, n)
            await ensureThrough(line)
            const ed = paging.editorRef.current
            ed?.revealLineNearTop?.(line)
            ed?.setPosition?.({ lineNumber: line, column: 1 })
          },
        }
      : null,
  )

  return (
    <div className="viewer-single">
      <div className="md-view-bar">
        <GoToButton />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--ph-fg-4)' }}>
          Edit (paged) · preloaded {startLine}–{endLine}{totalLines > 0 ? ` / ${totalLines}` : ''}
        </span>
      </div>
      <div className="editor-wrap" style={{ flex: 1, position: 'relative' }}>
        <ViewerLoading visible={bootLoading} label="Loading document…" />
        <MonacoEditor
          height="100%"
          language={langFromPath(path)}
          theme="vs"
          defaultValue=""
          onMount={(ed, monaco) => {
            paging.handleMount(ed, monaco)
            setEditorReady(true)
            ed.onDidChangeModelContent?.(() => {
              if (applyingDiskRef.current) return
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
