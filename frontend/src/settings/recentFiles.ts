const RECENT_KEY = 'pinkhunk-reader.recent-files.v1'
const RECENT_MAX_KEY = 'pinkhunk-reader.recent-max.v1'

export const DEFAULT_RECENT_MAX = 10
export const MIN_RECENT_MAX = 3
export const MAX_RECENT_MAX = 30

export interface RecentFile {
  path: string
  name: string
}

function fileName(path: string): string {
  const slash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return slash >= 0 ? path.slice(slash + 1) : path
}

export function loadRecentMax(): number {
  try {
    const raw = localStorage.getItem(RECENT_MAX_KEY)
    if (!raw) return DEFAULT_RECENT_MAX
    const n = Math.floor(Number(raw))
    if (!Number.isFinite(n)) return DEFAULT_RECENT_MAX
    return Math.min(MAX_RECENT_MAX, Math.max(MIN_RECENT_MAX, n))
  } catch {
    return DEFAULT_RECENT_MAX
  }
}

export function saveRecentMax(n: number) {
  const clamped = Math.min(MAX_RECENT_MAX, Math.max(MIN_RECENT_MAX, Math.floor(n)))
  localStorage.setItem(RECENT_MAX_KEY, String(clamped))
  return clamped
}

export function loadRecentFiles(max = loadRecentMax()): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: RecentFile[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const path = String((item as RecentFile).path || '').trim()
      if (!path) continue
      const name = String((item as RecentFile).name || '').trim() || fileName(path)
      out.push({ path, name })
      if (out.length >= max) break
    }
    return out
  } catch {
    return []
  }
}

export function saveRecentFiles(list: RecentFile[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

/** Put path at front; drop duplicates; trim to max. */
export function pushRecentFile(path: string, max = loadRecentMax()): RecentFile[] {
  const abs = path.trim()
  if (!abs) return loadRecentFiles(max)
  const entry: RecentFile = { path: abs, name: fileName(abs) }
  const prev = loadRecentFiles(Math.max(max, MAX_RECENT_MAX))
  const next = [entry, ...prev.filter((f) => f.path !== abs)].slice(0, max)
  saveRecentFiles(next)
  return next
}

export function trimRecentFiles(max: number): RecentFile[] {
  const next = loadRecentFiles(max).slice(0, max)
  saveRecentFiles(next)
  return next
}

export function clearRecentFiles() {
  saveRecentFiles([])
  return [] as RecentFile[]
}
