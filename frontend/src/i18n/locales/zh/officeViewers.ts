import type en from '../en/officeViewers'

const zh: Record<keyof typeof en, string> = {
  'office.unsupported.title': '暂不支持预览',
  'office.unsupported.hint': '后续可能会支持更多格式',

  'office.image.loading': '正在加载图片…',
  'office.image.parseFailed': '无法解析图片数据',

  'office.excel.readOnly': 'Excel · 只读',
  'office.excel.loading': '正在加载 Excel…',
  'office.excel.truncatedHint': '仅显示前 {rows} 行 × {cols} 列',
  'office.excel.emptySheet': '空白工作表',
  'office.excel.autofitTitle': '双击自适应列宽',
  'office.excel.resizeTitle': '拖动调整列宽 · 双击自适应',
  'office.excel.cellValue': '单元格内容',
  'office.excel.copyCell': '复制单元格',

  'office.word.readOnly': 'Word · 只读',
  'office.word.loading': '正在加载 Word…',
  'office.word.legacyDocUnsupported': '不支持旧版 .doc 格式，请另存为 .docx 后重新打开。',
  'office.word.emptyDocument': '（空文档）',
  'office.word.conversionNoteOne': '转换提示 {count} 条',
  'office.word.conversionNotesMany': '转换提示 {count} 条',

  'office.outline.label': '目录',
  'office.outline.show': '显示目录',
  'office.outline.hide': '隐藏目录',
  'office.outline.noOutlinePdf': '此 PDF 没有目录',
  'office.outline.noHeadings': '没有标题',
  'office.outline.expand': '展开',
  'office.outline.collapse': '收起',

  'office.zoom.in': '放大',
  'office.zoom.out': '缩小',
  'office.zoom.resetFitWidth': '恢复适应宽度',

  'office.pdf.loading': '正在加载 PDF…',
  'office.pdf.prev': '上一页',
  'office.pdf.next': '下一页',
  'office.pdf.pageNumber': '页码',
  'office.pdf.page': '第 {page} 页',
  'office.pdf.untitled': '（无标题）',
  'office.pdf.parseFailed': '无法解析 PDF 数据',
}

export default zh
