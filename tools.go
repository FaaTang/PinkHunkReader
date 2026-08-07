//go:build tools

package tools

// Pull Wails CLI + build transitive deps into go.mod / go.sum so CI can
// `go install` / `wails generate` / `wails build` under -mod=readonly.
import (
	_ "github.com/wailsapp/wails/v2/cmd/wails"
	_ "github.com/wailsapp/wails/v2/pkg/commands/build"
)
