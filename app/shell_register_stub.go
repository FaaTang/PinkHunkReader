//go:build !windows && !darwin

package app

func registerShellContextMenu(exePath string) error {
	_ = exePath
	return nil
}

func unregisterShellContextMenu() error {
	return nil
}
