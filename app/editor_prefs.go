package app

import (
	"os"
	"path/filepath"
	"sync"

	"github.com/FaaTang/PinkHunkReader/define"
)

const editorPrefsFileName = "editor_prefs.json"

func editorPrefsPath(configDir string) string {
	return filepath.Join(configDir, editorPrefsFileName)
}

var (
	editorPrefsMu     sync.Mutex
	editorPrefsCached *define.EditorPrefs
)

func defaultEditorPrefs() define.EditorPrefs {
	return define.EditorPrefs{LargeFileThresholdMB: define.DefaultLargeFileThresholdMB}
}

func normalizeEditorPrefs(p define.EditorPrefs) define.EditorPrefs {
	mb := p.LargeFileThresholdMB
	if mb < define.MinLargeFileThresholdMB {
		mb = define.DefaultLargeFileThresholdMB
	}
	return define.EditorPrefs{LargeFileThresholdMB: mb}
}

// GetEditorPrefs returns editor preferences (large-file threshold, etc.).
func (a *App) GetEditorPrefs() (define.EditorPrefs, error) {
	return a.loadEditorPrefs()
}

// SaveEditorPrefs persists editor preferences and refreshes the in-memory cache.
func (a *App) SaveEditorPrefs(prefs define.EditorPrefs) (define.EditorPrefs, error) {
	prefs = normalizeEditorPrefs(prefs)
	err := withWindowStore(func(configDir string) error {
		return writeJSONAtomic(editorPrefsPath(configDir), prefs)
	})
	if err != nil {
		return prefs, err
	}
	editorPrefsMu.Lock()
	cp := prefs
	editorPrefsCached = &cp
	editorPrefsMu.Unlock()
	return prefs, nil
}

func (a *App) loadEditorPrefs() (define.EditorPrefs, error) {
	editorPrefsMu.Lock()
	if editorPrefsCached != nil {
		out := *editorPrefsCached
		editorPrefsMu.Unlock()
		return out, nil
	}
	editorPrefsMu.Unlock()

	prefs := defaultEditorPrefs()
	err := withWindowStore(func(configDir string) error {
		var loaded define.EditorPrefs
		if err := readJSONFile(editorPrefsPath(configDir), &loaded); err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		prefs = normalizeEditorPrefs(loaded)
		return nil
	})
	if err != nil {
		return defaultEditorPrefs(), err
	}
	editorPrefsMu.Lock()
	cp := prefs
	editorPrefsCached = &cp
	editorPrefsMu.Unlock()
	return prefs, nil
}

func (a *App) largeFileBytes() int64 {
	prefs, err := a.loadEditorPrefs()
	if err != nil {
		return define.DefaultLargeFileBytes
	}
	return define.LargeFileThresholdBytes(prefs.LargeFileThresholdMB)
}
