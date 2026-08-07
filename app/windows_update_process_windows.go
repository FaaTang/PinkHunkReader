//go:build windows

package app

import (
	"os/exec"
	"syscall"
)

const (
	windowsCreateNoWindow         = 0x08000000
	windowsCreateBreakawayFromJob = 0x01000000
)

func configureWindowsUpdateCommand(cmd *exec.Cmd) {
	if cmd == nil {
		return
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: windowsCreateNoWindow | windowsCreateBreakawayFromJob,
	}
}

func buildWindowsHiddenPowerShellCommand(mode string, payload string) *exec.Cmd {
	cmd := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-NoLogo",
		"-NonInteractive",
		"-WindowStyle", "Hidden",
		"-ExecutionPolicy", "Bypass",
		mode, payload,
	)
	configureWindowsUpdateCommand(cmd)
	return cmd
}
