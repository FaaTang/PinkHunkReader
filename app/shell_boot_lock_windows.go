//go:build windows

package app

import (
	"os"
	"path/filepath"
	"time"

	"golang.org/x/sys/windows"
)

const shellBootLockName = "shell_boot.lock"

func lockShellBoot() (func(), error) {
	configDir := resolveAppConfigDir()
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		return nil, err
	}
	path := filepath.Join(configDir, shellBootLockName)
	deadline := time.Now().Add(8 * time.Second)
	var f *os.File
	for {
		var err error
		f, err = os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
		if err != nil {
			return nil, err
		}
		err = windows.LockFileEx(
			windows.Handle(f.Fd()),
			windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY,
			0,
			1,
			0,
			&windows.Overlapped{},
		)
		if err == nil {
			break
		}
		_ = f.Close()
		if time.Now().After(deadline) {
			return nil, err
		}
		time.Sleep(40 * time.Millisecond)
	}
	return func() {
		_ = windows.UnlockFileEx(windows.Handle(f.Fd()), 0, 1, 0, &windows.Overlapped{})
		_ = f.Close()
	}, nil
}
