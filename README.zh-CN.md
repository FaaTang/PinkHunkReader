# PinkHunkReader - 轻量本地文件浏览与编辑器

[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8)](https://go.dev/)
[![Wails Version](https://img.shields.io/badge/Wails-v2-red)](https://wails.io)
[![React Version](https://img.shields.io/badge/React-v18-blue)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**语言**: [English](README.md) | 简体中文

PinkHunkReader 基于 **Wails (Go)** 与 **React**，用于本地文件夹浏览：文本 / Markdown 可编辑并实时预览，PDF / 图片只读预览。目标是「Notepad++ 式浏览 + MD 双栏 + PDF/图片」，而不是又一个重型 IDE。

同属 **PinkHunk** 系列（与 PinkHunkDB / PinkHunkGit 一致的粉系视觉与桌面技术选型）。

---

## 功能

- **文件夹工作区**：打开目录、树形浏览、多标签；可隐藏/显示资源管理器（默认 `Ctrl+,` / `Cmd+,`）
- **新建文件**：`Ctrl+N` / `Cmd+N`，关闭未保存时提示保存
- **拖拽打开**：将文件/文件夹拖入窗口即可打开；系统「用 PinkHunkReader 打开」与应用内 Open 共用同一套打开位置 / 仅打开文件（父目录）设置
- **会话恢复**：关掉**最后一个**窗口后，下次启动只恢复该窗口的标签/工作区（含未保存内容）；此前在多窗口时主动关掉的其它窗口不会再打开；窗口位置与尺寸也会记住
- **自动保存**：Settings → General 可开启，按间隔自动保存可编辑标签
- **Markdown**：左右分栏编辑 + 实时预览（GFM）
- **文本 / 代码**：Monaco 编辑器，常见后缀高亮；JSON 支持 `Ctrl+Shift+M` / `Cmd+Shift+M` 格式化与压缩切换
- **PDF**：按页预览（PDF.js）
- **Excel**：`.xlsx` / `.xls` 只读表格预览（列宽拖拽、单元格悬停提示）
- **图片**：PNG / JPG / GIF / WebP / SVG 等
- **大文件**：文本 / Markdown 超过 2MB 采用「流式加载」——Go 端缓存行号偏移索引 + `ReadSlice` 分批读取，内容只增不减地填充进 Monaco（自带虚拟渲染），滚动接近底部自动预取下一批。分页只影响加载，不改变可编辑与保存：保存前会自动补全尚未加载的尾部再写入
- **路径沙箱**：读写限制在已打开根目录内
- **最近打开**：Open 菜单下列出最近文件；数量可在 Settings → General 中调整（默认 10）
- **代理与更新**：Settings → Proxy 配置全局代理；About / 更新检查支持启动提示与手动检查

## CI / 发布

在发布分支（`RELEASE_BRANCH` 变量，默认 `main`）推送 `v*` tag 时，流水线会构建前端，并用 Wails 打包：

| 平台 | 产物 |
|------|------|
| Windows AMD64 | `PinkHunkReader-*-Windows-Amd64.exe` |
| macOS ARM64（Apple Silicon） | `PinkHunkReader-*-MacOS-Arm64.dmg`（失败时回退 `.zip`） |

同时发布 GitHub Release（更新日志 + `SHA256SUMS`）。另提供 `workflow_dispatch` 手动触发的双平台 dev build。见 `.github/workflows/`。

本地跨平台打包示例：

```bash
wails build -platform windows/amd64
wails build -platform darwin/arm64
```

## 本地开发

依赖：Go 1.23+、Node.js 18+、[Wails CLI](https://wails.io) v2。

```bash
cd frontend
npm install
cd ..
wails dev
```

打包：

```bash
wails build
```

Go 单测：

```bash
go test ./...
```

## 架构

```text
app/        Wails 绑定（OpenRoot、ListDir、ReadSlice…）
define/     文件种类与 DTO
fsx/        路径守卫、目录树、读写、按行窗口
frontend/   React：FileTree + Tabs + ViewerHost
```

前端按 `kind` 路由视图：`markdown` / `text` / `pdf` / `image` / `excel` / `unknown`。

## 快捷键

| 快捷键 | 作用 |
|--------|------|
| `Ctrl+N` / macOS `Cmd+N` | 新建文件 |
| `Ctrl+S` / macOS `Cmd+S` | 保存当前可编辑标签 |
| `Ctrl+,` / macOS `Cmd+,` | 显示 / 隐藏资源管理器 |
| `Ctrl+Shift+M` / macOS `Cmd+Shift+M` | JSON 格式化 / 压缩切换 |
| `Ctrl+G` / macOS `Cmd+G` | 跳页（PDF）或跳行（文本 / MD） |
| `F11` | 全屏切换 |

可在应用 **Settings** 中修改快捷键。


## 许可

MIT — 见 [LICENSE](LICENSE)。
