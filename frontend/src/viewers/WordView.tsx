import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mammoth from 'mammoth'
import { ReadBytes } from '../../wailsjs/go/app/App'
import { MdOutline, type MdHeadingItem } from '../components/MdOutline'
import { ViewerLoading } from '../components/ViewerLoading'
import { usePersistedOutlineOpen } from '../hooks/usePersistedOutlineOpen'
import { toUint8Array } from '../util/bytes'
import './viewers.css'

interface Props {
  path: string
  name: string
}

interface PreparedDoc {
  html: string
  headings: MdHeadingItem[]
}

/** Tag mammoth HTML headings with stable ids and collect outline entries. */
export function prepareWordHtml(rawHtml: string): PreparedDoc {
  const source = (rawHtml || '').trim() || '<p>(empty document)</p>'
  const doc = new DOMParser().parseFromString(`<div id="word-root">${source}</div>`, 'text/html')
  const root = doc.getElementById('word-root')
  if (!root) {
    return { html: source, headings: [] }
  }

  const headings: MdHeadingItem[] = []
  const nodes = root.querySelectorAll('h1,h2,h3,h4,h5,h6')
  nodes.forEach((node, index) => {
    const tag = node.tagName.toLowerCase()
    const level = Number(tag.slice(1)) || 1
    const title = (node.textContent || '').trim()
    if (!title) return
    const line = index + 1
    node.id = `word-h-${line}`
    headings.push({ level, title, line })
  })

  return { html: root.innerHTML, headings }
}

export function WordView({ path, name }: Props) {
  const docRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState('')
  const [headings, setHeadings] = useState<MdHeadingItem[]>([])
  const [messages, setMessages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeLine, setActiveLine] = useState(1)
  const [outlineOpen, setOutlineOpen] = usePersistedOutlineOpen(path, true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setHtml('')
    setHeadings([])
    setMessages([])
    setActiveLine(1)

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
        const prepared = prepareWordHtml(result.value || '')
        setHtml(prepared.html)
        setHeadings(prepared.headings)
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

  const jumpToHeading = useCallback((line: number) => {
    const root = docRef.current
    if (!root) return
    const el = root.querySelector(`#word-h-${line}`)
    if (!el) return
    el.scrollIntoView({ block: 'start' })
    setActiveLine(line)
  }, [])

  useEffect(() => {
    if (loading || !html) return
    const root = docRef.current
    if (!root) return

    let timer = 0
    const syncActive = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const heads = root.querySelectorAll('h1,h2,h3,h4,h5,h6')
        if (!heads.length) return
        const top = root.getBoundingClientRect().top + 8
        let current = 1
        heads.forEach((node, index) => {
          if (node.getBoundingClientRect().top <= top) {
            current = index + 1
          }
        })
        setActiveLine(current)
      }, 120)
    }

    root.addEventListener('scroll', syncActive, { passive: true })
    syncActive()
    return () => {
      window.clearTimeout(timer)
      root.removeEventListener('scroll', syncActive)
    }
  }, [loading, html])

  const outlineEnabled = useMemo(() => headings.length > 0, [headings.length])

  if (error) {
    return <div className="empty" style={{ color: 'var(--ph-danger)' }}>{error}</div>
  }

  return (
    <div className="viewer-single office-root">
      <div className="office-toolbar">
        <button
          type="button"
          className={`toolbar-btn${outlineOpen && outlineEnabled ? ' active-toggle' : ''}`}
          disabled={!outlineEnabled}
          onClick={() => setOutlineOpen((o) => !o)}
          title={outlineEnabled ? (outlineOpen ? 'Hide outline' : 'Show outline') : 'No headings'}
        >
          {outlineOpen && outlineEnabled ? 'Hide outline' : 'Outline'}
        </button>
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
          <div className="office-split md-body">
            <MdOutline
              headings={headings}
              activeLine={activeLine}
              open={outlineOpen}
              onSelect={(line) => jumpToHeading(line)}
            />
            <div
              className="office-doc preview-wrap"
              ref={docRef}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
