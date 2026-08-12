//go:build darwin

package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const shellServiceName = "Open with PinkHunkReader"

func registerShellContextMenu(exePath string) error {
	exePath = filepath.Clean(exePath)
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	servicesDir := filepath.Join(home, "Library", "Services")
	if err := os.MkdirAll(servicesDir, 0o755); err != nil {
		return err
	}
	// AppleScript service applet: Finder Services / Quick Actions can invoke it with file selection.
	// Folder background clicks are not supported (accepted product limitation).
	appPath := filepath.Join(servicesDir, shellServiceName+".app")
	_ = os.RemoveAll(appPath)
	script := fmt.Sprintf(`on run {input, parameters}
  set exePath to %q
  if input is {} then return input
  repeat with theItem in input
    set p to POSIX path of theItem
    do shell script quoted form of exePath & " --open=" & quoted form of p
  end repeat
  return input
end run

on open theItems
  set exePath to %q
  repeat with theItem in theItems
    set p to POSIX path of theItem
    do shell script quoted form of exePath & " --open=" & quoted form of p
  end repeat
end open
`, exePath, exePath)
	tmpScript := filepath.Join(os.TempDir(), "pinkhunkreader-shellopen.applescript")
	if err := os.WriteFile(tmpScript, []byte(script), 0o600); err != nil {
		return err
	}
	defer os.Remove(tmpScript)
	cmd := exec.Command("osacompile", "-o", appPath, tmpScript)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("osacompile: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	// Patch Info.plist so the applet declares a Services menu item for files and folders.
	if err := patchServiceInfoPlist(filepath.Join(appPath, "Contents", "Info.plist")); err != nil {
		return err
	}
	_ = flushMacServices()
	_ = lsRegister(appPath)
	return nil
}

func unregisterShellContextMenu() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	appPath := filepath.Join(home, "Library", "Services", shellServiceName+".app")
	_ = os.RemoveAll(appPath)
	_ = flushMacServices()
	return nil
}

func patchServiceInfoPlist(plistPath string) error {
	raw, err := os.ReadFile(plistPath)
	if err != nil {
		return err
	}
	text := string(raw)
	if strings.Contains(text, "NSServices") {
		return nil
	}
	services := fmt.Sprintf(`  <key>NSServices</key>
  <array>
    <dict>
      <key>NSMenuItem</key>
      <dict>
        <key>default</key>
        <string>%s</string>
      </dict>
      <key>NSMessage</key>
      <string>runService</string>
      <key>NSPortName</key>
      <string>PinkHunkReaderShellOpen</string>
      <key>NSSendFileTypes</key>
      <array>
        <string>public.item</string>
        <string>public.folder</string>
      </array>
      <key>NSRequiredContext</key>
      <dict>
        <key>NSTextContent</key>
        <string>FilePath</string>
      </dict>
    </dict>
  </array>
`, shellMenuLabel)
	const marker = "</dict>\n</plist>"
	idx := strings.LastIndex(text, marker)
	if idx < 0 {
		return fmt.Errorf("unexpected Info.plist layout")
	}
	text = text[:idx] + services + text[idx:]
	return os.WriteFile(plistPath, []byte(text), 0o644)
}

func flushMacServices() error {
	_ = exec.Command("/System/Library/CoreServices/pbs", "-flush").Run()
	return nil
}

func lsRegister(path string) error {
	ls := "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
	_ = exec.Command(ls, "-f", path).Run()
	return nil
}
