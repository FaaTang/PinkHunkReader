package define

import (
	"path/filepath"
	"strings"
)

var markdownExt = map[string]struct{}{
	".md": {}, ".markdown": {}, ".mdown": {}, ".mdx": {},
}

var imageExt = map[string]struct{}{
	".png": {}, ".jpg": {}, ".jpeg": {}, ".gif": {}, ".webp": {}, ".svg": {}, ".bmp": {}, ".ico": {},
}

// textExt: plain / config / source — opened in Monaco and editable.
var textExt = map[string]struct{}{
	// Plain text & logs
	".txt": {}, ".text": {}, ".log": {}, ".out": {}, ".err": {},
	// Data / config
	".json": {}, ".jsonc": {}, ".jsonl": {}, ".yaml": {}, ".yml": {},
	".toml": {}, ".ini": {}, ".cfg": {}, ".conf": {}, ".config": {},
	".csv": {}, ".tsv": {}, ".env": {}, ".properties": {},
	".plist": {}, ".editorconfig": {},
	// Markup / style
	".xml": {}, ".html": {}, ".htm": {}, ".css": {}, ".scss": {}, ".less": {},
	// Scripts / code
	".js": {}, ".jsx": {}, ".ts": {}, ".tsx": {}, ".mjs": {}, ".cjs": {},
	".go": {}, ".rs": {}, ".py": {}, ".java": {}, ".kt": {}, ".kts": {},
	".c": {}, ".h": {}, ".cpp": {}, ".cc": {}, ".cxx": {}, ".hpp": {}, ".hxx": {},
	".cs": {}, ".php": {}, ".rb": {}, ".lua": {}, ".r": {}, ".swift": {}, ".dart": {}, ".zig": {},
	".sh": {}, ".bash": {}, ".zsh": {}, ".fish": {}, ".bat": {}, ".cmd": {}, ".ps1": {},
	".sql": {}, ".graphql": {}, ".graphqls": {}, ".gql": {}, ".proto": {},
	".vue": {}, ".svelte": {}, ".astro": {},
	// Project / VCS misc
	".gitignore": {}, ".gitattributes": {}, ".dockerignore": {},
	".npmrc": {}, ".nvmrc": {}, ".yarnrc": {},
	".gradle": {}, ".makefile": {}, ".mk": {},
	".http": {}, ".rest": {},
	".lock": {}, // package-lock / yarn.lock / Cargo.lock (text)
}

// officeExt: Word / Excel — read-only preview later (not Monaco-edit).
var officeExt = map[string]struct{}{
	".docx": {}, ".doc": {},
	".xlsx": {}, ".xls": {},
	".pptx": {}, ".ppt": {},
}

// DetectKind returns the viewer kind for a file path.
func DetectKind(path string) string {
	base := strings.ToLower(filepath.Base(path))
	ext := strings.ToLower(filepath.Ext(path))

	switch base {
	case "makefile", "dockerfile", "license", "licence", "readme", "changelog", "authors", "copying":
		return KindText
	}

	if _, ok := markdownExt[ext]; ok {
		return KindMarkdown
	}
	if ext == ".pdf" {
		return KindPDF
	}
	if _, ok := imageExt[ext]; ok {
		return KindImage
	}
	if _, ok := officeExt[ext]; ok {
		// Until dedicated readers land, treat as unknown (not editable text).
		return KindUnknown
	}
	if _, ok := textExt[ext]; ok {
		return KindText
	}
	if ext == "" {
		return KindText
	}
	return KindUnknown
}

// IsEditable reports whether the kind supports in-app editing.
func IsEditable(kind string) bool {
	return kind == KindMarkdown || kind == KindText
}
