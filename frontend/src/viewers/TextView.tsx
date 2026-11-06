import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MonacoEditor } from '../components/MonacoEditor'
import { GoToButton } from '../components/GoToButton'
import { ensureMonaco, isMonacoReady, whenMonacoReady } from '../monaco'
import { useRegisterGoTo } from '../settings/AppSettingsContext'
import { getActiveTextEditor, setActiveTextEditor } from '../utils/activeTextEditor'
import { langFromPath } from '../utils/lang'
import './viewers.css'

interface Props {
  content: string
  editable: boolean
  path: string
  name: string
  languageHint?: string
  /** Focus the editor once it mounts (e.g. new untitled file). */
  autoFocus?: boolean
  /** False while the tab is kept mounted but hidden. */
  active?: boolean
  onChange: (v: string) => void
}

function focusEditor(ed: { focus?: () => void } | null | undefined) {
  try {
    ed?.focus?.()
  } catch {
    /* ignore */
  }
}

export function TextView({
  content,
  editable,
  path,
  name,
  languageHint,
  autoFocus = false,
  active = true,
  onChange,
}: Props) {
  const editorRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const contentRef = useRef(content)
  const onChangeRef = useRef(onChange)
  const [monacoReady, setMonacoReady] = useState(isMonacoReady())
  const lineCount = useMemo(() => Math.max(1, content.split(/\r?\n/).length), [content])
  const language = languageHint || langFromPath(path, name)
  const useFastEditor = autoFocus && editable && !monacoReady
  contentRef.current = content
  onChangeRef.current = onChange

  useEffect(() => {
    void ensureMonaco().catch(() => {})
    if (monacoReady) return
    return whenMonacoReady(() => setMonacoReady(true))
  }, [monacoReady])

  const goLine = useCallback((n: number) => {
    const ed = editorRef.current
    if (!ed) return
    const line = Math.min(lineCount, Math.max(1, n))
    ed.revealLineNearTop?.(line)
    ed.setPosition?.({ lineNumber: line, column: 1 })
    focusEditor(ed)
  }, [lineCount])

  useRegisterGoTo(
    active
      ? {
          kind: 'line',
          current: 1,
          max: lineCount,
          go: goLine,
        }
      : null,
  )

  useEffect(() => {
    if (!active || !editable) return
    const handle = {
      getValue: () => {
        const ed = editorRef.current
        if (ed?.getValue) return ed.getValue()
        if (textareaRef.current) return textareaRef.current.value
        return contentRef.current
      },
      getSelection: () => {
        const ed = editorRef.current
        const model = ed?.getModel?.()
        const sel = ed?.getSelection?.()
        if (model && sel && !sel.isEmpty?.()) {
          const startOffset = model.getOffsetAt(sel.getStartPosition())
          const endOffset = model.getOffsetAt(sel.getEndPosition())
          if (startOffset === endOffset) return null
          return {
            startOffset,
            endOffset,
            text: model.getValueInRange(sel),
          }
        }
        const ta = textareaRef.current
        if (ta && ta.selectionStart !== ta.selectionEnd) {
          return {
            startOffset: ta.selectionStart,
            endOffset: ta.selectionEnd,
            text: ta.value.slice(ta.selectionStart, ta.selectionEnd),
          }
        }
        return null
      },
      replaceRange: (startOffset: number, endOffset: number, text: string) => {
        const ed = editorRef.current
        const model = ed?.getModel?.()
        if (model && ed?.executeEdits) {
          const start = model.getPositionAt(startOffset)
          const end = model.getPositionAt(endOffset)
          ed.executeEdits('format-json', [{
            range: {
              startLineNumber: start.lineNumber,
              startColumn: start.column,
              endLineNumber: end.lineNumber,
              endColumn: end.column,
            },
            text,
          }])
          const next = ed.getValue?.() ?? contentRef.current
          onChangeRef.current(next)
          return next
        }
        const base = textareaRef.current?.value ?? contentRef.current
        const next = base.slice(0, startOffset) + text + base.slice(endOffset)
        onChangeRef.current(next)
        const ta = textareaRef.current
        if (ta) {
          const caret = startOffset + text.length
          window.requestAnimationFrame(() => {
            ta.focus()
            ta.setSelectionRange(caret, caret)
          })
        }
        return next
      },
    }
    setActiveTextEditor(handle)
    return () => {
      // Other mounted tabs must not wipe a newer active registration.
      if (getActiveTextEditor() === handle) setActiveTextEditor(null)
    }
  }, [active, editable])

  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => editorRef.current?.layout?.(), 0)
    return () => window.clearTimeout(t)
  }, [active])

  useEffect(() => {
    if (!autoFocus || !editable || !active) return
    let cancelled = false
    let attempts = 0
    const tick = () => {
      if (cancelled) return
      if (editorRef.current) {
        focusEditor(editorRef.current)
        // Toolbar/menu may reclaim focus right after mount; nudge once more.
        window.setTimeout(() => {
          if (!cancelled) focusEditor(editorRef.current)
        }, 80)
        return
      }
      attempts += 1
      if (attempts < 40) window.setTimeout(tick, 50)
    }
    tick()
    return () => {
      cancelled = true
    }
  }, [autoFocus, editable, active, path])

  return (
    <div className="viewer-single">
      <div className="md-view-bar">
        <GoToButton />
      </div>
      <div className="editor-wrap" style={{ flex: 1 }}>
        {useFastEditor ? (
          <textarea
            ref={textareaRef}
            className="editor-fast-input"
            value={content}
            autoFocus
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <MonacoEditor
            height="100%"
            language={language}
            theme="vs"
            value={content}
            onMount={(ed) => {
              editorRef.current = ed
              if (autoFocus && editable) {
                focusEditor(ed)
                window.setTimeout(() => focusEditor(ed), 0)
              }
            }}
            onChange={(v) => {
              if (editable) onChange(v ?? '')
            }}
            options={{
              readOnly: !editable,
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              scrollBeyondLastLine: true,
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  )
}
