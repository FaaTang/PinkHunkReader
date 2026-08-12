//go:build windows

package app

import (
	"os"
	"strings"

	"golang.org/x/sys/windows"
)

func processAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return false
	}
	defer windows.CloseHandle(h)
	var code uint32
	if err := windows.GetExitCodeProcess(h, &code); err != nil {
		return false
	}
	// STILL_ACTIVE = 259
	if code != 259 {
		return false
	}
	// PID reuse: another process may own this pid. Only count as live if it is our app image.
	ourExe, err := os.Executable()
	if err != nil || strings.TrimSpace(ourExe) == "" {
		return true
	}
	theirPath, err := queryWindowsProcessImagePath(pid)
	if err != nil || strings.TrimSpace(theirPath) == "" {
		return false
	}
	return sameReaderExecutable(ourExe, theirPath)
}
