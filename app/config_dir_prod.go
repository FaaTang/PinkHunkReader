//go:build production

package app

func appConfigDirLeaf() string {
	return "PinkHunkReader"
}

func shellOSIntegrationEnabled() bool {
	return true
}
