//go:build !windows

package app

import "errors"

func resolveWindowsUpdateTarget() (string, error) {
	return "", errors.New("windows update target resolution is only available on windows")
}

func buildWindowsPowerShellUpdateScript(_ int) string {
	return ""
}

func windowsUpdateScriptEnv(_, _, _, _ string, _ int) []string {
	return nil
}
