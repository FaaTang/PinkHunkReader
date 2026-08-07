import { useCallback, useEffect, useRef, useState } from 'react'
import { ReadSlice } from '../../wailsjs/go/app/App'

/** Fallback chunk size until editor layout is known. */
export const WINDOW_LINES_FALLBACK = 40

export interface WindowedState {
  content: string
  startLine: number
  endLine: number
  totalLines: number
  windowLines: number
  hasNext: boolean
  hasPrev: boolean
  loading: boolean
  error: string
}

/** Apply disk loads into Monaco immediately (avoids save races with useEffect sync). */
export interface WindowedModelBridge {
  replace: (text: string) => void
  append: (chunk: string) => void
}

/**
 * Viewport-sized paging with append prefetch.
 * Initial load = visible×2. While scrolling, keep ~one chunk ahead so the
 * wheel never hits a hard wall (smooth continuous read).
 * Editing is allowed; save callers should ensureAll() then take editor value.
 */
export function useWindowedFile(path: string) {
  const [state, setState] = useState<WindowedState>({
    content: '',
    startLine: 1,
    endLine: 0,
    totalLines: 0,
    windowLines: WINDOW_LINES_FALLBACK,
    hasNext: false,
    hasPrev: false,
    loading: true,
    error: '',
  })
  const busyRef = useRef(false)
  const pathRef = useRef(path)
  const windowLinesRef = useRef(WINDOW_LINES_FALLBACK)
  const endRef = useRef(0)
  const eofRef = useRef(false)
  const pendingAheadRef = useRef(false)
  const contentRef = useRef('')
  const bridgeRef = useRef<WindowedModelBridge | null>(null)
  pathRef.current = path

  const setModelBridge = useCallback((bridge: WindowedModelBridge | null) => {
    bridgeRef.current = bridge
  }, [])

  const getLoadedContent = useCallback(() => contentRef.current, [])

  const loadReplace = useCallback(async (start: number, count: number) => {
    if (busyRef.current) return
    busyRef.current = true
    const n = Math.max(1, count)
    setState((s) => ({ ...s, loading: true, error: '', windowLines: n }))
    try {
      const slice = await ReadSlice(pathRef.current, start, n)
      endRef.current = slice.endLine
      eofRef.current = slice.eof
      contentRef.current = slice.content
      bridgeRef.current?.replace(slice.content)
      setState({
        content: slice.content,
        startLine: slice.startLine,
        endLine: slice.endLine,
        totalLines: slice.totalLines,
        windowLines: n,
        hasNext: !slice.eof,
        hasPrev: slice.startLine > 1,
        loading: false,
        error: '',
      })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: String(e) }))
    } finally {
      busyRef.current = false
    }
  }, [])

  const appendNext = useCallback(async (count?: number) => {
    if (busyRef.current || eofRef.current) return false
    busyRef.current = true
    const n = Math.max(1, count ?? windowLinesRef.current)
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const slice = await ReadSlice(pathRef.current, endRef.current + 1, n)
      endRef.current = slice.endLine
      eofRef.current = slice.eof
      contentRef.current += slice.content
      bridgeRef.current?.append(slice.content)
      setState((s) => ({
        ...s,
        content: s.content + slice.content,
        endLine: slice.endLine,
        totalLines: slice.totalLines > 0 ? slice.totalLines : s.totalLines,
        windowLines: windowLinesRef.current,
        hasNext: !slice.eof,
        hasPrev: s.startLine > 1,
        loading: false,
        error: '',
      }))
      return !slice.eof
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: String(e) }))
      return false
    } finally {
      busyRef.current = false
    }
  }, [])

  /**
   * Keep ahead buffer while scrolling.
   * nearBottom: user hit the loaded tail (word-wrap safe) → always append.
   * Otherwise append when remaining lines < one prefetch chunk (visible×2).
   */
  const ensureAhead = useCallback(async (
    localTopLine: number,
    visibleLines: number,
    nearBottom?: boolean,
  ) => {
    if (eofRef.current) return
    if (busyRef.current) {
      pendingAheadRef.current = true
      return
    }

    const viewBottom = localTopLine + Math.max(1, visibleLines) - 1
    const modelLines = Math.max(0, endRef.current)
    const remainingBelow = modelLines - viewBottom
    const needChunk = Math.max(visibleLines, Math.floor(windowLinesRef.current / 2), 1)

    if (!nearBottom && remainingBelow >= needChunk) return

    pendingAheadRef.current = false
    await appendNext()
    if (pendingAheadRef.current && !eofRef.current) {
      pendingAheadRef.current = false
      await appendNext()
    }
  }, [appendNext])

  /** Load forward until absolute line is in the model (outline jump). */
  const ensureThrough = useCallback(async (line: number) => {
    if (line < 1) return
    while (!eofRef.current && endRef.current < line) {
      if (busyRef.current) {
        await new Promise((r) => setTimeout(r, 40))
        continue
      }
      const need = Math.max(windowLinesRef.current, line - endRef.current + windowLinesRef.current)
      const ok = await appendNext(need)
      if (!ok && endRef.current < line) break
    }
  }, [appendNext])

  /** Prefetch remainder so save can write the full document. */
  const ensureAll = useCallback(async () => {
    while (!eofRef.current) {
      if (busyRef.current) {
        await new Promise((r) => setTimeout(r, 40))
        continue
      }
      const chunk = Math.max(windowLinesRef.current, 2000)
      const ok = await appendNext(chunk)
      if (!ok) break
    }
  }, [appendNext])

  const setWindowLines = useCallback((n: number) => {
    if (n <= 0) return
    windowLinesRef.current = n
    setState((s) => (s.windowLines === n ? s : { ...s, windowLines: n }))
  }, [])

  useEffect(() => {
    busyRef.current = false
    eofRef.current = false
    endRef.current = 0
    pendingAheadRef.current = false
    contentRef.current = ''
    windowLinesRef.current = WINDOW_LINES_FALLBACK
    void loadReplace(1, WINDOW_LINES_FALLBACK)
  }, [loadReplace, path])

  const pageNext = useCallback(() => {
    void appendNext()
  }, [appendNext])

  const pagePrev = useCallback(() => {
    // Content grows from the top; previous pages are already in the model.
  }, [])

  return {
    ...state,
    pageNext,
    pagePrev,
    appendNext,
    ensureAhead,
    ensureThrough,
    ensureAll,
    setWindowLines,
    setModelBridge,
    getLoadedContent,
  }
}

