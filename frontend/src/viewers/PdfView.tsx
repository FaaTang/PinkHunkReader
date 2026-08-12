import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { ReadBytes } from '../../wailsjs/go/app/App'
import { GoToButton } from '../components/GoToButton'
import { ViewerLoading } from '../components/ViewerLoading'
import { hasOutlinePreference, usePersistedOutlineOpen } from '../hooks/usePersistedOutlineOpen'
import { useRegisterGoTo } from '../settings/AppSettingsContext'
import './viewers.css'

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

interface Props {
  path: string
  /** False while the tab is kept mounted but hidden. */
  active?: boolean
}

interface OutlineNode {
  id: string
  title: string
  page: number | null
  items: OutlineNode[]
}

interface PageLayout {
  page: number
  width: number
  height: number
}

const RENDER_PAD = 1 // pages above/below viewport to keep painted

export function PdfView({ path, active = true }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const canvasElsRef = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const tasksRef = useRef<Map<number, pdfjs.RenderTask>>(new Map())
  const paintedRef = useRef<Set<number>>(new Set())
  const baseSizesRef = useRef<Map<number, { w: number; h: number }>>(new Map())
  const jumpInputRef = useRef<HTMLInputElement>(null)

  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(1)
  const [zoomPct, setZoomPct] = useState(100) // 100% = fit width
  const [fitWidth, setFitWidth] = useState(720)
  const [outline, setOutline] = useState<OutlineNode[]>([])
  const [outlineOpen, setOutlineOpen] = usePersistedOutlineOpen(path, true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const outlineScrollRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [jumpDraft, setJumpDraft] = useState('1')

  // Load document + outline once per path.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setPage(1)
    setJumpDraft('1')
    setOutline([])
    setExpandedIds(new Set())
    paintedRef.current.clear()
    baseSizesRef.current.clear()

    ;(async () => {
      try {
        const bytes = await ReadBytes(path)
        const data = toUint8Array(bytes)
        const doc = await pdfjs.getDocument({ data }).promise
        if (cancelled) {
          await doc.destroy()
          return
        }
        docRef.current = doc

        // Cache natural page sizes (scale=1) for layout before exposing pageCount.
        const sizes = new Map<number, { w: number; h: number }>()
        for (let i = 1; i <= doc.numPages; i++) {
          const p = await doc.getPage(i)
          if (cancelled) return
          const v = p.getViewport({ scale: 1 })
          sizes.set(i, { w: v.width, h: v.height })
        }
        baseSizesRef.current = sizes
        setPageCount(doc.numPages)

        try {
          const raw = await doc.getOutline()
          if (!cancelled) {
            const nodes = await mapOutline(doc, raw)
            setOutline(nodes)
            if (!hasOutlinePreference(path)) {
              setOutlineOpen(nodes.length > 0)
            }
            // Default: expand top-level sections that have children.
            setExpandedIds(new Set(nodes.filter((n) => n.items.length > 0).map((n) => n.id)))
          }
        } catch {
          if (!cancelled) setOutline([])
        }

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
      if (navLockTimerRef.current) window.clearTimeout(navLockTimerRef.current)
      navLockRef.current = null
      for (const t of tasksRef.current.values()) {
        try {
          t.cancel()
        } catch {
          /* ignore */
        }
      }
      tasksRef.current.clear()
      paintedRef.current.clear()
      void docRef.current?.destroy()
      docRef.current = null
    }
  }, [path])

  // Track scroll container width for fit-to-width zoom (incl. fullscreen / sidebar hide).
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !active) return
    const measure = () => {
      const w = el.clientWidth
      if (w <= 0) return
      setFitWidth(Math.max(320, w - 40))
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

  // Fit-width / zoom changes must invalidate painted canvases; otherwise pages keep the old
  // bitmap while the slot grows (fullscreen looks like content did not scale).
  const layoutKey = `${fitWidth}:${zoomPct}:${pageCount}`
  useEffect(() => {
    if (loading || pageCount <= 0) return
    paintedRef.current.clear()
  }, [layoutKey, loading, pageCount])

  const layouts: PageLayout[] = useMemo(() => {
    const out: PageLayout[] = []
    for (let i = 1; i <= pageCount; i++) {
      const base = baseSizesRef.current.get(i) ?? { w: 595, h: 842 }
      const scale = (fitWidth / base.w) * (zoomPct / 100)
      out.push({
        page: i,
        width: Math.floor(base.w * scale),
        height: Math.floor(base.h * scale),
      })
    }
    return out
  }, [pageCount, fitWidth, zoomPct, loading])

  const navLockRef = useRef<number | null>(null)
  const navLockTimerRef = useRef<number | null>(null)

  const scrollToPage = useCallback((n: number, behavior: ScrollBehavior = 'auto') => {
    const scroll = scrollRef.current
    const el = pageElsRef.current.get(n)
    if (!scroll || !el) return

    // Lock indicator to the requested page so syncVisible cannot fight mid-scroll.
    navLockRef.current = n
    if (navLockTimerRef.current) window.clearTimeout(navLockTimerRef.current)
    setPage(n)
    setJumpDraft(String(n))

    const scrollRect = scroll.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const top = elRect.top - scrollRect.top + scroll.scrollTop
    scroll.scrollTo({ top, behavior })

    // Keep lock until scroll settles (smooth) or briefly after instant jump.
    const holdMs = behavior === 'smooth' ? 450 : 80
    navLockTimerRef.current = window.setTimeout(() => {
      navLockRef.current = null
      navLockTimerRef.current = null
    }, holdMs)
  }, [])

  const applyJump = useCallback(() => {
    const n = Math.min(pageCount, Math.max(1, Math.floor(Number(jumpDraft) || 1)))
    setJumpDraft(String(n))
    // Instant jump (browser-like). All page slots already have layout height —
    // virtualization only paints nearby canvases; it does not require scrolling through them.
    scrollToPage(n, 'auto')
  }, [jumpDraft, pageCount, scrollToPage])

  useRegisterGoTo(
    active && pageCount > 0
      ? {
          kind: 'page',
          current: page,
          max: pageCount,
          go: (n) => scrollToPage(n, 'auto'),
        }
      : null,
  )

  // Virtualized render: paint pages near the viewport; release others.
  const syncGenRef = useRef(0)
  const syncVisible = useCallback(async () => {
    const doc = docRef.current
    const scroll = scrollRef.current
    if (!doc || !scroll || loading || !active) return
    const gen = ++syncGenRef.current

    const scrollRect = scroll.getBoundingClientRect()
    const viewTop = scrollRect.top
    const viewBottom = scrollRect.bottom
    // Prefer the page whose top edge last crossed the viewport top (stable while scrolling).
    let current = 1
    let bestTop = -Infinity

    const need = new Set<number>()
    for (const layout of layouts) {
      const el = pageElsRef.current.get(layout.page)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.top <= viewTop + 48 && r.top > bestTop) {
        bestTop = r.top
        current = layout.page
      }
      if (r.bottom >= viewTop - 200 && r.top <= viewBottom + 200) {
        for (let d = -RENDER_PAD; d <= RENDER_PAD; d++) {
          const p = layout.page + d
          if (p >= 1 && p <= pageCount) need.add(p)
        }
      }
    }

    // While Prev/Next/jump is in flight, keep the locked page number stable.
    if (navLockRef.current == null) {
      setPage((prev) => (prev === current ? prev : current))
      setJumpDraft((prev) => (prev === String(current) ? prev : String(current)))
    }

    for (const painted of [...paintedRef.current]) {
      if (need.has(painted)) continue
      const task = tasksRef.current.get(painted)
      if (task) {
        try {
          task.cancel()
        } catch {
          /* ignore */
        }
        tasksRef.current.delete(painted)
      }
      const canvas = canvasElsRef.current.get(painted)
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
        canvas.width = 0
        canvas.height = 0
      }
      paintedRef.current.delete(painted)
    }

    if (gen !== syncGenRef.current) return

    const dpr = Math.max(window.devicePixelRatio || 1, 2)
    for (const p of need) {
      if (gen !== syncGenRef.current) return
      if (paintedRef.current.has(p)) continue
      const layout = layouts.find((l) => l.page === p)
      const canvas = canvasElsRef.current.get(p)
      if (!layout || !canvas) continue

      try {
        const pdfPage = await doc.getPage(p)
        if (gen !== syncGenRef.current) return
        const cssScale = layout.width / (baseSizesRef.current.get(p)?.w ?? layout.width)
        const viewport = pdfPage.getViewport({ scale: cssScale * dpr })
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) continue
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${layout.width}px`
        canvas.style.height = `${layout.height}px`
        ctx.setTransform(1, 0, 0, 1, 0, 0)

        const prevTask = tasksRef.current.get(p)
        if (prevTask) {
          try {
            prevTask.cancel()
          } catch {
            /* ignore */
          }
        }
        const task = pdfPage.render({
          canvasContext: ctx,
          viewport,
          canvas,
        } as any)
        tasksRef.current.set(p, task)
        await task.promise
        if (tasksRef.current.get(p) === task) {
          tasksRef.current.delete(p)
          paintedRef.current.add(p)
        }
      } catch (e: any) {
        if (e?.name === 'RenderingCancelledException') continue
      }
    }
  }, [layouts, loading, pageCount, active])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || loading || !active) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        void syncVisible()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // Native wheel = smooth continuous scroll (no page-flip hijack).
    // Re-paint when tab becomes visible again (hidden tabs skip sync to keep scroll).
    void syncVisible()
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
    }
  }, [loading, syncVisible, zoomPct, layouts, active])

  const zoomBy = (delta: number) => {
    setZoomPct((z) => Math.min(300, Math.max(50, z + delta)))
    // Force re-paint at new scale.
    paintedRef.current.clear()
  }

  // Best outline entry for the current page: last item whose page <= current (depth-first).
  const activeOutline = useMemo(() => findOutlineForPage(outline, page), [outline, page])

  // Keep ancestors expanded and scroll the active outline row into view.
  useEffect(() => {
    if (!active || !activeOutline) return
    setExpandedIds((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const id of activeOutline.ancestorIds) {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
    const t = window.setTimeout(() => {
      const el = outlineScrollRef.current?.querySelector(
        `[data-outline-id="${CSS.escape(activeOutline.node.id)}"]`,
      ) as HTMLElement | null
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 50)
    return () => window.clearTimeout(t)
  }, [active, activeOutline])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="viewer-single pdf-root">
      <div className="pdf-toolbar">
        <GoToButton />
        <button
          type="button"
          className={`toolbar-btn${outlineOpen && outline.length > 0 ? ' active-toggle' : ''}`}
          disabled={outline.length === 0}
          onClick={() => setOutlineOpen((o) => !o)}
          title={outline.length ? (outlineOpen ? 'Hide outline' : 'Show outline') : 'No outline in this PDF'}
        >
          {outlineOpen && outline.length > 0 ? 'Hide outline' : 'Outline'}
        </button>

        <button type="button" className="toolbar-btn" disabled={page <= 1} onClick={() => scrollToPage(page - 1)}>
          Prev
        </button>
        <form
          className="pdf-jump"
          onSubmit={(e) => {
            e.preventDefault()
            applyJump()
          }}
        >
          <input
            ref={jumpInputRef}
            className="pdf-jump-input"
            value={jumpDraft}
            onChange={(e) => setJumpDraft(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={applyJump}
            aria-label="Page number"
          />
          <span className="pdf-jump-total">/ {pageCount || '—'}</span>
        </form>
        <button
          type="button"
          className="toolbar-btn"
          disabled={!pageCount || page >= pageCount}
          onClick={() => scrollToPage(page + 1)}
        >
          Next
        </button>

        <span className="pdf-toolbar-sep" />

        <button type="button" className="toolbar-btn" onClick={() => zoomBy(-10)} title="Zoom out">
          −
        </button>
        <button
          type="button"
          className="toolbar-btn pdf-zoom-label"
          onClick={() => {
            paintedRef.current.clear()
            setZoomPct(100)
          }}
          title="Reset to fit width"
        >
          {zoomPct}%
        </button>
        <button type="button" className="toolbar-btn" onClick={() => zoomBy(10)} title="Zoom in">
          +
        </button>

        <span style={{ flex: 1 }} />
        {error ? <span style={{ color: 'var(--ph-danger)' }}>{error}</span> : null}
      </div>

      <div className="pdf-body">
        <ViewerLoading visible={loading && !error} label="Loading PDF…" />
        {outlineOpen && outline.length > 0 ? (
          <aside className="pdf-outline">
            <div className="outline-panel-head">
              <span className="outline-panel-title">Outline</span>
            </div>
            <div className="pdf-outline-scroll" ref={outlineScrollRef}>
              <OutlineTree
                nodes={outline}
                activeId={activeOutline?.node.id ?? null}
                expandedIds={expandedIds}
                onToggle={toggleExpand}
                onSelect={(p) => {
                  if (p) scrollToPage(p)
                }}
              />
            </div>
          </aside>
        ) : null}

        <div className="pdf-canvas-wrap" ref={scrollRef}>
          {layouts.map((layout) => (
            <div
              key={layout.page}
              className="pdf-page"
              style={{ width: layout.width, height: layout.height }}
              ref={(el) => {
                if (el) pageElsRef.current.set(layout.page, el)
                else pageElsRef.current.delete(layout.page)
              }}
              data-page={layout.page}
            >
              <canvas
                ref={(el) => {
                  if (el) canvasElsRef.current.set(layout.page, el)
                  else canvasElsRef.current.delete(layout.page)
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OutlineTree({
  nodes,
  activeId,
  expandedIds,
  onToggle,
  onSelect,
  depth = 0,
}: {
  nodes: OutlineNode[]
  activeId: string | null
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onSelect: (page: number | null) => void
  depth?: number
}) {
  return (
    <ul className="pdf-outline-list" style={{ paddingLeft: depth === 0 ? 0 : 10 }}>
      {nodes.map((n) => {
        const hasKids = n.items.length > 0
        const expanded = hasKids && expandedIds.has(n.id)
        const active = activeId === n.id
        return (
          <li key={n.id}>
            <div
              className={`pdf-outline-row${active ? ' active' : ''}`}
              data-outline-id={n.id}
              style={{ paddingLeft: 4 + depth * 2 }}
            >
              {hasKids ? (
                <button
                  type="button"
                  className="pdf-outline-twist"
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                  aria-expanded={expanded}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle(n.id)
                  }}
                >
                  {expanded ? '▾' : '▸'}
                </button>
              ) : (
                <span className="pdf-outline-twist spacer" />
              )}
              <button
                type="button"
                className="pdf-outline-item"
                onClick={() => onSelect(n.page)}
                title={n.page ? `Page ${n.page}` : n.title}
              >
                {n.title || '(untitled)'}
              </button>
            </div>
            {hasKids && expanded ? (
              <OutlineTree
                nodes={n.items}
                activeId={activeId}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Depth-first: pick the last outline node with page <= current, plus ancestor ids. */
function findOutlineForPage(
  nodes: OutlineNode[],
  page: number,
): { node: OutlineNode; ancestorIds: string[] } | null {
  const hit: {
    node: OutlineNode | null
    ancestorIds: string[]
    page: number
  } = { node: null, ancestorIds: [], page: -1 }

  const walk = (list: OutlineNode[], anc: string[]) => {
    for (const n of list) {
      if (n.page != null && n.page <= page && n.page >= hit.page) {
        hit.node = n
        hit.ancestorIds = anc
        hit.page = n.page
      }
      if (n.items.length) walk(n.items, [...anc, n.id])
    }
  }
  walk(nodes, [])
  return hit.node ? { node: hit.node, ancestorIds: hit.ancestorIds } : null
}

async function mapOutline(
  doc: pdfjs.PDFDocumentProxy,
  items: any[] | null | undefined,
  prefix = 'o',
): Promise<OutlineNode[]> {
  if (!items?.length) return []
  const out: OutlineNode[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const id = `${prefix}.${i}`
    const page = await destToPage(doc, item.dest)
    out.push({
      id,
      title: String(item.title ?? ''),
      page,
      items: await mapOutline(doc, item.items, id),
    })
  }
  return out
}

async function destToPage(doc: pdfjs.PDFDocumentProxy, dest: unknown): Promise<number | null> {
  try {
    let d: any = dest
    if (typeof d === 'string') {
      d = await doc.getDestination(d)
    }
    if (!Array.isArray(d) || !d[0]) return null
    const idx = await doc.getPageIndex(d[0])
    return idx + 1
  } catch {
    return null
  }
}

function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (Array.isArray(data)) return new Uint8Array(data)
  if (typeof data === 'string') {
    const bin = atob(data)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  throw new Error('Unable to parse PDF bytes')
}
