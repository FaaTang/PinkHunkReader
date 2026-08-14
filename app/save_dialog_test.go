package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNormalizeSaveDefaultFilename(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in   string
		want string
	}{
		{"", "Untitled.txt"},
		{"  ", "Untitled.txt"},
		{"Untitled-1", "Untitled-1.txt"},
		{"Untitled-1.txt", "Untitled-1.txt"},
		{"notes.md", "notes.md"},
		{"file.", "file.txt"},
	}
	for _, tc := range cases {
		got := normalizeSaveDefaultFilename(tc.in)
		if got != tc.want {
			t.Fatalf("normalizeSaveDefaultFilename(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestEnsureDefaultSaveExtension(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in   string
		want string
	}{
		{"", ""},
		{filepath.Join("tmp", "notes"), filepath.Join("tmp", "notes.txt")},
		{filepath.Join("tmp", "notes.txt"), filepath.Join("tmp", "notes.txt")},
		{filepath.Join("tmp", "notes.md"), filepath.Join("tmp", "notes.md")},
		{filepath.Join("tmp", "notes."), filepath.Join("tmp", "notes.txt")},
	}
	for _, tc := range cases {
		got := ensureDefaultSaveExtension(tc.in)
		if got != tc.want {
			t.Fatalf("ensureDefaultSaveExtension(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestEnsureSaveRootAddsFileNotParent(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	file := filepath.Join(dir, "solo.txt")
	a := NewApp()
	if err := a.ensureSaveRoot(file); err != nil {
		t.Fatal(err)
	}
	roots := a.GetRoots()
	if len(roots) != 1 {
		t.Fatalf("roots=%v", roots)
	}
	if filepath.Clean(roots[0]) != filepath.Clean(file) {
		t.Fatalf("got root %s, want file %s (not parent folder)", roots[0], file)
	}
	if err := a.WriteText(file, "hello"); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "hello" {
		t.Fatalf("content=%q", got)
	}
}

func TestEnsureSaveRootSkipsWhenAlreadyUnderFolder(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	file := filepath.Join(dir, "inside.txt")
	a := NewApp()
	if err := a.OpenRoot(dir); err != nil {
		t.Fatal(err)
	}
	if err := a.ensureSaveRoot(file); err != nil {
		t.Fatal(err)
	}
	roots := a.GetRoots()
	if len(roots) != 1 {
		t.Fatalf("should not add extra root, got %v", roots)
	}
	if filepath.Clean(roots[0]) != filepath.Clean(dir) {
		t.Fatalf("got %s want folder %s", roots[0], dir)
	}
}

func TestEnsureSaveRootAddsFileOutsideExistingRoot(t *testing.T) {
	t.Parallel()
	a := NewApp()
	folder := t.TempDir()
	if err := a.OpenRoot(folder); err != nil {
		t.Fatal(err)
	}
	other := filepath.Join(t.TempDir(), "out.txt")
	if err := a.ensureSaveRoot(other); err != nil {
		t.Fatal(err)
	}
	roots := a.GetRoots()
	if len(roots) != 2 {
		t.Fatalf("want 2 roots, got %v", roots)
	}
	if filepath.Clean(roots[1]) != filepath.Clean(other) {
		t.Fatalf("got extra root %s, want file %s (not parent folder)", roots[1], other)
	}
}
