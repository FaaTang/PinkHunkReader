package define

// LaunchInfo describes how this process was started (CLI / restore).
type LaunchInfo struct {
	WindowID   string `json:"windowId"`
	OpenPath   string `json:"openPath"`
	OpenIsDir  bool   `json:"openIsDir"`
	ShouldRestore bool `json:"shouldRestore"`
}

// WindowSessionState is persisted per window on disk.
type WindowSessionState struct {
	Version      int               `json:"version"`
	WindowID     string            `json:"windowId"`
	Roots        []string          `json:"roots"`
	ActivePath   string            `json:"activePath"`
	UntitledSeq  int               `json:"untitledSeq"`
	Tabs         []WindowSessionTab `json:"tabs"`
}

// WindowSessionTab mirrors a frontend OpenTab for persistence.
type WindowSessionTab struct {
	Path         string `json:"path"`
	Name         string `json:"name"`
	Kind         string `json:"kind"`
	Editable     bool   `json:"editable"`
	LargeMode    bool   `json:"largeMode"`
	Size         int64  `json:"size"`
	Dirty        bool   `json:"dirty"`
	Untitled     bool   `json:"untitled"`
	LanguageHint string `json:"languageHint,omitempty"`
	Content      string `json:"content,omitempty"`
}

// OpenPlacementPrefs controls open-in-current vs new-window behavior.
type OpenPlacementPrefs struct {
	Target string `json:"target"` // "current" | "new"
	Mode   string `json:"mode"`   // "ask" | "always"
}
