import { isApplePlatform } from '../utils/platform'
import type { OpenTab } from '../types'
import './TabBar.css'

interface Props {
  tabs: OpenTab[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function TabBar({ tabs, activePath, onSelect, onClose }: Props) {
  // Safari-style: close control on the leading edge on macOS.
  const closeLeading = isApplePlatform()

  if (!tabs.length) return null
  return (
    <div className={`tabbar${closeLeading ? ' tabbar-mac' : ''}`}>
      {tabs.map((t) => {
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
            {!closeLeading ? closeBtn : null}
          </div>
        )
      })}
    </div>
  )
}
