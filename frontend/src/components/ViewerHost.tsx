import type { OpenTab } from '../types'
import { MarkdownView } from '../viewers/MarkdownView'
import { TextView } from '../viewers/TextView'
import { PagedMarkdown } from '../viewers/PagedMarkdown'
import { PagedText } from '../viewers/PagedText'
import { PdfView } from '../viewers/PdfView'
import { ImageView } from '../viewers/ImageView'
import { WordView } from '../viewers/WordView'
import { ExcelView } from '../viewers/ExcelView'
import { UnsupportedView } from '../viewers/UnsupportedView'
import './ViewerHost.css'

interface Props {
  tab: OpenTab
  onChange: (content: string) => void
  onDirty: (dirty: boolean) => void
  registerSave: (fn: (() => Promise<void>) | null) => void
}

/** Large text/markdown use viewport-sized paging; still editable + saveable. */
export function ViewerHost({ tab, onChange, onDirty, registerSave }: Props) {
  return (
    <div className="viewer-host">
      {tab.kind === 'markdown'
        ? tab.largeMode
          ? <PagedMarkdown path={tab.path} onDirty={onDirty} registerSave={registerSave} />
          : <MarkdownView path={tab.path} content={tab.content} editable={tab.editable} onChange={onChange} />
        : null}
      {tab.kind === 'text'
        ? tab.largeMode
          ? <PagedText path={tab.path} onDirty={onDirty} registerSave={registerSave} />
          : (
            <TextView
              content={tab.content}
              editable={tab.editable}
              path={tab.path}
              name={tab.name}
              languageHint={tab.languageHint}
              autoFocus={Boolean(tab.untitled)}
              onChange={onChange}
            />
          )
        : null}
      {tab.kind === 'pdf' ? <PdfView path={tab.path} /> : null}
      {tab.kind === 'image' ? <ImageView path={tab.path} name={tab.name} /> : null}
      {tab.kind === 'word' ? <WordView path={tab.path} name={tab.name} /> : null}
      {tab.kind === 'excel' ? <ExcelView path={tab.path} name={tab.name} /> : null}
      {tab.kind === 'unknown' ? <UnsupportedView name={tab.name} /> : null}
    </div>
  )
}
