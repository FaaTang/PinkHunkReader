package app

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/FaaTang/PinkHunkReader/define"
	xproxy "golang.org/x/net/proxy"
)

type ProxyConfig struct {
	Type     string `json:"type"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
}

type GlobalProxyView struct {
	Enabled  bool   `json:"enabled"`
	Type     string `json:"type"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
}

type globalProxySnapshot struct {
	Enabled bool
	Proxy   ProxyConfig
}

var globalProxyRuntime = struct {
	mu      sync.RWMutex
	enabled bool
	proxy   ProxyConfig
}{}

type localProxyTLSFallbackTransport struct {
	primary       *http.Transport
	fallback      *http.Transport
	proxyEndpoint string
}

func currentGlobalProxyConfig() globalProxySnapshot {
	globalProxyRuntime.mu.RLock()
	defer globalProxyRuntime.mu.RUnlock()
	if !globalProxyRuntime.enabled {
		return globalProxySnapshot{}
	}
	return globalProxySnapshot{
		Enabled: true,
		Proxy:   globalProxyRuntime.proxy,
	}
}

func setGlobalProxyConfig(enabled bool, proxyConfig ProxyConfig) (globalProxySnapshot, error) {
	if !enabled {
		globalProxyRuntime.mu.Lock()
		globalProxyRuntime.enabled = false
		globalProxyRuntime.proxy = ProxyConfig{}
		globalProxyRuntime.mu.Unlock()
		return currentGlobalProxyConfig(), nil
	}

	normalized, err := normalizeProxyConfig(proxyConfig)
	if err != nil {
		return globalProxySnapshot{}, err
	}

	globalProxyRuntime.mu.Lock()
	globalProxyRuntime.enabled = true
	globalProxyRuntime.proxy = normalized
	globalProxyRuntime.mu.Unlock()
	return currentGlobalProxyConfig(), nil
}

func normalizeProxyConfig(config ProxyConfig) (ProxyConfig, error) {
	result := ProxyConfig{
		Type:     strings.ToLower(strings.TrimSpace(config.Type)),
		Host:     strings.TrimSpace(config.Host),
		Port:     config.Port,
		User:     strings.TrimSpace(config.User),
		Password: config.Password,
	}
	switch result.Type {
	case "http", "socks5":
	case "socks5h":
		result.Type = "socks5"
	default:
		return result, fmt.Errorf("unsupported proxy type: %s", config.Type)
	}
	if result.Host == "" {
		return result, fmt.Errorf("proxy host is empty")
	}
	if result.Port <= 0 || result.Port > 65535 {
		return result, fmt.Errorf("invalid proxy port: %d", result.Port)
	}
	return result, nil
}

func currentGlobalProxyView() GlobalProxyView {
	snapshot := currentGlobalProxyConfig()
	if !snapshot.Enabled {
		return GlobalProxyView{Enabled: false, Type: "socks5", Port: 1080}
	}
	return GlobalProxyView{
		Enabled:  true,
		Type:     snapshot.Proxy.Type,
		Host:     snapshot.Proxy.Host,
		Port:     snapshot.Proxy.Port,
		User:     snapshot.Proxy.User,
		Password: snapshot.Proxy.Password,
	}
}

// GetGlobalProxyConfig returns the persisted/runtime global proxy settings.
func (a *App) GetGlobalProxyConfig() define.QueryResult {
	return define.QueryResult{
		Success: true,
		Message: "OK",
		Data:    currentGlobalProxyView(),
	}
}

// SaveGlobalProxy persists and applies global proxy settings used by updater HTTP.
func (a *App) SaveGlobalProxy(input GlobalProxyView) define.QueryResult {
	view, err := a.saveGlobalProxy(input)
	if err != nil {
		return define.QueryResult{Success: false, Message: err.Error()}
	}
	return define.QueryResult{
		Success: true,
		Message: "Proxy settings saved",
		Data:    view,
	}
}

func newHTTPClientWithGlobalProxy(timeout time.Duration) *http.Client {
	client := &http.Client{Timeout: timeout}
	if transport := buildHTTPTransportWithGlobalProxy(); transport != nil {
		client.Transport = transport
	}
	return client
}

