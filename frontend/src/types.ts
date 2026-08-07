export type FileKind = 'markdown' | 'text' | 'pdf' | 'image' | 'word' | 'excel' | 'unknown' | 'directory'

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
  kind: FileKind | string
}

export interface FileInfo {
  path: string
  name: string
  size: number
  isDir: boolean
  kind: FileKind | string
  editable: boolean
  largeMode: boolean
  modTime: string
}

export interface TextSlice {
  startLine: number
  endLine: number
  totalLines: number
  content: string
  eof: boolean
}

export interface OpenTab {
  path: string
  name: string
  kind: FileKind | string
  editable: boolean
  largeMode: boolean
  size: number
  content: string
  dirty: boolean
  /** In-memory buffer not yet saved to disk (Ctrl+N). */
  untitled?: boolean
  /** Monaco language override (e.g. after Format JSON on untitled). */
  languageHint?: string
}
