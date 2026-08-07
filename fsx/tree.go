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
		full := filepath.Join(abs, name)
		isDir := e.IsDir()
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
func Stat(g *Guard, path string) (define.FileInfo, error) {
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
	size := info.Size()
	large := !info.IsDir() && define.IsEditable(kind) && size > define.LargeFileBytes
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
