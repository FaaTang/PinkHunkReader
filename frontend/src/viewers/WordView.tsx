import { useEffect, useState } from 'react'
import mammoth from 'mammoth'
import { ReadBytes } from '../../wailsjs/go/app/App'
import { ViewerLoading } from '../components/ViewerLoading'
import { toUint8Array } from '../util/bytes'
import './viewers.css'

interface Props {
  path: string
  name: string
}

export function WordView({ path, name }: Props) {
  const [html, setHtml] = useState('')
  const [messages, setMessages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setHtml('')
    setMessages([])

    const lower = name.toLowerCase()
    if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
      setError('Legacy .doc is not supported. Please save as .docx and open again.')
      setLoading(false)
      return
    }

    ;(async () => {
      try {
        const bytes = await ReadBytes(path)
        const u8 = toUint8Array(bytes)
        const ab = new ArrayBuffer(u8.byteLength)
        new Uint8Array(ab).set(u8)
        const result = await mammoth.convertToHtml({ arrayBuffer: ab })
        if (cancelled) return
        setHtml(result.value || '<p>(empty document)</p>')
        setMessages(
          (result.messages ?? [])
            .filter((m) => m.type === 'warning' || m.type === 'error')
            .map((m) => m.message)
            .slice(0, 8),
        )
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(String(e))
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [path, name])

  if (error) {
    return <div className="empty" style={{ color: 'var(--ph-danger)' }}>{error}</div>
  }

  return (
    <div className="viewer-single office-root">
      <div className="office-toolbar">
        <span className="office-toolbar-label">Word · read-only</span>
        {messages.length > 0 ? (
          <span className="office-toolbar-hint" title={messages.join('\n')}>
            {messages.length} conversion note{messages.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      <div className="office-body media-wrap-loading-host">
        <ViewerLoading visible={loading} label="Loading Word…" detail={name} />
        {!loading ? (
          <div className="office-doc preview-wrap" dangerouslySetInnerHTML={{ __html: html }} />
        ) : null}
      </div>
    </div>
  )
}
