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
