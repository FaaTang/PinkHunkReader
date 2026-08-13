import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DetectKind, InspectPath, ListDir } from '../../wailsjs/go/app/App'
import type { DirEntry } from '../types'
import { folderLabel, parentDir, pathUnderRoot, pathsEqual } from '../utils/pathHelpers'
import { revealInOsLabel } from '../utils/platform'
import './FileTree.css'

interface Props {
  roots: string[]
  /** Paths removed from the explorer tree without dropping their workspace root. */
  hiddenPaths?: string[]
  refreshToken?: number
  activePath?: string | null
  revealPath?: string | null
  revealNonce?: number
  onOpenFile: (path: string) => void
  onRemoveFromWorkspace: (paths: string[]) => void
  onRemoveAllFromWorkspace: () => void
  onRevealInOs: (paths: string[]) => void
  onRevealResult?: (ok: boolean, message: string) => void
}

interface TreeNode {
  entry: DirEntry
  expanded?: boolean
  children?: TreeNode[]
}

interface RootGroup {
  root: string
  name: string
  expanded: boolean
  nodes: TreeNode[]
  error: string
}

interface ContextMenuState {
  x: number
  y: number
  /** Paths the menu actions apply to (current multi-selection). */
  targets: string[]
}

/** Prefer the most specific workspace root covering the clicked path. */
function coveringRoot(filePath: string, roots: string[]): string | null {
  const covering = roots
    .filter((r) => pathUnderRoot(filePath, r))
    .sort((a, b) => b.replace(/\\/g, '/').length - a.replace(/\\/g, '/').length)
  return covering[0] ?? null
}

/** Intermediate directories from root to file (exclusive of root and file). */
function dirChain(root: string, filePath: string): string[] {
  const dirs: string[] = []
  let cur = parentDir(filePath)
  while (cur && pathUnderRoot(cur, root) && !pathsEqual(cur, root)) {
    dirs.push(cur)
    const next = parentDir(cur)
    if (!next || pathsEqual(next, cur)) break
    cur = next
  }
  return dirs.reverse()
}

function emptyGroups(roots: string[]): RootGroup[] {
  return roots.map((root) => ({
    root,
    name: folderLabel(root),
    expanded: true,
    nodes: [],
    error: '',
  }))
}

function isFileOnlyGroup(g: RootGroup): boolean {
  return g.nodes.length === 1 && !g.nodes[0].entry.isDir && pathsEqual(g.nodes[0].entry.path, g.root)
}

/** Flat order of currently visible tree rows (group heads + expanded children). */
function flattenVisible(groups: RootGroup[], hiddenPaths: string[]): string[] {
  const out: string[] = []
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (isHiddenPath(n.entry.path, hiddenPaths)) continue
      out.push(n.entry.path)
      if (n.expanded && n.children) walk(n.children)
    }
  }
  for (const g of groups) {
    if (isHiddenPath(g.root, hiddenPaths)) continue
    out.push(g.root)
    if (isFileOnlyGroup(g)) continue
    if (g.expanded) walk(g.nodes)
  }
  return out
}

function pathInList(list: string[], path: string): boolean {
  return list.some((p) => pathsEqual(p, path))
}

function selectionKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function toSelectionSet(paths: string[]): Set<string> {
  return new Set(paths.map(selectionKey))
}

function selectionSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = toSelectionSet(a)
  return b.every((p) => set.has(selectionKey(p)))
}

function isHiddenPath(path: string, hiddenPaths: string[]): boolean {
  return hiddenPaths.some((h) => pathUnderRoot(path, h))
}

function togglePathInList(list: string[], path: string): string[] {
  if (pathInList(list, path)) return list.filter((p) => !pathsEqual(p, path))
  return [...list, path]
}

function rangeSelect(visible: string[], anchor: string, end: string): string[] {
  const a = visible.findIndex((p) => pathsEqual(p, anchor))
  const b = visible.findIndex((p) => pathsEqual(p, end))
  if (a < 0 || b < 0) return [end]
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return visible.slice(lo, hi + 1)
}

function uniquePaths(paths: string[]): string[] {
  const out: string[] = []
  for (const p of paths) {
    if (!pathInList(out, p)) out.push(p)
  }
  return out
}

