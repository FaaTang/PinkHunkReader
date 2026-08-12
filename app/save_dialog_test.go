package app

import (
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
