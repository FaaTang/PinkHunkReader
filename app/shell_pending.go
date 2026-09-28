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
	a.dispatchShellOpen(requests)
}

// ReadyForShellOpen marks the frontend listener ready and returns any requests
// that arrived (via second-instance handoff) before EventsOn was registered.
func (a *App) ReadyForShellOpen() []define.ShellOpenRequest {
	if a == nil {
		return nil
	}
	a.shellOpenMu.Lock()
	a.shellOpenReady = true
	out := append([]define.ShellOpenRequest{}, a.shellOpenBuf...)
	a.shellOpenBuf = nil
	a.shellOpenMu.Unlock()
	return out
}

func (a *App) dispatchShellOpen(requests []define.ShellOpenRequest) {
	if len(requests) == 0 {
		return
	}
	a.shellOpenMu.Lock()
	ready := a.shellOpenReady
	if !ready {
		a.shellOpenBuf = append(a.shellOpenBuf, requests...)
		a.shellOpenMu.Unlock()
		// Still surface the window so the user sees the handoff instance.
		a.focusForShellOpen()
		return
	}
	a.shellOpenMu.Unlock()

	for _, req := range requests {
		runtime.EventsEmit(a.ctx, "app:shell-open", req)
	}
	a.focusForShellOpen()
}

func (a *App) focusForShellOpen() {
	if a == nil || a.ctx == nil {
		return
	}
	runtime.WindowShow(a.ctx)
	// Only unminimise when actually minimised. Calling Unminimise on a maximised
	// window can restore it to normal size on Windows (looks like a sudden shrink).
	if runtime.WindowIsMinimised(a.ctx) {
		runtime.WindowUnminimise(a.ctx)
	}
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
