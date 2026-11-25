package app

import (
	"strings"
	"sync/atomic"
)

// uiLanguage stores the frontend UI language ("en" or "zh") so backend-generated
// messages (update status, proxy save result, ...) match the visible UI.
var uiLanguage atomic.Value

func init() {
	uiLanguage.Store("en")
}

// SetUILanguage mirrors the frontend language preference into the backend.
// Anything that does not start with "zh" falls back to English.
func (a *App) SetUILanguage(lang string) {
	normalized := "en"
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "zh") {
		normalized = "zh"
	}
	uiLanguage.Store(normalized)
}

func currentUILanguage() string {
	if v, ok := uiLanguage.Load().(string); ok {
		return v
	}
	return "en"
}

func isUILanguageZH() bool {
	return currentUILanguage() == "zh"
}
