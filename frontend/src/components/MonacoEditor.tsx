import { useEffect, useState } from 'react'
import Editor, { type EditorProps } from '@monaco-editor/react'
import { ViewerLoading } from './ViewerLoading'
import { ensureMonaco, isMonacoReady, whenMonacoReady } from '../monaco'

/** Thin wrapper that waits for local monaco before mounting the editor. */
export function MonacoEditor(props: EditorProps) {
  const [ready, setReady] = useState(isMonacoReady())

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
        <ViewerLoading visible label="Loading editor…" />
      </div>
    )
  }

  return (
    <Editor
      loading={
        <div style={{ height: '100%', minHeight: 120, position: 'relative' }}>
          <ViewerLoading visible label="Loading editor…" />
        </div>
      }
      {...props}
    />
  )
}
