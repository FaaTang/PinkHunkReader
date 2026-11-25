import type en from '../en/update'

const zh: Record<keyof typeof en, string> = {
  // 设置 → 关于 中的状态行
  'update.status.notChecked': '尚未检查',
  'update.status.checking': '正在检查…',
  'update.status.upToDate': '已是最新版本（v{version}）',
  'update.status.available': '有可用更新：v{version}',
  'update.status.downloaded': '更新 v{version} 已下载',
  'update.status.skipped': '已跳过 v{version}',
  'update.status.installerStarted': '安装程序已启动',

  // 更新流程产生的失败提示（后端消息已本地化）
  'update.error.checkFailed': '检查失败',
  'update.error.checkFailedDetail': '检查失败：{message}',
  'update.error.unknown': '未知',
  'update.error.downloadFailed': '下载失败',
  'update.error.downloadCancelled': '下载已取消',
  'update.error.pauseFailed': '暂停失败',
  'update.error.resumeFailed': '继续失败',
  'update.error.cancelFailed': '取消失败',
  'update.error.installFailed': '安装失败',
  'update.error.openPackageFailed': '无法打开安装包',
}

export default zh
