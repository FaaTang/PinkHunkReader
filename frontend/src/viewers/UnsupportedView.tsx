import { useT } from '../i18n'

interface Props {
  name: string
}

export function UnsupportedView({ name }: Props) {
  const t = useT()
  return (
    <div className="empty">
      <h2>{t('office.unsupported.title')}</h2>
      <div>{name}</div>
      <div style={{ fontSize: 12 }}>{t('office.unsupported.hint')}</div>
    </div>
  )
}
