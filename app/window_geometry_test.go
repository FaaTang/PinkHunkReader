package app

import "testing"

func TestClampInt(t *testing.T) {
	if got := clampInt(100, 900, 1920); got != 900 {
		t.Fatalf("expected min clamp 900, got %d", got)
	}
	if got := clampInt(2000, 900, 1920); got != 1920 {
		t.Fatalf("expected max clamp 1920, got %d", got)
	}
	if got := clampInt(1280, 900, 1920); got != 1280 {
		t.Fatalf("expected passthrough 1280, got %d", got)
	}
}

func TestResolveFirstOpenWindowSizeRatios(t *testing.T) {
	width := clampInt(int(float64(1920)*firstOpenWidthRatio), firstOpenMinWidth, 1920)
	height := clampInt(int(float64(1080)*firstOpenHeightRatio), firstOpenMinHeight, 1080)
	if width != 1632 {
		t.Fatalf("expected width 1632, got %d", width)
	}
	if height != 918 {
		t.Fatalf("expected height 918, got %d", height)
	}
}

func TestResolveFirstOpenWindowSizeRequiresScreen(t *testing.T) {
	// Without a usable screen measurement, first open stays at the minimum window size.
	width, height := firstOpenMinWidth, firstOpenMinHeight
	if width != 900 || height != 560 {
		t.Fatalf("expected min first-open size 900x560, got %dx%d", width, height)
	}
}
