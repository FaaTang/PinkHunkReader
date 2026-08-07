# PinkHunkReader - Lightweight Local File Browser & Editor

[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8)](https://go.dev/)
[![Wails Version](https://img.shields.io/badge/Wails-v2-red)](https://wails.io)
[![React Version](https://img.shields.io/badge/React-v18-blue)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Language**: English | [简体中文](README.zh-CN.md)

PinkHunkReader is a cross-platform local file browser built with **Wails (Go)** and **React**.
Browse a folder tree, edit text/Markdown with live preview, and preview PDF / images — without the weight of a full IDE.

Part of the **PinkHunk** series (alongside PinkHunkDB / PinkHunkGit).

---

## Features

- **Folder workspace**: open a directory, tree navigation, multi-tabs
- **Markdown**: side-by-side edit + live preview (GFM)
- **Text / code**: Monaco editor with basic language highlighting
- **PDF**: page-by-page preview (PDF.js)
- **Images**: PNG / JPG / GIF / WebP / SVG and more
- **Large files**: text / Markdown above 2MB stream into the Monaco model chunk by chunk (Monaco's own virtualized rendering keeps it smooth), prefetching the next window near the bottom edge. Paging only affects loading — files stay **editable and saveable**; saving auto-drains any not-yet-loaded tail before write.
- **Path sandbox**: all IO stays under the opened root

## CI / Releases

Tag pushes `v*` on the release branch (`RELEASE_BRANCH` variable, default `main`) build the frontend and
package with Wails for:

| Platform | Asset |
|----------|-------|
| Windows AMD64 | `PinkHunkReader-*-Windows-Amd64.exe` |
| macOS ARM64 (Apple Silicon) | `PinkHunkReader-*-MacOS-Arm64.dmg` (`.zip` fallback) |

A GitHub Release is published with changelog + `SHA256SUMS`. Manual `workflow_dispatch` builds both platforms. See `.github/workflows/`.

Local cross builds:

```bash
wails build -platform windows/amd64
wails build -platform darwin/arm64
```


Requirements: Go 1.23+, Node.js 18+, [Wails CLI](https://wails.io) v2.

```bash
cd frontend
npm install
cd ..
wails dev
```

Build:

```bash
wails build
```

Run Go unit tests:

```bash
go test ./...
```

## Architecture

```text
app/        Wails bindings (OpenRoot, ListDir, ReadSlice, …)
define/     File kinds + DTO
fsx/        Path guard, tree, IO, line-window reads
frontend/   React UI: FileTree + Tabs + ViewerHost
```

Viewer routing is driven by `kind` (`markdown` / `text` / `pdf` / `image` / `unknown`).

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / macOS `Cmd+S` | Save current editable tab |
| `Ctrl+G` / macOS `Cmd+G` | Go to page (PDF) or line (text / Markdown) |
| `F11` | Toggle full screen |

Shortcuts can be changed in **Settings**.

## License

MIT — see [LICENSE](LICENSE).
