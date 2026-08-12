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
  /** False while the tab is kept mounted but hidden. */
  active?: boolean
}

interface PreparedDoc {
  html: string
  headings: MdHeadingItem[]
}

const PAGE_WIDTH = 816

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

export function WordView({ path, name, active = true }: Props) {
  const docRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState('')
  const [headings, setHeadings] = useState<MdHeadingItem[]>([])
  const [messages, setMessages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeLine, setActiveLine] = useState(1)
  const [outlineOpen, setOutlineOpen] = usePersistedOutlineOpen(path, true)
  /** 100% = fit page width to the viewer; scales up/down with fullscreen. */
  const [zoomPct, setZoomPct] = useState(100)
  const [fitWidth, setFitWidth] = useState(PAGE_WIDTH)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || loading || !active) return
    const measure = () => {
      const w = el.clientWidth
      if (w <= 0) return
      setFitWidth(Math.max(320, w - 48))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [loading, outlineOpen, active])

  const fitScale = (fitWidth / PAGE_WIDTH) * (zoomPct / 100)

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
    if (!active || loading || !html) return
    const scroll = scrollRef.current
    const root = docRef.current
    if (!scroll || !root) return

    let timer = 0
    const syncActive = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const heads = root.querySelectorAll('h1,h2,h3,h4,h5,h6')
        if (!heads.length) return
        const top = scroll.getBoundingClientRect().top + 8
        let current = 1
        heads.forEach((node, index) => {
          if (node.getBoundingClientRect().top <= top) {
            current = index + 1
          }
        })
        setActiveLine(current)
      }, 120)
    }

    scroll.addEventListener('scroll', syncActive, { passive: true })
    syncActive()
    return () => {
      window.clearTimeout(timer)
      scroll.removeEventListener('scroll', syncActive)
    }
  }, [active, loading, html, fitScale])

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
        <button type="button" className="toolbar-btn" onClick={() => setZoomPct((z) => Math.max(50, z - 10))} title="Zoom out">
          −
        </button>
        <button
          type="button"
          className="toolbar-btn pdf-zoom-label"
          onClick={() => setZoomPct(100)}
          title="Reset to fit width"
        >
          {zoomPct}%
        </button>
        <button type="button" className="toolbar-btn" onClick={() => setZoomPct((z) => Math.min(300, z + 10))} title="Zoom in">
          +
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
            <div className="office-doc-scroll" ref={scrollRef}>
              <div
                className="office-doc preview-wrap"
                ref={docRef}
                style={{
                  width: PAGE_WIDTH,
                  zoom: fitScale,
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
