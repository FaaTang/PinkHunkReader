package app

import (
	"strings"
	"testing"
)

func TestBuildMacScriptResolvesDMGAppBundle(t *testing.T) {
	script := buildMacScript(
		"/tmp/update.dmg",
		"/Applications/PinkHunkReader.app",
		"/tmp/staged",
		"/tmp/mnt",
		"/tmp/update.log",
		1,
		"",
	)

	// `ls "$MOUNT_DIR"/*.app` expands the bundle and returns "Contents", not
	// the .app path; the script must resolve the bundle with find instead.
	if strings.Contains(script, `ls "$MOUNT_DIR"/*.app`) {
		t.Fatal("script still uses ls on *.app (returns bundle contents)")
	}
	for _, want := range []string{
		`find "$MOUNT_DIR" -maxdepth 1 -type d -name "*.app"`,
		`resolve_app_bin_rel`,
		`/usr/bin/open -n -a "$TARGET_APP"`,
		`hdiutil attach "$DMG"`,
	} {
		if !strings.Contains(script, want) {
			t.Fatalf("script missing %q", want)
		}
	}
}

func TestBuildMacScriptKeepsWindowRestoreArgs(t *testing.T) {
	script := buildMacScript(
		"/tmp/update.dmg",
		"/Applications/PinkHunkReader.app",
		"/tmp/staged",
		"/tmp/mnt",
		"/tmp/update.log",
		1,
		"win-test",
	)
	if !strings.Contains(script, `RESTORE_ARGS=(--window-id=win-test --restore)`) {
		t.Fatal("restore args missing")
	}
}
