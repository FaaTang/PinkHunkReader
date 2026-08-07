package define_test

import (
	"testing"

	"github.com/FaaTang/PinkHunkReader/define"
)

func TestDetectKind(t *testing.T) {
	cases := map[string]string{
		"a.md":       define.KindMarkdown,
		"b.PDF":      define.KindPDF,
		"c.png":      define.KindImage,
		"d.json":     define.KindText,
		"notes.txt":  define.KindText,
		"app.log":    define.KindText,
		"run.out":    define.KindText,
		"data.jsonc": define.KindText,
		"e.bin":      define.KindUnknown,
		"report.docx": define.KindUnknown,
		"sheet.xlsx":  define.KindUnknown,
		"Makefile":   define.KindText,
		"readme":     define.KindText,
	}
	for path, want := range cases {
		if got := define.DetectKind(path); got != want {
			t.Fatalf("%s: got %s want %s", path, got, want)
		}
	}
}

func TestIsEditable(t *testing.T) {
	if !define.IsEditable(define.KindMarkdown) {
		t.Fatal("markdown should be editable")
	}
	if define.IsEditable(define.KindPDF) {
		t.Fatal("pdf should not be editable")
	}
}
