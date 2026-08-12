package app

import (
	"reflect"
	"testing"

	"github.com/FaaTang/PinkHunkReader/define"
)

func TestParseLaunchArgsPositionalAndFlags(t *testing.T) {
	opts := parseLaunchArgs([]string{
		`--open-file=C:\a.md`,
		`--open=D:\b.txt`,
		`E:\folder`,
	})
	if opts.OpenPath != `E:\folder` {
		t.Fatalf("OpenPath=%q", opts.OpenPath)
	}
	want := []string{`C:\a.md`, `D:\b.txt`, `E:\folder`}
	if !reflect.DeepEqual(opts.OpenPaths, want) {
		t.Fatalf("OpenPaths=%v want %v", opts.OpenPaths, want)
	}
}

func TestParseLaunchArgsWindowID(t *testing.T) {
	opts := parseLaunchArgs([]string{"--window-id=abc", "--open-folder=/tmp/x"})
	if opts.WindowID != "abc" {
		t.Fatalf("WindowID=%q", opts.WindowID)
	}
	if !opts.OpenIsDir {
		t.Fatal("expected OpenIsDir")
	}
}

func TestCollectLaunchPathsDedup(t *testing.T) {
	opts := launchOptions{
		OpenPath:  `C:\A.md`,
		OpenPaths: []string{`C:\A.md`, `C:\b.md`, `c:\a.md`},
	}
	got := collectLaunchPaths(opts)
	if len(got) != 2 {
		t.Fatalf("got %v", got)
	}
}

func TestNormalizeShellPrefs(t *testing.T) {
	p := normalizeShellPrefs(define.ShellIntegrationPrefs{ContextMenu: false})
	if p.ContextMenu {
		t.Fatal("expected false")
	}
	p = normalizeShellPrefs(define.ShellIntegrationPrefs{ContextMenu: true})
	if !p.ContextMenu {
		t.Fatal("expected true")
	}
}
