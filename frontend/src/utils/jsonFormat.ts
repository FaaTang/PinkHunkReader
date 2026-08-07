/** Pretty-print or minify JSON. Toggle: if already multi-line pretty, compress; else expand. */
export function toggleJsonFormat(text: string): { ok: true; text: string; mode: 'pretty' | 'compact' } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'Empty JSON' }
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  const compact = JSON.stringify(value)
  const pretty = JSON.stringify(value, null, 2)
  const looksPretty = trimmed.includes('\n') && trimmed !== compact
  if (looksPretty) {
    return { ok: true, text: compact, mode: 'compact' }
  }
  return { ok: true, text: pretty, mode: 'pretty' }
}

/** True when path or display name looks like a JSON file. */
export function isJsonFile(path: string, name: string): boolean {
  const p = path.toLowerCase()
  const n = name.toLowerCase()
  return (
    p.endsWith('.json')
    || p.endsWith('.jsonc')
    || n.endsWith('.json')
    || n.endsWith('.jsonc')
  )
}

/** Show Format JSON for JSON files and untitled buffers (paste-then-format). */
export function isJsonTab(path: string, name: string): boolean {
  return isJsonFile(path, name) || path.toLowerCase().startsWith('untitled:')
}
