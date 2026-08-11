package app

import (
	"os"
	"testing"
)

// Normal title-bar quit leaves the window in the manifest with a dead PID and
// keeps the session file. Next cold start must treat that entry as restorable.
func TestStaleWindowIDsIncludeDeadPIDForQuitRestore(t *testing.T) {
	deadPID := 999_999_999
	if processAlive(deadPID) {
		t.Skip("test pid unexpectedly alive")
	}
	m := windowManifest{
		Version: 1,
		Windows: []windowManifestEntry{
			{ID: "win-quit-restore", PID: deadPID, UpdatedAt: 1},
		},
	}
	ids := staleWindowIDsLocked(m)
	if len(ids) != 1 || ids[0] != "win-quit-restore" {
		t.Fatalf("expected dead-pid window to be restorable, got %#v", ids)
	}
	if hasLiveWindowLocked(m) {
		t.Fatalf("expected no live window for dead pid")
	}
}

func TestStaleWindowIDsEmptyWhenLive(t *testing.T) {
	pid := os.Getpid()
	m := windowManifest{
		Version: 1,
		Windows: []windowManifestEntry{
			{ID: "win-live", PID: pid, UpdatedAt: 1},
		},
	}
	if !hasLiveWindowLocked(m) {
		t.Fatalf("expected current process to count as live")
	}
	ids := staleWindowIDsLocked(m)
	if len(ids) != 0 {
		t.Fatalf("expected no stale ids while process is live, got %#v", ids)
	}
}
