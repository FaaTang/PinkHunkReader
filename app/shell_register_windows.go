//go:build windows

package app

import (
	"fmt"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const (
	shellRegFileKey = `Software\Classes\*\shell\` + shellVerbName
	shellRegDirKey  = `Software\Classes\Directory\shell\` + shellVerbName
	shellRegBgKey   = `Software\Classes\Directory\Background\shell\` + shellVerbName
)

func registerShellContextMenu(exePath string) error {
	exePath = filepath.Clean(exePath)
	cmdOpen := fmt.Sprintf(`"%s" --open="%%1"`, exePath)
	cmdFolder := fmt.Sprintf(`"%s" --open-folder="%%1"`, exePath)
	cmdBg := fmt.Sprintf(`"%s" --open-folder="%%V"`, exePath)
	icon := exePath + ",0"

	if err := writeShellVerb(shellRegFileKey, shellMenuLabel, icon, cmdOpen, true); err != nil {
		return err
	}
	if err := writeShellVerb(shellRegDirKey, shellMenuLabel, icon, cmdFolder, true); err != nil {
		return err
	}
	if err := writeShellVerb(shellRegBgKey, shellMenuLabel, icon, cmdBg, false); err != nil {
		return err
	}
	return nil
}

func unregisterShellContextMenu() error {
	_ = registry.DeleteKey(registry.CURRENT_USER, shellRegFileKey+`\command`)
	_ = registry.DeleteKey(registry.CURRENT_USER, shellRegFileKey)
	_ = registry.DeleteKey(registry.CURRENT_USER, shellRegDirKey+`\command`)
	_ = registry.DeleteKey(registry.CURRENT_USER, shellRegDirKey)
	_ = registry.DeleteKey(registry.CURRENT_USER, shellRegBgKey+`\command`)
	_ = registry.DeleteKey(registry.CURRENT_USER, shellRegBgKey)
	return nil
}

func writeShellVerb(keyPath, label, icon, command string, multiSelect bool) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, keyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if err := k.SetStringValue("", label); err != nil {
		return err
	}
	if err := k.SetStringValue("Icon", icon); err != nil {
		return err
	}
	if multiSelect {
		if err := k.SetStringValue("MultiSelectModel", "Player"); err != nil {
			return err
		}
	}
	ck, _, err := registry.CreateKey(registry.CURRENT_USER, keyPath+`\command`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer ck.Close()
	return ck.SetStringValue("", command)
}
