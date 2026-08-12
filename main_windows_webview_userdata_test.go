//go:build windows

package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestListLegacyWindowsWebviewUserDataDirs(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "PinkHunkReader", "WebView2")
	if err := os.MkdirAll(filepath.Join(root, "PinkHunkReader", "sessions"), 0o755); err != nil {
		t.Fatal(err)
	}
	legacyNames := []string{
		"PinkHunkReader.exe",
		"PinkHunkReader-dev.exe",
		"PinkHunkReader-1.1.14-Windows-Amd64.exe",
		"OtherApp.exe",
	}
	for _, name := range legacyNames {
		if err := os.MkdirAll(filepath.Join(root, name, "EBWebView"), 0o755); err != nil {
			t.Fatal(err)
		}
	}

	got := listLegacyWindowsWebviewUserDataDirs(root, target)
	want := map[string]struct{}{
		filepath.Join(root, "PinkHunkReader.exe"):                     {},
		filepath.Join(root, "PinkHunkReader-dev.exe"):                 {},
		filepath.Join(root, "PinkHunkReader-1.1.14-Windows-Amd64.exe"): {},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d dirs %v, want %d", len(got), got, len(want))
	}
	for _, path := range got {
		if _, ok := want[path]; !ok {
			t.Fatalf("unexpected legacy dir %q", path)
		}
		if strings.EqualFold(filepath.Clean(path), filepath.Clean(filepath.Join(root, "PinkHunkReader"))) {
			t.Fatalf("must not treat app config root as legacy webview dir")
		}
	}
}

func TestPickLegacyWindowsWebviewUserDataPrefersNewest(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "PinkHunkReader", "WebView2")
	older := filepath.Join(root, "PinkHunkReader-1.0.3-Windows-Amd64.exe")
	newer := filepath.Join(root, "PinkHunkReader-1.1.14-Windows-Amd64.exe")
	if err := os.MkdirAll(filepath.Join(older, "EBWebView"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(newer, "EBWebView"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(older, "EBWebView", "old.txt"), []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(newer, "EBWebView", "new.txt"), []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}
	oldTime := time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC)
	newTime := time.Date(2026, 8, 12, 12, 0, 0, 0, time.UTC)
	if err := os.Chtimes(newer, newTime, newTime); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(older, oldTime, oldTime); err != nil {
		t.Fatal(err)
	}

	got := pickLegacyWindowsWebviewUserData(root, target)
	if got != newer {
		t.Fatalf("pick = %q, want %q", got, newer)
	}
}

func TestMigrateAndCleanupLegacyWindowsWebviewUserData(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "PinkHunkReader", "WebView2")
	legacy := filepath.Join(root, "PinkHunkReader-1.1.14-Windows-Amd64.exe")
	marker := filepath.Join(legacy, "EBWebView", "Cookie")
	if err := os.MkdirAll(filepath.Dir(marker), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(marker, []byte("cookie"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := migrateLegacyWindowsWebviewUserData(root, target); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	copied := filepath.Join(target, "EBWebView", "Cookie")
	data, err := os.ReadFile(copied)
	if err != nil {
		t.Fatalf("expected migrated file: %v", err)
	}
	if string(data) != "cookie" {
		t.Fatalf("migrated content = %q", data)
	}

	cleanupLegacyWindowsWebviewUserData(root, target)
	if _, err := os.Stat(legacy); !os.IsNotExist(err) {
		t.Fatalf("expected legacy dir removed, stat err=%v", err)
	}
	if _, err := os.Stat(target); err != nil {
		t.Fatalf("target must remain: %v", err)
	}
}
