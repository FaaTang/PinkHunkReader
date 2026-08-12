package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/FaaTang/PinkHunkReader/define"
	"github.com/FaaTang/PinkHunkReader/fsx"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails binding surface for PinkHunkReader.
type App struct {
	ctx   context.Context
	guard *fsx.Guard

	quitMu        sync.Mutex
	quitConfirmed bool

	updateMu    sync.Mutex
	updateState updateState

	windowID string
	launch   launchOptions
}

func NewApp() *App {
	return &App{}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.loadPersistedGlobalProxy()
	opts := parseLaunchArgs(os.Args[1:])
	a.launch = a.resolveLaunch(opts)
	if a.launch.WindowID != "" {
		_ = a.RegisterWindow(a.launch.WindowID)
	}
	// Restore user geometry when present; otherwise first-open dynamic size + center.
	a.applyStartupWindowGeometry(ctx)
}

// BeforeClose is called when the user tries to close the window.
// Returning true prevents quit; false allows shutdown (Wails v2).
func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	a.quitMu.Lock()
	ok := a.quitConfirmed
	if ok {
		a.quitConfirmed = false
	}
	a.quitMu.Unlock()
	if ok {
		a.saveCurrentWindowGeometry(ctx)
		return false
	}
	runtime.EventsEmit(ctx, "app:quit-requested")
	return true
}

// ConfirmQuit allows the next close/quit to proceed.
// Does not UnregisterWindow: session files stay so the next cold start can restore
// tabs (including unsaved / untitled buffers), same idea as PinkHunkDB draft flush + Notepad++.
func (a *App) ConfirmQuit() {
	a.quitMu.Lock()
	a.quitConfirmed = true
	a.quitMu.Unlock()
	runtime.Quit(a.ctx)
}

// OpenRoot replaces workspace roots with a single root directory.
func (a *App) OpenRoot(path string) error {
	return a.SetRoots([]string{path})
}

// SetRoots replaces all workspace roots.
func (a *App) SetRoots(paths []string) error {
	g, err := fsx.NewMultiGuard(paths)
	if err != nil {
		return err
	}
	a.guard = g
	return nil
}

// AddRoot appends a workspace root without removing existing ones.
func (a *App) AddRoot(path string) error {
	if a.guard == nil {
		return a.OpenRoot(path)
	}
	return a.guard.AddRoot(path)
}

// RemoveRoot removes one workspace root.
func (a *App) RemoveRoot(path string) error {
	if a.guard == nil {
		return nil
	}
	return a.guard.RemoveRoot(path)
}

// GetRoots returns all workspace roots.
func (a *App) GetRoots() []string {
	if a.guard == nil {
		return []string{}
	}
	roots := a.guard.Roots()
	if roots == nil {
		return []string{}
	}
	return roots
}

// PickAndOpenFolder opens a native folder dialog and returns the path (does not change roots).
func (a *App) PickAndOpenFolder() (string, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Folder",
	})
	if err != nil {
		return "", err
	}
	return path, nil
}

// PickAndOpenFile opens a native file dialog and returns the selected file path (does not change roots).
func (a *App) PickAndOpenFile() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open File",
	})
	if err != nil {
		return "", err
	}
	return path, nil
}

// PickAndOpen opens a modern native file or folder dialog (mode: "file" | "folder").
// Windows file dialogs require a file; use mode "folder" to open a directory alone.
// Does not change workspace roots — the frontend decides current vs new window.
func (a *App) PickAndOpen(mode string) (define.PickOpenResult, error) {
	empty := define.PickOpenResult{}
	var path string
	var err error
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "folder", "dir", "directory":
		path, err = runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
			Title: "Open Folder",
		})
	default:
		path, err = runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
			Title: "Open",
		})
	}
	if err != nil {
		return empty, err
	}
	if path == "" {
		return empty, nil
	}
	return a.finishPickOpen(path)
}

func (a *App) finishPickOpen(path string) (define.PickOpenResult, error) {
	empty := define.PickOpenResult{}
	info, err := os.Stat(path)
	if err != nil {
		return empty, err
	}
	if info.IsDir() {
		return define.PickOpenResult{Path: path, IsDir: true}, nil
	}
	return define.PickOpenResult{Path: path, IsDir: false}, nil
}

// InspectPath checks whether a filesystem path exists and whether it is a directory.
// Unlike StatFile, it does not require the path to be under a workspace root (used for drag-drop open).
func (a *App) InspectPath(path string) (define.PickOpenResult, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return define.PickOpenResult{}, fmt.Errorf("path is empty")
	}
	return a.finishPickOpen(path)
}

// PickAndSaveFile opens a save dialog and returns the chosen path (empty if cancelled).
// Adds the file parent as a workspace root when needed so the save can proceed.
func (a *App) PickAndSaveFile(defaultFilename string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save As",
		DefaultFilename: defaultFilename,
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	parent := filepath.Dir(path)
	if err := a.AddRoot(parent); err != nil {
		return "", err
	}
	return path, nil
}

// GetRoot returns the first workspace root (back-compat).
func (a *App) GetRoot() string {
	if a.guard == nil {
		return ""
	}
	return a.guard.Root()
}

// ListDir lists directory entries under the workspace.
func (a *App) ListDir(path string) ([]define.DirEntry, error) {
	if a.guard == nil || len(a.guard.Roots()) == 0 {
		return nil, errNoRoot()
	}
	if path == "" {
		path = a.guard.Root()
	}
	return fsx.ListDir(a.guard, path)
}

// StatFile returns metadata for a path.
func (a *App) StatFile(path string) (define.FileInfo, error) {
	if a.guard == nil {
		return define.FileInfo{}, errNoRoot()
	}
	return fsx.Stat(a.guard, path)
}

// DetectKind returns the viewer kind for a path.
func (a *App) DetectKind(path string) string {
	return define.DetectKind(path)
}

// ReadText loads a whole text file (small / non-largeMode).
func (a *App) ReadText(path string) (string, error) {
	if a.guard == nil {
		return "", errNoRoot()
	}
	return fsx.ReadText(a.guard, path)
}

// WriteText saves UTF-8 text content.
func (a *App) WriteText(path string, content string) error {
	if a.guard == nil {
		return errNoRoot()
	}
	return fsx.WriteText(a.guard, path, content)
}

// ReadSlice loads a line window for large text files.
func (a *App) ReadSlice(path string, startLine, count int) (define.TextSlice, error) {
	if a.guard == nil {
		return define.TextSlice{}, errNoRoot()
	}
	return fsx.ReadSlice(a.guard, path, startLine, count)
}

// ReadMarkdownOutline returns ATX headings (# …) with line numbers for the outline sidebar.
func (a *App) ReadMarkdownOutline(path string) ([]define.MdHeading, error) {
	if a.guard == nil {
		return nil, errNoRoot()
	}
	return fsx.ReadMarkdownOutline(a.guard, path)
}

// CountLines returns total line count (optional).
func (a *App) CountLines(path string) (int, error) {
	if a.guard == nil {
		return 0, errNoRoot()
	}
	return fsx.CountLines(a.guard, path)
}

// ReadBytes returns raw bytes (Wails encodes as base64 for JS). Used for PDF/images.
func (a *App) ReadBytes(path string) ([]byte, error) {
	if a.guard == nil {
		return nil, errNoRoot()
	}
	return fsx.ReadBytes(a.guard, path)
}

func errNoRoot() error {
	return errString("Open a folder first")
}

type errString string

func (e errString) Error() string { return string(e) }
