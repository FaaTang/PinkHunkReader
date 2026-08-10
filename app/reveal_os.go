package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// RevealInFileManager opens the OS file manager and selects the given path when possible.
func (a *App) RevealInFileManager(path string) error {
	return revealPathInFileManager(path, true)
}

// revealPathInFileManager opens the system file manager for path.
// When selectItem is true, the path is selected (Windows Explorer / macOS Finder).
// When false, the containing folder is opened (or the directory itself if path is a dir).
func revealPathInFileManager(path string, selectItem bool) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return fmt.Errorf("path is empty")
	}
	cleaned := filepath.Clean(path)
	info, err := os.Stat(cleaned)
	if err != nil {
		return fmt.Errorf("path not found: %w", err)
	}
	dirPath := cleaned
	if !info.IsDir() {
		dirPath = filepath.Dir(cleaned)
	}
	if dirPath == "" || dirPath == "." {
		return fmt.Errorf("could not resolve containing folder")
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		if selectItem {
			cmd = exec.Command("open", "-R", cleaned)
		} else {
			cmd = exec.Command("open", dirPath)
		}
	case "windows":
		if selectItem {
			cmd = exec.Command("explorer", "/select,", cleaned)
		} else {
			cmd = exec.Command("explorer", dirPath)
		}
	case "linux":
		cmd = exec.Command("xdg-open", dirPath)
	default:
		return fmt.Errorf("reveal in file manager is unsupported on %s", runtime.GOOS)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to open file manager: %w", err)
	}
	return nil
}
