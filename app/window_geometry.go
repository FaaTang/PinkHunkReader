package app

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	windowGeometryFileName = "window_geometry.json"

	// First-open target ~85% of the current screen (aligned with PinkHunkDB).
	firstOpenWidthRatio  = 0.85
	firstOpenHeightRatio = 0.85
	firstOpenMinWidth    = 900
	firstOpenMinHeight   = 560
)

type windowGeometry struct {
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Maximized bool `json:"maximized"`
}

func windowGeometryPath(configDir string) string {
	return filepath.Join(configDir, windowGeometryFileName)
}

func loadWindowGeometry(configDir string) (*windowGeometry, error) {
	raw, err := os.ReadFile(windowGeometryPath(configDir))
	if err != nil {
		return nil, err
	}
	var geo windowGeometry
	if err := json.Unmarshal(raw, &geo); err != nil {
		return nil, err
	}
	return &geo, nil
}

func persistWindowGeometry(configDir string, geo windowGeometry) error {
	return writeJSONAtomic(windowGeometryPath(configDir), geo)
}

func (a *App) applyStartupWindowGeometry(ctx context.Context) {
	configDir := resolveAppConfigDir()
	screenW, screenH := resolveScreenSize(ctx)
	geo, err := loadWindowGeometry(configDir)
	if err == nil && geo != nil && geo.Width >= 400 && geo.Height >= 300 && !isCreatePlaceholderGeometry(geo, screenW, screenH) {
		if geo.Maximized {
			runtime.WindowMaximise(ctx)
			runtime.WindowShow(ctx)
			return
		}
		runtime.WindowSetSize(ctx, geo.Width, geo.Height)
		runtime.WindowSetPosition(ctx, geo.X, geo.Y)
		runtime.WindowShow(ctx)
		return
	}
	width, height := resolveFirstOpenWindowSize(ctx)
	runtime.WindowSetSize(ctx, width, height)
	runtime.WindowCenter(ctx)
	runtime.WindowShow(ctx)
}

func resolveFirstOpenWindowSize(ctx context.Context) (int, int) {
	screenW, screenH := resolveScreenSize(ctx)
	if screenW <= 0 || screenH <= 0 {
		return firstOpenMinWidth, firstOpenMinHeight
	}
	width := clampInt(int(float64(screenW)*firstOpenWidthRatio), firstOpenMinWidth, screenW)
	height := clampInt(int(float64(screenH)*firstOpenHeightRatio), firstOpenMinHeight, screenH)
	return width, height
}

func resolveScreenSize(ctx context.Context) (int, int) {
	screens, err := runtime.ScreenGetAll(ctx)
	if err != nil || len(screens) == 0 {
		return 0, 0
	}
	screenW, screenH := 0, 0
	for _, screen := range screens {
		if !(screen.IsCurrent || screen.IsPrimary) {
			continue
		}
		if screen.Size.Width > 0 && screen.Size.Height > 0 {
			screenW, screenH = screen.Size.Width, screen.Size.Height
		} else if screen.Width > 0 && screen.Height > 0 {
			screenW, screenH = screen.Width, screen.Height
		}
		if screen.IsCurrent && screenW > 0 && screenH > 0 {
			break
		}
	}
	if screenW <= 0 || screenH <= 0 {
		for _, screen := range screens {
			if screen.Size.Width > 0 && screen.Size.Height > 0 {
				screenW, screenH = screen.Size.Width, screen.Size.Height
				break
			}
			if screen.Width > 0 && screen.Height > 0 {
				screenW, screenH = screen.Width, screen.Height
				break
			}
		}
	}
	return screenW, screenH
}

// isCreatePlaceholderGeometry detects the StartHidden create size (≈900×560) that must
// not stick as the restored window when a proper first-open size is available.
func isCreatePlaceholderGeometry(geo *windowGeometry, screenW, screenH int) bool {
	if geo == nil {
		return true
	}
	if geo.Width < 400 || geo.Height < 300 {
		return true
	}
	nearCreateMin := geo.Width <= firstOpenMinWidth+8 && geo.Height <= firstOpenMinHeight+8
	if !nearCreateMin {
		return false
	}
	if screenW <= 0 || screenH <= 0 {
		// Without a screen measurement, still treat the create min as a placeholder so
		// the frontend can re-apply screen-ratio sizing after the webview is ready.
		return true
	}
	firstW := clampInt(int(float64(screenW)*firstOpenWidthRatio), firstOpenMinWidth, screenW)
	firstH := clampInt(int(float64(screenH)*firstOpenHeightRatio), firstOpenMinHeight, screenH)
	return firstW >= geo.Width+80 || firstH >= geo.Height+80
}

func (a *App) saveCurrentWindowGeometry(ctx context.Context) {
	if ctx == nil {
		return
	}
	configDir := resolveAppConfigDir()
	maximised := runtime.WindowIsMaximised(ctx)
	if runtime.WindowIsFullscreen(ctx) {
		// Keep last normal geometry; only remember maximised-like exit state.
		if existing, loadErr := loadWindowGeometry(configDir); loadErr == nil && existing != nil {
			existing.Maximized = true
			_ = persistWindowGeometry(configDir, *existing)
		}
		return
	}
	width, height := runtime.WindowGetSize(ctx)
	x, y := runtime.WindowGetPosition(ctx)
	if width < 400 || height < 300 {
		return
	}
	screenW, screenH := resolveScreenSize(ctx)
	candidate := &windowGeometry{Width: width, Height: height, X: x, Y: y, Maximized: maximised}
	// Never persist the create-placeholder size as a real user preference.
	if !maximised && isCreatePlaceholderGeometry(candidate, screenW, screenH) {
		return
	}
	geo := windowGeometry{
		Width:     width,
		Height:    height,
		X:         x,
		Y:         y,
		Maximized: maximised,
	}
	if maximised {
		if existing, loadErr := loadWindowGeometry(configDir); loadErr == nil && existing != nil && existing.Width >= 400 && existing.Height >= 300 {
			if !isCreatePlaceholderGeometry(existing, screenW, screenH) {
				geo.Width = existing.Width
				geo.Height = existing.Height
				geo.X = existing.X
				geo.Y = existing.Y
			}
		}
	}
	_ = persistWindowGeometry(configDir, geo)
}

func clampInt(value, min, max int) int {
	if max > 0 && value > max {
		value = max
	}
	if value < min {
		return min
	}
	return value
}
