/** GitHub-style heading slug (Unicode letters kept; punctuation stripped). */
const GITHUB_PUNCT = /[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc}\- ]/gu

export function githubHeadingSlug(text: string): string {
  return text.replace(GITHUB_PUNCT, '').toLowerCase().replace(/ /g, '-')
}

/** Tracks duplicate heading slugs the same way GitHub does (foo, foo-1, foo-2, …). */
export function createHeadingSlugger(): (text: string) => string {
  const seen = new Map<string, number>()
  return (text: string) => {
    const base = githubHeadingSlug(text)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base}-${n}`
  }
}

const HTML_ENTITY: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = hex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10)
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code)
        } catch {
          return match
        }
      }
      return match
    }
    return HTML_ENTITY[body.toLowerCase()] ?? match
  })
}

/**
 * Inline Markdown → the plain text a renderer would show for a heading.
 * Mirrors md2pdf's `headingPlainText` (inline markdown parsed, tags stripped),
 * without pulling a Markdown parser into the bundle: images keep alt text,
 * links keep their label, code spans keep their content, emphasis markers and
 * inline HTML are removed, and backslash escapes become literal characters.
 */
export function plainHeadingText(raw: string): string {
  if (!raw) return ''
  const stash: string[] = []
  const hold = (text: string): string => {
    stash.push(text)
    return `\u0000${stash.length - 1}\u0000`
  }
  let s = raw.replace(/\s+#+\s*$/, '').trim()

  // Code spans keep their content verbatim (before emphasis stripping).
  s = s.replace(/(`+)([\s\S]*?)\1/g, (_m, _ticks: string, code: string) => hold(code.trim()))
  // Backslash escapes keep the escaped character literal.
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!>~|])/g, (_m, ch: string) => hold(ch))

  // Images keep alt text; links keep their label.
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
  // Autolinks keep the URL; other inline HTML tags are dropped.
  s = s.replace(/<((?:https?|mailto):[^>\s]+)>/gi, '$1')
  s = s.replace(/<\/?[A-Za-z][^>]*>/g, '')

  // Strong / emphasis / strikethrough. Underscore emphasis stays word-bounded
  // so snake_case headings are left alone.
  s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
  s = s.replace(/\*(?=\S)([\s\S]*?\S)\*/g, '$1')
  s = s.replace(/(^|[^\p{L}\p{N}_])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}_])/gu, '$1$2')
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')

  // Restore protected literals, then decode entities (so escaped text stays literal).
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, idx: string) => stash[Number(idx)] ?? '')
  s = decodeHtmlEntities(s)
  return s.replace(/[ \t]+/g, ' ').trim()
}

/** Plain text from react-markdown heading children (strips inline markup). */
export function plainTextFromNode(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(plainTextFromNode).join('')
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const props = (node as { props?: { children?: unknown } }).props
    return plainTextFromNode(props?.children)
  }
  return ''
}

export function decodeHashId(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Find a heading target inside the preview root for an in-document hash. */
export function findPreviewHeading(root: ParentNode, hash: string): HTMLElement | null {
  const id = decodeHashId(hash)
  if (!id) return null
  try {
    const byId = root.querySelector(`#${CSS.escape(id)}`)
    if (byId instanceof HTMLElement) return byId
  } catch {
    /* invalid selector */
  }
  const heads = root.querySelectorAll('h1,h2,h3,h4,h5,h6')
  for (const h of Array.from(heads)) {
    if (!(h instanceof HTMLElement)) continue
    const title = (h.textContent ?? '').trim()
    if (title === id || githubHeadingSlug(title) === id) return h
  }
  return null
}

export function scrollPreviewToHeading(el: HTMLElement): void {
  // content-visibility:auto on preview children can leave far nodes unsized.
  el.style.contentVisibility = 'visible'
  el.scrollIntoView({ block: 'start' })
}
