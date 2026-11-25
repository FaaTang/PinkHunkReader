import type en from '../en/viewers'

const zh: Record<keyof typeof en, string> = {
  'viewers.paged.loadingDocument': '正在加载文档…',
  'viewers.paged.status': '已预加载 {start}–{end}',
  'viewers.paged.statusTotal': '已预加载 {start}–{end} / {total}',
  'viewers.paged.inlinePreloaded': '已预加载 {start}–{end}',
  'viewers.paged.inlinePreloadedTotal': '已预加载 {start}–{end} / {total}',
  'viewers.paged.prefetch': '每页预取 {lines} 行',
  'viewers.paged.loading': '加载中…',
  'viewers.paged.scrollMore': '滚动加载更多',
  'viewers.paged.endOfFile': '文件末尾',
  'viewers.paged.loadMore': '加载更多',

  'viewers.pagedText.bar': '编辑（分页） · 已预加载 {start}–{end}',
  'viewers.pagedText.barTotal': '编辑（分页） · 已预加载 {start}–{end} / {total}',

  'viewers.pagedMd.paneEdit': '编辑（分页）',
  'viewers.pagedMd.previewPane': '预览（已预加载 {start}–{end}）',
  'viewers.pagedMd.previewPaneTotal': '预览（已预加载 {start}–{end} / {total}）',

  'viewers.mdView.paneEdit': '编辑',
  'viewers.mdView.panePreview': '预览',
  'viewers.mdView.split': '编辑 + 预览',
  'viewers.mdView.editOnly': '仅编辑',
  'viewers.mdView.previewOnly': '仅预览',

  'viewers.mdOutline.label': '大纲',
  'viewers.mdOutline.show': '显示大纲',
  'viewers.mdOutline.hide': '隐藏大纲',
  'viewers.mdOutline.noHeadings': '无标题',
  'viewers.mdOutline.line': '第 {line} 行',
}

export default zh
