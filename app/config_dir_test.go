package app

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveAppConfigDirUsesDevLeafOutsideProduction(t *testing.T) {
	// Unit tests build without -tags production → PinkHunkReader-dev.
	dir := resolveAppConfigDir()
	base := filepath.Base(dir)
	if base != "PinkHunkReader-dev" {
		t.Fatalf("config leaf=%q want PinkHunkReader-dev (non-production build)", base)
	}
	if ConfigDirLeaf() != "PinkHunkReader-dev" {
		t.Fatalf("ConfigDirLeaf=%q", ConfigDirLeaf())
	}
	if shellOSIntegrationEnabled() {
		t.Fatal("shell OS integration must stay off outside production")
	}
	if !strings.Contains(filepath.ToSlash(dir), "PinkHunkReader-dev") {
		t.Fatalf("dir=%q", dir)
	}
}
