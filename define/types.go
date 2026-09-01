package define

// File kind constants used by Go and the frontend viewer router.
const (
	KindMarkdown  = "markdown"
	KindText      = "text"
	KindPDF       = "pdf"
	KindImage     = "image"
	KindWord      = "word"
	KindExcel     = "excel"
	KindUnknown   = "unknown"
	KindDirectory = "directory"
)

// Large-file threshold (MB) for Settings → General. Files larger than this
// enter paged (ReadSlice) mode for editable text / Markdown.
const (
	DefaultLargeFileThresholdMB = 100
	MinLargeFileThresholdMB     = 1
)

// DefaultLargeFileBytes is the default byte threshold (100MB).
const DefaultLargeFileBytes int64 = DefaultLargeFileThresholdMB * 1024 * 1024

// LargeFileBytes is kept as an alias of the default for older call sites/tests.
const LargeFileBytes = DefaultLargeFileBytes

// DefaultSliceLines is the default window size for ReadSlice.
const DefaultSliceLines = 200

// LargeFileThresholdBytes converts a megabyte setting to bytes.
// Values below MinLargeFileThresholdMB fall back to the default.
func LargeFileThresholdBytes(mb int) int64 {
	if mb < MinLargeFileThresholdMB {
		mb = DefaultLargeFileThresholdMB
	}
	return int64(mb) * 1024 * 1024
}

// DirEntry is one node in the file tree.
type DirEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Kind  string `json:"kind"`
}

// FileInfo describes a file for the viewer host.
type FileInfo struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	Size      int64  `json:"size"`
	IsDir     bool   `json:"isDir"`
	Kind      string `json:"kind"`
	Editable  bool   `json:"editable"`
	LargeMode bool   `json:"largeMode"`
	ModTime   string `json:"modTime"`
}

// TextSlice is a line window for large text files (1-based line numbers).
type TextSlice struct {
	StartLine  int    `json:"startLine"`
	EndLine    int    `json:"endLine"`
	TotalLines int    `json:"totalLines"`
	Content    string `json:"content"`
	EOF        bool   `json:"eof"`
}

// MdHeading is one ATX heading entry for the markdown outline sidebar.
type MdHeading struct {
	Level int    `json:"level"`
	Title string `json:"title"`
	Line  int    `json:"line"`
}

// PickOpenResult is returned by PickAndOpen (unified file/folder picker).
type PickOpenResult struct {
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
}
