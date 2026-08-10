package fsx

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestNormalizeDriveLetterPath(t *testing.T) {
	got := normalizeDriveLetterPath("D:")
	want := "D:" + string(filepath.Separator)
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	if normalizeDriveLetterPath(`D:\foo`) != `D:\foo` {
		t.Fatal("non-drive path should be unchanged")
	}
	if normalizeDriveLetterPath("") != "" {
		t.Fatal("empty path should stay empty")
	}
}

func TestGuardDriveLetterRoot(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("drive-letter roots are a Windows path rule")
	}
	g, err := NewGuard("C:")
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Clean("C:\\")
	if !strings.EqualFold(filepath.Clean(g.Root()), want) {
		t.Fatalf("root=%q want %q", g.Root(), want)
	}
	resolved, err := g.Resolve("C:")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.EqualFold(filepath.Clean(resolved), want) {
		t.Fatalf("resolve=%q want %q", resolved, want)
	}
}
