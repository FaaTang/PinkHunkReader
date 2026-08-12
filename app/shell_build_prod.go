//go:build production

package app

// shellHandoffEnabled is true for `wails build` / release binaries.
func shellHandoffEnabled() bool {
	return true
}
