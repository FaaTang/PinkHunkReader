package fsx_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/FaaTang/PinkHunkReader/fsx"
)

func TestWriteTextCreatesMissingFile(t *testing.T) {
	root := t.TempDir()
	g, err := fsx.NewGuard(root)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "Untitled-2.txt")
	if err := fsx.WriteText(g, path, "hello\n"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "hello\n" {
		t.Fatalf("got %q", data)
	}
}
