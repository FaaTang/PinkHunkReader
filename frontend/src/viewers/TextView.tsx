import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MonacoEditor } from '../components/MonacoEditor'
import { GoToButton } from '../components/GoToButton'
import { ensureMonaco, isMonacoReady, whenMonacoReady } from '../monaco'
import { useRegisterGoTo } from '../settings/AppSettingsContext'
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
  const [monacoReady, setMonacoReady] = useState(isMonacoReady())
  const lineCount = useMemo(() => Math.max(1, content.split(/\r?\n/).length), [content])
  const language = languageHint || langFromPath(path, name)
  const useFastEditor = autoFocus && editable && !monacoReady

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
