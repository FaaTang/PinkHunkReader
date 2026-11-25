package app

import "testing"

func TestSetUILanguageSwitchesUpdateText(t *testing.T) {
	t.Cleanup(func() { uiLanguage.Store("en") })

	(&App{}).SetUILanguage("zh")
	if got := updateText("app.update.backend.message.latest", nil); got != "已是最新版本" {
		t.Fatalf("zh latest = %q", got)
	}
	if got := updateText("app.update.backend.error.check_http_status", map[string]any{"status": 500}); got != "检查更新失败（HTTP 500）" {
		t.Fatalf("zh check error = %q", got)
	}
	if got := updateText("app.proxy.backend.message.saved", nil); got != "代理设置已保存" {
		t.Fatalf("zh proxy saved = %q", got)
	}

	(&App{}).SetUILanguage("en")
	if got := updateText("app.update.backend.message.latest", nil); got != "You are on the latest version" {
		t.Fatalf("en latest = %q", got)
	}
	if got := updateText("app.proxy.backend.message.saved", nil); got != "Proxy settings saved" {
		t.Fatalf("en proxy saved = %q", got)
	}

	(&App{}).SetUILanguage("zh-CN")
	if got := updateText("app.update.backend.message.latest", nil); got != "已是最新版本" {
		t.Fatalf("zh-CN latest = %q", got)
	}

	(&App{}).SetUILanguage("fr")
	if got := updateText("app.update.backend.message.latest", nil); got != "You are on the latest version" {
		t.Fatalf("unsupported language should fall back to en, got %q", got)
	}
}

func TestUpdateTextUnknownKeyFallsBackToKey(t *testing.T) {
	t.Cleanup(func() { uiLanguage.Store("en") })
	(&App{}).SetUILanguage("zh")
	if got := updateText("app.update.backend.unknown", nil); got != "app.update.backend.unknown" {
		t.Fatalf("unknown key = %q", got)
	}
}
