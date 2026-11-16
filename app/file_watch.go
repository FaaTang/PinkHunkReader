package app

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	fileRenamedEvent = "app:file-renamed"
	// Pair Rename(old) → Create(new) within this window (Notepad++-style same-dir rename).
	renamePairWindow = 1500 * time.Millisecond
)

type pendingRename struct {
	oldPath string
	dir     string
	at      time.Time
}

type openFileWatcher struct {
	app *App

	mu       sync.Mutex
	watcher  *fsnotify.Watcher
	files    map[string]struct{} // normalized absolute open file paths
	dirs     map[string]int      // parent dir → refcount
	pending  *pendingRename
	stopCh   chan struct{}
	stopped  bool
}

func (a *App) startOpenFileWatcher() {
	a.fileWatchMu.Lock()
	defer a.fileWatchMu.Unlock()
	if a.fileWatch != nil {
		return
	}
	w, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("open-file watcher: %v", err)
		return
	}
	fw := &openFileWatcher{
		app:     a,
		watcher: w,
		files:   make(map[string]struct{}),
		dirs:    make(map[string]int),
		stopCh:  make(chan struct{}),
	}
	a.fileWatch = fw
	go fw.loop()
}

func (a *App) stopOpenFileWatcher() {
	a.fileWatchMu.Lock()
	fw := a.fileWatch
	a.fileWatch = nil
	a.fileWatchMu.Unlock()
	if fw == nil {
		return
	}
	fw.close()
}

// SyncWatchedFiles updates which on-disk files should be monitored for rename/delete.
// Pass absolute paths of open (non-untitled) tabs; empty clears watches.
func (a *App) SyncWatchedFiles(paths []string) {
	a.startOpenFileWatcher()
	a.fileWatchMu.Lock()
	fw := a.fileWatch
	a.fileWatchMu.Unlock()
	if fw == nil {
		return
	}
	normalized := make([]string, 0, len(paths))
	for _, p := range paths {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		abs, err := filepath.Abs(p)
		if err != nil {
			abs = filepath.Clean(p)
		}
		normalized = append(normalized, normalizeWatchPath(abs))
	}
	fw.syncFiles(normalized)
}

func (fw *openFileWatcher) close() {
	fw.mu.Lock()
	if fw.stopped {
		fw.mu.Unlock()
		return
	}
	fw.stopped = true
	close(fw.stopCh)
	w := fw.watcher
	fw.watcher = nil
	fw.mu.Unlock()
	if w != nil {
		_ = w.Close()
	}
}

func (fw *openFileWatcher) loop() {
	for {
		fw.mu.Lock()
		w := fw.watcher
		stop := fw.stopCh
		fw.mu.Unlock()
		if w == nil {
			return
		}
		select {
		case <-stop:
			return
		case err, ok := <-w.Errors:
			if !ok {
				return
			}
			if err != nil {
				log.Printf("open-file watcher error: %v", err)
			}
		case ev, ok := <-w.Events:
			if !ok {
				return
			}
			fw.handleEvent(ev)
		}
	}
}

func (fw *openFileWatcher) syncFiles(paths []string) {
	wantedFiles := make(map[string]struct{}, len(paths))
	wantedDirs := make(map[string]struct{})
	for _, p := range paths {
		wantedFiles[p] = struct{}{}
		dir := normalizeWatchPath(filepath.Dir(p))
		if dir != "" {
			wantedDirs[dir] = struct{}{}
		}
	}

	fw.mu.Lock()
	defer fw.mu.Unlock()
	if fw.watcher == nil || fw.stopped {
		return
	}

	// Drop dirs no longer needed.
	for dir := range fw.dirs {
		if _, ok := wantedDirs[dir]; ok {
			continue
		}
		_ = fw.watcher.Remove(dir)
		delete(fw.dirs, dir)
	}
	// Add new dirs.
	for dir := range wantedDirs {
		if _, ok := fw.dirs[dir]; ok {
			continue
		}
		if err := fw.watcher.Add(dir); err != nil {
			log.Printf("open-file watcher add %s: %v", dir, err)
			continue
		}
		fw.dirs[dir] = 1
	}
	fw.files = wantedFiles
	// Clear pending rename if old path is no longer watched.
	if fw.pending != nil {
		if _, ok := wantedFiles[fw.pending.oldPath]; !ok {
			fw.pending = nil
		}
	}
}

func (fw *openFileWatcher) handleEvent(ev fsnotify.Event) {
	name := normalizeWatchPath(ev.Name)
	if name == "" {
		return
	}
	dir := normalizeWatchPath(filepath.Dir(name))
	base := filepath.Base(name)

	fw.mu.Lock()
	defer fw.mu.Unlock()
	if fw.stopped {
		return
	}

	// Expire stale pending rename.
	if fw.pending != nil && time.Since(fw.pending.at) > renamePairWindow {
		fw.pending = nil
	}

	// Same-directory rename: Rename/Remove on old name, then Create/Rename on new name.
	if _, watched := fw.files[name]; watched && (ev.Has(fsnotify.Rename) || ev.Has(fsnotify.Remove)) {
		fw.pending = &pendingRename{
			oldPath: name,
			dir:     dir,
			at:      time.Now(),
		}
		return
	}

	// New name may arrive as Create and/or Rename (platform-dependent).
	if fw.pending != nil && (ev.Has(fsnotify.Create) || ev.Has(fsnotify.Rename)) {
		p := fw.pending
		if normalizeWatchPath(p.dir) == dir && !strings.EqualFold(filepath.Base(p.oldPath), base) {
			if _, watchedNew := fw.files[name]; watchedNew {
				return
			}
			newPath := name
			oldPath := p.oldPath
			fw.pending = nil
			// Verify new path exists and old is gone.
			if _, err := os.Stat(newPath); err != nil {
				return
			}
			if _, err := os.Stat(oldPath); err == nil {
				// Old still exists — not a rename of our file.
				return
			}
			go fw.app.emitFileRenamed(oldPath, newPath)
		}
	}
}

func (a *App) emitFileRenamed(oldPath, newPath string) {
	if a.ctx == nil {
		return
	}
	wailsRuntime.EventsEmit(a.ctx, fileRenamedEvent, map[string]string{
		"oldPath": oldPath,
		"newPath": newPath,
	})
}

func normalizeWatchPath(p string) string {
	p = strings.TrimSpace(p)
	if p == "" {
		return ""
	}
	clean := filepath.Clean(p)
	if abs, err := filepath.Abs(clean); err == nil {
		clean = abs
	}
	return clean
}
