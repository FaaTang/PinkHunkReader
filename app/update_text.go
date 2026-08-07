package app

import "fmt"

func updateText(key string, params map[string]any) string {
	pick := func(name string) string {
		if params == nil {
			return ""
		}
		if v, ok := params[name]; ok {
			return fmt.Sprint(v)
		}
		return ""
	}
	switch key {
	case "app.update.backend.message.latest":
		return "You are on the latest version"
	case "app.update.backend.message.update_found":
		return fmt.Sprintf("Update available: %s", pick("version"))
	case "app.update.backend.message.download_in_progress":
		return "A download is already in progress"
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
	default:
		return key
	}
}
