import { useT } from '../i18n'

interface Props {
  /** Show while a prefetch/append is in flight and the user is waiting on more content. */
  visible: boolean
  label?: string
  className?: string
}

/** Bottom-of-viewport loading strip for paged readers. */
export function ScrollLoadFooter({ visible, label, className }: Props) {
  const t = useT()
  if (!visible) return null
  return (
    <div className={`scroll-load-footer${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      <span className="scroll-load-spinner" aria-hidden />
      <span>{label ?? t('dialogs.scrollLoad.loadingMore')}</span>
    </div>
  )
}
