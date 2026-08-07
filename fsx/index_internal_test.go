package fsx

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildIndex(t *testing.T) {
	dir := t.TempDir()

	cases := []struct {
		name    string
		content string
		lines   int
		second  int64 // byte offset of line 2 start
	}{
		{"trailing newline", "l1\nl2\nl3\n", 3, 3},
		{"no trailing newline", "l1\nl2\nl3", 3, 3},
		{"single line", "l1", 1, 0},
		{"empty", "", 0, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			path := filepath.Join(dir, "case.txt")
			if err := os.WriteFile(path, []byte(c.content), 0o644); err != nil {
				t.Fatal(err)
			}
			idx, err := getOrBuildIndex(path)
			if err != nil {
				t.Fatal(err)
			}
			if idx.lineCount != c.lines {
				t.Fatalf("lineCount=%d want %d", idx.lineCount, c.lines)
			}
			if c.lines >= 2 && idx.offsets[1] != c.second {
				t.Fatalf("offset[1]=%d want %d", idx.offsets[1], c.second)
			}
		})
	}
}

func TestReadSliceIndexed(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "big.txt")

	// Enough content to exceed the 1MB index threshold so ReadSlice
	// exercises the indexed seek path.
	var sb strings.Builder
	for i := 1; i <= 40000; i++ {
		sb.WriteString(fmt.Sprintf("line number %06d with some padding to make it realistic\n", i))
	}
	content := sb.String()
	if len(content) < int(indexThresholdBytes) {
		t.Fatalf("test file too small: %d bytes", len(content))
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	g, err := NewGuard(dir)
	if err != nil {
		t.Fatal(err)
	}

	slice, err := ReadSlice(g, "big.txt", 1500, 200)
	if err != nil {
		t.Fatal(err)
	}
	if slice.StartLine != 1500 || slice.EndLine != 1699 {
		t.Fatalf("range = %d..%d want 1500..1699", slice.StartLine, slice.EndLine)
	}
	if slice.TotalLines != 40000 {
		t.Fatalf("totalLines=%d want 40000", slice.TotalLines)
	}
	if slice.EOF {
		t.Fatal("should not be EOF")
	}
	if !strings.HasPrefix(slice.Content, "line number 001500") {
		t.Fatalf("unexpected window head: %q", firstLine(slice.Content))
	}

	last, err := ReadSlice(g, "big.txt", 39800, 500)
	if err != nil {
		t.Fatal(err)
	}
	if last.EndLine != 40000 {
		t.Fatalf("last window end=%d want 40000", last.EndLine)
	}
	if !last.EOF {
		t.Fatal("should be EOF")
	}

	outOfRange, err := ReadSlice(g, "big.txt", 50000, 100)
	if err != nil {
		t.Fatal(err)
	}
	if !outOfRange.EOF || outOfRange.Content != "" {
		t.Fatalf("out-of-range window unexpected: %+v", outOfRange)
	}
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}
