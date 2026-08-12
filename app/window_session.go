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
	windowsManifestName   = "windows.json"
	openPrefsFileName     = "open_prefs.json"
	sessionsDirName       = "sessions"
	updateRestoreHintName = "update_restore.json"
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

// MarkWindowDead clears the live PID for a window while keeping the session file.
// Call on last-window quit / update restart so the next cold start (or relaunch with
// --window-id) can restore even if Windows reuses the old PID for another process.
func (a *App) MarkWindowDead(windowID string) error {
	windowID = strings.TrimSpace(windowID)
	if windowID == "" {
		windowID = a.windowID
	}
	if windowID == "" {
		return nil
	}
	return withWindowStore(func(configDir string) error {
		return markWindowDeadLocked(configDir, windowID)
	})
}

func markWindowDeadLocked(configDir, windowID string) error {
	m, err := loadWindowManifestLocked(configDir)
	if err != nil {
		return err
	}
	now := time.Now().UnixMilli()
	changed := false
	for i := range m.Windows {
		if m.Windows[i].ID == windowID {
			m.Windows[i].PID = 0
			m.Windows[i].UpdatedAt = now
			changed = true
			break
		}
	}
	if !changed {
		return nil
	}
	return saveWindowManifestLocked(configDir, m)
}

// UnregisterWindow removes a window from the restore manifest and deletes its session file.
// Used when abandoning a window (failed spawn, or title-bar close while other windows live).
func (a *App) UnregisterWindow(windowID string) error {
	windowID = strings.TrimSpace(windowID)
	if windowID == "" {
		windowID = a.windowID
	}
	if windowID == "" {
		return nil
	}
	return withWindowStore(func(configDir string) error {
		return unregisterWindowLocked(configDir, windowID)
	})
}

func unregisterWindowLocked(configDir, windowID string) error {
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
}

// finalizeWindowOnQuit discards this window when siblings are still live; otherwise
// keeps the session for next-launch restore of the last closed window only.
func (a *App) finalizeWindowOnQuit(windowID string) error {
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
		if hasOtherLiveWindowLocked(m, windowID) {
			return unregisterWindowLocked(configDir, windowID)
		}
		return markWindowDeadLocked(configDir, windowID)
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
				// PID==0 means MarkWindowDead (quit/update). Never revive it from a late persist.
				if m.Windows[i].PID > 0 && m.Windows[i].PID != os.Getpid() && !processAlive(m.Windows[i].PID) {
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

// hasOtherLiveWindowLocked reports whether any window other than selfID is still running.
func hasOtherLiveWindowLocked(m windowManifest, selfID string) bool {
	selfID = strings.TrimSpace(selfID)
	for _, w := range m.Windows {
		if selfID != "" && w.ID == selfID {
			continue
		}
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

type updateRestoreHint struct {
	WindowID  string `json:"windowId"`
	UpdatedAt int64  `json:"updatedAt"`
}

func updateRestoreHintPath(configDir string) string {
	return filepath.Join(configDir, updateRestoreHintName)
}

func writeUpdateRestoreHint(configDir, windowID string) error {
	windowID = strings.TrimSpace(windowID)
	if windowID == "" {
		return nil
	}
	return writeJSONAtomic(updateRestoreHintPath(configDir), updateRestoreHint{
		WindowID:  windowID,
		UpdatedAt: time.Now().UnixMilli(),
	})
}

// consumeUpdateRestoreHintLocked reads and deletes a one-shot post-update restore hint.
// Returns empty string when absent/stale.
func consumeUpdateRestoreHintLocked(configDir string) string {
	path := updateRestoreHintPath(configDir)
	var hint updateRestoreHint
	if err := readJSONFile(path, &hint); err != nil {
		return ""
	}
	_ = os.Remove(path)
	id := strings.TrimSpace(hint.WindowID)
	if id == "" {
		return ""
	}
	// Ignore hints older than 30 minutes (leftover from a failed update).
	if hint.UpdatedAt > 0 && time.Now().UnixMilli()-hint.UpdatedAt > 30*60*1000 {
		return ""
	}
	return id
}

func sessionHasRestorableContentLocked(configDir, windowID string) bool {
	var state define.WindowSessionState
	if err := readJSONFile(sessionFilePath(configDir, windowID), &state); err != nil {
		return false
	}
	if len(state.Roots) > 0 {
		return true
	}
	return len(state.Tabs) > 0
}

// prioritizeRestorableWindowIDs picks a single window to restore: the restorable
// session with the latest manifest UpdatedAt (last closed / last saved). Older
// siblings and empty orphans are pruned — cold start never reopens every past window.
func prioritizeRestorableWindowIDs(configDir string, ids []string) (primary string, spawn []string) {
	if len(ids) == 0 {
		return "", nil
	}
	m, err := loadWindowManifestLocked(configDir)
	updated := map[string]int64{}
	if err == nil {
		for _, w := range m.Windows {
			updated[w.ID] = w.UpdatedAt
		}
	}
	rich := make([]string, 0, len(ids))
	empty := make([]string, 0, len(ids))
	for _, id := range ids {
		if sessionHasRestorableContentLocked(configDir, id) {
			rich = append(rich, id)
		} else {
			empty = append(empty, id)
		}
	}
	if len(rich) == 0 {
		// All empty: keep a single blank window id (first), do not spawn more blanks.
		primary = ids[0]
		pruneWindowIDsLocked(configDir, ids[1:])
		return primary, nil
	}
	primary = rich[0]
	bestAt := updated[primary]
	for _, id := range rich[1:] {
		at := updated[id]
		if at >= bestAt {
			primary = id
			bestAt = at
		}
	}
	drop := make([]string, 0, len(ids)-1)
	for _, id := range ids {
		if id != primary {
			drop = append(drop, id)
		}
	}
	pruneWindowIDsLocked(configDir, drop)
	return primary, nil
}

func pruneWindowIDsLocked(configDir string, ids []string) {
	if len(ids) == 0 {
		return
	}
	drop := map[string]struct{}{}
	for _, id := range ids {
		drop[id] = struct{}{}
		_ = os.Remove(sessionFilePath(configDir, id))
	}
	m, err := loadWindowManifestLocked(configDir)
	if err != nil {
		return
	}
	next := make([]windowManifestEntry, 0, len(m.Windows))
	for _, w := range m.Windows {
		if _, ok := drop[w.ID]; !ok {
			next = append(next, w)
		}
	}
	m.Windows = next
	_ = saveWindowManifestLocked(configDir, m)
}
