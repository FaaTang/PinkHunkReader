//go:build windows

package app

import (
	"encoding/binary"
	"fmt"
	"os"
	"strings"
	"unicode/utf16"
)

const (
	windowsLnkHeaderSize            = 0x4C
	windowsLnkFlagHasLinkTargetIDList = 0x01
	windowsLnkFlagHasLinkInfo         = 0x02
	windowsLnkFlagIsUnicode           = 0x80
)

func parseWindowsShortcutTarget(lnkPath string) (string, error) {
	data, err := os.ReadFile(lnkPath)
	if err != nil {
		return "", err
	}
	if len(data) < windowsLnkHeaderSize {
		return "", fmt.Errorf("shortcut file too short: %s", lnkPath)
	}
	if binary.LittleEndian.Uint32(data[0:4]) != windowsLnkHeaderSize {
		return "", fmt.Errorf("invalid shortcut header: %s", lnkPath)
	}

	flags := binary.LittleEndian.Uint32(data[0x14:0x18])
	offset := windowsLnkHeaderSize

	if flags&windowsLnkFlagHasLinkTargetIDList != 0 {
		if len(data) < offset+2 {
			return "", fmt.Errorf("shortcut id list header missing: %s", lnkPath)
		}
		idListSize := int(binary.LittleEndian.Uint16(data[offset : offset+2]))
		offset += 2 + idListSize
	}

	target := ""
	if flags&windowsLnkFlagHasLinkInfo != 0 {
		target, err = readWindowsShortcutLinkInfoTarget(data, offset, lnkPath)
		if err != nil {
			return "", err
		}
	}

	if target == "" && flags&windowsLnkFlagIsUnicode != 0 {
		target, err = readWindowsShortcutStringDataTarget(data, offset, flags)
		if err != nil {
			return "", err
		}
	}

	target = strings.TrimSpace(os.ExpandEnv(target))
	if target == "" {
		return "", fmt.Errorf("shortcut target is empty: %s", lnkPath)
	}
	return target, nil
}

func readWindowsShortcutLinkInfoTarget(data []byte, offset int, lnkPath string) (string, error) {
	if len(data) < offset+4 {
		return "", fmt.Errorf("shortcut link info missing: %s", lnkPath)
	}
	linkInfoSize := int(binary.LittleEndian.Uint32(data[offset : offset+4]))
	if linkInfoSize < 0x1C || len(data) < offset+linkInfoSize {
		return "", fmt.Errorf("shortcut link info invalid: %s", lnkPath)
	}

	linkInfo := data[offset : offset+linkInfoSize]
	headerSize := binary.LittleEndian.Uint32(linkInfo[4:8])
	localBasePathOffset := binary.LittleEndian.Uint32(linkInfo[16:20])

	if localBasePathOffset > 0 && int(localBasePathOffset) < len(linkInfo) {
		if target := readWindowsShortcutANSIString(linkInfo[localBasePathOffset:]); target != "" {
			return target, nil
		}
	}

	if headerSize >= 0x24 && len(linkInfo) >= 0x28 {
		unicodeOffset := binary.LittleEndian.Uint32(linkInfo[0x24:0x28])
		if unicodeOffset > 0 && int(unicodeOffset) < len(linkInfo) {
			if target := readWindowsShortcutUTF16String(linkInfo[unicodeOffset:]); target != "" {
				return target, nil
			}
		}
	}

	return "", nil
}

func readWindowsShortcutStringDataTarget(data []byte, linkInfoOffset int, flags uint32) (string, error) {
	offset := linkInfoOffset
	if flags&windowsLnkFlagHasLinkInfo != 0 {
		if len(data) < offset+4 {
			return "", nil
		}
		linkInfoSize := int(binary.LittleEndian.Uint32(data[offset : offset+4]))
		offset += linkInfoSize
	}

	readDataString := func() (string, bool) {
		if len(data) < offset+2 {
			return "", false
		}
		count := int(binary.LittleEndian.Uint16(data[offset : offset+2]))
		offset += 2
		if count == 0 {
			return "", true
		}
		end := offset + count*2
		if end > len(data) {
			return "", false
		}
		u16 := make([]uint16, count)
		for i := 0; i < count; i++ {
			u16[i] = binary.LittleEndian.Uint16(data[offset+i*2 : offset+i*2+2])
		}
		offset = end
		return string(utf16.Decode(u16)), true
	}

	// NAME
	if _, ok := readDataString(); !ok {
		return "", nil
	}
	// RELATIVE_PATH
	if relative, ok := readDataString(); ok && strings.TrimSpace(relative) != "" {
		return relative, nil
	}
	return "", nil
}

func readWindowsShortcutANSIString(data []byte) string {
	end := 0
	for end < len(data) && data[end] != 0 {
		end++
	}
	return strings.TrimSpace(string(data[:end]))
}

func readWindowsShortcutUTF16String(data []byte) string {
	if len(data) < 2 {
		return ""
	}
	u16 := make([]uint16, 0, len(data)/2)
	for i := 0; i+1 < len(data); i += 2 {
		ch := binary.LittleEndian.Uint16(data[i : i+2])
		if ch == 0 {
			break
		}
		u16 = append(u16, ch)
	}
	return strings.TrimSpace(string(utf16.Decode(u16)))
}
