package fsx

import (
	"fmt"
	"path/filepath"
	"strings"
)

// Guard keeps all file operations under one or more opened root directories.
type Guard struct {
	roots []string
}

// NewGuard creates a workspace guard with a single root (back-compat).
func NewGuard(root string) (*Guard, error) {
	return NewMultiGuard([]string{root})
}

// NewMultiGuard creates a workspace guard that allows paths under any root.
func NewMultiGuard(roots []string) (*Guard, error) {
	g := &Guard{}
	if err := g.SetRoots(roots); err != nil {
		return nil, err
	}
	return g, nil
}

// Root returns the first workspace root (empty when none).
func (g *Guard) Root() string {
	if g == nil || len(g.roots) == 0 {
		return ""
	}
	return g.roots[0]
}

// Roots returns a copy of all workspace roots in order.
func (g *Guard) Roots() []string {
	if g == nil || len(g.roots) == 0 {
		return nil
	}
	out := make([]string, len(g.roots))
	copy(out, g.roots)
	return out
}

// SetRoots replaces all workspace roots. Empty paths are skipped; duplicates collapse.
func (g *Guard) SetRoots(paths []string) error {
	if g == nil {
		return fmt.Errorf("nil guard")
	}
	next := make([]string, 0, len(paths))
	seen := map[string]struct{}{}
	for _, p := range paths {
		abs, err := normalizeRoot(p)
		if err != nil {
			return err
		}
		if abs == "" {
			continue
		}
		key := strings.ToLower(abs)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		next = append(next, abs)
	}
	g.roots = next
	return nil
}

// AddRoot appends a workspace root if not already present.
func (g *Guard) AddRoot(path string) error {
	if g == nil {
		return fmt.Errorf("nil guard")
	}
	abs, err := normalizeRoot(path)
	if err != nil {
		return err
	}
	if abs == "" {
		return fmt.Errorf("empty root")
	}
	key := strings.ToLower(abs)
	for _, r := range g.roots {
		if strings.ToLower(r) == key {
			return nil
		}
	}
	g.roots = append(g.roots, abs)
	return nil
}

// RemoveRoot drops a workspace root (no-op if missing).
func (g *Guard) RemoveRoot(path string) error {
	if g == nil {
		return fmt.Errorf("nil guard")
	}
	abs, err := normalizeRoot(path)
	if err != nil {
		return err
	}
	key := strings.ToLower(abs)
	next := make([]string, 0, len(g.roots))
	for _, r := range g.roots {
		if strings.ToLower(r) != key {
			next = append(next, r)
		}
	}
	g.roots = next
	return nil
}

func normalizeRoot(root string) (string, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		return "", nil
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}

func underRoot(root, abs string) bool {
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return false
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return false
	}
	return true
}

// Resolve returns an absolute path that is guaranteed to stay under at least one root.
func (g *Guard) Resolve(path string) (string, error) {
	if g == nil || len(g.roots) == 0 {
		return "", fmt.Errorf("no folder opened")
	}
	path = strings.TrimSpace(path)
	if path == "" {
		return g.roots[0], nil
	}

	var abs string
	var err error
	if filepath.IsAbs(path) {
		abs, err = filepath.Abs(path)
		if err != nil {
			return "", err
		}
		abs = filepath.Clean(abs)
		for _, root := range g.roots {
			if underRoot(root, abs) {
				return abs, nil
			}
		}
		return "", fmt.Errorf("path escapes workspace root")
	}

	// Relative paths: try each root; prefer the first that exists as a join target.
	var lastErr error
	for _, root := range g.roots {
		cand, joinErr := filepath.Abs(filepath.Join(root, path))
		if joinErr != nil {
			lastErr = joinErr
			continue
		}
		cand = filepath.Clean(cand)
		if underRoot(root, cand) {
			return cand, nil
		}
		lastErr = fmt.Errorf("path escapes workspace root")
	}
	if lastErr != nil {
		return "", lastErr
	}
	return "", fmt.Errorf("path escapes workspace root")
}
