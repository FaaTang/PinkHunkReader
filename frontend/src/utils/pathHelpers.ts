/** Normalize Windows drive roots so "D:" is treated as "D:\\". */
export function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (/^[a-zA-Z]:$/i.test(trimmed)) {
    return `${trimmed}\\`
  }
  return trimmed
}

export function parentDir(path: string): string {
  const trimmed = normalizePath(path).replace(/[\\/]+$/, '')
  if (/^[a-zA-Z]:$/i.test(trimmed)) {
    return `${trimmed}\\`
  }
  const slash = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
  if (slash < 0) return normalizePath(trimmed)
  const parent = trimmed.slice(0, slash)
  if (/^[a-zA-Z]:$/i.test(parent)) {
    return `${parent}\\`
  }
  return parent || normalizePath(trimmed)
}

export function pathsEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  const norm = (p: string) => normalizePath(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return norm(a) === norm(b)
}

export function pathUnderRoot(filePath: string, rootPath: string): boolean {
  if (!rootPath) return false
  const norm = (p: string) => normalizePath(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const rootN = norm(rootPath)
  const fileN = norm(filePath)
  return fileN === rootN || fileN.startsWith(`${rootN}/`)
}

export function folderLabel(path: string): string {
  const norm = normalizePath(path).replace(/[\\/]+$/, '')
  if (/^[a-zA-Z]:$/i.test(norm)) {
    return `${norm}\\`
  }
  const slash = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  return slash >= 0 ? norm.slice(slash + 1) : norm
}
