import { memo } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const components: Components = {
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table>{children}</table>
    </div>
  ),
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

/** Memoized so parent scroll state updates do not re-parse markdown. */
export const MarkdownPreview = memo(function MarkdownPreview({ content }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
      {content}
    </ReactMarkdown>
  )
})
