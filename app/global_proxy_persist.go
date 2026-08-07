package app

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

const globalProxyFileName = "global_proxy.json"

func resolveAppConfigDir() string {
	dir, err := os.UserConfigDir()
	if err != nil || strings.TrimSpace(dir) == "" {
		home, homeErr := os.UserHomeDir()
		if homeErr != nil || strings.TrimSpace(home) == "" {
			return "PinkHunkReader"
		}
		return filepath.Join(home, ".config", "PinkHunkReader")
	}
	return filepath.Join(dir, "PinkHunkReader")
}

func globalProxyMetadataPath(configDir string) string {
	return filepath.Join(configDir, globalProxyFileName)
}

func (a *App) loadPersistedGlobalProxy() {
	view, err := loadStoredGlobalProxyView()
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("加载全局代理失败: %v", err)
		}
		return
	}
	if !view.Enabled {
		_, _ = setGlobalProxyConfig(false, ProxyConfig{})
		return
	}
	if _, err := setGlobalProxyConfig(true, ProxyConfig{
		Type:     view.Type,
		Host:     view.Host,
		Port:     view.Port,
		User:     view.User,
		Password: view.Password,
	}); err != nil {
		log.Printf("应用全局代理失败: %v", err)
	}
}

func (a *App) saveGlobalProxy(input GlobalProxyView) (GlobalProxyView, error) {
	view := GlobalProxyView{
		Enabled:  input.Enabled,
		Type:     strings.TrimSpace(input.Type),
		Host:     strings.TrimSpace(input.Host),
		Port:     input.Port,
		User:     strings.TrimSpace(input.User),
		Password: input.Password,
	}

	if !view.Enabled {
		view = GlobalProxyView{Enabled: false, Type: "socks5", Port: 1080}
		if err := persistGlobalProxyView(view); err != nil {
			return GlobalProxyView{}, err
		}
		if _, err := setGlobalProxyConfig(false, ProxyConfig{}); err != nil {
			return GlobalProxyView{}, err
		}
		return view, nil
	}

	normalized, err := normalizeProxyConfig(ProxyConfig{
		Type:     view.Type,
		Host:     view.Host,
		Port:     view.Port,
		User:     view.User,
		Password: view.Password,
	})
	if err != nil {
		return GlobalProxyView{}, err
	}
	view.Type = normalized.Type
	view.Host = normalized.Host
	view.Port = normalized.Port
	view.User = normalized.User
	view.Password = normalized.Password

	if err := persistGlobalProxyView(view); err != nil {
		return GlobalProxyView{}, err
	}
	if _, err := setGlobalProxyConfig(true, ProxyConfig{
		Type:     view.Type,
		Host:     view.Host,
		Port:     view.Port,
		User:     view.User,
		Password: view.Password,
	}); err != nil {
		return GlobalProxyView{}, err
	}
	return view, nil
}

func loadStoredGlobalProxyView() (GlobalProxyView, error) {
	path := globalProxyMetadataPath(resolveAppConfigDir())
	raw, err := os.ReadFile(path)
	if err != nil {
		return GlobalProxyView{}, err
	}
	var view GlobalProxyView
	if err := json.Unmarshal(raw, &view); err != nil {
		return GlobalProxyView{}, fmt.Errorf("parse global proxy config: %w", err)
	}
	return view, nil
}

func persistGlobalProxyView(view GlobalProxyView) error {
	configDir := resolveAppConfigDir()
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(view, "", "  ")
	if err != nil {
		return err
	}
	path := globalProxyMetadataPath(configDir)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
