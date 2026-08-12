package app

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/FaaTang/PinkHunkReader/define"
)

const shellPrefsFileName = "shell_prefs.json"

func shellPrefsPath(configDir string) string {
	return filepath.Join(configDir, shellPrefsFileName)
}

// GetShellIntegrationPrefs returns shell integration preferences (default: context menu on).
func (a *App) GetShellIntegrationPrefs() (define.ShellIntegrationPrefs, error) {
	prefs := define.ShellIntegrationPrefs{ContextMenu: true}
	err := withWindowStore(func(configDir string) error {
		var loaded shellPrefsFile
		if err := readJSONFile(shellPrefsPath(configDir), &loaded); err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		prefs = loaded.toPrefs()
		return nil
	})
	return prefs, err
}

// SaveShellIntegrationPrefs persists prefs and applies OS registration immediately.
func (a *App) SaveShellIntegrationPrefs(prefs define.ShellIntegrationPrefs) (define.ShellIntegrationPrefs, error) {
	prefs = normalizeShellPrefs(prefs)
	err := withWindowStore(func(configDir string) error {
		enabled := prefs.ContextMenu
		return writeJSONAtomic(shellPrefsPath(configDir), shellPrefsFile{ContextMenu: &enabled})
	})
	if err != nil {
		return prefs, err
	}
	if err := a.applyShellIntegration(prefs.ContextMenu); err != nil {
		return prefs, fmt.Errorf("saved prefs but failed to update OS integration: %w", err)
	}
	return prefs, nil
}

type shellPrefsFile struct {
	ContextMenu *bool `json:"contextMenu"`
}

func (f shellPrefsFile) toPrefs() define.ShellIntegrationPrefs {
	if f.ContextMenu == nil {
		return define.ShellIntegrationPrefs{ContextMenu: true}
	}
	return define.ShellIntegrationPrefs{ContextMenu: *f.ContextMenu}
}

func normalizeShellPrefs(p define.ShellIntegrationPrefs) define.ShellIntegrationPrefs {
	return define.ShellIntegrationPrefs{ContextMenu: p.ContextMenu}
}

func (a *App) applyShellIntegration(enabled bool) error {
	exe, err := resolveExecutablePath()
	if err != nil {
		return err
	}
	if enabled {
		return registerShellContextMenu(exe)
	}
	return unregisterShellContextMenu()
}

func (a *App) syncShellIntegrationOnStartup() {
	prefs, err := a.GetShellIntegrationPrefs()
	if err != nil {
		return
	}
	_ = a.applyShellIntegration(prefs.ContextMenu)
}

func resolveExecutablePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return filepath.Abs(exe)
}
