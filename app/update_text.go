package app

import "fmt"

// updateText renders a backend status message in the current UI language.
// Unknown keys fall back to the English table (or the key itself).
func updateText(key string, params map[string]any) string {
	if isUILanguageZH() {
		if text, ok := updateTextZH(key, params); ok {
			return text
		}
	}
	return updateTextEN(key, params)
}

func paramString(params map[string]any, name string) string {
	if params == nil {
		return ""
	}
	if v, ok := params[name]; ok {
		return fmt.Sprint(v)
	}
	return ""
}

func updateTextEN(key string, params map[string]any) string {
	pick := func(name string) string { return paramString(params, name) }
	switch key {
	case "app.update.backend.message.latest":
		return "You are on the latest version"
	case "app.update.backend.message.update_found":
		return fmt.Sprintf("Update available: %s", pick("version"))
	case "app.update.backend.message.download_in_progress":
		return "A download is already in progress"
	case "app.update.backend.message.no_download_in_progress":
		return "No download is in progress"
	case "app.update.backend.message.download_paused":
		return "Download paused"
	case "app.update.backend.message.download_resumed":
		return "Download resumed"
	case "app.update.backend.message.download_cancelled":
		return "Download cancelled"
	case "app.update.backend.error.package_download_http_failed":
		return fmt.Sprintf("Package download failed (HTTP %s)", pick("status"))
	case "app.update.backend.error.package_file_busy":
		return fmt.Sprintf("Could not create package file: %s", pick("detail"))
	case "app.update.backend.message.check_first":
		return "Check for updates first"
	case "app.update.backend.message.no_update_package":
		return "No update package found for this platform"
	case "app.update.backend.message.package_already_downloaded":
		return "Update package already downloaded"
	case "app.update.backend.message.no_downloaded_package":
		return "No downloaded update package"
	case "app.update.backend.message.install_launch_failed":
		return fmt.Sprintf("Failed to start installer: %s", pick("detail"))
	case "app.update.backend.message.install_launch_failed_with_log":
		return fmt.Sprintf("Failed to start installer: %s (log: %s)", pick("detail"), pick("path"))
	case "app.update.backend.message.install_started":
		return "Installer started; the app will quit shortly"
	case "app.update.backend.message.install_started_with_log":
		return fmt.Sprintf("Installer started (log: %s)", pick("path"))
	case "app.update.backend.message.package_path_empty":
		return "Update package path is empty"
	case "app.update.backend.message.package_directory_unavailable":
		return "Update package is missing"
	case "app.update.backend.message.package_directory_unresolved":
		return "Could not resolve update package directory"
	case "app.update.backend.message.open_directory_unsupported":
		return fmt.Sprintf("Opening folders is not supported on %s", pick("platform"))
	case "app.update.backend.message.open_directory_failed":
		return fmt.Sprintf("Failed to open folder: %s", pick("detail"))
	case "app.update.backend.message.opened_install_directory":
		return fmt.Sprintf("Opened: %s", pick("path"))
	case "app.update.backend.message.app_directory_unresolved_download":
		return "Could not resolve download directory"
	case "app.update.backend.message.app_directory_unavailable":
		return fmt.Sprintf("Download directory unavailable: %s", pick("path"))
	case "app.update.backend.message.create_workspace_failed":
		return fmt.Sprintf("Failed to create workspace: %s", pick("path"))
	case "app.update.backend.message.checksum_missing":
		return "Missing package checksum"
	case "app.update.backend.message.checksum_failed":
		return "Package checksum mismatch"
	case "app.update.backend.message.package_downloaded":
		return "Update package downloaded"
	case "app.update.backend.error.latest_version_unparseable":
		return "Could not parse latest version"
	case "app.update.backend.error.sha256_missing_current_package":
		return "SHA256 missing for current platform package"
	case "app.update.backend.error.check_http_status":
		return fmt.Sprintf("Update check failed (HTTP %s)", pick("status"))
	case "app.update.backend.error.release_version_unparseable":
		return "Could not parse release version"
	case "app.update.backend.error.online_update_unsupported":
		return fmt.Sprintf("Online update is not supported on %s", pick("platform"))
	case "app.update.backend.error.update_package_not_found":
		return fmt.Sprintf("Update package not found: %s", pick("name"))
	case "app.update.backend.error.install_unsupported":
		return fmt.Sprintf("Install is not supported on %s", pick("platform"))
	case "app.proxy.backend.message.saved":
		return "Proxy settings saved"
	default:
		return key
	}
}