/** visibleLines × 2, clamped. */
export function calcWindowLines(editor: any, monaco?: any): number {
  const layoutHeight = editor.getLayoutInfo?.()?.height ?? 0
  const lineHeight =
    editor.getOption?.(monaco?.editor?.EditorOption?.lineHeight) ??
    Math.max(1, (editor.getTopForLineNumber?.(2) ?? 18) - (editor.getTopForLineNumber?.(1) ?? 0))
  const visible = Math.max(1, Math.ceil(layoutHeight / Math.max(1, lineHeight)))
  return Math.min(2000, Math.max(40, visible * 2))
}

export function calcVisibleLines(editor: any, monaco?: any): number {
  const layoutHeight = editor.getLayoutInfo?.()?.height ?? 0
  const lineHeight =
    editor.getOption?.(monaco?.editor?.EditorOption?.lineHeight) ??
    Math.max(1, (editor.getTopForLineNumber?.(2) ?? 18) - (editor.getTopForLineNumber?.(1) ?? 0))
  return Math.max(1, Math.ceil(layoutHeight / Math.max(1, lineHeight)))
}

/** Append text at the end of a Monaco model. */
export function appendToMonacoModel(model: any, chunk: string) {
  if (!chunk) return
  const lastLine = model.getLineCount()
  const lastCol = model.getLineMaxColumn(lastLine)
  model.pushEditOperations(
    [],
    [{
      range: {
        startLineNumber: lastLine,
        startColumn: lastCol,
        endLineNumber: lastLine,
        endColumn: lastCol,
      },
      text: chunk,
    }],
    () => null,
  )
}
