//go:build !production

package app

// appConfigDirLeaf is the per-user config folder name under UserConfigDir.
// Isolated from production so `wailsdev` sessions / prefs cannot overwrite release data.
func appConfigDirLeaf() string {
	return "PinkHunkReader-dev"
}

// shellOSIntegrationEnabled: skip Explorer/Finder registration under wailsdev so the
// production "Open with PinkHunkReader" verb is not rewritten to *-dev.exe.
func shellOSIntegrationEnabled() bool {
	return false
}
