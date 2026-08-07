import './ViewerLoading.css'

interface Props {
  visible: boolean
  /** Primary status line (English UI). */
  label?: string
  /** Optional secondary hint, e.g. file name. */
  detail?: string
  className?: string
}

/**
 * Full-area loading cover for viewers / panels.
 * Use for initial open & any wait that would otherwise show an empty void.
 * Do not use for tiny incremental “load more” footers.
 */
export function ViewerLoading({
  visible,
  label = 'Loading…',
  detail,
  className,
}: Props) {
  if (!visible) return null
  return (
    <div
      className={`viewer-loading${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="viewer-loading-card">
        <span className="viewer-loading-spinner" aria-hidden />
        <div className="viewer-loading-label">{label}</div>
        {detail ? <div className="viewer-loading-detail">{detail}</div> : null}
      </div>
    </div>
  )
}
