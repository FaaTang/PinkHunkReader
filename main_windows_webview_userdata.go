//go:build windows

package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const webviewUserDataDirName = "WebView2"

func resolveWindowsWebviewUserDataPath() string {
	appDataDir := strings.TrimSpace(os.Getenv("APPDATA"))
	if appDataDir == "" {
		return ""
	}

	targetDir := filepath.Join(appDataDir, "PinkHunkReader", webviewUserDataDirName)
	_ = migrateLegacyWindowsWebviewUserData(appDataDir, targetDir)
	cleanupLegacyWindowsWebviewUserData(appDataDir, targetDir)
	return targetDir
}

func migrateLegacyWindowsWebviewUserData(appDataDir, targetDir string) error {
	if dirHasContent(targetDir) {
		return nil
	}

	src := pickLegacyWindowsWebviewUserData(appDataDir, targetDir)
	if src == "" {
		return nil
	}
	return copyDirTree(src, targetDir)
}

func pickLegacyWindowsWebviewUserData(appDataDir, targetDir string) string {
	candidates := listLegacyWindowsWebviewUserDataDirs(appDataDir, targetDir)
	if len(candidates) == 0 {
		return ""
	}

	best := ""
	var bestMod time.Time
	for _, candidate := range candidates {
		if !dirHasContent(candidate) {
			continue
		}
		info, err := os.Stat(candidate)
		if err != nil {
			continue
		}
		mod := info.ModTime()
		if best == "" || mod.After(bestMod) {
			best = candidate
			bestMod = mod
		}
	}
	return best
}

func cleanupLegacyWindowsWebviewUserData(appDataDir, targetDir string) {
	for _, candidate := range listLegacyWindowsWebviewUserDataDirs(appDataDir, targetDir) {
		_ = os.RemoveAll(candidate)
	}
}

func listLegacyWindowsWebviewUserDataDirs(appDataDir, targetDir string) []string {
	appDataDir = filepath.Clean(strings.TrimSpace(appDataDir))
	targetDir = filepath.Clean(strings.TrimSpace(targetDir))
	if appDataDir == "" {
		return nil
	}

	entries, err := os.ReadDir(appDataDir)
	if err != nil {
		return nil
	}

	seen := make(map[string]struct{})
	var out []string
	add := func(path string) {
		src := filepath.Clean(strings.TrimSpace(path))
		if src == "" || strings.EqualFold(src, targetDir) {
			return
		}
		// Never touch the shared app config root (sessions / prefs live here).
		if strings.EqualFold(src, filepath.Join(appDataDir, "PinkHunkReader")) {
			return
		}
		key := strings.ToLower(src)
		if _, exists := seen[key]; exists {
			return
		}
		info, err := os.Stat(src)
		if err != nil || !info.IsDir() {
			return
		}
		seen[key] = struct{}{}
		out = append(out, src)
	}

	exeName := "PinkHunkReader.exe"
	if exePath, err := os.Executable(); err == nil {
		base := strings.TrimSpace(filepath.Base(exePath))
		if base != "" {
			exeName = base
		}
	}
	exeBase := strings.TrimSuffix(exeName, filepath.Ext(exeName))
	add(filepath.Join(appDataDir, exeName))
	add(filepath.Join(appDataDir, exeBase))
	add(filepath.Join(appDataDir, "PinkHunkReader.exe"))
	add(filepath.Join(appDataDir, "PinkHunkReader-dev.exe"))

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		lower := strings.ToLower(name)
		// Portable / auto-update builds leave %APPDATA%\<exe-filename>\EBWebView.
		if strings.HasPrefix(lower, "pinkhunkreader") && strings.HasSuffix(lower, ".exe") {
			add(filepath.Join(appDataDir, name))
		}
	}
	return out
}

func dirHasContent(path string) bool {
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return false
	}
	entries, err := os.ReadDir(path)
	return err == nil && len(entries) > 0
}

func copyDirTree(srcDir, dstDir string) error {
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		return err
	}

	return filepath.WalkDir(srcDir, func(srcPath string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relPath, err := filepath.Rel(srcDir, srcPath)
		if err != nil {
			return err
		}
		if relPath == "." {
			return nil
		}
		dstPath := filepath.Join(dstDir, relPath)

		if d.IsDir() {
			return os.MkdirAll(dstPath, 0o755)
		}

		info, err := d.Info()
		if err != nil {
			return err
		}
		return copyFileWithMode(srcPath, dstPath, info.Mode())
	})
}

func copyFileWithMode(srcPath, dstPath string, mode os.FileMode) error {
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	if err := os.MkdirAll(filepath.Dir(dstPath), 0o755); err != nil {
		return err
	}
	dstFile, err := os.OpenFile(dstPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode.Perm())
	if err != nil {
		return err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return err
	}
	return nil
}
