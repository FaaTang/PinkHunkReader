package app

import (
	"testing"

	"github.com/FaaTang/PinkHunkReader/define"
)

func TestReadyForShellOpenBuffersUntilReady(t *testing.T) {
	a := NewApp()
	a.dispatchShellOpen([]define.ShellOpenRequest{{
		Paths: []string{`C:\a.md`},
		Focus: true,
	}})
	got := a.ReadyForShellOpen()
	if len(got) != 1 || len(got[0].Paths) != 1 || got[0].Paths[0] != `C:\a.md` {
		t.Fatalf("buffered = %#v", got)
	}
	if more := a.ReadyForShellOpen(); len(more) != 0 {
		t.Fatalf("second drain should be empty, got %#v", more)
	}
}
