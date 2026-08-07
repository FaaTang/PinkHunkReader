package app

import (
	"net/http"
	"time"
)

func newUpdateHTTPClient(timeout time.Duration) *http.Client {
	return newHTTPClientWithGlobalProxy(timeout)
}
