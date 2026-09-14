package fsx

import (
	"strings"
	"testing"
)

func TestExtractLegacyDocTextRejectsTiny(t *testing.T) {
	_, err := ExtractLegacyDocText([]byte{0xd0, 0xcf})
	if err == nil {
		t.Fatal("expected error for tiny buffer")
	}
}

func TestExtractLegacyDocTextRejectsNonOLE(t *testing.T) {
	// ZIP / OOXML signature — not a legacy OLE .doc
	_, err := ExtractLegacyDocText([]byte("PK\x03\x04" + strings.Repeat("x", 64)))
	if err == nil {
		t.Fatal("expected error for non-OLE bytes")
	}
}
