import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { loader, type EditorProps, type OnMount } from '@monaco-editor/react'
import { ViewerLoading } from './ViewerLoading'
import { ensureMonaco, isMonacoReady, whenMonacoReady } from '../monaco'
import { useT } from '../i18n'
import { useAppSettings } from '../settings/AppSettingsContext'

/** Thin wrapper that waits for local monaco before mounting the editor. */
export function MonacoEditor(props: EditorProps) {
  const t = useT()
  const { darkMode } = useAppSettings()
  const [ready, setReady] = useState(isMonacoReady())
  const editorRef = useRef<any>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  /**
   * `scrollBeyondLastLine` always leaves one viewport of scroll space, so
   * Monaco shows a vertical scrollbar even for a three-line file. Enable it
   * only when the content actually overflows the viewport; a file that fits
   * stays scrollbar-free, while long files keep scrolling past the last line.
   */
  const syncScrollBeyond = useCallback(async () => {
    const ed = editorRef.current
    if (!ed) return
    try {
      const monaco = await loader.init()
      const model = ed.getModel?.()
      const layout = ed.getLayoutInfo?.()
      if (!model || !layout?.height) return
      const lineHeight = ed.getOption?.(monaco.editor.EditorOption.lineHeight) ?? 19
      const fits = model.getLineCount() * lineHeight <= layout.height
      ed.updateOptions({ scrollBeyondLastLine: !fits })
    } catch {
      /* editor disposed or monaco not ready */
    }
  }, [])

  useEffect(() => {
    void syncScrollBeyond()
  }, [props.value, syncScrollBeyond])

  useEffect(() => () => {
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
  }, [])

  const handleMount = useCallback<OnMount>((ed, monaco) => {
    editorRef.current = ed
    void syncScrollBeyond()
    resizeObserverRef.current?.disconnect()
    const dom = ed.getDomNode?.()
    if (dom && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        void syncScrollBeyond()
      })
      observer.observe(dom)
      resizeObserverRef.current = observer
    }
    props.onMount?.(ed, monaco)
  }, [props.onMount, syncScrollBeyond])

  useEffect(() => {
    void ensureMonaco().catch((err) => {
      console.error('Monaco init failed', err)
    })
  }, [])

  useEffect(() => {
    if (ready) return
    return whenMonacoReady(() => setReady(true))
  }, [ready])

  if (!ready) {
    return (
      <div className="monaco-boot-host" style={{ height: props.height ?? '100%', position: 'relative', minHeight: 120 }}>
        <ViewerLoading visible label={t('app.editor.loading')} />
      </div>
    )
  }

  return (
    <Editor
      loading={
        <div style={{ height: '100%', minHeight: 120, position: 'relative' }}>
          <ViewerLoading visible label={t('app.editor.loading')} />
        </div>
      }
      {...props}
      onMount={handleMount}
      theme={darkMode ? 'vs-dark' : 'vs'}
    />
  )
}
