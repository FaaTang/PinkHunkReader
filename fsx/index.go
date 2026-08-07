package fsx

import (
	"bufio"
	"io"
	"os"
	"sync"
)

// lineIndex is a cached per-file map of line start byte offsets.
// offsets[i] is the byte offset of line i+1's first byte.
type lineIndex struct {
	offsets   []int64
	lineCount int
	size      int64
	modTimeNs int64
}

const (
	// indexThresholdBytes: files above this size get a line-offset index
	// so ReadSlice can seek directly instead of rescanning.
	indexThresholdBytes = 1024 * 1024

	maxIndexEntries = 16
)

var (
	indexMu      sync.Mutex
	indexEntries = map[string]*lineIndex{}
	indexOrder   []string // simple FIFO eviction
)

// getOrBuildIndex returns the cached index for abs, building it on first use.
func getOrBuildIndex(abs string) (*lineIndex, error) {
	info, err := os.Stat(abs)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, os.ErrInvalid
	}

	indexMu.Lock()
	defer indexMu.Unlock()

	if idx, ok := indexEntries[abs]; ok && idx.size == info.Size() && idx.modTimeNs == info.ModTime().UnixNano() {
		return idx, nil
	}

	idx, err := buildIndex(abs)
	if err != nil {
		return nil, err
	}
	idx.size = info.Size()
	idx.modTimeNs = info.ModTime().UnixNano()

	indexEntries[abs] = idx
	indexOrder = append(indexOrder, abs)
	if len(indexOrder) > maxIndexEntries {
		old := indexOrder[0]
		indexOrder = indexOrder[1:]
		delete(indexEntries, old)
	}
	return idx, nil
}

// buildIndex records the byte offset of each line start.
func buildIndex(abs string) (*lineIndex, error) {
	f, err := os.Open(abs)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	r := bufio.NewReaderSize(f, 256*1024)
	idx := &lineIndex{offsets: []int64{0}}
	lineCount := 0
	offset := int64(0)

	for {
		line, err := r.ReadBytes('\n')
		if len(line) > 0 {
			lineCount++
			offset += int64(len(line))
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		idx.offsets = append(idx.offsets, offset)
	}

	idx.lineCount = lineCount
	if len(idx.offsets) > lineCount {
		// A trailing newline produces one extra start offset beyond the last
		// real line; drop it so offsets[i] always refers to an existing line.
		idx.offsets = idx.offsets[:lineCount]
	}
	return idx, nil
}
