import { useT } from '../i18n'
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
  const t = useT()
  if (!open) return null
  const active = status === 'downloading' || status === 'start'
  const paused = status === 'paused'
  const inFlight = active || paused
  const label =
    status === 'done'
      ? t('dialogs.updateProgress.done')
      : status === 'error'
        ? t('dialogs.updateProgress.failed')
        : status === 'cancelled'
          ? t('dialogs.updateProgress.cancelled')
          : paused
            ? t('dialogs.updateProgress.paused')
            : active
              ? t('dialogs.updateProgress.downloading')
              : t('dialogs.updateProgress.update')
  return (
    <div className="goto-backdrop" onMouseDown={onHide}>
      <div
        className="goto-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogs.updateProgress.ariaLabel')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="goto-title">{label}</div>
        <p className="settings-hint" style={{ marginTop: 0 }}>
          {version ? `v${version}` : t('dialogs.updateProgress.package')}
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
            title={t('dialogs.updateProgress.hideTitle')}
          >
            {t('common.hide')}
          </button>
          {inFlight && onCancel ? (
            <button type="button" className="toolbar-btn" onClick={onCancel}>
              {t('common.cancel')}
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          {active && onPause ? (
            <button type="button" className="toolbar-btn" onClick={onPause}>
              {t('dialogs.updateProgress.pause')}
            </button>
          ) : null}
          {paused && onResume ? (
            <button type="button" className="toolbar-btn primary" onClick={onResume}>
              {t('dialogs.updateProgress.resume')}
            </button>
          ) : null}
          {(status === 'done' || canInstall) && !inFlight ? (
            <button type="button" className="toolbar-btn primary" onClick={onInstall}>
              {t('dialogs.updateProgress.installAndRestart')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
