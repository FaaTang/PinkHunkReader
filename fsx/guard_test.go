package fsx_test

import (
	"path/filepath"
	"testing"

	"github.com/FaaTang/PinkHunkReader/fsx"
)

func TestGuardAllowsInside(t *testing.T) {
	root := t.TempDir()
	g, err := fsx.NewGuard(root)
	if err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(root, "a.txt")
	got, err := g.Resolve(target)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Clean(got) != filepath.Clean(target) {
		t.Fatalf("got %s want %s", got, target)
	}
}

func TestMultiGuardAllowsAnyRoot(t *testing.T) {
	a := t.TempDir()
	b := t.TempDir()
	g, err := fsx.NewMultiGuard([]string{a, b})
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Roots()) != 2 {
		t.Fatalf("roots=%v", g.Roots())
	}
	ta := filepath.Join(a, "x.txt")
	tb := filepath.Join(b, "y.txt")
	if _, err := g.Resolve(ta); err != nil {
		t.Fatal(err)
	}
	if _, err := g.Resolve(tb); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "z.txt")
	if _, err := g.Resolve(outside); err == nil {
		t.Fatal("expected escape error")
	}
}

func TestGuardAddRootIdempotent(t *testing.T) {
	a := t.TempDir()
	g, err := fsx.NewGuard(a)
	if err != nil {
		t.Fatal(err)
	}
	if err := g.AddRoot(a); err != nil {
		t.Fatal(err)
	}
	if len(g.Roots()) != 1 {
		t.Fatalf("want 1 root, got %v", g.Roots())
	}
	b := t.TempDir()
	if err := g.AddRoot(b); err != nil {
		t.Fatal(err)
	}
	if len(g.Roots()) != 2 {
		t.Fatalf("want 2 roots, got %v", g.Roots())
	}
}
