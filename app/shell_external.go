package app

import (
	"strings"

	"github.com/FaaTang/PinkHunkReader/define"
)

// HandleExternalOpen is the macOS `mac.Options.OnFileOpen` callback: Finder's
// "Open With" (and `open -a PinkHunkReader file`) deliver an Apple Event rather
// than argv, so the path has to be routed through the same shell-open pipeline.
func (a *App) HandleExternalOpen(path string) {
	a.HandleExternalOpenPaths([]string{path})
}

// HandleExternalOpenPaths opens one or more external paths, buffering until
// Startup has established a Wails context and the frontend listener is ready.
func (a *App) HandleExternalOpenPaths(paths []string) {
	if a == nil {
		return
	}
	cleaned := make([]string, 0, len(paths))
	seen := make(map[string]struct{}, len(paths))
	for _, p := range paths {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		cleaned = append(cleaned, p)
	}
	if len(cleaned) == 0 {
		return
	}

	a.externalOpenMu.Lock()
	immediate := a.ctx != nil
	if !immediate {
		a.externalOpenPending = append(a.externalOpenPending, cleaned...)
	}
	a.externalOpenMu.Unlock()
	if !immediate {
		return
	}
	a.dispatchShellOpen([]define.ShellOpenRequest{{Paths: cleaned, Focus: true}})
}
