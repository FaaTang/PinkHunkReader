import type en from '../en/tree'

const zh: Record<keyof typeof en, string> = {
  // Open menu (toolbar "File" dropdown)
  'tree.menu.file': '文件',
  'tree.menu.openFileHint': '打开文件（{shortcut}）',
  'tree.menu.openFolder': '打开文件夹',
  'tree.menu.openFolderHint': '打开文件夹（{shortcut}）',
  'tree.menu.openRecent': '最近使用',
  'tree.menu.recentFolder': '文件夹',
  'tree.menu.noRecent': '暂无最近使用项',
  'tree.menu.newFile': '新建文件',
  'tree.menu.newFileHint': '新建文件（{shortcut}）',

  // Explorer context menu
  'tree.menu.removeFromWorkspace': '从工作区移除',
  'tree.menu.removeAllFolders': '移除所有文件夹',
  'tree.menu.itemCount': '{count} 项',

  // Reveal / locate status messages
  'tree.reveal.notInWorkspace': '文件不在当前工作区中',
  'tree.reveal.located': '已定位 {name}',

  // Tab bar
  'tree.tab.locate': '在资源管理器中定位',
  'tree.tab.locateNamed': '在资源管理器中定位 {name}',
  'tree.tab.closeNamed': '关闭 {name}',
  'tree.tab.closeLeft': '关闭左侧标签页',
  'tree.tab.closeRight': '关闭右侧标签页',
  'tree.tab.closeAll': '关闭全部',

  // Open placement dialog
  'tree.placement.ariaLabel': '打开位置',
  'tree.placement.title': '在哪里打开？',
  'tree.placement.bodyWithLabel': '已有打开的工作区。请选择打开“{path}”的方式。',
  'tree.placement.bodyNoLabel': '已有打开的工作区。请选择打开所选内容的方式。',
  'tree.placement.newWindow': '新窗口',
  'tree.placement.currentWorkspace': '当前工作区',

  // Open parent folder dialog
  'tree.parentFolder.label': '打开上级文件夹',
  'tree.parentFolder.title': '打开上级文件夹？',
  'tree.parentFolder.bodyWithLabel': '打开“{path}”时，请选择是否将上级文件夹添加到资源管理器。',
  'tree.parentFolder.bodyNoLabel': '打开文件时，请选择是否将上级文件夹添加到资源管理器。',
  'tree.parentFolder.fileOnly': '仅文件',

  // Shared by the open-placement / open-parent-folder dialogs
  'tree.dialog.alwaysUse': '始终使用此选项',
}

export default zh
