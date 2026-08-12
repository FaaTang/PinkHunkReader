package app

import (
	"path/filepath"
	"strings"
)

func sameReaderExecutable(ourExe, theirPath string) bool {
	ourBase := strings.ToLower(filepath.Base(ourExe))
	theirBase := strings.ToLower(filepath.Base(theirPath))
	if ourBase == "" || theirBase == "" {
		return false
	}
	if ourBase == theirBase {
		return true
	}
	// Portable updates may rename the exe; still treat PinkHunkReader*.exe as ours.
	return strings.HasPrefix(ourBase, "pinkhunkreader") && strings.HasPrefix(theirBase, "pinkhunkreader")
}
