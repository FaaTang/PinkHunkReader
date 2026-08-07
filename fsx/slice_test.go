package fsx_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/FaaTang/PinkHunkReader/fsx"
)

func TestGuardBlocksEscape(t *testing.T) {
	root := t.TempDir()
	g, err := fsx.NewGuard(root)
	if err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(root, "..", "nope.txt")
	if _, err := g.Resolve(outside); err == nil {
		t.Fatal("expected path escape to fail")
	}
}

func TestReadSlice(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "a.txt")
	content := "l1\nl2\nl3\nl4\nl5\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	g, err := fsx.NewGuard(root)
	if err != nil {
		t.Fatal(err)
	}
	slice, err := fsx.ReadSlice(g, path, 2, 2)
	if err != nil {
		t.Fatal(err)
	}
	if slice.StartLine != 2 || slice.EndLine != 3 {
		t.Fatalf("unexpected range: %+v", slice)
	}
	if slice.Content != "l2\nl3\n" {
		t.Fatalf("unexpected content %q", slice.Content)
	}
	if slice.EOF {
		t.Fatal("should not be eof yet")
	}
}
