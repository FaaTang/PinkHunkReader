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
              <table className="office-sheet">
                <tbody>
                  {current.rows.map((row, ri) => (
                    <tr key={ri}>
                      <th className="office-row-num">{ri + 1}</th>
                      {Array.from({ length: colCount }, (_, ci) => (
                        <td key={ci}>{row[ci] ?? ''}</td>
                      ))}
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
