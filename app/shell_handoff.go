package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	shellBootClaimName = "shell_boot_claim.json"
	shellPendingDirName = "shell_pending"
	shellVerbName      = "PinkHunkReader"
	shellMenuLabel     = "Open with PinkHunkReader"
)

type shellBootClaim struct {
	PID       int   `json:"pid"`
	StartedAt int64 `json:"startedAt"`
}

type shellPendingPayload struct {
	Paths     []string `json:"paths"`
	Focus     bool     `json:"focus"`
	CreatedAt int64    `json:"createdAt"`
}

// TryHandoffExternalLaunch returns true when this process should exit because an
// existing (or starting) instance will open the paths. Intentional child windows
// (--window-id=) always return false. Disabled for non-production builds (wailsdev).
func TryHandoffExternalLaunch(args []string) bool {
	if !shellHandoffEnabled() {
		return false
	}
	opts := parseLaunchArgs(args)
	if strings.TrimSpace(opts.WindowID) != "" {
		return false
	}
	paths := collectLaunchPaths(opts)
	unlock, err := lockShellBoot()
	if err == nil && unlock != nil {
		defer unlock()
	}
	if hasLiveWindow() || hasActiveBootClaim() {
		_ = writeShellPending(paths, true)
		return true
	}
	_ = writeBootClaim(os.Getpid())
	return false
}

func collectLaunchPaths(opts launchOptions) []string {
	out := make([]string, 0, len(opts.OpenPaths)+1)
	seen := map[string]struct{}{}
	add := func(p string) {
		p = strings.TrimSpace(p)
		if p == "" {
			return
		}
		key := strings.ToLower(filepath.Clean(p))
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		out = append(out, p)
	}
	for _, p := range opts.OpenPaths {
		add(p)
	}
	add(opts.OpenPath)
	return out
}

func hasLiveWindow() bool {
	var live bool
	_ = withWindowStore(func(configDir string) error {
		m, err := loadWindowManifestLocked(configDir)
		if err != nil {
			return err
		}
		live = hasLiveWindowLocked(m)
		return nil
	})
	return live
}

func hasActiveBootClaim() bool {
	var active bool
	_ = withWindowStore(func(configDir string) error {
		path := filepath.Join(configDir, shellBootClaimName)
		var claim shellBootClaim
		if err := readJSONFile(path, &claim); err != nil {
			return nil
		}
		if claim.PID > 0 && processAlive(claim.PID) {
			// Claims older than 2 minutes are treated as stale.
			if time.Now().UnixMilli()-claim.StartedAt < 2*60*1000 {
				active = true
			}
		}
		return nil
	})
	return active
}

func writeBootClaim(pid int) error {
	return withWindowStore(func(configDir string) error {
		claim := shellBootClaim{PID: pid, StartedAt: time.Now().UnixMilli()}
		return writeJSONAtomic(filepath.Join(configDir, shellBootClaimName), claim)
	})
}

func clearBootClaim() {
	_ = withWindowStore(func(configDir string) error {
		path := filepath.Join(configDir, shellBootClaimName)
		var claim shellBootClaim
		if err := readJSONFile(path, &claim); err != nil {
			return nil
		}
		if claim.PID == os.Getpid() || !processAlive(claim.PID) {
			_ = os.Remove(path)
		}
		return nil
	})
}

func writeShellPending(paths []string, focus bool) error {
	return withWindowStore(func(configDir string) error {
		dir := filepath.Join(configDir, shellPendingDirName)
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
		payload := shellPendingPayload{
			Paths:     append([]string{}, paths...),
			Focus:     focus,
			CreatedAt: time.Now().UnixMilli(),
		}
		raw, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		name := uuid.NewString() + ".json"
		tmp := filepath.Join(dir, name+".tmp")
		if err := os.WriteFile(tmp, raw, 0o600); err != nil {
			return err
		}
		return os.Rename(tmp, filepath.Join(dir, name))
	})
}

func shellPendingDir(configDir string) string {
	return filepath.Join(configDir, shellPendingDirName)
}
