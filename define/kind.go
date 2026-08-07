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

// wordExt: Word — read-only preview (docx; legacy .doc may fail in viewer).
var wordExt = map[string]struct{}{
	".docx": {}, ".doc": {},
}

// excelExt: Excel — read-only preview.
var excelExt = map[string]struct{}{
	".xlsx": {}, ".xls": {},
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
	if _, ok := wordExt[ext]; ok {
		return KindWord
	}
	if _, ok := excelExt[ext]; ok {
		return KindExcel
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
