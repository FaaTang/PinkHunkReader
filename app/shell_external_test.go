package app

import (
	"reflect"
	"testing"
)

func TestHandleExternalOpenBuffersUntilReady(t *testing.T) {
	a := &App{}
	a.HandleExternalOpenPaths([]string{" /tmp/a.md ", "/tmp/a.md", ""})
	a.HandleExternalOpen("/tmp/b.md")

	if got, want := a.externalOpenPending, []string{"/tmp/a.md", "/tmp/b.md"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("pending=%v want %v", got, want)
	}

	out := a.ReadyForShellOpen()
	if len(out) != 1 {
		t.Fatalf("got %d requests: %#v", len(out), out)
	}
	if got, want := out[0].Paths, []string{"/tmp/a.md", "/tmp/b.md"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("paths=%v want %v", got, want)
	}
	if len(a.externalOpenPending) != 0 {
		t.Fatalf("pending should be drained, got %v", a.externalOpenPending)
	}
}

func TestHandleExternalOpenIgnoresBlankAndDuplicates(t *testing.T) {
	a := &App{}
	a.HandleExternalOpenPaths([]string{"", "   "})
	if len(a.externalOpenPending) != 0 {
		t.Fatalf("blank paths should be ignored, got %v", a.externalOpenPending)
	}
	a.HandleExternalOpenPaths([]string{"/tmp/x.md", " /tmp/x.md "})
	if got := a.externalOpenPending; len(got) != 1 || got[0] != "/tmp/x.md" {
		t.Fatalf("pending=%v", got)
	}
}
