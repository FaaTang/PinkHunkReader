package fsx

import (
	"bufio"
	"io"
	"os"
	"strings"

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

	return scanMarkdownOutline(bufio.NewReaderSize(f, 256*1024))
}

// scanMarkdownOutline collects ATX headings, skipping fenced code blocks
// (``` and ~~~) so shell comments like "# ..." never become outline entries.
func scanMarkdownOutline(reader *bufio.Reader) ([]define.MdHeading, error) {
	var out []define.MdHeading
	lineNo := 0
	var fenceCh byte
	var fenceLen int
	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 {
			lineNo++
			if ch, n, rest, ok := fenceMarker(line); ok {
				if fenceCh == 0 {
					fenceCh, fenceLen = ch, n
				} else if ch == fenceCh && n >= fenceLen && rest == "" {
					fenceCh, fenceLen = 0, 0
				}
				continue
			}
			if fenceCh != 0 {
				continue
			}
			if h, ok := parseATXHeading(line); ok {
				out = append(out, define.MdHeading{
					Level: h.level,
					Title: h.title,
					Line:  lineNo,
				})
			}
		}
		if err != nil {
			if err == io.EOF {
				return out, nil
			}
			return out, err
		}
	}
}

// fenceMarker reports a code-fence line: up to three spaces of indentation,
// then a run of at least three backticks or tildes. rest is what follows the
// run with surrounding whitespace trimmed (empty for a closing fence).
func fenceMarker(raw string) (byte, int, string, bool) {
	s := strings.TrimRight(raw, "\r\n")
	i := 0
	for i < len(s) && s[i] == ' ' {
		i++
		if i > 3 {
			return 0, 0, "", false
		}
	}
	if i >= len(s) {
		return 0, 0, "", false
	}
	ch := s[i]
	if ch != '`' && ch != '~' {
		return 0, 0, "", false
	}
	n := 0
	for i+n < len(s) && s[i+n] == ch {
		n++
	}
	if n < 3 {
		return 0, 0, "", false
	}
	return ch, n, strings.TrimSpace(s[i+n:]), true
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
	// CommonMark closing sequence: the trailing run of #s only closes the
	// heading when preceded by whitespace (or when it is the entire text).
	if title != "" {
		if allHashes(title) {
			title = ""
		} else {
			j := len(title)
			for j > 0 && title[j-1] == '#' {
				j--
			}
			if j > 0 && j < len(title) && (title[j-1] == ' ' || title[j-1] == '\t') {
				title = strings.TrimSpace(title[:j])
			}
		}
	}
	if title == "" {
		return atx{}, false
	}
	return atx{level: level, title: title}, true
}

func allHashes(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] != '#' {
			return false
		}
	}
	return true
}
