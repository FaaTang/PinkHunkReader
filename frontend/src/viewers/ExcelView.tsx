import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import { ReadBytes } from '../../wailsjs/go/app/App'
import { ClipboardSetText } from '../../wailsjs/runtime/runtime'
import { ViewerLoading } from '../components/ViewerLoading'
import { toUint8Array } from '../util/bytes'
import './viewers.css'

/** Overlap tip into the cell so the pointer can reach Copy without crossing a gap / next row. */
const CELL_TIP_OVERLAP_PX = 10

interface Props {
  path: string
  name: string
}

type SheetGrid = {
  name: string
  rows: string[][]
}

type CellHoverTip = {
  text: string
  row: number
  col: number
}

const MAX_ROWS = 2000
const MAX_COLS = 100
/** Approximate glyph width for 12px monospace used by `.office-sheet`. */
const COL_CHAR_PX = 7.2
const COL_PAD_PX = 16
const COL_MIN_PX = 48
const COL_MAX_PX = 480
/** Double-click autofit may grow wider than the initial estimate clamp. */
const COL_AUTOFIT_MAX_PX = 1200
const ROW_NUM_COL_PX = 44

export function ExcelView({ path, name }: Props) {
  const [sheets, setSheets] = useState<SheetGrid[]>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [truncated, setTruncated] = useState(false)
  /** Per-sheet column widths; missing entry means use content estimate. */
  const [widthBySheet, setWidthBySheet] = useState<Record<number, number[]>>({})

  const tableRef = useRef<HTMLTableElement | null>(null)
  const colElsRef = useRef<(HTMLTableColElement | null)[]>([])
  const widthsLiveRef = useRef<number[]>([])
  const dragRef = useRef<{
    col: number
    startX: number
    startW: number
    pointerId: number
  } | null>(null)
  const cellTipRef = useRef<HTMLDivElement | null>(null)
  const cellTipPinnedRef = useRef(false)
  const cellTipHideTimerRef = useRef<number | null>(null)
  const cellTipPosRef = useRef({ x: 0, y: 0, top: 0 })
  const cellTipKeyRef = useRef('')
  const [cellTip, setCellTip] = useState<CellHoverTip | null>(null)
  const [cellTipCopied, setCellTipCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setSheets([])
    setActive(0)
    setTruncated(false)
    setWidthBySheet({})

    ;(async () => {
      try {
        const bytes = await ReadBytes(path)
        const u8 = toUint8Array(bytes)
        const wb = XLSX.read(u8, { type: 'array', cellDates: true })
        if (cancelled) return

        let clipped = false
        const grids: SheetGrid[] = wb.SheetNames.map((sheetName) => {
          const sheet = wb.Sheets[sheetName]
          const raw = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
            header: 1,
            defval: '',
            raw: false,
          }) as unknown[][]
          if (raw.length > MAX_ROWS) clipped = true
          const sliced = raw.slice(0, MAX_ROWS)
          const rows = sliced.map((row) => {
            const cells = Array.isArray(row) ? row : []
            if (cells.length > MAX_COLS) clipped = true
            return cells.slice(0, MAX_COLS).map(cellToString)
          })
          return { name: sheetName, rows }
        })

        setSheets(grids)
        setTruncated(clipped)
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
  }, [path])

  const current = sheets[active] ?? null
  const colCount = useMemo(() => {
    if (!current) return 0
    let max = 0
    for (const row of current.rows) max = Math.max(max, row.length)
    return max
  }, [current])

  const estimatedWidths = useMemo(() => {
    if (!current || colCount === 0) return [] as number[]
    return estimateColWidths(current.rows, colCount, COL_MAX_PX)
  }, [current, colCount])

  const colWidths = widthBySheet[active] ?? estimatedWidths

  useEffect(() => {
    widthsLiveRef.current = colWidths.slice()
  }, [colWidths])

  const tableWidth = useMemo(() => {
    if (colWidths.length === 0) return undefined
    return ROW_NUM_COL_PX + colWidths.reduce((sum, w) => sum + w, 0)
  }, [colWidths])

  const applyLiveWidths = (next: number[]) => {
    widthsLiveRef.current = next
    const cols = colElsRef.current
    for (let i = 0; i < next.length; i++) {
      const el = cols[i]
      if (el) el.style.width = `${next[i]}px`
    }
    const table = tableRef.current
    if (table) {
      table.style.width = `${ROW_NUM_COL_PX + next.reduce((sum, w) => sum + w, 0)}px`
    }
  }

  const commitWidths = (next: number[]) => {
    setWidthBySheet((prev) => ({ ...prev, [active]: next.slice() }))
  }

  const onResizePointerDown = (col: number, e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startW = widthsLiveRef.current[col] ?? COL_MIN_PX
    dragRef.current = { col, startX: e.clientX, startW, pointerId: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onResizePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const delta = e.clientX - drag.startX
    const nextW = clamp(drag.startW + delta, COL_MIN_PX, COL_AUTOFIT_MAX_PX)
    const next = widthsLiveRef.current.slice()
    if (next[drag.col] === nextW) return
    next[drag.col] = nextW
    applyLiveWidths(next)
  }

  const onResizePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    commitWidths(widthsLiveRef.current)
  }

  const onResizeDoubleClick = (col: number, e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = null
    if (!current) return
    const fitted = estimateColWidth(current.rows, col, COL_AUTOFIT_MAX_PX)
    const next = widthsLiveRef.current.slice()
    next[col] = fitted
    applyLiveWidths(next)
    commitWidths(next)
  }

  const clearCellTipHideTimer = () => {
    if (cellTipHideTimerRef.current != null) {
      window.clearTimeout(cellTipHideTimerRef.current)
      cellTipHideTimerRef.current = null
    }
  }

  const hideCellTip = () => {
    clearCellTipHideTimer()
    cellTipPinnedRef.current = false
    cellTipKeyRef.current = ''
    setCellTip(null)
    setCellTipCopied(false)
  }

  const scheduleHideCellTip = () => {
    clearCellTipHideTimer()
    cellTipHideTimerRef.current = window.setTimeout(() => {
      if (cellTipPinnedRef.current) return
      hideCellTip()
    }, 280)
  }

  /** Place tip overlapping the cell edge — no gap — so Copy stays reachable. */
  const placeCellTip = (anchorLeft: number, cellTop: number, cellBottom: number) => {
    const el = cellTipRef.current
    if (!el) return
    const tipW = el.offsetWidth || 280
    const tipH = el.offsetHeight || 80
    const maxX = window.innerWidth - tipW - 8
    const maxY = window.innerHeight - tipH - 8
    let x = anchorLeft
    // Prefer below, overlapping into the cell; flip above if it would leave the viewport.
    let y = cellBottom - CELL_TIP_OVERLAP_PX
    if (y + tipH > window.innerHeight - 8) {
      y = cellTop - tipH + CELL_TIP_OVERLAP_PX
    }
    if (x + tipW > window.innerWidth - 8) {
      x = maxX
    }
    x = Math.max(8, Math.min(x, maxX))
    y = Math.max(8, Math.min(y, maxY))
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }

  const showCellTip = (row: number, col: number, text: string, td: HTMLElement) => {
    clearCellTipHideTimer()
    const key = `${row}:${col}`
    // Same cell: keep tip still so the pointer can reach Copy without the panel fleeing.
    if (cellTipKeyRef.current === key) return
    const rect = td.getBoundingClientRect()
    cellTipPosRef.current = { x: rect.left, y: rect.bottom, top: rect.top }
    cellTipKeyRef.current = key
    setCellTipCopied(false)
    setCellTip({ text, row, col })
  }

  useLayoutEffect(() => {
    if (!cellTip) return
    const pos = cellTipPosRef.current
    placeCellTip(pos.x, pos.top, pos.y)
  }, [cellTip])

  const pointerOverCellTip = (clientX: number, clientY: number) => {
    const tip = cellTipRef.current
    if (!tip) return false
    const r = tip.getBoundingClientRect()
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  }

  const onSheetPointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) return
    // Tip is portaled outside the sheet; if it overlays the table, treat that as pinned hover.
    if (pointerOverCellTip(e.clientX, e.clientY)) {
      cellTipPinnedRef.current = true
      clearCellTipHideTimer()
      return
    }
    if (cellTipPinnedRef.current) return
    const td = (e.target as HTMLElement | null)?.closest?.('td')
    if (!td || !tableRef.current?.contains(td)) {
      scheduleHideCellTip()
      return
    }
    const row = Number(td.getAttribute('data-r'))
    const col = Number(td.getAttribute('data-c'))
    if (!Number.isFinite(row) || !Number.isFinite(col) || !current) {
      scheduleHideCellTip()
      return
    }
    const text = current.rows[row]?.[col] ?? ''
    if (!text) {
      scheduleHideCellTip()
      return
    }
    showCellTip(row, col, text, td)
  }

  const onSheetPointerLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cellTipPinnedRef.current) return
    const related = e.relatedTarget as Node | null
    if (related && cellTipRef.current?.contains(related)) {
      cellTipPinnedRef.current = true
      clearCellTipHideTimer()
      return
    }
    // Leaving into the tip overlay (relatedTarget may be null across portal / WebView).
    if (pointerOverCellTip(e.clientX, e.clientY)) {
      cellTipPinnedRef.current = true
      clearCellTipHideTimer()
      return
    }
    scheduleHideCellTip()
  }

  const onSheetScroll = () => {
    hideCellTip()
  }

  const onCopyCellTip = async () => {
    if (!cellTip?.text) return
    const ok = await copyTextToClipboard(cellTip.text)
    if (ok) {
      setCellTipCopied(true)
      window.setTimeout(() => setCellTipCopied(false), 1200)
    }
  }

  useEffect(() => {
    return () => clearCellTipHideTimer()
  }, [])

  useEffect(() => {
    clearCellTipHideTimer()
    cellTipPinnedRef.current = false
    cellTipKeyRef.current = ''
    setCellTip(null)
    setCellTipCopied(false)
  }, [active, path])

  if (error) {
    return <div className="empty" style={{ color: 'var(--ph-danger)' }}>{error}</div>
  }

  return (
    <div className="viewer-single office-root">
      <div className="office-toolbar">
        <span className="office-toolbar-label">Excel · read-only</span>
        {truncated ? (
          <span className="office-toolbar-hint">
            Showing first {MAX_ROWS} rows × {MAX_COLS} cols
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        {sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            className={`toolbar-btn${i === active ? ' active-toggle' : ''}`}
            onClick={() => setActive(i)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="office-body media-wrap-loading-host">
        <ViewerLoading visible={loading} label="Loading Excel…" detail={name} />
        {!loading && current ? (
          <div
            className="office-sheet-wrap"
            onMouseMove={onSheetPointerMove}
            onMouseLeave={onSheetPointerLeave}
            onScroll={onSheetScroll}
          >
            {current.rows.length === 0 ? (
              <div className="empty">Empty sheet</div>
            ) : (
              <table ref={tableRef} className="office-sheet" style={{ width: tableWidth }}>
                <colgroup>
                  <col style={{ width: ROW_NUM_COL_PX }} />
                  {colWidths.map((w, i) => (
                    <col
                      key={i}
                      ref={(el) => {
                        colElsRef.current[i] = el
                      }}
                      style={{ width: w }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="office-corner" aria-hidden="true" />
                    {Array.from({ length: colCount }, (_, ci) => (
                      <th key={ci} className="office-col-letter" scope="col">
                        {colLetter(ci)}
                        <span
                          className="office-col-resize"
                          title="Drag to resize · double-click to fit"
                          onPointerDown={(e) => onResizePointerDown(ci, e)}
                          onPointerMove={onResizePointerMove}
                          onPointerUp={onResizePointerUp}
                          onPointerCancel={onResizePointerUp}
                          onDoubleClick={(e) => onResizeDoubleClick(ci, e)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.rows.map((row, ri) => (
                    <tr key={ri}>
                      <th className="office-row-num">{ri + 1}</th>
                      {Array.from({ length: colCount }, (_, ci) => {
                        const text = row[ci] ?? ''
                        return (
                          <td key={ci} data-r={ri} data-c={ci}>
                            {text}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </div>
      {cellTip
        ? createPortal(
            <div
              ref={cellTipRef}
              className="office-cell-tip"
              role="tooltip"
              onMouseEnter={() => {
                cellTipPinnedRef.current = true
                clearCellTipHideTimer()
              }}
              onMouseLeave={() => {
                cellTipPinnedRef.current = false
                scheduleHideCellTip()
              }}
            >
              <pre className="office-cell-tip-text">{cellTip.text}</pre>
              <button
                type="button"
                className="office-cell-tip-copy"
                title="Copy cell"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  void onCopyCellTip()
                }}
                onPointerDown={(e) => {
                  // Keep tip pinned through the click; sheet leave must not race-hide it.
                  e.stopPropagation()
                  cellTipPinnedRef.current = true
                  clearCellTipHideTimer()
                }}
              >
                {cellTipCopied ? 'Copied' : 'Copy'}
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  // Wails production WebView often blocks navigator.clipboard; runtime API is reliable.
  try {
    const ok = await ClipboardSetText(text)
    if (ok) return true
  } catch {
    /* fall through */
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function cellToString(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toLocaleString()
  return String(v)
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Excel-style column label: 0 → A, 25 → Z, 26 → AA. */
function colLetter(index: number): string {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/** Fit each column to the longest display line, clamped so huge cells stay scrollable. */
function estimateColWidths(rows: string[][], colCount: number, maxPx: number): number[] {
  const widths = Array.from({ length: colCount }, () => COL_MIN_PX)
  for (let ci = 0; ci < colCount; ci++) {
    widths[ci] = estimateColWidth(rows, ci, maxPx)
  }
  return widths
}

function estimateColWidth(rows: string[][], col: number, maxPx: number): number {
  let width = COL_MIN_PX
  for (const row of rows) {
    const text = row[col] ?? ''
    if (!text) continue
    let maxLineChars = 0
    for (const line of text.split('\n')) {
      maxLineChars = Math.max(maxLineChars, displayWidth(line))
    }
    const px = Math.ceil(maxLineChars * COL_CHAR_PX) + COL_PAD_PX
    width = Math.max(width, Math.min(maxPx, px))
  }
  return width
}

/** Prefer wider slots for CJK / fullwidth glyphs vs ASCII. */
function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    w += code > 0xff ? 2 : 1
  }
  return w
}
