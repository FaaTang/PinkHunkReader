//go:build tools

package tools

// Keep Wails CLI/build transitive deps in go.mod / go.sum so CI can use -mod=readonly.
import (
	_ "github.com/tc-hib/winres"
	_ "github.com/tc-hib/winres/version"
	_ "github.com/wailsapp/wails/v2/pkg/commands/build"
)
