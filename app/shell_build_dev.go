//go:build !production

package app

// shellHandoffEnabled is false under `wailsdev` / plain `go build` (no production tag).
// Otherwise a leftover live window or Notepad++-style bare relaunch would exit the
// process immediately and Wails would print "Development mode exited".
func shellHandoffEnabled() bool {
	return false
}