func buildHTTPTransportWithGlobalProxy() http.RoundTripper {
	baseTransport, ok := http.DefaultTransport.(*http.Transport)
	if !ok || baseTransport == nil {
		return nil
	}

	transport := baseTransport.Clone()
	snapshot := currentGlobalProxyConfig()
	if !snapshot.Enabled {
		transport.Proxy = http.ProxyFromEnvironment
		return transport
	}

	if err := applyProxyToTransport(transport, snapshot.Proxy); err != nil {
		log.Printf("全局代理配置无效，回退系统代理：%v", err)
		transport.Proxy = http.ProxyFromEnvironment
		return transport
	}
	if !isLoopbackProxyHost(snapshot.Proxy.Host) {
		return transport
	}

	proxyURL, _ := buildProxyURLFromConfig(snapshot.Proxy)
	endpoint := ""
	if proxyURL != nil {
		endpoint = proxyURL.Redacted()
	}
	fallbackTransport := transport.Clone()
	fallbackTransport.TLSClientConfig = cloneTLSConfigWithInsecureSkipVerify(fallbackTransport.TLSClientConfig)
	return &localProxyTLSFallbackTransport{
		primary:       transport,
		fallback:      fallbackTransport,
		proxyEndpoint: endpoint,
	}
}

func applyProxyToTransport(transport *http.Transport, proxyConfig ProxyConfig) error {
	normalized, err := normalizeProxyConfig(proxyConfig)
	if err != nil {
		return err
	}
	hostPort := net.JoinHostPort(normalized.Host, strconv.Itoa(normalized.Port))

	switch normalized.Type {
	case "http":
		proxyURL, err := buildProxyURLFromConfig(normalized)
		if err != nil {
			return err
		}
		transport.Proxy = http.ProxyURL(proxyURL)
		return nil
	case "socks5":
		var auth *xproxy.Auth
		if normalized.User != "" {
			auth = &xproxy.Auth{
				User:     normalized.User,
				Password: normalized.Password,
			}
		}
		dialer, err := xproxy.SOCKS5("tcp", hostPort, auth, &net.Dialer{Timeout: 30 * time.Second})
		if err != nil {
			return err
		}
		contextDialer, ok := dialer.(xproxy.ContextDialer)
		transport.Proxy = nil
		if ok {
			transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
				return contextDialer.DialContext(ctx, network, addr)
			}
		} else {
			transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
				return dialer.Dial(network, addr)
			}
		}
		return nil
	default:
		return fmt.Errorf("unsupported proxy type: %s", normalized.Type)
	}
}

func (t *localProxyTLSFallbackTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := t.primary.RoundTrip(req)
	if err == nil {
		return resp, nil
	}
	if !isTLSFallbackCandidate(req.Method, err) {
		return nil, err
	}
	retryReq, cloneErr := cloneRequestForRetry(req)
	if cloneErr != nil {
		return nil, err
	}
	log.Printf("检测到本地代理 TLS 证书不受信任，启用兼容回退：代理=%s 目标=%s 错误=%v", t.proxyEndpoint, req.URL.String(), err)
	return t.fallback.RoundTrip(retryReq)
}

func isTLSFallbackCandidate(method string, err error) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case http.MethodGet, http.MethodHead:
	default:
		return false
	}
	return isUnknownAuthorityError(err)
}

func cloneRequestForRetry(req *http.Request) (*http.Request, error) {
	cloned := req.Clone(req.Context())
	if req.Body == nil || req.Body == http.NoBody {
		return cloned, nil
	}
	if req.GetBody == nil {
		return nil, fmt.Errorf("request body not replayable")
	}
	body, err := req.GetBody()
	if err != nil {
		return nil, err
	}
	cloned.Body = body
	return cloned, nil
}

func isUnknownAuthorityError(err error) bool {
	var unknownErr x509.UnknownAuthorityError
	if errors.As(err, &unknownErr) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "x509: certificate signed by unknown authority")
}

func cloneTLSConfigWithInsecureSkipVerify(base *tls.Config) *tls.Config {
	if base == nil {
		return &tls.Config{InsecureSkipVerify: true} //nolint:gosec // local proxy TLS fallback only
	}
	cloned := base.Clone()
	cloned.InsecureSkipVerify = true
	return cloned
}

func isLoopbackProxyHost(host string) bool {
	trimmed := strings.TrimSpace(host)
	if trimmed == "" {
		return false
	}
	if strings.EqualFold(trimmed, "localhost") {
		return true
	}
	ip := net.ParseIP(trimmed)
	if ip == nil {
		return false
	}
	return ip.IsLoopback()
}

func buildProxyURLFromConfig(proxyConfig ProxyConfig) (*url.URL, error) {
	normalized, err := normalizeProxyConfig(proxyConfig)
	if err != nil {
		return nil, err
	}
	proxyURL := &url.URL{
		Scheme: normalized.Type,
		Host:   net.JoinHostPort(normalized.Host, strconv.Itoa(normalized.Port)),
	}
	if normalized.User != "" {
		proxyURL.User = url.UserPassword(normalized.User, normalized.Password)
	}
	return proxyURL, nil
}
