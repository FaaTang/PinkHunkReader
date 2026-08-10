import { useCallback, useEffect, useState } from 'react'
import { ListDir } from '../../wailsjs/go/app/App'
import type { DirEntry } from '../types'
import { folderLabel, parentDir, pathUnderRoot, pathsEqual } from '../utils/pathHelpers'
import './FileTree.css'

interface Props {
  roots: string[]
  refreshToken?: number
  activePath?: string | null
  revealPath?: string | null
  revealNonce?: number
  onOpenFile: (path: string) => void
  onRemoveFromWorkspace: (rootPath: string) => void
  onRemoveAllFromWorkspace: () => void
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
  rootPath: string
  label: string
}

/** Prefer the most specific workspace root covering the clicked path. */
function resolveWorkspaceRoot(clickedPath: string, groupRoot: string, roots: string[]): string {
  const exact = roots.find((r) => pathsEqual(r, clickedPath))
  if (exact) return exact
  const covering = roots
    .filter((r) => pathUnderRoot(clickedPath, r))
    .sort((a, b) => b.replace(/\\/g, '/').length - a.replace(/\\/g, '/').length)
  return covering[0] ?? groupRoot
}

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

export function FileTree({
  roots,
  refreshToken = 0,
  activePath = null,
  revealPath = null,
  revealNonce = 0,
  onOpenFile,
  onRemoveFromWorkspace,
  onRemoveAllFromWorkspace,
  onRevealResult,
}: Props) {
  const [groups, setGroups] = useState<RootGroup[]>(() => emptyGroups(roots))
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [flashPath, setFlashPath] = useState<string | null>(null)

  const loadGroups = useCallback(async (keep: RootGroup[] | null) => {
    const next: RootGroup[] = []
    for (const root of roots) {
      const prev = keep?.find((g) => pathsEqual(g.root, root))
      try {
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
    if (refreshToken === 0) return
    void loadGroups(groups)
    // intentionally only when refreshToken changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
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
        if (!nodes.length) {
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

  const openContextMenu = (e: React.MouseEvent, clickedPath: string, groupRoot: string) => {
    e.preventDefault()
    e.stopPropagation()
    const rootPath = resolveWorkspaceRoot(clickedPath, groupRoot, roots)
    setMenu({
      x: e.clientX,
      y: e.clientY,
      rootPath,
      label: folderLabel(rootPath),
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

  return (
    <div className="tree" onContextMenu={(e) => e.preventDefault()}>
      {groups.map((g) => (
        <div key={g.root} className="tree-group">
          <div
            className="tree-group-head"
            title={g.root}
            onClick={() => toggleGroup(g.root)}
            onContextMenu={(e) => openContextMenu(e, g.root, g.root)}
          >
            <span className="tree-icon">{g.expanded ? '▼' : '▶'}</span>
            <span className="tree-group-name">{g.name}</span>
          </div>
          {g.expanded ? (
            <>
              {g.error ? <div style={{ padding: '4px 10px', color: 'var(--ph-danger)', fontSize: 12 }}>{g.error}</div> : null}
              <TreeList
                nodes={g.nodes}
                depth={1}
                activePath={activePath}
                flashPath={flashPath}
                onToggle={(p) => void toggle(g.root, p)}
                onOpen={onOpenFile}
                onContextMenu={(e, path) => openContextMenu(e, path, g.root)}
              />
            </>
          ) : null}
        </div>
      ))}
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
              const rootPath = menu.rootPath
              setMenu(null)
              onRemoveFromWorkspace(rootPath)
            }}
          >
            Remove from workspace
            <span className="tree-context-sub">{menu.label}</span>
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
    const old = prev.find((n) => n.entry.path === e.path)
    if (e.isDir && old?.expanded) {
      const children = await ListDir(e.path)
      out.push({
        entry: e,
        expanded: true,
        children: await mergeExpanded(children, old.children ?? []),
      })
    } else {
      out.push({ entry: e, expanded: old?.expanded, children: old?.children })
    }
  }
  return out
}

async function togglePath(list: TreeNode[], path: string): Promise<TreeNode[]> {
  const out: TreeNode[] = []
  for (const n of list) {
    if (n.entry.path === path) {
      if (n.expanded) {
        out.push({ ...n, expanded: false })
      } else if (n.children) {
        out.push({ ...n, expanded: true })
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
  onToggle,
  onOpen,
  onContextMenu,
}: {
  nodes: TreeNode[]
  depth: number
  activePath: string | null
  flashPath: string | null
  onToggle: (path: string) => void
  onOpen: (path: string) => void
  onContextMenu: (e: React.MouseEvent, path: string) => void
}) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.entry.path}>
          <div
            className={[
              'tree-row',
              pathsEqual(activePath ?? '', n.entry.path) ? 'active' : '',
              pathsEqual(flashPath ?? '', n.entry.path) ? 'locate-flash' : '',
            ].filter(Boolean).join(' ')}
            style={{ ['--depth' as string]: depth }}
            data-tree-path={n.entry.path}
            onClick={() => {
              if (n.entry.isDir) onToggle(n.entry.path)
              else onOpen(n.entry.path)
            }}
            onContextMenu={(e) => onContextMenu(e, n.entry.path)}
          >
            <span className="tree-icon">
              {n.entry.isDir ? (n.expanded ? '▼' : '▶') : kindIcon(n.entry.kind)}
            </span>
            <span className="tree-name">{n.entry.name}</span>
          </div>
          {n.expanded && n.children ? (
            <TreeList
              nodes={n.children}
              depth={depth + 1}
              activePath={activePath}
              flashPath={flashPath}
              onToggle={onToggle}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
            />
          ) : null}
        </div>
      ))}
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
