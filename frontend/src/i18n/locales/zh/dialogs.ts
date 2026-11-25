import type en from '../en/dialogs'

const zh: Record<keyof typeof en, string> = {
  // 对话框通用按钮
  'dialogs.choice.yesKey': '是(Y)',
  'dialogs.choice.noKey': '否(N)',

  // CloseSaveDialog
  'dialogs.closeSave.ariaLabel': '未保存的更改',
  'dialogs.closeSave.title': '保存更改？',
  'dialogs.closeSave.message': '“{file}”有未保存的更改。',
  'dialogs.closeSave.remainingOne': '（之后还有 {count} 个文件）',
  'dialogs.closeSave.remainingMany': '（之后还有 {count} 个文件）',
  'dialogs.closeSave.yesToAll': '全部保存',
  'dialogs.closeSave.noToAll': '全部不保存',

  // KeepMissingDialog
  'dialogs.keepMissing.ariaKeep': '保留文件',
  'dialogs.keepMissing.titleKeep': '保留文件？',
  'dialogs.keepMissing.sourceMissing': '源文件已丢失',
  'dialogs.keepMissing.message': '文件“{file}”已不存在。',
  'dialogs.keepMissing.keepHint': '是否在编辑器中继续保留？',

  // ReloadRenamedDialog
  'dialogs.reloadRenamed.ariaLabel': '文件已重命名',
  'dialogs.reloadRenamed.title': '重新加载已重命名的文件？',
  'dialogs.reloadRenamed.message': '“{old}”似乎已被重命名为“{new}”。是否重新加载新文件？',

  // GoToDialog
  'dialogs.goTo.page': '页',
  'dialogs.goTo.line': '行',
  'dialogs.goTo.goToPage': '跳转到页',
  'dialogs.goTo.goToLine': '跳转到行',
  'dialogs.goTo.range': '（1–{max}）',

  // UpdateProgressDialog
  'dialogs.updateProgress.ariaLabel': '更新下载',
  'dialogs.updateProgress.done': '下载完成',
  'dialogs.updateProgress.failed': '下载失败',
  'dialogs.updateProgress.cancelled': '下载已取消',
  'dialogs.updateProgress.paused': '下载已暂停',
  'dialogs.updateProgress.downloading': '正在下载更新…',
  'dialogs.updateProgress.update': '更新',
  'dialogs.updateProgress.package': '更新包',
  'dialogs.updateProgress.hideTitle': '隐藏 — 可从工具栏或“设置 → 关于”重新打开',
  'dialogs.updateProgress.pause': '暂停',
  'dialogs.updateProgress.resume': '继续',
  'dialogs.updateProgress.installAndRestart': '安装并重启',

  // MdViewModeToggle
  'dialogs.mdViewMode.group': 'Markdown 视图模式',
  'dialogs.mdViewMode.edit': '编辑',
  'dialogs.mdViewMode.editTitle': '仅编辑',
  'dialogs.mdViewMode.split': '分栏',
  'dialogs.mdViewMode.splitTitle': '编辑与预览并排显示',
  'dialogs.mdViewMode.preview': '预览',
  'dialogs.mdViewMode.previewTitle': '仅预览',

  // ScrollLoadFooter
  'dialogs.scrollLoad.loadingMore': '正在加载更多…',
}

export default zh
