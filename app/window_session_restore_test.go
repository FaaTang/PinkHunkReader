package app

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/FaaTang/PinkHunkReader/define"
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

func TestStaleWindowIDsIncludeZeroPID(t *testing.T) {
	m := windowManifest{
		Version: 1,
		Windows: []windowManifestEntry{
			{ID: "win-marked-dead", PID: 0, UpdatedAt: 1},
		},
	}
	ids := staleWindowIDsLocked(m)
	if len(ids) != 1 || ids[0] != "win-marked-dead" {
		t.Fatalf("expected pid=0 window to be restorable, got %#v", ids)
	}
	if hasLiveWindowLocked(m) {
		t.Fatalf("expected no live window for pid=0")
	}
}

func TestSameReaderExecutable(t *testing.T) {
	cases := []struct {
		our, their string
		want       bool
	}{
		{`C:\Apps\PinkHunkReader.exe`, `C:\Apps\PinkHunkReader.exe`, true},
		{`C:\Apps\PinkHunkReader.exe`, `C:\Temp\PinkHunkReader-1.0.11-Windows-Amd64.exe`, true},
		{`C:\Apps\PinkHunkReader.exe`, `C:\Windows\notepad.exe`, false},
		{`C:\Apps\PinkHunkReader.exe`, ``, false},
	}
	for _, tc := range cases {
		if got := sameReaderExecutable(tc.our, tc.their); got != tc.want {
			t.Fatalf("sameReaderExecutable(%q,%q)=%v want %v", tc.our, tc.their, got, tc.want)
		}
	}
}

func TestPrioritizeRestorableWindowIDsPrefersRichAndDropsEmpty(t *testing.T) {
	dir := t.TempDir()
	sessions := filepath.Join(dir, sessionsDirName)
	if err := os.MkdirAll(sessions, 0o700); err != nil {
		t.Fatal(err)
	}
	rich := define.WindowSessionState{
		Version:  2,
		WindowID: "win-rich",
		Roots:    []string{`D:\docs`},
		Tabs:     []define.WindowSessionTab{{Path: `D:\docs\a.md`, Name: "a.md"}},
	}
	empty := define.WindowSessionState{Version: 2, WindowID: "win-empty", Roots: nil, Tabs: nil}
	if err := writeJSONAtomic(filepath.Join(sessions, "win-rich.json"), rich); err != nil {
		t.Fatal(err)
	}
	if err := writeJSONAtomic(filepath.Join(sessions, "win-empty.json"), empty); err != nil {
		t.Fatal(err)
	}
	m := windowManifest{
		Version: 1,
		Windows: []windowManifestEntry{
			{ID: "win-empty", PID: 0, UpdatedAt: 1},
			{ID: "win-rich", PID: 0, UpdatedAt: 2},
		},
	}
	if err := saveWindowManifestLocked(dir, m); err != nil {
		t.Fatal(err)
	}
	primary, spawn := prioritizeRestorableWindowIDs(dir, []string{"win-empty", "win-rich"})
	if primary != "win-rich" {
		t.Fatalf("primary=%q want win-rich", primary)
	}
	if len(spawn) != 0 {
		t.Fatalf("spawn=%v want empty (no blank sibling)", spawn)
	}
	loaded, err := loadWindowManifestLocked(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded.Windows) != 1 || loaded.Windows[0].ID != "win-rich" {
		t.Fatalf("expected empty orphan pruned, got %#v", loaded.Windows)
	}
}

func TestPrioritizeRestorableWindowIDsKeepsOnlyNewestRich(t *testing.T) {
	dir := t.TempDir()
	sessions := filepath.Join(dir, sessionsDirName)
	if err := os.MkdirAll(sessions, 0o700); err != nil {
		t.Fatal(err)
	}
	older := define.WindowSessionState{
		Version:  2,
		WindowID: "win-old",
		Roots:    []string{`D:\old`},
		Tabs:     []define.WindowSessionTab{{Path: `D:\old\a.md`, Name: "a.md"}},
	}
	newer := define.WindowSessionState{
		Version:  2,
		WindowID: "win-new",
		Roots:    []string{`D:\new`},
		Tabs:     []define.WindowSessionTab{{Path: `D:\new\b.md`, Name: "b.md"}},
	}
	if err := writeJSONAtomic(filepath.Join(sessions, "win-old.json"), older); err != nil {
		t.Fatal(err)
	}
	if err := writeJSONAtomic(filepath.Join(sessions, "win-new.json"), newer); err != nil {
		t.Fatal(err)
	}
	m := windowManifest{
		Version: 1,
		Windows: []windowManifestEntry{
			{ID: "win-old", PID: 0, UpdatedAt: 10},
			{ID: "win-new", PID: 0, UpdatedAt: 99},
		},
	}
	if err := saveWindowManifestLocked(dir, m); err != nil {
		t.Fatal(err)
	}
	primary, spawn := prioritizeRestorableWindowIDs(dir, []string{"win-old", "win-new"})
	if primary != "win-new" {
		t.Fatalf("primary=%q want win-new (newest UpdatedAt)", primary)
	}
	if len(spawn) != 0 {
		t.Fatalf("spawn=%v want empty (only last window)", spawn)
	}
	loaded, err := loadWindowManifestLocked(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded.Windows) != 1 || loaded.Windows[0].ID != "win-new" {
		t.Fatalf("expected older sibling pruned, got %#v", loaded.Windows)
	}
	if _, err := os.Stat(filepath.Join(sessions, "win-old.json")); !os.IsNotExist(err) {
		t.Fatalf("expected win-old session removed, err=%v", err)
	}
}

func TestHasOtherLiveWindowLocked(t *testing.T) {
	pid := os.Getpid()
	m := windowManifest{
		Version: 1,
		Windows: []windowManifestEntry{
			{ID: "self", PID: pid, UpdatedAt: 1},
			{ID: "other-dead", PID: 0, UpdatedAt: 2},
		},
	}
	if hasOtherLiveWindowLocked(m, "self") {
		t.Fatalf("dead sibling should not count as live")
	}
	m.Windows = append(m.Windows, windowManifestEntry{ID: "other-live", PID: pid, UpdatedAt: 3})
	if !hasOtherLiveWindowLocked(m, "self") {
		t.Fatalf("expected sibling with live pid to count")
	}
}

func TestConsumeUpdateRestoreHint(t *testing.T) {
	dir := t.TempDir()
	if err := writeUpdateRestoreHint(dir, "win-update"); err != nil {
		t.Fatal(err)
	}
	if got := consumeUpdateRestoreHintLocked(dir); got != "win-update" {
		t.Fatalf("got %q", got)
	}
	if got := consumeUpdateRestoreHintLocked(dir); got != "" {
		t.Fatalf("hint should be one-shot, got %q", got)
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
