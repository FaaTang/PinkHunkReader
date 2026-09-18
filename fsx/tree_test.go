package fsx_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/FaaTang/PinkHunkReader/fsx"
)

func TestListDirSkipsOfficeLockFiles(t *testing.T) {
	root := t.TempDir()
	mustWrite := func(name string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(root, name), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	mustWrite("report.docx")
	mustWrite("~$report.docx")
	mustWrite("~$中心问题回复20260910.doc")
	mustWrite("sheet.xlsx")
	mustWrite("~$sheet.xlsx")
	mustWrite("notes.txt")
	if err := os.Mkdir(filepath.Join(root, "subdir"), 0o755); err != nil {
		t.Fatal(err)
	}

	g, err := fsx.NewGuard(root)
	if err != nil {
		t.Fatal(err)
	}
	entries, err := fsx.ListDir(g, root)
	if err != nil {
		t.Fatal(err)
	}

	got := map[string]bool{}
	for _, e := range entries {
		got[e.Name] = true
		if len(e.Name) >= 2 && e.Name[0] == '~' && e.Name[1] == '$' {
			t.Fatalf("office lock file should be skipped: %s", e.Name)
		}
	}
	for _, want := range []string{"report.docx", "sheet.xlsx", "notes.txt", "subdir"} {
		if !got[want] {
			t.Fatalf("missing entry %s in %#v", want, got)
		}
	}
	if len(entries) != 4 {
		t.Fatalf("want 4 entries, got %d (%#v)", len(entries), got)
	}
}
