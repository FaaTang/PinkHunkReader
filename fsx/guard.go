package fsx

import (
	"fmt"
	"path/filepath"
	"strings"
)

// Guard keeps all file operations under an opened root directory.
type Guard struct {
	root string
}

func NewGuard(root string) (*Guard, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	abs = filepath.Clean(abs)
	return &Guard{root: abs}, nil
}

func (g *Guard) Root() string {
	if g == nil {
		return ""
	}
	return g.root
}

// Resolve returns an absolute path that is guaranteed to stay under root.
func (g *Guard) Resolve(path string) (string, error) {
	if g == nil || g.root == "" {
		return "", fmt.Errorf("no folder opened")
	}
	path = strings.TrimSpace(path)
	if path == "" {
		return g.root, nil
	}

	var abs string
	var err error
	if filepath.IsAbs(path) {
		abs, err = filepath.Abs(path)
	} else {
		abs, err = filepath.Abs(filepath.Join(g.root, path))
	}
	if err != nil {
		return "", err
	}
	abs = filepath.Clean(abs)

	root := g.root
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return "", fmt.Errorf("invalid path")
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes workspace root")
	}
	return abs, nil
}
