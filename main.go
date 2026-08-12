package main

import (
	"embed"
	"os"

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
	if app.TryHandoffExternalLaunch(os.Args[1:]) {
		return
	}

	application := app.NewApp()

	err := wails.Run(&options.App{
		Title:            "PinkHunkReader",
		Width:            900,
		Height:           560,
		MinWidth:         900,
		MinHeight:        560,
		WindowStartState: options.Normal,
		StartHidden:      true,
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
			// Keep WebView2 under a stable folder so portable/versioned exe names
			// do not create a new %APPDATA%\<BinaryName.exe> directory on every update.
			WebviewUserDataPath: resolveWindowsWebviewUserDataPath(),
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
