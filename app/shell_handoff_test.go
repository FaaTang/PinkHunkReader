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
	if !opts.FromCLIWindowID {
		t.Fatal("expected FromCLIWindowID for spawned/restored child argv")
	}
	if !opts.OpenIsDir {
		t.Fatal("expected OpenIsDir")
	}
	primary := parseLaunchArgs([]string{`--open-file=C:\a.md`})
	if primary.FromCLIWindowID {
		t.Fatal("primary start without --window-id must not set FromCLIWindowID")
	}
}

func TestAllowFirstOpenWindowGeometry(t *testing.T) {
	empty := parseLaunchArgs(nil)
	if !allowFirstOpenWindowGeometry(empty) {
		t.Fatal("empty primary start should allow first-open geometry")
	}
	shell := parseLaunchArgs([]string{`--open=C:\a.md`})
	if allowFirstOpenWindowGeometry(shell) {
		t.Fatal("shell --open must not allow first-open geometry")
	}
	child := parseLaunchArgs([]string{"--window-id=abc", `--open-file=C:\a.md`})
	if allowFirstOpenWindowGeometry(child) {
		t.Fatal("child --window-id must not allow first-open geometry")
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

func TestParseLaunchArgsIgnoresFinderPSN(t *testing.T) {
	opts := parseLaunchArgs([]string{"-psn_0_123456", `--open-file=/tmp/a.md`})
	if opts.OpenPath != "/tmp/a.md" {
		t.Fatalf("OpenPath=%q", opts.OpenPath)
	}
	if len(opts.OpenPaths) != 1 || opts.OpenPaths[0] != "/tmp/a.md" {
		t.Fatalf("OpenPaths=%v", opts.OpenPaths)
	}
	only := parseLaunchArgs([]string{"-psn_0_123456"})
	if only.OpenPath != "" || len(only.OpenPaths) != 0 {
		t.Fatalf("psn must not become a path: %+v", only)
	}
}
