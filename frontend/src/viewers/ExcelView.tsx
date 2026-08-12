import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { ReadBytes } from '../../wailsjs/go/app/App'
import { ViewerLoading } from '../components/ViewerLoading'
import { toUint8Array } from '../util/bytes'
import './viewers.css'

interface Props {
  path: string
  name: string
}

type SheetGrid = {
  name: string
  rows: string[][]
}

const MAX_ROWS = 2000
const MAX_COLS = 100
/** Approximate glyph width for 12px monospace used by `.office-sheet`. */
const COL_CHAR_PX = 7.2
const COL_PAD_PX = 16
const COL_MIN_PX = 48
const COL_MAX_PX = 480
const ROW_NUM_COL_PX = 44

export function ExcelView({ path, name }: Props) {
  const [sheets, setSheets] = useState<SheetGrid[]>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setSheets([])
    setActive(0)
    setTruncated(false)

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

  const colWidths = useMemo(() => {
    if (!current || colCount === 0) return [] as number[]
    return estimateColWidths(current.rows, colCount)
  }, [current, colCount])

  const tableWidth = useMemo(() => {
    if (colWidths.length === 0) return undefined
    return ROW_NUM_COL_PX + colWidths.reduce((sum, w) => sum + w, 0)
  }, [colWidths])

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
          <div className="office-sheet-wrap">
            {current.rows.length === 0 ? (
              <div className="empty">Empty sheet</div>
            ) : (
              <table className="office-sheet" style={{ width: tableWidth }}>
                <colgroup>
                  <col style={{ width: ROW_NUM_COL_PX }} />
                  {colWidths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <tbody>
                  {current.rows.map((row, ri) => (
                    <tr key={ri}>
                      <th className="office-row-num">{ri + 1}</th>
                      {Array.from({ length: colCount }, (_, ci) => {
                        const text = row[ci] ?? ''
                        return (
                          <td key={ci} title={text || undefined}>
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
    </div>
  )
}

function cellToString(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toLocaleString()
  return String(v)
}

/** Fit each column to the longest display line, clamped so huge cells stay scrollable. */
function estimateColWidths(rows: string[][], colCount: number): number[] {
  const widths = Array.from({ length: colCount }, () => COL_MIN_PX)
  for (const row of rows) {
    for (let ci = 0; ci < colCount; ci++) {
      const text = row[ci] ?? ''
      if (!text) continue
      let maxLineChars = 0
      for (const line of text.split('\n')) {
        maxLineChars = Math.max(maxLineChars, displayWidth(line))
      }
      const px = Math.ceil(maxLineChars * COL_CHAR_PX) + COL_PAD_PX
      widths[ci] = Math.max(widths[ci], Math.min(COL_MAX_PX, px))
    }
  }
  return widths
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
