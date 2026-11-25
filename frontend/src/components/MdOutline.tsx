import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { plainHeadingText } from '../utils/mdHeadingAnchor'

export interface MdHeadingItem {
  level: number
  title: string
  line: number
}

interface OutlineNode {
  id: string
  title: string
  line: number
  level: number
  children: OutlineNode[]
}

interface Props {
  headings: MdHeadingItem[]
  activeLine: number
  onSelect: (line: number, title: string) => void
  /** When false, panel is not rendered (parent shows a reopen control). */
  open?: boolean
}

/**
 * Parse ATX headings from markdown text (small-file / client-side).
 * Mirrors the Go parser: fenced code blocks (``` / ~~~) are skipped, up to
 * three spaces of indentation are allowed, and only a whitespace-preceded
 * closing hash run is stripped (`## C#` keeps `C#`).
 */
export function parseMdHeadings(content: string): MdHeadingItem[] {
  const out: MdHeadingItem[] = []
  const lines = content.split(/\r?\n/)
  let fence: { marker: string; length: number } | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      const length = fenceMatch[1].length
      const rest = fenceMatch[2].trim()
      if (fence === null) fence = { marker, length }
      else if (marker === fence.marker && length >= fence.length && rest === '') fence = null
      continue
    }
    if (fence) continue
    const m = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/.exec(line)
    if (!m) continue
    const raw = (m[2] ?? '').replace(/(^|[ \t])#+[ \t]*$/, '$1')
    const title = plainHeadingText(raw)
    if (!title) continue
    out.push({ level: m[1].length, title, line: i + 1 })
  }
  return out
}

function buildTree(headings: MdHeadingItem[]): OutlineNode[] {
  const root: OutlineNode[] = []
  const stack: OutlineNode[] = []
  headings.forEach((h, i) => {
    const node: OutlineNode = {
      id: `md-${h.line}-${i}`,
      title: h.title,
      line: h.line,
      level: h.level,
      children: [],
    }
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop()
    if (!stack.length) root.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  })
  return root
}

function findActive(nodes: OutlineNode[], line: number): { id: string; ancestors: string[] } | null {
  const hit = { id: '', ancestors: [] as string[], line: -1 }
  const walk = (list: OutlineNode[], anc: string[]) => {
    for (const n of list) {
      if (n.line <= line && n.line >= hit.line) {
        hit.id = n.id
        hit.ancestors = anc
        hit.line = n.line
      }
      if (n.children.length) walk(n.children, [...anc, n.id])
    }
  }
  walk(nodes, [])
  return hit.line >= 0 ? { id: hit.id, ancestors: hit.ancestors } : null
}

export function MdOutline({ headings, activeLine, onSelect, open = true }: Props) {
  const t = useT()
  const tree = useMemo(() => buildTree(headings), [headings])
  const active = useMemo(() => findActive(tree, activeLine), [tree, activeLine])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const seeded = useRef(false)

  useEffect(() => {
    seeded.current = false
  }, [headings])

  useEffect(() => {
    if (seeded.current || !tree.length) return
    seeded.current = true
    setExpanded(new Set(tree.filter((n) => n.children.length).map((n) => n.id)))
  }, [tree])

  useEffect(() => {
    if (!active || !open) return
    setExpanded((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const id of active.ancestors) {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
    // Debounce outline auto-scroll so continuous editor scrolling stays smooth.
    const t = window.setTimeout(() => {
      const el = scrollRef.current?.querySelector(
        `[data-outline-id="${CSS.escape(active.id)}"]`,
      ) as HTMLElement | null
      if (!el || !scrollRef.current) return
      const root = scrollRef.current.getBoundingClientRect()
      const box = el.getBoundingClientRect()
      const visible = box.top >= root.top && box.bottom <= root.bottom
      if (!visible) el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    }, 160)
    return () => window.clearTimeout(t)
  }, [active, open])

  if (!open || !headings.length) return null

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="md-outline">
      <div className="outline-panel-head">
        <span className="outline-panel-title">{t('viewers.mdOutline.label')}</span>
      </div>
      <div className="md-outline-scroll" ref={scrollRef}>
        <OutlineTree
          nodes={tree}
          activeId={active?.id ?? null}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onSelect}
        />
      </div>
    </aside>
  )
}

function OutlineTree({
  nodes,
  activeId,
  expanded,
  onToggle,
  onSelect,
  depth = 0,
}: {
  nodes: OutlineNode[]
  activeId: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (line: number, title: string) => void
  depth?: number
}) {
  const t = useT()
  return (
    <ul className="md-outline-list" style={{ paddingLeft: depth === 0 ? 0 : 10 }}>
      {nodes.map((n) => {
        const hasKids = n.children.length > 0
        const open = hasKids && expanded.has(n.id)
        const active = activeId === n.id
        return (
          <li key={n.id}>
            <div className={`md-outline-row${active ? ' active' : ''}`} data-outline-id={n.id}>
              {hasKids ? (
                <button
                  type="button"
                  className="md-outline-twist"
                  aria-expanded={open}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle(n.id)
                  }}
                >
                  {open ? '▾' : '▸'}
                </button>
              ) : (
                <span className="md-outline-twist spacer" />
              )}
              <button
                type="button"
                className="md-outline-item"
                title={t('viewers.mdOutline.line', { line: n.line })}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(n.line, n.title)}
              >
                {n.title}
              </button>
            </div>
            {hasKids && open ? (
              <OutlineTree
                nodes={n.children}
                activeId={activeId}
                expanded={expanded}
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
