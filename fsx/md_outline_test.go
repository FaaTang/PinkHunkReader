package fsx

import (
	"bufio"
	"strings"
	"testing"
)

func TestParseATXHeading(t *testing.T) {
	cases := []struct {
		in    string
		ok    bool
		level int
		title string
	}{
		{"# Hello", true, 1, "Hello"},
		{"##  Part 2  ", true, 2, "Part 2"},
		{"###NoSpace", false, 0, ""},
		{"####### Too deep", false, 0, ""},
		{"not a heading", false, 0, ""},
		{"  ## Indented", true, 2, "Indented"},
	}
	for _, c := range cases {
		h, ok := parseATXHeading(c.in)
		if ok != c.ok {
			t.Fatalf("%q ok=%v want %v", c.in, ok, c.ok)
		}
		if !ok {
			continue
		}
		if h.level != c.level || h.title != c.title {
			t.Fatalf("%q => %+v want level=%d title=%q", c.in, h, c.level, c.title)
		}
	}
}

func TestParseATXHeadingClosingHashes(t *testing.T) {
	cases := []struct {
		in    string
		ok    bool
		title string
	}{
		{"## C#", true, "C#"},
		{"## F# 类型", true, "F# 类型"},
		{"## Heading ###", true, "Heading"},
		{"## ###", false, ""},
		{"###   ", false, ""},
		{"   ### Indented", true, "Indented"},
		{"    ## FourSpaces", false, ""},
	}
	for _, c := range cases {
		h, ok := parseATXHeading(c.in)
		if ok != c.ok {
			t.Fatalf("%q ok=%v want %v", c.in, ok, c.ok)
		}
		if ok && h.title != c.title {
			t.Fatalf("%q title=%q want %q", c.in, h.title, c.title)
		}
	}
}

func TestScanMarkdownOutlineSkipsFencedCode(t *testing.T) {
	md := strings.Join([]string{
		"# A",
		"```bash",
		"# not a heading",
		"```",
		"## B",
		"~~~",
		"# nope",
		"~~~",
		"### C",
		"",
	}, "\n")
	got, err := scanMarkdownOutline(bufio.NewReader(strings.NewReader(md)))
	if err != nil {
		t.Fatal(err)
	}
	want := []struct {
		level, line int
		title       string
	}{
		{1, 1, "A"},
		{2, 5, "B"},
		{3, 9, "C"},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d headings: %+v", len(got), got)
	}
	for i, w := range want {
		if got[i].Level != w.level || got[i].Line != w.line || got[i].Title != w.title {
			t.Fatalf("heading %d = %+v want %+v", i, got[i], w)
		}
	}
}

func TestScanMarkdownOutlineFenceLength(t *testing.T) {
	md := "````md\n# x\n```\n# still code\n````\n# real\n"
	got, err := scanMarkdownOutline(bufio.NewReader(strings.NewReader(md)))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Title != "real" {
		t.Fatalf("got %+v", got)
	}
}

func TestScanMarkdownOutlineUnclosedFenceHidesRest(t *testing.T) {
	md := "# A\n```\n# hidden\n"
	got, err := scanMarkdownOutline(bufio.NewReader(strings.NewReader(md)))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Title != "A" {
		t.Fatalf("got %#v", got)
	}
}
