package fsx

import (
	"fmt"
	"os"
)

// MaxFullTextBytes soft cap when loading a whole text file into memory.
const MaxFullTextBytes int64 = 8 * 1024 * 1024

// ReadText reads an entire UTF-8 text file (rejects oversized files).
func ReadText(g *Guard, path string) (string, error) {
	abs, err := g.Resolve(path)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("cannot read a directory")
	}
	if info.Size() > MaxFullTextBytes {
		return "", fmt.Errorf("file too large; use ReadSlice")
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// WriteText creates or overwrites a text file with UTF-8 content.
func WriteText(g *Guard, path string, content string) error {
	abs, err := g.Resolve(path)
	if err != nil {
		return err
	}
	info, err := os.Stat(abs)
	if err == nil {
		if info.IsDir() {
			return fmt.Errorf("cannot write a directory")
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	// Save As / new file: create when missing.
	return os.WriteFile(abs, []byte(content), 0o644)
}

// ReadBytes reads raw file bytes (images / PDF). Soft size guard applies.
func ReadBytes(g *Guard, path string) ([]byte, error) {
	abs, err := g.Resolve(path)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, fmt.Errorf("cannot read a directory")
	}
	// 64MB guard for binary preview
	if info.Size() > 64*1024*1024 {
		return nil, fmt.Errorf("binary file too large (>%dMB) for preview", 64)
	}
	return os.ReadFile(abs)
}
