package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/FaaTang/PinkHunkReader/define"
	"github.com/google/uuid"
)

const (
	windowsManifestName = "windows.json"
	openPrefsFileName   = "open_prefs.json"
	sessionsDirName     = "sessions"
)

var windowStoreMu sync.Mutex

type windowManifest struct {
	Version int                `json:"version"`
	Windows []windowManifestEntry `json:"windows"`
}

type windowManifestEntry struct {
	ID        string `json:"id"`
	PID       int    `json:"pid"`
	UpdatedAt int64  `json:"updatedAt"`
}

func sessionsDir(configDir string) string {
	return filepath.Join(configDir, sessionsDirName)
}

func windowsManifestPath(configDir string) string {
	return filepath.Join(configDir, windowsManifestName)
}

func openPrefsPath(configDir string) string {
	return filepath.Join(configDir, openPrefsFileName)
}

func sessionFilePath(configDir, windowID string) string {
	safe := sanitizeWindowID(windowID)
	return filepath.Join(sessionsDir(configDir), safe+".json")
}

func sanitizeWindowID(id string) string {
	id = strings.TrimSpace(id)
	var b strings.Builder
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if out == "" {
		return "window"
	}
	return out
}

func newWindowID() string {
	return uuid.NewString()
}

func writeJSONAtomic(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func readJSONFile(path string, dest any) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, dest)
}

func loadWindowManifestLocked(configDir string) (windowManifest, error) {
	path := windowsManifestPath(configDir)
	var m windowManifest
	err := readJSONFile(path, &m)
	if err != nil {
		if os.IsNotExist(err) {
			return windowManifest{Version: 1, Windows: nil}, nil
		}
		return windowManifest{}, err
	}
	if m.Version == 0 {
		m.Version = 1
	}
	if m.Windows == nil {
		m.Windows = []windowManifestEntry{}
	}
	return m, nil
}

func saveWindowManifestLocked(configDir string, m windowManifest) error {
	if m.Version == 0 {
		m.Version = 1
	}
	return writeJSONAtomic(windowsManifestPath(configDir), m)
}

func withWindowStore(fn func(configDir string) error) error {
	windowStoreMu.Lock()
	defer windowStoreMu.Unlock()
	return fn(resolveAppConfigDir())
}

// RegisterWindow upserts this window id with the current process pid.
func (a *App) RegisterWindow(windowID string) error {
	windowID = strings.TrimSpace(windowID)
	if windowID == "" {
		return fmt.Errorf("empty window id")
	}
	return withWindowStore(func(configDir string) error {
		m, err := loadWindowManifestLocked(configDir)
		if err != nil {
			return err
		}
		now := time.Now().UnixMilli()
		pid := os.Getpid()
		found := false
		for i := range m.Windows {
			if m.Windows[i].ID == windowID {
				m.Windows[i].PID = pid
				m.Windows[i].UpdatedAt = now
				found = true
				break
			}
		}
		if !found {
			m.Windows = append(m.Windows, windowManifestEntry{
				ID:        windowID,
				PID:       pid,
				UpdatedAt: now,
			})
		}
		a.windowID = windowID
		return saveWindowManifestLocked(configDir, m)
	})
}

// UnregisterWindow removes a window from the restore manifest (normal quit).
func (a *App) UnregisterWindow(windowID string) error {
	windowID = strings.TrimSpace(windowID)
	if windowID == "" {
		windowID = a.windowID
	}
	if windowID == "" {
		return nil
	}
	return withWindowStore(func(configDir string) error {
		m, err := loadWindowManifestLocked(configDir)
		if err != nil {
			return err
		}
		next := make([]windowManifestEntry, 0, len(m.Windows))
		for _, w := range m.Windows {
			if w.ID != windowID {
				next = append(next, w)
			}
		}
		m.Windows = next
		_ = os.Remove(sessionFilePath(configDir, windowID))
		return saveWindowManifestLocked(configDir, m)
	})
}

