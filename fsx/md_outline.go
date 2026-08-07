package fsx

import (
	"bufio"
	"os"
	"strings"
	"unicode"

	"github.com/FaaTang/PinkHunkReader/define"
)

// ReadMarkdownOutline streams the file once and collects ATX headings (# … ######).
// Memory stays O(headings); suitable for large markdown without loading full text.
func ReadMarkdownOutline(g *Guard, path string) ([]define.MdHeading, error) {
	abs, err := g.Resolve(path)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(abs)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	reader := bufio.NewReaderSize(f, 256*1024)
	var out []define.MdHeading
	lineNo := 0
	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 {
			lineNo++
			if h, ok := parseATXHeading(line); ok {
				out = append(out, define.MdHeading{
					Level: h.level,
					Title: h.title,
					Line:  lineNo,
				})
			}
		}
		if err != nil {
			break
		}
	}
	return out, nil
}

type atx struct {
	level int
	title string
}

func parseATXHeading(raw string) (atx, bool) {
	s := strings.TrimRight(raw, "\r\n")
	// Skip setext-style / empty; only ATX.
	i := 0
	for i < len(s) && (s[i] == ' ' || s[i] == '\t') {
		i++
		if i > 3 {
			// CommonMark: up to 3 spaces of indentation.
			return atx{}, false
		}
	}
	if i >= len(s) || s[i] != '#' {
		return atx{}, false
	}
	level := 0
	for i < len(s) && s[i] == '#' {
		level++
		i++
		if level > 6 {
			return atx{}, false
		}
	}
	if level == 0 || i >= len(s) {
		return atx{}, false
	}
	// Require whitespace (or EOL) after hashes.
	if s[i] != ' ' && s[i] != '\t' {
		return atx{}, false
	}
	title := strings.TrimSpace(s[i:])
	title = strings.TrimRightFunc(title, func(r rune) bool {
		return r == '#' || unicode.IsSpace(r)
	})
	title = strings.TrimSpace(title)
	if title == "" {
		return atx{}, false
	}
	return atx{level: level, title: title}, true
}
