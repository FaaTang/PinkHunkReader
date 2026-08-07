import { useCallback, useEffect, useRef } from 'react'
import { WINDOW_LINES_FALLBACK, calcVisibleLines } from './useWindowedFile'

export interface PagingOpts {
  hasNext: boolean
  loading: boolean
  windowLines: number
  pageNext: () => void
  /** Prefer scroll-near-bottom; visible ranges are a fallback. */
  ensureAhead: (localTopLine: number, visibleLines: number, nearBottom?: boolean) => void
  setWindowLines: (n: number) => void
  calcWindowLines: (editor: any, monaco?: any) => number
}

/**
 * Continuous scroll prefetch via Monaco's own scroll events
 * (DOM scroll on .monaco-scrollable-element is unreliable with word-wrap).
 */
export function useMonacoPaging() {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)
  const optsRef = useRef<PagingOpts>({
    hasNext: false,
    loading: false,
    windowLines: WINDOW_LINES_FALLBACK,
    pageNext: () => undefined,
    ensureAhead: () => undefined,
    setWindowLines: () => undefined,
    calcWindowLines: () => WINDOW_LINES_FALLBACK,
  })
  const cleanupRef = useRef<(() => void) | null>(null)

  const tick = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const o = optsRef.current
    // Do not gate on o.loading — busy lock lives inside ensureAhead.
    // Gating here prevented re-checks while stuck at the bottom.
    if (!o.hasNext) return

    const layout = editor.getLayoutInfo?.() ?? { height: 0 }
    const scrollTop = editor.getScrollTop?.() ?? 0
    const scrollHeight = editor.getScrollHeight?.() ?? 0
    const nearBottom = scrollTop + layout.height >= scrollHeight - 96

    let localTop = 1
    let visible = calcVisibleLines(editor, monacoRef.current)
    const ranges = editor.getVisibleRanges?.() as { startLineNumber: number; endLineNumber: number }[] | undefined
    if (ranges?.length) {
      localTop = ranges[0].startLineNumber
      visible = Math.max(1, ranges[0].endLineNumber - ranges[0].startLineNumber + 1)
    }
    o.ensureAhead(localTop, visible, nearBottom)
  }, [])

  const handleMount = useCallback((editor: any, monaco?: any) => {
    editorRef.current = editor
    monacoRef.current = monaco

    const applySize = () => {
      const n = optsRef.current.calcWindowLines(editor, monaco)
      optsRef.current.setWindowLines(n)
    }
    applySize()

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }

    const scrollDispose = editor.onDidScrollChange?.(onScroll)
    const layoutDispose = editor.onDidLayoutChange?.(() => {
      applySize()
      onScroll()
    })
    onScroll()

    cleanupRef.current = () => {
      cancelAnimationFrame(raf)
      scrollDispose?.dispose?.()
      layoutDispose?.dispose?.()
    }
  }, [tick])

  const checkAhead = useCallback(() => {
    tick()
  }, [tick])

  useEffect(() => () => cleanupRef.current?.(), [])

  return { editorRef, optsRef, handleMount, checkAhead }
}
