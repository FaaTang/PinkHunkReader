export type JsonFormatMode = 'pretty' | 'compact'

const findNextNonWhitespace = (value: string, startIndex: number): string => {
  for (let i = startIndex; i < value.length; i++) {
    if (!/\s/.test(value[i])) {
      return value[i]
    }
  }
  return ''
}

const readJsonStringToken = (value: string, startIndex: number): { token: string; nextIndex: number } => {
  let index = startIndex + 1
  let escaped = false
  while (index < value.length) {
    const char = value[index]
    if (escaped) {
      escaped = false
      index++
      continue
    }
    if (char === '\\') {
      escaped = true
      index++
      continue
    }
    if (char === '"') {
      return { token: value.slice(startIndex, index + 1), nextIndex: index + 1 }
    }
    index++
  }
  return { token: value.slice(startIndex), nextIndex: value.length }
}

const readJsonPrimitiveToken = (value: string, startIndex: number): { token: string; nextIndex: number } => {
  let index = startIndex
  while (index < value.length && !/[\s,\]}]/.test(value[index])) {
    index++
  }
  return { token: value.slice(startIndex, index), nextIndex: index }
}

const formatJsonStringToken = (token: string): string => {
  try {
    return JSON.stringify(JSON.parse(token))
  } catch {
    return token
  }
}

/**
 * Rewrite JSON text without converting number literals through JS Number,
 * so values beyond Number.MAX_SAFE_INTEGER keep their original digits.
 */
const rewriteJsonPreservingNumberLiterals = (value: string, mode: JsonFormatMode): string => {
  const pretty = mode === 'pretty'
  const indentUnit = '  '
  const indent = (depth: number) => indentUnit.repeat(Math.max(0, depth))
  let result = ''
  let depth = 0
  let index = 0
  let lastToken: 'open' | 'value' | 'close' | 'comma' | 'colon' | '' = ''

  while (index < value.length) {
    const char = value[index]
    if (/\s/.test(char)) {
      index++
      continue
    }

    if (char === '"') {
      const { token, nextIndex } = readJsonStringToken(value, index)
      result += formatJsonStringToken(token)
      lastToken = 'value'
      index = nextIndex
      continue
    }

    if (char === '{' || char === '[') {
      const closeChar = char === '{' ? '}' : ']'
      result += char
      depth++
      lastToken = 'open'
      if (pretty && findNextNonWhitespace(value, index + 1) !== closeChar) {
        result += `\n${indent(depth)}`
      }
      index++
      continue
    }

    if (char === '}' || char === ']') {
      depth--
      if (pretty && lastToken !== 'open') {
        result += `\n${indent(depth)}`
      }
      result += char
      lastToken = 'close'
      index++
      continue
    }

    if (char === ',') {
      result += pretty ? `,\n${indent(depth)}` : ','
      lastToken = 'comma'
      index++
      continue
    }

    if (char === ':') {
      result += pretty ? ': ' : ':'
      lastToken = 'colon'
      index++
      continue
    }

    const { token, nextIndex } = readJsonPrimitiveToken(value, index)
    result += token
    lastToken = 'value'
    index = nextIndex
  }

  return result
}

/** Pretty-print or minify JSON. Toggle: if already multi-line pretty, compress; else expand. */
export function toggleJsonFormat(text: string): { ok: true; text: string; mode: 'pretty' | 'compact' } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'Empty JSON' }
  try {
    JSON.parse(trimmed)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  const compact = rewriteJsonPreservingNumberLiterals(trimmed, 'compact')
  const pretty = rewriteJsonPreservingNumberLiterals(trimmed, 'pretty')
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
