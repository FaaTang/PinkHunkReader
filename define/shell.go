package define

// ShellIntegrationPrefs controls OS file-manager integration (portable builds).
type ShellIntegrationPrefs struct {
	// ContextMenu enables Explorer / Finder "Open with PinkHunkReader" integration.
	// Default true when the prefs file is missing.
	ContextMenu bool `json:"contextMenu"`
}

// ShellOpenRequest is emitted to the frontend when another process hands off paths.
type ShellOpenRequest struct {
	Paths []string `json:"paths"`
	Focus bool     `json:"focus"`
}