const MARQUEE_THRESHOLD_PX = 6

function clientRectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: DOMRect,
): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
}

function pathsIntersectingMarquee(
  root: HTMLElement,
  box: { left: number; top: number; right: number; bottom: number },
): string[] {
  const out: string[] = []
  root.querySelectorAll<HTMLElement>('[data-tree-path]').forEach((el) => {
    if (!clientRectsIntersect(box, el.getBoundingClientRect())) return
    const path = el.getAttribute('data-tree-path')
    if (path) out.push(path)
  })
  return uniquePaths(out)
}

export function FileTree({
  roots,
  hiddenPaths = [],
  refreshToken = 0,
  activePath = null,
  revealPath = null,
  revealNonce = 0,
  onOpenFile,
  onRemoveFromWorkspace,
  onRemoveAllFromWorkspace,
  onRevealInOs,
  onRevealResult,
}: Props) {
  const [groups, setGroups] = useState<RootGroup[]>(() => emptyGroups(roots))
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [flashPath, setFlashPath] = useState<string | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const selectedPathsRef = useRef(selectedPaths)
  const skipClickRef = useRef(false)
  /** True while Ctrl / Shift / marquee owns selection; false = follow active file. */
  const multiSelectRef = useRef(false)
  const marqueeRafRef = useRef(0)
  const marqueeDragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    additive: boolean
    baseline: string[]
    dragging: boolean
  } | null>(null)
  selectedPathsRef.current = selectedPaths
  const selectedSet = useMemo(() => toSelectionSet(selectedPaths), [selectedPaths])

  const restoreActiveSelection = useCallback(() => {
    multiSelectRef.current = false
    if (activePath) {
      setSelectedPaths([activePath])
      setSelectionAnchor(activePath)
    } else {
      setSelectedPaths([])
      setSelectionAnchor(null)
    }
  }, [activePath])

  const loadGroups = useCallback(async (keep: RootGroup[] | null) => {
    const next: RootGroup[] = []
    for (const root of roots) {
      const prev = keep?.find((g) => pathsEqual(g.root, root))
      try {
        const probed = await InspectPath(root)
        if (probed && !probed.isDir) {
          const name = folderLabel(root)
          const kind = await DetectKind(root)
          next.push({
            root,
            name,
            expanded: false,
            nodes: [
              {
                entry: {
                  name,
                  path: root,
                  isDir: false,
                  kind,
                },
              },
            ],
            error: '',
          })
          continue
        }
        const entries = await ListDir(root)
        const nodes = prev?.nodes?.length
          ? await mergeExpanded(entries, prev.nodes)
          : entries.map((e) => ({ entry: e }))
        next.push({
          root,
          name: folderLabel(root),
          expanded: prev?.expanded ?? true,
          nodes,
          error: '',
        })
      } catch (e) {
        next.push({
          root,
          name: folderLabel(root),
          expanded: prev?.expanded ?? true,
          nodes: prev?.nodes ?? [],
          error: String(e),
        })
      }
    }
    setGroups(next)
  }, [roots])

  useEffect(() => {
    void loadGroups(null)
  }, [loadGroups])

  useEffect(() => {
    // Always full reload from disk — never merge stale children after remove/refresh.
    if (refreshToken === 0) return
    void loadGroups(null)
    // intentionally only when refreshToken changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  useEffect(() => {
    setSelectedPaths([])
    setSelectionAnchor(null)
    multiSelectRef.current = false
  }, [roots])

  useEffect(() => {
    // Default interaction: selection follows the open file until a multi-select op.
    if (multiSelectRef.current) return
    if (activePath) {
      setSelectedPaths([activePath])
      setSelectionAnchor(activePath)
    } else {
      setSelectedPaths([])
      setSelectionAnchor(null)
    }
  }, [activePath])

  useEffect(() => {
    if (!hiddenPaths.length) return
    setSelectedPaths((prev) => prev.filter((p) => !isHiddenPath(p, hiddenPaths)))
    setSelectionAnchor((prev) => (prev && isHiddenPath(prev, hiddenPaths) ? null : prev))
  }, [hiddenPaths])

  useEffect(() => {
    if (!menu) return
    const closeLeft = (ev: MouseEvent) => {
      if (ev.button !== 0) return
      setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    const onScroll = () => setMenu(null)
    const timer = window.setTimeout(() => {
      window.addEventListener('mousedown', closeLeft)
    }, 0)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousedown', closeLeft)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [menu])

  useEffect(() => {
    if (menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPaths([])
        setSelectionAnchor(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  useEffect(() => {
    if (!revealPath || revealNonce <= 0) return
    let cancelled = false
    ;(async () => {
      const root = coveringRoot(revealPath, roots)
      if (!root) {
        onRevealResult?.(false, 'File is not in the current workspace')
        return
      }
      try {
        const prev = groups.find((g) => pathsEqual(g.root, root))
        let nodes = prev?.nodes ?? []
        if (pathsEqual(root, revealPath)) {
          if (!nodes.length) {
            const name = folderLabel(revealPath)
            const kind = await DetectKind(revealPath)
            nodes = [{ entry: { name, path: root, isDir: false, kind } }]
          }
        } else if (!nodes.length) {
          const entries = await ListDir(root)
          nodes = entries.map((e) => ({ entry: e }))
        }
        for (const dir of dirChain(root, revealPath)) {
          if (cancelled) return
          nodes = await ensureDirExpanded(nodes, dir)
        }
        if (cancelled) return
        setGroups((gs) =>
          gs.map((g) =>
            pathsEqual(g.root, root)
              ? { ...g, expanded: true, nodes, error: '' }
              : g,
          ),
        )
        setFlashPath(revealPath)
        multiSelectRef.current = false
        setSelectedPaths([revealPath])
        setSelectionAnchor(revealPath)
        window.setTimeout(() => {
          if (cancelled) return
          const el = document.querySelector(`[data-tree-path="${cssEscape(revealPath)}"]`)
          el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }, 40)
        onRevealResult?.(true, `Located ${folderLabel(revealPath)}`)
        window.setTimeout(() => {
          if (!cancelled) setFlashPath((p) => (pathsEqual(p ?? '', revealPath) ? null : p))
        }, 1600)
      } catch (e) {
        onRevealResult?.(false, String(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealNonce])

  const visiblePaths = useMemo(() => flattenVisible(groups, hiddenPaths), [groups, hiddenPaths])

  const applySelectionClick = (
    e: React.MouseEvent,
    path: string,
  ): { keepDefault: boolean } => {
    if (skipClickRef.current) {
      skipClickRef.current = false
      return { keepDefault: false }
    }
    const additive = e.ctrlKey || e.metaKey
    const ranged = e.shiftKey
    if (ranged) {
      multiSelectRef.current = true
      const anchor = selectionAnchor ?? path
      const next = rangeSelect(visiblePaths, anchor, path)
      setSelectedPaths(next)
      if (!selectionAnchor) setSelectionAnchor(path)
      return { keepDefault: false }
    }
    if (additive) {
      multiSelectRef.current = true
      setSelectedPaths((prev) => togglePathInList(prev, path))
      setSelectionAnchor(path)
      return { keepDefault: false }
    }
    // Plain click — original interaction: selection follows this open/toggle target.
    multiSelectRef.current = false
    setSelectedPaths([path])
    setSelectionAnchor(path)
    return { keepDefault: true }
  }

  const flushMarqueeFrame = useCallback((
    clientBox: { left: number; top: number; right: number; bottom: number },
    local: { left: number; top: number; width: number; height: number },
    additive: boolean,
    baseline: string[],
  ) => {
    const root = treeRef.current
    if (!root) return
    const hit = pathsIntersectingMarquee(root, clientBox)
    const next = additive ? uniquePaths([...baseline, ...hit]) : hit
    setMarquee(local)
    setSelectedPaths((prev) => (selectionSetsEqual(prev, next) ? prev : next))
    if (hit.length) setSelectionAnchor(hit[hit.length - 1])
  }, [])

  const onTreePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (menu) return
    // Ctrl/Cmd/Shift clicks are discrete multi-select — never start a rubber-band.
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    // Do NOT capture yet — early capture breaks click/contextmenu on rows in WebView2.
    marqueeDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      additive: false,
      baseline: selectedPathsRef.current.slice(),
      dragging: false,
    }
  }

  const onTreePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = marqueeDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const tree = treeRef.current
    if (!tree) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    if (!drag.dragging) {
      if (Math.abs(dx) < MARQUEE_THRESHOLD_PX && Math.abs(dy) < MARQUEE_THRESHOLD_PX) return
      drag.dragging = true
      skipClickRef.current = true
      multiSelectRef.current = true
      try {
        tree.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const treeRect = tree.getBoundingClientRect()
    const left = Math.min(drag.startClientX, e.clientX)
    const top = Math.min(drag.startClientY, e.clientY)
    const right = Math.max(drag.startClientX, e.clientX)
    const bottom = Math.max(drag.startClientY, e.clientY)
    const local = {
      left: left - treeRect.left + tree.scrollLeft,
      top: top - treeRect.top + tree.scrollTop,
      width: right - left,
      height: bottom - top,
    }
    const clientBox = { left, top, right, bottom }
    if (marqueeRafRef.current) cancelAnimationFrame(marqueeRafRef.current)
    marqueeRafRef.current = requestAnimationFrame(() => {
      marqueeRafRef.current = 0
      flushMarqueeFrame(clientBox, local, drag.additive, drag.baseline)
    })
  }

  const endMarqueeDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = marqueeDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    if (marqueeRafRef.current) {
      cancelAnimationFrame(marqueeRafRef.current)
      marqueeRafRef.current = 0
    }
    const wasDragging = drag.dragging
    if (wasDragging) skipClickRef.current = true
    marqueeDragRef.current = null
    setMarquee(null)
    if (wasDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
  }

  const onTreeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (skipClickRef.current) {
      skipClickRef.current = false
      return
    }
    const el = e.target as HTMLElement | null
    // Clicks on row/head bodies are handled there (and stopPropagation).
    if (el?.closest('.tree-row, .tree-group-head, .tree-context-menu')) return
    // Blank / left gutter / empty panel — clear multi-select, restore open file.
    restoreActiveSelection()
  }

  const openContextMenu = (e: React.MouseEvent, clickedPath: string, _groupRoot: string) => {
    e.preventDefault()
    e.stopPropagation()
    let targets = selectedPaths
    if (!pathInList(selectedPaths, clickedPath)) {
      targets = [clickedPath]
      setSelectedPaths([clickedPath])
      setSelectionAnchor(clickedPath)
    }
    setMenu({
      x: e.clientX,
      y: e.clientY,
      targets: uniquePaths(targets),
    })
  }

  const toggleGroup = (root: string) => {
    setGroups((prev) =>
      prev.map((g) => (pathsEqual(g.root, root) ? { ...g, expanded: !g.expanded } : g)),
    )
  }

  const toggle = async (root: string, path: string) => {
    try {
      const current = groups.find((g) => pathsEqual(g.root, root))
      if (!current) return
      const nodes = await togglePath(current.nodes, path)
      setGroups((prev) =>
        prev.map((g) => (pathsEqual(g.root, root) ? { ...g, nodes, error: '' } : g)),
      )
    } catch (e) {
      setGroups((prev) =>
        prev.map((g) => (pathsEqual(g.root, root) ? { ...g, error: String(e) } : g)),
      )
    }
  }

  if (!roots.length) return null

  const menuCount = menu?.targets.length ?? 0

  return (
    <div
      ref={treeRef}
      className={`tree${marquee ? ' tree-marqueeing' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={onTreePointerDown}
      onPointerMove={onTreePointerMove}
      onPointerUp={endMarqueeDrag}
      onPointerCancel={endMarqueeDrag}
      onClick={onTreeClick}
    >
      {groups.map((g) => {
        if (isHiddenPath(g.root, hiddenPaths)) return null
        if (isFileOnlyGroup(g)) {
          const n = g.nodes[0]
          const active = activePath ? pathsEqual(n.entry.path, activePath) : false
          const flash = flashPath ? pathsEqual(n.entry.path, flashPath) : false
          const selected = selectedSet.has(selectionKey(n.entry.path))
          return (
            <div key={g.root} className="tree-group">
              <div
                className="tree-line"
                data-tree-path={n.entry.path}
                onContextMenu={(e) => openContextMenu(e, g.root, g.root)}
              >
                <div className="tree-gutter" style={{ width: 8 }} />
                <div
                  className={`tree-row${active ? ' active' : ''}${selected ? ' selected' : ''}${flash ? ' locate-flash' : ''}`}
                  title={g.root}
                  onClick={(e) => {
                    e.stopPropagation()
                    const { keepDefault } = applySelectionClick(e, n.entry.path)
                    if (keepDefault) onOpenFile(n.entry.path)
                  }}
                >
                  <span className="tree-icon">{kindIcon(n.entry.kind)}</span>
                  <span className="tree-name">{n.entry.name}</span>
                </div>
              </div>
              {g.error ? (
                <div style={{ padding: '4px 10px', color: 'var(--ph-danger)', fontSize: 12 }}>{g.error}</div>
              ) : null}
            </div>
          )
        }
        const headSelected = selectedSet.has(selectionKey(g.root))
        const headActive = activePath ? pathsEqual(g.root, activePath) : false
        return (
          <div key={g.root} className="tree-group">
            <div className="tree-line" data-tree-path={g.root} onContextMenu={(e) => openContextMenu(e, g.root, g.root)}>
              <div className="tree-gutter" style={{ width: 8 }} />
              <div
                className={`tree-group-head${headActive ? ' active' : ''}${headSelected ? ' selected' : ''}`}
                title={g.root}
                onClick={(e) => {
                  e.stopPropagation()
                  const { keepDefault } = applySelectionClick(e, g.root)
                  if (keepDefault) toggleGroup(g.root)
                }}
              >
                <span className="tree-icon">{g.expanded ? '▼' : '▶'}</span>
                <span className="tree-group-name">{g.name}</span>
              </div>
            </div>
            {g.expanded ? (
              <>
                {g.error ? (
                  <div style={{ padding: '4px 10px', color: 'var(--ph-danger)', fontSize: 12 }}>{g.error}</div>
                ) : null}
                <TreeList
                  nodes={g.nodes}
                  depth={1}
                  activePath={activePath}
                  flashPath={flashPath}
                  selectedSet={selectedSet}
                  hiddenPaths={hiddenPaths}
                  onToggle={(p) => void toggle(g.root, p)}
                  onOpen={onOpenFile}
                  onSelectClick={applySelectionClick}
                  onContextMenu={(e, path) => openContextMenu(e, path, g.root)}
                />
              </>
            ) : null}
          </div>
        )
      })}
      {menu ? (
        <div
          className="tree-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="tree-context-item"
            role="menuitem"
            onClick={() => {
              const paths = menu.targets
              setMenu(null)
              onRevealInOs(paths)
            }}
          >
            {revealInOsLabel()}
            {menuCount > 1 ? (
              <span className="tree-context-sub">{menuCount} items</span>
            ) : null}
          </button>
          <button
            type="button"
            className="tree-context-item"
            role="menuitem"
            onClick={() => {
              const paths = menu.targets
              setMenu(null)
              onRemoveFromWorkspace(paths)
            }}
          >
            Remove from workspace
            <span className="tree-context-sub">
              {menuCount === 1
                ? folderLabel(menu.targets[0])
                : `${menuCount} items`}
            </span>
          </button>
          <button
            type="button"
            className="tree-context-item"
            role="menuitem"
            onClick={() => {
              setMenu(null)
              onRemoveAllFromWorkspace()
            }}
          >
            Remove all folders
          </button>
        </div>
      ) : null}
      {marquee ? (
        <div
          className="tree-marquee"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      ) : null}
    </div>
  )
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function ensureDirExpanded(list: TreeNode[], dirPath: string): Promise<TreeNode[]> {
  const out: TreeNode[] = []
  for (const n of list) {
    if (pathsEqual(n.entry.path, dirPath)) {
      if (n.expanded && n.children) {
        out.push(n)
      } else if (n.children) {
        out.push({ ...n, expanded: true })
      } else {
        const entries = await ListDir(dirPath)
        out.push({
          ...n,
          expanded: true,
          children: entries.map((e) => ({ entry: e })),
        })
      }
      continue
    }
    if (n.children && pathUnderRoot(dirPath, n.entry.path)) {
      out.push({ ...n, expanded: true, children: await ensureDirExpanded(n.children, dirPath) })
    } else {
      out.push(n)
    }
  }
  return out
}

async function mergeExpanded(entries: DirEntry[], prev: TreeNode[]): Promise<TreeNode[]> {
  const out: TreeNode[] = []
  for (const e of entries) {
    const old = prev.find((n) => pathsEqual(n.entry.path, e.path))
    if (e.isDir && old?.expanded) {
      const children = await ListDir(e.path)
      out.push({
        entry: e,
        expanded: true,
        children: await mergeExpanded(children, old.children ?? []),
      })
    } else {
      out.push({ entry: e, expanded: old?.expanded })
    }
  }
  return out
}

async function togglePath(list: TreeNode[], path: string): Promise<TreeNode[]> {
  const out: TreeNode[] = []
  for (const n of list) {
    if (pathsEqual(n.entry.path, path)) {
      if (n.expanded) {
        out.push({ ...n, expanded: false })
      } else if (n.children) {
        // Re-list on expand so Refresh / disk changes are not stuck behind a stale cache.
        const entries = await ListDir(path)
        out.push({
          ...n,
          expanded: true,
          children: entries.map((e) => ({ entry: e })),
        })
      } else {
        const entries = await ListDir(path)
        out.push({
          ...n,
          expanded: true,
          children: entries.map((e) => ({ entry: e })),
        })
      }
      continue
    }
    if (n.children) {
      out.push({ ...n, children: await togglePath(n.children, path) })
    } else {
      out.push(n)
    }
  }
  return out
}

function TreeList({
  nodes,
  depth,
  activePath,
  flashPath,
  selectedSet,
  hiddenPaths,
  onToggle,
  onOpen,
  onSelectClick,
  onContextMenu,
}: {
  nodes: TreeNode[]
  depth: number
  activePath: string | null
  flashPath: string | null
  selectedSet: Set<string>
  hiddenPaths: string[]
  onToggle: (path: string) => void
  onOpen: (path: string) => void
  onSelectClick: (e: React.MouseEvent, path: string) => { keepDefault: boolean }
  onContextMenu: (e: React.MouseEvent, path: string) => void
}) {
  const gutter = 8 + depth * 12
  return (
    <>
      {nodes.map((n) => {
        if (isHiddenPath(n.entry.path, hiddenPaths)) return null
        return (
          <div key={n.entry.path}>
            <div
              className="tree-line"
              data-tree-path={n.entry.path}
              onContextMenu={(e) => onContextMenu(e, n.entry.path)}
            >
              <div className="tree-gutter" style={{ width: gutter }} />
              <div
                className={[
                  'tree-row',
                  pathsEqual(activePath ?? '', n.entry.path) ? 'active' : '',
                  selectedSet.has(selectionKey(n.entry.path)) ? 'selected' : '',
                  pathsEqual(flashPath ?? '', n.entry.path) ? 'locate-flash' : '',
                ].filter(Boolean).join(' ')}
                onClick={(e) => {
                  e.stopPropagation()
                  const { keepDefault } = onSelectClick(e, n.entry.path)
                  if (!keepDefault) return
                  if (n.entry.isDir) onToggle(n.entry.path)
                  else onOpen(n.entry.path)
                }}
              >
                <span className="tree-icon">
                  {n.entry.isDir ? (n.expanded ? '▼' : '▶') : kindIcon(n.entry.kind)}
                </span>
                <span className="tree-name">{n.entry.name}</span>
              </div>
            </div>
            {n.expanded && n.children ? (
              <TreeList
                nodes={n.children}
                depth={depth + 1}
                activePath={activePath}
                flashPath={flashPath}
                selectedSet={selectedSet}
                hiddenPaths={hiddenPaths}
                onToggle={onToggle}
                onOpen={onOpen}
                onSelectClick={onSelectClick}
                onContextMenu={onContextMenu}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function kindIcon(kind: string): string {
  switch (kind) {
    case 'markdown':
      return 'M'
    case 'pdf':
      return 'P'
    case 'image':
      return 'I'
    case 'word':
      return 'W'
    case 'excel':
      return 'X'
    default:
      return '·'
  }
}
