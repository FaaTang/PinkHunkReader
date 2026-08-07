import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MonacoEditor } from '../components/MonacoEditor'
import { GoToButton } from '../components/GoToButton'
import { MdOutline, parseMdHeadings } from '../components/MdOutline'
import { MdViewModeToggle, type MdViewMode } from '../components/MdViewModeToggle'
import { MarkdownPreview } from './MarkdownPreview'
import { usePersistedOutlineOpen } from '../hooks/usePersistedOutlineOpen'
import { useRegisterGoTo } from '../settings/AppSettingsContext'
import './viewers.css'

interface Props {
  path: string
  content: string
  editable: boolean
  onChange: (v: string) => void
}

export function MarkdownView({ path, content, editable, onChange }: Props) {
  const editorRef = useRef<any>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [activeLine, setActiveLine] = useState(1)
  const [mode, setMode] = useState<MdViewMode>('split')
  const [outlineOpen, setOutlineOpen] = usePersistedOutlineOpen(path, true)
  const headings = useMemo(() => parseMdHeadings(content), [content])

  useEffect(() => {
    const ed = editorRef.current
    if (!ed) return
    let timer = 0
    const syncLine = () => {
      const ranges = ed.getVisibleRanges?.() as { startLineNumber: number }[] | undefined
      const top = ranges?.[0]?.startLineNumber ?? 1
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setActiveLine(top), 120)
    }
    const d = ed.onDidScrollChange?.(syncLine)
    syncLine()
    return () => {
      window.clearTimeout(timer)
      d?.dispose?.()
    }
  }, [content])

  const jumpToLine = useCallback((line: number, title: string) => {
    const ed = editorRef.current
    ed?.revealLineNearTop?.(line)
    setActiveLine(line)
    const root = previewRef.current
    if (!root) return
    const heads = root.querySelectorAll('h1,h2,h3,h4,h5,h6')
    for (const h of Array.from(heads)) {
      if ((h.textContent ?? '').trim() === title) {
        h.scrollIntoView({ block: 'start' })
        break
      }
    }
  }, [])

  const lineCount = useMemo(() => Math.max(1, content.split(/\r?\n/).length), [content])
  useRegisterGoTo({
    kind: 'line',
    current: activeLine,
    max: lineCount,
    go: (n) => {
      const ed = editorRef.current
      const line = Math.min(lineCount, Math.max(1, n))
      ed?.revealLineNearTop?.(line)
      ed?.setPosition?.({ lineNumber: line, column: 1 })
      setActiveLine(line)
    },
  })

  // Relayout Monaco after showing the edit pane again.
  useEffect(() => {
    if (mode === 'preview') return
    const t = window.setTimeout(() => editorRef.current?.layout?.(), 0)
    return () => window.clearTimeout(t)
  }, [mode])

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
        </span>
      </div>
      <div className="md-body">
        <MdOutline
          headings={headings}
          activeLine={activeLine}
          open={outlineOpen}
          onSelect={jumpToLine}
        />
        <div className={`viewer-split mode-${mode}`}>
          <div className="viewer-pane viewer-pane-edit">
            <div className="pane-label">Edit</div>
            <div className="editor-wrap">
              <MonacoEditor
                height="100%"
                language="markdown"
                theme="light"
                value={content}
                onMount={(ed) => {
                  editorRef.current = ed
                }}
                onChange={(v) => {
                  if (editable) onChange(v ?? '')
                }}
                options={{
                  readOnly: !editable,
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
          <div className="viewer-pane viewer-pane-preview">
            <div className="pane-label">Preview</div>
            <div className="preview-wrap" ref={previewRef}>
              <MarkdownPreview content={content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
