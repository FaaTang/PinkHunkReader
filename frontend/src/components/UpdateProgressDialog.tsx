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
}: Props) {
  if (!open) return null
  const label =
    status === 'done'
      ? 'Download complete'
      : status === 'error'
        ? 'Download failed'
        : status === 'downloading' || status === 'start'
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
        <div className="goto-actions" style={{ marginTop: 14 }}>
          <button type="button" className="toolbar-btn" onClick={onHide}>
            Hide
          </button>
          <span style={{ flex: 1 }} />
          {(status === 'done' || canInstall) ? (
            <button type="button" className="toolbar-btn primary" onClick={onInstall}>
              Install and restart
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
