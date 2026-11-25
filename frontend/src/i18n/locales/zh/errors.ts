import type en from '../en/errors'

const zh: Record<keyof typeof en, string> = {
  // JSON 格式化 / 解析
  'errors.jsonEmpty': 'JSON 内容为空',

  // 查看器中显示的文件读取失败（后端详情原样追加）
  'errors.readFileFailed': '读取文件失败：{error}',

  // 无法解码为字节的桥接数据
  'errors.bytesUnsupported': '无法解析文件字节数据',
}

export default zh