func updateTextZH(key string, params map[string]any) (string, bool) {
	pick := func(name string) string { return paramString(params, name) }
	switch key {
	case "app.update.backend.message.latest":
		return "已是最新版本", true
	case "app.update.backend.message.update_found":
		return fmt.Sprintf("有可用更新：%s", pick("version")), true
	case "app.update.backend.message.download_in_progress":
		return "已有下载任务正在进行", true
	case "app.update.backend.message.no_download_in_progress":
		return "当前没有正在进行的下载", true
	case "app.update.backend.message.download_paused":
		return "下载已暂停", true
	case "app.update.backend.message.download_resumed":
		return "下载已继续", true
	case "app.update.backend.message.download_cancelled":
		return "下载已取消", true
	case "app.update.backend.error.package_download_http_failed":
		return fmt.Sprintf("安装包下载失败（HTTP %s）", pick("status")), true
	case "app.update.backend.error.package_file_busy":
		return fmt.Sprintf("无法创建安装包文件：%s", pick("detail")), true
	case "app.update.backend.message.check_first":
		return "请先检查更新", true
	case "app.update.backend.message.no_update_package":
		return "未找到适用于当前平台的更新包", true
	case "app.update.backend.message.package_already_downloaded":
		return "更新包已下载", true
	case "app.update.backend.message.no_downloaded_package":
		return "没有已下载的更新包", true
	case "app.update.backend.message.install_launch_failed":
		return fmt.Sprintf("无法启动安装程序：%s", pick("detail")), true
	case "app.update.backend.message.install_launch_failed_with_log":
		return fmt.Sprintf("无法启动安装程序：%s（日志：%s）", pick("detail"), pick("path")), true
	case "app.update.backend.message.install_started":
		return "安装程序已启动，应用即将退出", true
	case "app.update.backend.message.install_started_with_log":
		return fmt.Sprintf("安装程序已启动（日志：%s）", pick("path")), true
	case "app.update.backend.message.package_path_empty":
		return "更新包路径为空", true
	case "app.update.backend.message.package_directory_unavailable":
		return "更新包缺失", true
	case "app.update.backend.message.package_directory_unresolved":
		return "无法解析更新包目录", true
	case "app.update.backend.message.open_directory_unsupported":
		return fmt.Sprintf("%s 平台不支持打开文件夹", pick("platform")), true
	case "app.update.backend.message.open_directory_failed":
		return fmt.Sprintf("无法打开文件夹：%s", pick("detail")), true
	case "app.update.backend.message.opened_install_directory":
		return fmt.Sprintf("已打开：%s", pick("path")), true
	case "app.update.backend.message.app_directory_unresolved_download":
		return "无法解析下载目录", true
	case "app.update.backend.message.app_directory_unavailable":
		return fmt.Sprintf("下载目录不可用：%s", pick("path")), true
	case "app.update.backend.message.create_workspace_failed":
		return fmt.Sprintf("无法创建下载工作区：%s", pick("path")), true
	case "app.update.backend.message.checksum_missing":
		return "缺少安装包校验值", true
	case "app.update.backend.message.checksum_failed":
		return "安装包校验不匹配", true
	case "app.update.backend.message.package_downloaded":
		return "更新包已下载", true
	case "app.update.backend.error.latest_version_unparseable":
		return "无法解析最新版本号", true
	case "app.update.backend.error.sha256_missing_current_package":
		return "当前平台安装包缺少 SHA256", true
	case "app.update.backend.error.check_http_status":
		return fmt.Sprintf("检查更新失败（HTTP %s）", pick("status")), true
	case "app.update.backend.error.release_version_unparseable":
		return "无法解析发布版本号", true
	case "app.update.backend.error.online_update_unsupported":
		return fmt.Sprintf("%s 平台不支持在线更新", pick("platform")), true
	case "app.update.backend.error.update_package_not_found":
		return fmt.Sprintf("未找到更新包：%s", pick("name")), true
	case "app.update.backend.error.install_unsupported":
		return fmt.Sprintf("%s 平台不支持安装", pick("platform")), true
	case "app.proxy.backend.message.saved":
		return "代理设置已保存", true
	default:
		return "", false
	}
}
