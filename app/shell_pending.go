package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/FaaTang/PinkHunkReader/define"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) startShellPendingWatcher() {
	if a.ctx == nil {
		return
	}
	go func() {
		ticker := time.NewTicker(350 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-a.ctx.Done():
				return
			case <-ticker.C:
				a.claimShellPending()
			}
		}
	}()
}

func (a *App) claimShellPending() {
	if a == nil || a.ctx == nil || strings.TrimSpace(a.windowID) == "" {
		return
	}
	if !a.isPreferredShellTarget() {
		return
	}
	var requests []define.ShellOpenRequest
	_ = withWindowStore(func(configDir string) error {
		dir := shellPendingDir(configDir)
		entries, err := os.ReadDir(dir)
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		for _, ent := range entries {
			if ent.IsDir() {
				continue
			}
			name := ent.Name()
			if !strings.HasSuffix(name, ".json") {
				continue
			}
			path := filepath.Join(dir, name)
			claimed := path + ".claim"
			if err := os.Rename(path, claimed); err != nil {
				continue
			}
			raw, err := os.ReadFile(claimed)
			_ = os.Remove(claimed)
			if err != nil {
				continue
			}
			var payload shellPendingPayload
			if err := json.Unmarshal(raw, &payload); err != nil {
				continue
			}
			requests = append(requests, define.ShellOpenRequest{
				Paths: append([]string{}, payload.Paths...),
				Focus: payload.Focus,
			})
		}
		return nil
	})
	if len(requests) == 0 {
		return
	}
	// RegisterWindow also takes windowStoreMu — must not run inside withWindowStore.
	_ = a.touchWindowManifest()
	for _, req := range requests {
		runtime.EventsEmit(a.ctx, "app:shell-open", req)
	}
	runtime.WindowShow(a.ctx)
	runtime.WindowUnminimise(a.ctx)
}

func (a *App) isPreferredShellTarget() bool {
	var preferred bool
	_ = withWindowStore(func(configDir string) error {
		m, err := loadWindowManifestLocked(configDir)
		if err != nil {
			return err
		}
		var bestID string
		var bestAt int64 = -1
		for _, w := range m.Windows {
			if w.PID <= 0 || !processAlive(w.PID) {
				continue
			}
			if w.UpdatedAt >= bestAt {
				bestAt = w.UpdatedAt
				bestID = w.ID
			}
		}
		preferred = bestID != "" && bestID == a.windowID
		return nil
	})
	return preferred
}

func (a *App) touchWindowManifest() error {
	id := strings.TrimSpace(a.windowID)
	if id == "" {
		return nil
	}
	return a.RegisterWindow(id)
}
