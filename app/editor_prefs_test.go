package app

import (
	"testing"

	"github.com/FaaTang/PinkHunkReader/define"
)

func TestNormalizeEditorPrefs(t *testing.T) {
	got := normalizeEditorPrefs(define.EditorPrefs{LargeFileThresholdMB: 100})
	if got.LargeFileThresholdMB != 100 {
		t.Fatalf("got %d", got.LargeFileThresholdMB)
	}
	got = normalizeEditorPrefs(define.EditorPrefs{LargeFileThresholdMB: 0})
	if got.LargeFileThresholdMB != define.DefaultLargeFileThresholdMB {
		t.Fatalf("zero → default, got %d", got.LargeFileThresholdMB)
	}
	got = normalizeEditorPrefs(define.EditorPrefs{LargeFileThresholdMB: 9999})
	if got.LargeFileThresholdMB != 9999 {
		t.Fatalf("large values allowed, got %d", got.LargeFileThresholdMB)
	}
	got = normalizeEditorPrefs(define.EditorPrefs{LargeFileThresholdMB: 1})
	if got.LargeFileThresholdMB != 1 {
		t.Fatalf("min 1, got %d", got.LargeFileThresholdMB)
	}
}

func TestLargeFileThresholdBytes(t *testing.T) {
	if got := define.LargeFileThresholdBytes(100); got != 100*1024*1024 {
		t.Fatalf("got %d", got)
	}
	if got := define.LargeFileThresholdBytes(0); got != define.DefaultLargeFileBytes {
		t.Fatalf("invalid → default bytes, got %d", got)
	}
	if got := define.LargeFileThresholdBytes(2048); got != 2048*1024*1024 {
		t.Fatalf("no upper clamp, got %d", got)
	}
}
