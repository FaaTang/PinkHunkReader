import { memo, useMemo, type MouseEvent } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  createHeadingSlugger,
  findPreviewHeading,
  plainTextFromNode,
  scrollPreviewToHeading,
} from '../utils/mdHeadingAnchor'

const tableComponent: Components['table'] = ({ children }) => (
  <div className="md-table-wrap">
    <table>{children}</table>
  </div>
)

function headingComponent(
  Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
  slug: (text: string) => string,
): Components['h1'] {
  return ({ children }) => {
    const text = plainTextFromNode(children).trim()
    const id = text ? slug(text) : ''
    return id ? <Tag id={id}>{children}</Tag> : <Tag>{children}</Tag>
  }
}

function buildComponents(slug: (text: string) => string): Components {
  return {
    table: tableComponent,
    h1: headingComponent('h1', slug),
    h2: headingComponent('h2', slug),
    h3: headingComponent('h3', slug),
    h4: headingComponent('h4', slug),
    h5: headingComponent('h5', slug),
    h6: headingComponent('h6', slug),
  }
}

/** data:image/* is common in local MD docs; defaultUrlTransform strips all data: URLs. */
const DATA_IMAGE_RE = /^data:image\/[a-z0-9.+-]+[;,]/i

function urlTransform(url: string, key: string): string {
  if (key === 'src' && DATA_IMAGE_RE.test(url)) return url
  return defaultUrlTransform(url)
}

interface Props {
  content: string
}

function onPreviewClick(e: MouseEvent<HTMLDivElement>) {
  const a = (e.target as HTMLElement | null)?.closest?.('a')
  if (!a || !(a instanceof HTMLAnchorElement)) return
  const href = a.getAttribute('href')
  if (!href || !href.startsWith('#') || href === '#') return
  e.preventDefault()
  e.stopPropagation()
  const target = findPreviewHeading(e.currentTarget, href)
  if (target) scrollPreviewToHeading(target)
}

/** Memoized so parent scroll state updates do not re-parse markdown. */
export const MarkdownPreview = memo(function MarkdownPreview({ content }: Props) {
  const components = useMemo(() => buildComponents(createHeadingSlugger()), [content])
  return (
    <div className="md-preview-root" onClick={onPreviewClick}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
})
