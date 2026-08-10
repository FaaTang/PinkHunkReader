import { useEffect, useState } from 'react'
import { isApplePlatform } from '../utils/platform'
import type { OpenTab } from '../types'
import './TabBar.css'

interface Props {
  tabs: OpenTab[]
  activePath: string | null
  /** Paths that can be revealed in the explorer tree. */
  locatablePaths?: Set<string> | string[]
  onSelect: (path: string) => void
  onClose: (path: string) => void
  onCloseLeft: (path: string) => void
  onCloseRight: (path: string) => void
  onCloseAll: () => void
  onLocate: (path: string) => void
}

interface ContextMenuState {
  x: number
  y: number
  path: string
}

function LocateIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="2.25" fill="currentColor" />
      <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function TabBar({
  tabs,
  activePath,
  locatablePaths,
  onSelect,
  onClose,
  onCloseLeft,
  onCloseRight,
  onCloseAll,
  onLocate,
}: Props) {
  const closeLeading = isApplePlatform()
  const [menu, setMenu] = useState<ContextMenuState | null>(null)

  const canLocate = (path: string) => {
    if (!locatablePaths) return false
    if (Array.isArray(locatablePaths)) return locatablePaths.some((p) => p === path)
    return locatablePaths.has(path)
  }

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

  if (!tabs.length) return null

  const menuIndex = menu ? tabs.findIndex((t) => t.path === menu.path) : -1
  const canCloseLeft = menuIndex > 0
  const canCloseRight = menuIndex >= 0 && menuIndex < tabs.length - 1

  return (
    <div className={`tabbar${closeLeading ? ' tabbar-mac' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      {tabs.map((t) => {
        const locateBtn = canLocate(t.path) ? (
          <button
            type="button"
            className="tab-locate"
            title="Locate in explorer"
            aria-label={`Locate ${t.name} in explorer`}
            onClick={(e) => {
              e.stopPropagation()
              onLocate(t.path)
            }}
          >
            <LocateIcon />
          </button>
        ) : null
        const closeBtn = (
          <button
            type="button"
            className="tab-close"
            title="Close"
            aria-label={`Close ${t.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onClose(t.path)
            }}
          >
            ×
          </button>
        )
        return (
          <div
            key={t.path}
            className={`tab ${activePath === t.path ? 'active' : ''}`}
            onClick={() => onSelect(t.path)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenu({ x: e.clientX, y: e.clientY, path: t.path })
            }}
            title={t.path}
          >
            {closeLeading ? closeBtn : null}
            <span className="tab-name">
              {t.dirty ? <span className="tab-dirty">● </span> : null}
              {t.name}
            </span>
            {locateBtn}
            {!closeLeading ? closeBtn : null}
          </div>
        )
      })}
      {menu ? (
        <div
          className="tab-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="tab-context-item"
            role="menuitem"
            onClick={() => {
              const path = menu.path
              setMenu(null)
              onClose(path)
            }}
          >
            Close
          </button>
          <button
            type="button"
            className="tab-context-item"
            role="menuitem"
            disabled={!canCloseLeft}
            onClick={() => {
              if (!canCloseLeft) return
              const path = menu.path
              setMenu(null)
              onCloseLeft(path)
            }}
          >
            Close to the left
          </button>
          <button
            type="button"
            className="tab-context-item"
            role="menuitem"
            disabled={!canCloseRight}
            onClick={() => {
              if (!canCloseRight) return
              const path = menu.path
              setMenu(null)
              onCloseRight(path)
            }}
          >
            Close to the right
          </button>
          <button
            type="button"
            className="tab-context-item"
            role="menuitem"
            onClick={() => {
              setMenu(null)
              onCloseAll()
            }}
          >
            Close all
          </button>
        </div>
      ) : null}
    </div>
  )
}
