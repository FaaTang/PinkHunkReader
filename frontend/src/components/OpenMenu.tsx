import { useEffect, useRef, useState } from 'react'
import { useAppSettings } from '../settings/AppSettingsContext'
import type { RecentFile } from '../settings/recentFiles'
import { formatShortcut } from '../settings/shortcuts'
import './OpenMenu.css'

interface Props {
  onOpenFile: () => void
  onOpenFolder: () => void
  onOpenRecent?: (path: string) => void
  onNewFile?: () => void
  primary?: boolean
  label?: string
}

export function OpenMenu({
  onOpenFile,
  onOpenFolder,
  onOpenRecent,
  onNewFile,
  primary = true,
  label = 'File',
}: Props) {
  const { recentFiles, shortcuts } = useAppSettings()
  const [open, setOpen] = useState(false)
  const [recentHover, setRecentHover] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setRecentHover(false)
      return
    }
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pickRecent = (file: RecentFile) => {
    setOpen(false)
    setRecentHover(false)
    onOpenRecent?.(file.path)
  }

  return (
    <div className={`open-menu${primary ? ' primary' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`toolbar-btn${primary ? ' primary' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="open-menu-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="open-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            title={`Open file (${formatShortcut(shortcuts.open)})`}
            onClick={() => {
              setOpen(false)
              onOpenFile()
            }}
          >
            Open
          </button>
          <button
            type="button"
            role="menuitem"
            title={`Open folder (${formatShortcut(shortcuts.openFolder)})`}
            onClick={() => {
              setOpen(false)
              onOpenFolder()
            }}
          >
            Open Folder
          </button>
          <div className="open-menu-sep" role="separator" />
          <div
            className={`open-menu-submenu${recentHover ? ' is-open' : ''}`}
            onMouseEnter={() => setRecentHover(true)}
            onMouseLeave={() => setRecentHover(false)}
          >
            <button
              type="button"
              role="menuitem"
              className="open-menu-submenu-trigger"
              aria-haspopup="menu"
              aria-expanded={recentHover}
              onClick={(e) => {
                e.preventDefault()
                setRecentHover((v) => !v)
              }}
            >
              <span>Open Recent</span>
              <span className="open-menu-submenu-chevron" aria-hidden>
                ›
              </span>
            </button>
            {recentHover ? (
              <div className="open-menu-flyout" role="menu">
                {recentFiles.length > 0 ? (
                  recentFiles.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      role="menuitem"
                      className="open-menu-recent"
                      title={f.path}
                      onClick={() => pickRecent(f)}
                    >
                      <span className="open-menu-recent-name">
                        {f.isDir ? <span className="open-menu-recent-kind">Folder</span> : null}
                        {f.name}
                      </span>
                      <span className="open-menu-recent-path">{f.path}</span>
                    </button>
                  ))
                ) : (
                  <div className="open-menu-flyout-empty">No recent items</div>
                )}
              </div>
            ) : null}
          </div>
          {onNewFile ? (
            <>
              <div className="open-menu-sep" role="separator" />
              <button
                type="button"
                role="menuitem"
                title={`New file (${formatShortcut(shortcuts.newFile)})`}
                onClick={() => {
                  setOpen(false)
                  onNewFile()
                }}
              >
                New File
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
