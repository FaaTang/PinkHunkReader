import { memo, useMemo, type MouseEvent } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { PluggableList } from 'unified'
import {
  createHeadingSlugger,
  findPreviewHeading,
  plainTextFromNode,
  scrollPreviewToHeading,
} from '../utils/mdHeadingAnchor'

/** Allow inline HTML (incl. style) while still stripping script / event handlers. */
const mdHtmlSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'style'],
  },
}

const rehypePlugins: PluggableList = [rehypeRaw, [rehypeSanitize, mdHtmlSchema]]

const tableComponent: Components['table'] = ({ children, node: _node, ...props }) => (
  <div className="md-table-wrap">
    <table {...props}>{children}</table>
  </div>
)

function headingComponent(
  Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
  slug: (text: string) => string,
): Components['h1'] {
  return ({ children, node: _node, ...props }) => {
    const text = plainTextFromNode(children).trim()
    const id = text ? slug(text) : props.id
    return (
      <Tag {...props} id={id}>
        {children}
      </Tag>
    )
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
  if (!(a instanceof HTMLAnchorElement)) return
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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        urlTransform={urlTransform}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
