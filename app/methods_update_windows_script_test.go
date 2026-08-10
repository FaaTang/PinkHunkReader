//go:build windows

package app

import (
	"os/exec"
	"strings"
	"testing"
)

func TestBuildWindowsPowerShellUpdateScriptUsesEnvPaths(t *testing.T) {
	script := buildWindowsPowerShellUpdateScript(13579)

	mustContain := []string{
		`$ErrorActionPreference = 'Stop'`,
		`$Source = $env:GONAVI_UPDATE_SOURCE`,
		`$Target = $env:GONAVI_UPDATE_TARGET`,
		`$Staged = $env:GONAVI_UPDATE_STAGED`,
		`$LogFile = $env:GONAVI_UPDATE_LOG`,
		`$HostPid = [int]$env:GONAVI_UPDATE_PID`,
		`Write-UpdateLog "source=$Source"`,
		`Write-UpdateLog "target=$Target"`,
		`Test-Path -Path $Target`,
		`Expand-Archive -Path $SourcePath`,
		`function Resolve-LaunchTarget`,
		`target filename differs, renaming to latest`,
		`Start-Process -FilePath $TargetExe -WorkingDirectory $targetDir -WindowStyle Normal -PassThru -ErrorAction Stop`,
		`Write-UpdateLog ("started updated application: pid={0} path={1}" -f $proc.Id, $TargetExe)`,
		`Update-ShortcutsToTarget -OldExe $TargetExe -NewExe $renamedTarget`,
		`$launchTarget = Resolve-LaunchTarget -SourceExe $sourceExe -TargetExe $Target`,
		`Start-UpdatedApplication -TargetExe $launchTarget`,
		`Replace-TargetExecutable -SourceExe $sourceExe -TargetExe $Target`,
		`Write-UpdateLog ("update failed: " + $_.Exception.Message)`,
		`Start-Sleep -Seconds 3`,
		`for ($retry = 0; $retry -lt 15; $retry++)`,
	}
	for _, want := range mustContain {
		if !strings.Contains(script, want) {
			t.Fatalf("windows powershell update script missing required token: %s\nscript:\n%s", want, script)
		}
	}
}

func TestBuildWindowsPowerShellUpdateScriptUsesCRLFLineEndings(t *testing.T) {
	script := buildWindowsPowerShellUpdateScript(99999)
	if !strings.Contains(script, "\r\n") {
		t.Fatalf("windows powershell update script should use CRLF line endings")
	}
}

func TestWindowsUpdateScriptEnv(t *testing.T) {
	env := windowsUpdateScriptEnv(
		`C:\tmp\PinkHunkReader-1.0.10-Windows-Amd64.exe`,
		`C:\Users\admin\Desktop\PinkHunkReader-1.0.9-Windows-Amd64.exe`,
		`C:\Users\admin\AppData\Local\Temp\PinkHunkReader-updates\.PinkHunkReader-update-windows-1.0.10`,
		`C:\Users\admin\AppData\Local\Temp\PinkHunkReader-updates\update-install.log`,
		99999,
	)
	want := []string{
		`GONAVI_UPDATE_SOURCE=C:\tmp\PinkHunkReader-1.0.10-Windows-Amd64.exe`,
		`GONAVI_UPDATE_TARGET=C:\Users\admin\Desktop\PinkHunkReader-1.0.9-Windows-Amd64.exe`,
		`GONAVI_UPDATE_STAGED=C:\Users\admin\AppData\Local\Temp\PinkHunkReader-updates\.PinkHunkReader-update-windows-1.0.10`,
		`GONAVI_UPDATE_LOG=C:\Users\admin\AppData\Local\Temp\PinkHunkReader-updates\update-install.log`,
		`GONAVI_UPDATE_PID=99999`,
	}
	if len(env) != len(want) {
		t.Fatalf("unexpected env length: got %d want %d", len(env), len(want))
	}
	for i := range want {
		if env[i] != want[i] {
			t.Fatalf("unexpected env[%d]: got %q want %q", i, env[i], want[i])
		}
	}
}

func TestBuildWindowsLaunchCommandUsesDetachedPowerShell(t *testing.T) {
	cmd := buildWindowsLaunchCommand(`C:\tmp\pinkhunk-reader-update\update.ps1`)

	if !strings.EqualFold(cmd.Args[0], cmd.Path) && !strings.HasSuffix(strings.ToLower(cmd.Path), `\powershell.exe`) {
		t.Fatalf("unexpected command path: %s", cmd.Path)
	}

	want := []string{
		"powershell.exe", "-NoProfile", "-NoLogo", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", `C:\tmp\pinkhunk-reader-update\update.ps1`,
	}
	if len(cmd.Args) != len(want) {
		t.Fatalf("unexpected arg length: got %d want %d, args=%v", len(cmd.Args), len(want), cmd.Args)
	}
	for i := range want {
		if cmd.Args[i] != want[i] {
			t.Fatalf("unexpected arg[%d]: got %q want %q", i, cmd.Args[i], want[i])
		}
	}
}

var _ = exec.ErrNotFound
