package fsx

import (
	"fmt"
	"strings"

	wordextractor "github.com/WayneKent/go-word-extractor/pkg/word-extractor"
)

// ExtractLegacyDocText extracts plain text from a legacy Word 97–2003 (.doc) OLE file.
// data must be the full file bytes (OLE compound signature D0 CF…).
func ExtractLegacyDocText(data []byte) (string, error) {
	if len(data) < 8 {
		return "", fmt.Errorf("file too small to be a Word document")
	}
	ex := wordextractor.NewWordExtractor()
	doc, err := ex.Extract(data)
	if err != nil {
		return "", fmt.Errorf("failed to parse legacy .doc: %w", err)
	}
	body := strings.TrimSpace(doc.GetBody(nil))
	if body == "" {
		return "", fmt.Errorf("legacy .doc has no readable text")
	}
	return body, nil
}
