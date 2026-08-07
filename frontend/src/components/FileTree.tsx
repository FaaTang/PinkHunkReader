import { useCallback, useEffect, useState } from 'react'
import { ListDir } from '../../wailsjs/go/app/App'
import type { DirEntry } from '../types'
import './FileTree.css'

interface Props {
  root: string
  refreshToken?: number
  onOpenFile: (path: string) => void
}

interface TreeNode {
  entry: DirEntry
  expanded?: boolean
  children?: TreeNode[]
}

export function FileTree({ root, refreshToken = 0, onOpenFile }: Props) {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [error, setError] = useState('')
  const [active, setActive] = useState('')

  const loadRoot = useCallback(async (keepExpanded: TreeNode[] | null) => {
    setError('')
    try {
      const entries = await ListDir(root)
      if (keepExpanded && keepExpanded.length) {
        setNodes(await mergeExpanded(entries, keepExpanded))
      } else {
        setNodes(entries.map((e) => ({ entry: e })))
      }
    } catch (e) {
      setError(String(e))
    }
  }, [root])

  useEffect(() => {
    void loadRoot(null)
  }, [loadRoot])

  useEffect(() => {
    if (refreshToken === 0) return
    void loadRoot(nodes)
    // intentionally only when refreshToken changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const toggle = async (path: string) => {
    try {
      setNodes(await togglePath(nodes, path))
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="tree">
      {error ? <div style={{ padding: 8, color: 'var(--ph-danger)' }}>{error}</div> : null}
      <TreeList
        nodes={nodes}
        depth={0}
        active={active}
        onToggle={(p) => void toggle(p)}
        onOpen={(p) => {
          setActive(p)
          onOpenFile(p)
        }}
      />
    </div>
  )
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
  active,
  onToggle,
  onOpen,
}: {
  nodes: TreeNode[]
  depth: number
  active: string
  onToggle: (path: string) => void
  onOpen: (path: string) => void
}) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.entry.path}>
          <div
            className={`tree-row ${active === n.entry.path ? 'active' : ''}`}
            style={{ ['--depth' as string]: depth }}
            onClick={() => {
              if (n.entry.isDir) onToggle(n.entry.path)
              else onOpen(n.entry.path)
            }}
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
              active={active}
              onToggle={onToggle}
              onOpen={onOpen}
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
    default:
      return '·'
  }
}
