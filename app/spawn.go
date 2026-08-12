package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/FaaTang/PinkHunkReader/define"
)

type launchOptions struct {
	WindowID      string
	OpenPath      string
	OpenPaths     []string
	OpenIsDir     bool
	ShouldRestore bool
	SpawnRestores []string
}

func parseLaunchArgs(args []string) launchOptions {
	opts := launchOptions{}
	for _, raw := range args {
		arg := strings.TrimSpace(raw)
		if arg == "" {
			continue
		}
		switch {
		case strings.HasPrefix(arg, "--window-id="):
			opts.WindowID = strings.TrimSpace(strings.TrimPrefix(arg, "--window-id="))
		case strings.HasPrefix(arg, "--open-folder="):
			p := strings.TrimSpace(strings.TrimPrefix(arg, "--open-folder="))
			opts.OpenPaths = append(opts.OpenPaths, p)
			opts.OpenPath = p
			opts.OpenIsDir = true
		case strings.HasPrefix(arg, "--open-file="):
			p := strings.TrimSpace(strings.TrimPrefix(arg, "--open-file="))
			opts.OpenPaths = append(opts.OpenPaths, p)
			opts.OpenPath = p
			opts.OpenIsDir = false
		case strings.HasPrefix(arg, "--open="):
			p := strings.TrimSpace(strings.TrimPrefix(arg, "--open="))
			opts.OpenPaths = append(opts.OpenPaths, p)
			opts.OpenPath = p
		case arg == "--open-dir":
			opts.OpenIsDir = true
		case arg == "--restore":
			opts.ShouldRestore = true
		case strings.HasPrefix(arg, "--"):
			// ignore unknown flags
		default:
			// Positional path from shell / Open With.
			opts.OpenPaths = append(opts.OpenPaths, arg)
			opts.OpenPath = arg
		}
	}
	if opts.OpenPath == "" && len(opts.OpenPaths) > 0 {
		opts.OpenPath = opts.OpenPaths[0]
	}
	if !opts.OpenIsDir && opts.OpenPath != "" {
		if st, err := os.Stat(opts.OpenPath); err == nil && st.IsDir() {
			opts.OpenIsDir = true
		}
	}
	return opts
}

func (a *App) resolveLaunch(opts launchOptions) launchOptions {
	_ = withWindowStore(func(configDir string) error {
		m, err := loadWindowManifestLocked(configDir)
		if err != nil {
			return err
		}
		if opts.WindowID != "" {
			// Child / restored window: adopt id and mark restore unless opening a fresh path only.
			a.windowID = opts.WindowID
			if opts.OpenPath == "" && len(opts.OpenPaths) == 0 {
				opts.ShouldRestore = true
			}
			// One-shot update hint is consumed so a later cold start does not double-restore.
			_ = os.Remove(updateRestoreHintPath(configDir))
			return nil
		}

		// Post-update relaunch: restore exactly the window that initiated the update.
		// Do not spawn sibling stale windows (those look like "a new empty instance").
		if hintID := consumeUpdateRestoreHintLocked(configDir); hintID != "" {
			opts.WindowID = hintID
			opts.ShouldRestore = true
			opts.SpawnRestores = nil
			a.windowID = hintID
			return nil
		}

		stale := staleWindowIDsLocked(m)
		live := hasLiveWindowLocked(m)
		if len(stale) > 0 && !live {
			primary, spawn := prioritizeRestorableWindowIDs(configDir, stale)
			opts.WindowID = primary
			opts.ShouldRestore = true
			opts.SpawnRestores = spawn
			a.windowID = opts.WindowID
			return nil
		}

		// Fresh window (empty start, or another instance already running).
		opts.WindowID = newWindowID()
		opts.ShouldRestore = false
		a.windowID = opts.WindowID
		return nil
	})
	if a.windowID == "" && opts.WindowID != "" {
		a.windowID = opts.WindowID
	}
	return opts
}

// GetLaunchInfo returns CLI / restore instructions for the frontend.
func (a *App) GetLaunchInfo() define.LaunchInfo {
	paths := append([]string{}, a.launch.OpenPaths...)
	if len(paths) == 0 && a.launch.OpenPath != "" {
		paths = []string{a.launch.OpenPath}
	}
	return define.LaunchInfo{
		WindowID:      a.launch.WindowID,
		OpenPath:      a.launch.OpenPath,
		OpenPaths:     paths,
		OpenIsDir:     a.launch.OpenIsDir,
		ShouldRestore: a.launch.ShouldRestore,
	}
}

// SpawnRestoredWindows starts sibling processes for remaining crash-recovery windows.
func (a *App) SpawnRestoredWindows() error {
	for _, id := range a.launch.SpawnRestores {
		if err := a.spawnWindowProcess(id, "", false, true); err != nil {
			return err
		}
	}
	a.launch.SpawnRestores = nil
	return nil
}

// SpawnNewWindow starts a new process for the given path (new window open).
func (a *App) SpawnNewWindow(openPath string, isDir bool) (string, error) {
	openPath = strings.TrimSpace(openPath)
	if openPath == "" {
		return "", fmt.Errorf("empty open path")
	}
	id := newWindowID()
	// Seed an empty session so restore has a file if needed.
	_ = a.SaveWindowSession(define.WindowSessionState{
		Version:     2,
		WindowID:    id,
		Roots:       nil,
		UntitledSeq: 1,
		Tabs:        []define.WindowSessionTab{},
	})
	if err := a.spawnWindowProcess(id, openPath, isDir, false); err != nil {
		_ = a.UnregisterWindow(id)
		return "", err
	}
	return id, nil
}

func (a *App) spawnWindowProcess(windowID, openPath string, isDir, restore bool) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	args := []string{"--window-id=" + windowID}
	if restore {
		args = append(args, "--restore")
	}
	if openPath != "" {
		if isDir {
			args = append(args, "--open-folder="+openPath)
		} else {
			args = append(args, "--open-file="+openPath)
		}
	}
	cmd := exec.Command(exe, args...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	cmd.Stdin = nil
	if dir := filepath.Dir(exe); dir != "" {
		cmd.Dir = dir
	}
	return cmd.Start()
}
