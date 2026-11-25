import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { isApplePlatform, revealInOsLabel } from '../utils/platform'
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
  onRevealInOs: (path: string) => void
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
  onRevealInOs,
}: Props) {
  const t = useT()
  const closeLeading = isApplePlatform()
  const [menu, setMenu] = useState<ContextMenuState | null>(null)

  const canLocate = (path: string) => {
    if (!locatablePaths) return false
    if (Array.isArray(locatablePaths)) return locatablePaths.some((p) => p === path)
    return locatablePaths.has(path)
  }

  const canRevealInOs = (path: string) => Boolean(path) && !path.startsWith('untitled:')

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

  const menuIndex = menu ? tabs.findIndex((tab) => tab.path === menu.path) : -1
  const canCloseLeft = menuIndex > 0
  const canCloseRight = menuIndex >= 0 && menuIndex < tabs.length - 1
  const menuCanRevealInOs = menu ? canRevealInOs(menu.path) : false

  return (
    <div className={`tabbar${closeLeading ? ' tabbar-mac' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      {tabs.map((tab) => {
        const locateBtn = canLocate(tab.path) ? (
          <button
            type="button"
            className="tab-locate"
            title={t('tree.tab.locate')}
            aria-label={t('tree.tab.locateNamed', { name: tab.name })}
            onClick={(e) => {
              e.stopPropagation()
              onLocate(tab.path)
            }}
          >
            <LocateIcon />
          </button>
        ) : null
        const closeBtn = (
          <button
            type="button"
            className="tab-close"
            title={t('common.close')}
            aria-label={t('tree.tab.closeNamed', { name: tab.name })}
            onClick={(e) => {
              e.stopPropagation()
              onClose(tab.path)
            }}
          >
            ×
          </button>
        )
        return (
          <div
            key={tab.path}
            className={`tab ${activePath === tab.path ? 'active' : ''}`}
            onClick={() => onSelect(tab.path)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenu({ x: e.clientX, y: e.clientY, path: tab.path })
            }}
            title={tab.path}
          >
            {closeLeading ? closeBtn : null}
            <span className="tab-name">
              {tab.dirty ? <span className="tab-dirty">● </span> : null}
              {tab.name}
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
            disabled={!menuCanRevealInOs}
            onClick={() => {
              if (!menuCanRevealInOs) return
              const path = menu.path
              setMenu(null)
              onRevealInOs(path)
            }}
          >
            {revealInOsLabel()}
          </button>
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
            {t('common.close')}
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
            {t('tree.tab.closeLeft')}
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
            {t('tree.tab.closeRight')}
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
            {t('tree.tab.closeAll')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
