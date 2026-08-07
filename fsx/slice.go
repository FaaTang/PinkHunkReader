package fsx

import (
	"bufio"
	"fmt"
	"io"
	"os"

	"github.com/FaaTang/PinkHunkReader/define"
)

// ReadSlice returns a 1-based line window without loading the whole file.
// Large files use a cached line-offset index for O(1) seeks.
func ReadSlice(g *Guard, path string, startLine, count int) (define.TextSlice, error) {
	if startLine < 1 {
		startLine = 1
	}
	if count <= 0 {
		count = define.DefaultSliceLines
	}
	if count > 5000 {
		count = 5000
	}

	abs, err := g.Resolve(path)
	if err != nil {
		return define.TextSlice{}, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return define.TextSlice{}, err
	}
	if info.IsDir() {
		return define.TextSlice{}, fmt.Errorf("cannot read a directory")
	}
	if info.Size() <= indexThresholdBytes {
		return readSliceStream(abs, startLine, count)
	}
	return readSliceIndexed(abs, info.Size(), startLine, count)
}

// readSliceStream scans from the start; used for small files.
func readSliceStream(abs string, startLine, count int) (define.TextSlice, error) {
	f, err := os.Open(abs)
	if err != nil {
		return define.TextSlice{}, err
	}
	defer f.Close()

	reader := bufio.NewReaderSize(f, 256*1024)
	lineNo := 0
	var content []byte
	endLine := startLine - 1

	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			lineNo++
			if lineNo >= startLine && lineNo < startLine+count {
				content = append(content, line...)
				endLine = lineNo
			}
		}
		if err == io.EOF {
			return define.TextSlice{
				StartLine:  startLine,
				EndLine:    endLine,
				TotalLines: lineNo,
				Content:    string(content),
				EOF:        lineNo < startLine+count,
			}, nil
		}
		if err != nil {
			return define.TextSlice{}, err
		}
		if lineNo >= startLine+count {
			_, err2 := reader.Peek(1)
			return define.TextSlice{
				StartLine:  startLine,
				EndLine:    endLine,
				TotalLines: -1,
				Content:    string(content),
				EOF:        err2 == io.EOF,
			}, nil
		}
	}
}

// readSliceIndexed seeks directly via the line-offset index.
func readSliceIndexed(abs string, size int64, startLine, count int) (define.TextSlice, error) {
	idx, err := getOrBuildIndex(abs)
	if err != nil {
		return define.TextSlice{}, err
	}
	if startLine > idx.lineCount {
		return define.TextSlice{
			StartLine:  startLine,
			EndLine:    startLine - 1,
			TotalLines: idx.lineCount,
			Content:    "",
			EOF:        true,
		}, nil
	}

	endLine := startLine + count - 1
	if endLine > idx.lineCount {
		endLine = idx.lineCount
	}

	startOff := idx.offsets[startLine-1]
	endOff := size
	if endLine < idx.lineCount {
		endOff = idx.offsets[endLine]
	}

	f, err := os.Open(abs)
	if err != nil {
		return define.TextSlice{}, err
	}
	defer f.Close()

	buf := make([]byte, endOff-startOff)
	reader := io.NewSectionReader(f, startOff, endOff-startOff)
	if _, err := io.ReadFull(reader, buf); err != nil {
		return define.TextSlice{}, err
	}
	return define.TextSlice{
		StartLine:  startLine,
		EndLine:    endLine,
		TotalLines: idx.lineCount,
		Content:    string(buf),
		EOF:        endLine >= idx.lineCount,
	}, nil
}

// CountLines returns total line count (uses the cached index for large files).
func CountLines(g *Guard, path string) (int, error) {
	abs, err := g.Resolve(path)
	if err != nil {
		return 0, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return 0, err
	}
	if info.IsDir() {
		return 0, fmt.Errorf("cannot read a directory")
	}
	if info.Size() > indexThresholdBytes {
		idx, err := getOrBuildIndex(abs)
		if err != nil {
			return 0, err
		}
		return idx.lineCount, nil
	}
	return countLinesStream(abs)
}

func countLinesStream(abs string) (int, error) {
	f, err := os.Open(abs)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	reader := bufio.NewReaderSize(f, 256*1024)
	count := 0
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			count++
		}
		if err == io.EOF {
			return count, nil
		}
		if err != nil {
			return 0, err
		}
	}
}
