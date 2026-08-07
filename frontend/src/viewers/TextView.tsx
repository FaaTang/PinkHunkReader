import { useCallback, useMemo, useRef } from 'react'
import { MonacoEditor } from '../components/MonacoEditor'
import { GoToButton } from '../components/GoToButton'
import { useRegisterGoTo } from '../settings/AppSettingsContext'
import { langFromPath } from '../utils/lang'
import './viewers.css'

interface Props {
  content: string
  editable: boolean
  path: string
  onChange: (v: string) => void
}

export function TextView({ content, editable, path, onChange }: Props) {
  const editorRef = useRef<any>(null)
  const lineCount = useMemo(() => Math.max(1, content.split(/\r?\n/).length), [content])

  const goLine = useCallback((n: number) => {
    const ed = editorRef.current
    if (!ed) return
    const line = Math.min(lineCount, Math.max(1, n))
    ed.revealLineNearTop?.(line)
    ed.setPosition?.({ lineNumber: line, column: 1 })
    ed.focus?.()
  }, [lineCount])

  useRegisterGoTo({
    kind: 'line',
    current: 1,
    max: lineCount,
    go: goLine,
  })

  return (
    <div className="viewer-single">
      <div className="md-view-bar">
        <GoToButton />
      </div>
      <div className="editor-wrap" style={{ flex: 1 }}>
        <MonacoEditor
          height="100%"
          language={langFromPath(path)}
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
  )
}
