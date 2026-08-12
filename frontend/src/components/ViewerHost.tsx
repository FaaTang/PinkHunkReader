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
  /** False when the tab is kept mounted but hidden (preserve scroll / editor state). */
  active: boolean
  onChange: (content: string) => void
  onDirty: (dirty: boolean) => void
  registerSave: (fn: (() => Promise<void>) | null) => void
}

/** Large text/markdown use viewport-sized paging; still editable + saveable. */
export function ViewerHost({ tab, active, onChange, onDirty, registerSave }: Props) {
  return (
    <div className="viewer-host">
      {tab.kind === 'markdown'
        ? tab.largeMode
          ? (
            <PagedMarkdown
              path={tab.path}
              active={active}
              onDirty={onDirty}
              registerSave={registerSave}
            />
          )
          : (
            <MarkdownView
              path={tab.path}
              content={tab.content}
              editable={tab.editable}
              active={active}
              onChange={onChange}
            />
          )
        : null}
      {tab.kind === 'text'
        ? tab.largeMode
          ? (
            <PagedText
              path={tab.path}
              active={active}
              onDirty={onDirty}
              registerSave={registerSave}
            />
          )
          : (
            <TextView
              content={tab.content}
              editable={tab.editable}
              path={tab.path}
              name={tab.name}
              languageHint={tab.languageHint}
              autoFocus={Boolean(tab.untitled) && active}
              active={active}
              onChange={onChange}
            />
          )
        : null}
      {tab.kind === 'pdf' ? <PdfView path={tab.path} active={active} /> : null}
      {tab.kind === 'image' ? <ImageView path={tab.path} name={tab.name} /> : null}
      {tab.kind === 'word' ? <WordView path={tab.path} name={tab.name} active={active} /> : null}
      {tab.kind === 'excel' ? <ExcelView path={tab.path} name={tab.name} /> : null}
      {tab.kind === 'unknown' ? <UnsupportedView name={tab.name} /> : null}
    </div>
  )
}
