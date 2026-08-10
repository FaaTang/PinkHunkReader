package main

import (
	"embed"

	"github.com/FaaTang/PinkHunkReader/app"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	application := app.NewApp()

	err := wails.Run(&options.App{
		Title:     "PinkHunkReader",
		Width:     1280,
		Height:    800,
		MinWidth:  900,
		MinHeight: 560,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 246, G: 246, B: 244, A: 255},
		OnStartup:        application.Startup,
		OnBeforeClose:    application.BeforeClose,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     true,
			DisableWebViewDrop: true,
		},
		Bind: []interface{}{
			application,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
		Mac: &mac.Options{
			// Native traffic lights stay top-left; content draws under the titlebar.
			// Do not draw Windows-style caption buttons in the webview on macOS.
			TitleBar:             mac.TitleBarHiddenInset(),
			Appearance:           mac.NSAppearanceNameAqua,
			WebviewIsTransparent: true,
			About: &mac.AboutInfo{
				Title:   "PinkHunkReader",
				Message: "Local file browser · Markdown · PDF · images",
			},
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
