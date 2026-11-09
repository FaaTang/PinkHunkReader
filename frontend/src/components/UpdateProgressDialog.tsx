import './GoToDialog.css'

interface Props {
  open: boolean
  version: string
  status: string
  percent: number
  downloaded: number
  total: number
  message: string
  formatBytes: (n?: number) => string
  canInstall: boolean
  onHide: () => void
  onInstall: () => void
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
}

export function UpdateProgressDialog({
  open,
  version,
  status,
  percent,
  downloaded,
  total,
  message,
  formatBytes,
  canInstall,
  onHide,
  onInstall,
  onPause,
  onResume,
  onCancel,
}: Props) {
  if (!open) return null
  const active = status === 'downloading' || status === 'start'
  const paused = status === 'paused'
  const inFlight = active || paused
  const label =
    status === 'done'
      ? 'Download complete'
      : status === 'error'
        ? 'Download failed'
        : status === 'cancelled'
          ? 'Download cancelled'
          : paused
            ? 'Download paused'
            : active
              ? 'Downloading update…'
              : 'Update'
  return (
    <div className="goto-backdrop" onMouseDown={onHide}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Update download"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{label}</div>
        <p className="settings-hint" style={{ marginTop: 0 }}>
          {version ? `v${version}` : 'Update package'}
          {total > 0 ? ` · ${formatBytes(downloaded)} / ${formatBytes(total)}` : ''}
        </p>
        <div className="update-progress-track" aria-hidden>
          <div className="update-progress-bar" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
        </div>
        {message ? <p className="settings-error" style={{ marginTop: 10 }}>{message}</p> : null}
        <div className="goto-actions" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="toolbar-btn"
            onClick={onHide}
            title="Hide — reopen from the toolbar or Settings → About"
          >
            Hide
          </button>
          {inFlight && onCancel ? (
            <button type="button" className="toolbar-btn" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          {active && onPause ? (
            <button type="button" className="toolbar-btn" onClick={onPause}>
              Pause
            </button>
          ) : null}
          {paused && onResume ? (
            <button type="button" className="toolbar-btn primary" onClick={onResume}>
              Resume
            </button>
          ) : null}
          {(status === 'done' || canInstall) && !inFlight ? (
            <button type="button" className="toolbar-btn primary" onClick={onInstall}>
              Install and restart
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
