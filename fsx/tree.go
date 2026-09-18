package fsx

import (
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/FaaTang/PinkHunkReader/define"
)

// ListDir lists direct children of path (must be under guard root).
func ListDir(g *Guard, path string) ([]define.DirEntry, error) {
	abs, err := g.Resolve(path)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		return nil, err
	}

	out := make([]define.DirEntry, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		isDir := e.IsDir()
		// Skip Microsoft Office lock/owner files (~$foo.docx) — they appear while
		// Word/Excel has a document open and are not real documents to browse.
		if !isDir && isOfficeLockFile(name) {
			continue
		}
		full := filepath.Join(abs, name)
		kind := define.KindDirectory
		if !isDir {
			kind = define.DetectKind(full)
		}
		out = append(out, define.DirEntry{
			Name:  name,
			Path:  full,
			IsDir: isDir,
			Kind:  kind,
		})
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return stringsLessFold(out[i].Name, out[j].Name)
	})
	return out, nil
}

// isOfficeLockFile reports Microsoft Office temporary owner/lock files.
// Word/Excel create "~$" + truncated document name while a file is open.
func isOfficeLockFile(name string) bool {
	return len(name) >= 2 && name[0] == '~' && name[1] == '$'
}

func stringsLessFold(a, b string) bool {
	if len(a) == len(b) {
		for i := 0; i < len(a); i++ {
			ca, cb := a[i], b[i]
			if ca >= 'A' && ca <= 'Z' {
				ca += 'a' - 'A'
			}
			if cb >= 'A' && cb <= 'Z' {
				cb += 'a' - 'A'
			}
			if ca != cb {
				return ca < cb
			}
		}
		return false
	}
	ai, bi := 0, 0
	for ai < len(a) && bi < len(b) {
		ca, cb := a[ai], b[bi]
		if ca >= 'A' && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return ca < cb
		}
		ai++
		bi++
	}
	return len(a) < len(b)
}

// Stat returns file metadata for the viewer host.
// largeFileBytes controls when editable text enters paged mode (≤0 uses default).
func Stat(g *Guard, path string, largeFileBytes int64) (define.FileInfo, error) {
	abs, err := g.Resolve(path)
	if err != nil {
		return define.FileInfo{}, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return define.FileInfo{}, err
	}
	kind := define.KindDirectory
	if !info.IsDir() {
		kind = define.DetectKind(abs)
	}
	if largeFileBytes <= 0 {
		largeFileBytes = define.DefaultLargeFileBytes
	}
	size := info.Size()
	large := !info.IsDir() && define.IsEditable(kind) && size > largeFileBytes
	return define.FileInfo{
		Path:      abs,
		Name:      info.Name(),
		Size:      size,
		IsDir:     info.IsDir(),
		Kind:      kind,
		Editable:  define.IsEditable(kind),
		LargeMode: large,
		ModTime:   info.ModTime().Format(time.RFC3339),
	}, nil
}
