//go:build !windows

package app

import (
	"os"
	"path/filepath"
	"time"

	"golang.org/x/sys/unix"
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
		err = unix.Flock(int(f.Fd()), unix.LOCK_EX|unix.LOCK_NB)
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
		_ = unix.Flock(int(f.Fd()), unix.LOCK_UN)
		_ = f.Close()
	}, nil
}
