package fsx_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/FaaTang/PinkHunkReader/fsx"
)

func TestGuardAllowsFileRoot(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "solo.txt")
	if err := os.WriteFile(file, []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	g, err := fsx.NewGuard(file)
	if err != nil {
		t.Fatal(err)
	}
	got, err := g.Resolve(file)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Clean(got) != filepath.Clean(file) {
		t.Fatalf("got %s want %s", got, file)
	}
	sibling := filepath.Join(dir, "other.txt")
	if _, err := g.Resolve(sibling); err == nil {
		t.Fatal("expected sibling to escape file root")
	}
}
