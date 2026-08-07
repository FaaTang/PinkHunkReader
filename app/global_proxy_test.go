package app

import (
	"testing"
	"time"
)

func TestNormalizeProxyConfig(t *testing.T) {
	got, err := normalizeProxyConfig(ProxyConfig{
		Type: "SOCKS5H",
		Host: " 127.0.0.1 ",
		Port: 7891,
		User: " u ",
	})
	if err != nil {
		t.Fatalf("normalizeProxyConfig returned error: %v", err)
	}
	if got.Type != "socks5" || got.Host != "127.0.0.1" || got.Port != 7891 || got.User != "u" {
		t.Fatalf("unexpected normalized proxy: %#v", got)
	}

	if _, err := normalizeProxyConfig(ProxyConfig{Type: "http", Host: "", Port: 8080}); err == nil {
		t.Fatal("expected empty host to fail")
	}
	if _, err := normalizeProxyConfig(ProxyConfig{Type: "ftp", Host: "127.0.0.1", Port: 21}); err == nil {
		t.Fatal("expected unsupported type to fail")
	}
}

func TestSetGlobalProxyConfigAppliesRuntime(t *testing.T) {
	_, _ = setGlobalProxyConfig(false, ProxyConfig{})
	t.Cleanup(func() {
		_, _ = setGlobalProxyConfig(false, ProxyConfig{})
	})

	snapshot, err := setGlobalProxyConfig(true, ProxyConfig{
		Type: "http",
		Host: "127.0.0.1",
		Port: 7890,
	})
	if err != nil {
		t.Fatalf("setGlobalProxyConfig returned error: %v", err)
	}
	if !snapshot.Enabled || snapshot.Proxy.Type != "http" || snapshot.Proxy.Port != 7890 {
		t.Fatalf("unexpected snapshot: %#v", snapshot)
	}

	client := newHTTPClientWithGlobalProxy(5 * time.Second)
	if client == nil || client.Transport == nil {
		t.Fatal("expected HTTP client with proxy transport")
	}
}
