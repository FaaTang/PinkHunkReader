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
  onLocate: (path: string) => void
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
  onLocate,
}: Props) {
  const closeLeading = isApplePlatform()
  const canLocate = (path: string) => {
    if (!locatablePaths) return false
    if (Array.isArray(locatablePaths)) return locatablePaths.some((p) => p === path)
    return locatablePaths.has(path)
  }

  if (!tabs.length) return null
  return (
    <div className={`tabbar${closeLeading ? ' tabbar-mac' : ''}`}>
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
    </div>
  )
}
