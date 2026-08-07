interface Props {
  name: string
}

export function UnsupportedView({ name }: Props) {
  return (
    <div className="empty">
      <h2>Preview not supported</h2>
      <div>{name}</div>
      <div style={{ fontSize: 12 }}>More formats may be added later</div>
    </div>
  )
}