// SaveWindowSession persists session state for a window.
func (a *App) SaveWindowSession(state define.WindowSessionState) error {
	if strings.TrimSpace(state.WindowID) == "" {
		return fmt.Errorf("empty window id")
	}
	if state.Version == 0 {
		state.Version = 2
	}
	return withWindowStore(func(configDir string) error {
		if err := writeJSONAtomic(sessionFilePath(configDir, state.WindowID), state); err != nil {
			return err
		}
		m, err := loadWindowManifestLocked(configDir)
		if err != nil {
			return err
		}
		now := time.Now().UnixMilli()
		found := false
		for i := range m.Windows {
			if m.Windows[i].ID == state.WindowID {
				m.Windows[i].UpdatedAt = now
				if m.Windows[i].PID == 0 {
					m.Windows[i].PID = os.Getpid()
				}
				found = true
				break
			}
		}
		if !found {
			m.Windows = append(m.Windows, windowManifestEntry{
				ID:        state.WindowID,
				PID:       os.Getpid(),
				UpdatedAt: now,
			})
		}
		return saveWindowManifestLocked(configDir, m)
	})
}

// LoadWindowSession loads a window session from disk (nil-ish empty if missing).
func (a *App) LoadWindowSession(windowID string) (define.WindowSessionState, error) {
	windowID = strings.TrimSpace(windowID)
	empty := define.WindowSessionState{}
	if windowID == "" {
		return empty, fmt.Errorf("empty window id")
	}
	var state define.WindowSessionState
	err := withWindowStore(func(configDir string) error {
		path := sessionFilePath(configDir, windowID)
		if err := readJSONFile(path, &state); err != nil {
			if os.IsNotExist(err) {
				state = define.WindowSessionState{Version: 2, WindowID: windowID, Roots: []string{}, Tabs: []define.WindowSessionTab{}}
				return nil
			}
			return err
		}
		return nil
	})
	return state, err
}

// GetOpenPlacementPrefs returns open placement preferences.
func (a *App) GetOpenPlacementPrefs() (define.OpenPlacementPrefs, error) {
	prefs := define.OpenPlacementPrefs{
		Target:             "current",
		Mode:               "ask",
		ParentFolderTarget: "file",
		ParentFolderMode:   "always",
	}
	err := withWindowStore(func(configDir string) error {
		path := openPrefsPath(configDir)
		var loaded define.OpenPlacementPrefs
		if err := readJSONFile(path, &loaded); err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		prefs = normalizeOpenPrefs(loaded)
		return nil
	})
	return prefs, err
}

// SaveOpenPlacementPrefs persists open placement preferences.
func (a *App) SaveOpenPlacementPrefs(prefs define.OpenPlacementPrefs) (define.OpenPlacementPrefs, error) {
	prefs = normalizeOpenPrefs(prefs)
	err := withWindowStore(func(configDir string) error {
		return writeJSONAtomic(openPrefsPath(configDir), prefs)
	})
	return prefs, err
}

func normalizeOpenPrefs(p define.OpenPlacementPrefs) define.OpenPlacementPrefs {
	target := strings.ToLower(strings.TrimSpace(p.Target))
	if target != "new" {
		target = "current"
	}
	mode := strings.ToLower(strings.TrimSpace(p.Mode))
	if mode != "always" {
		mode = "ask"
	}
	parentTarget := strings.ToLower(strings.TrimSpace(p.ParentFolderTarget))
	if parentTarget != "parent" {
		parentTarget = "file"
	}
	parentMode := strings.ToLower(strings.TrimSpace(p.ParentFolderMode))
	if parentMode != "ask" {
		parentMode = "always"
	}
	return define.OpenPlacementPrefs{
		Target:             target,
		Mode:               mode,
		ParentFolderTarget: parentTarget,
		ParentFolderMode:   parentMode,
	}
}

// ListWindowsToRestore returns stale (dead-pid) window ids for crash recovery.
func (a *App) ListWindowsToRestore() ([]string, error) {
	var ids []string
	err := withWindowStore(func(configDir string) error {
		m, err := loadWindowManifestLocked(configDir)
		if err != nil {
			return err
		}
		ids = staleWindowIDsLocked(m)
		return nil
	})
	return ids, err
}

func hasLiveWindowLocked(m windowManifest) bool {
	for _, w := range m.Windows {
		if w.PID > 0 && processAlive(w.PID) {
			return true
		}
	}
	return false
}

func staleWindowIDsLocked(m windowManifest) []string {
	out := make([]string, 0, len(m.Windows))
	for _, w := range m.Windows {
		if w.PID <= 0 || !processAlive(w.PID) {
			out = append(out, w.ID)
		}
	}
	return out
}
