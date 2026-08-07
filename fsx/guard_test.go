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
