package fsx

import "testing"

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
