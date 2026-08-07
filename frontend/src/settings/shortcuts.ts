import { isApplePlatform } from '../utils/platform'

export type ShortcutId = 'save' | 'newFile' | 'open' | 'formatJson' | 'fullscreen' | 'goto' | 'exitFullscreen'

export interface ShortcutBinding {
  key: string
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  shift?: boolean
}

export type ShortcutMap = Record<ShortcutId, ShortcutBinding>

export const SHORTCUT_LABELS: Record<ShortcutId, string> = {
  save: 'Save file',
  newFile: 'New file',
  open: 'Open',
  formatJson: 'Format / minify JSON',
  fullscreen: 'Toggle full screen',
  goto: 'Go to page / line',
  exitFullscreen: 'Exit full screen',
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  save: { key: 's', ctrl: true },
  newFile: { key: 'n', ctrl: true },
  open: { key: 'f', ctrl: true, shift: true },
  formatJson: { key: 'm', ctrl: true, shift: true },
  fullscreen: { key: 'F11' },
  goto: { key: 'g', ctrl: true },
  exitFullscreen: { key: 'Escape' },
}

const STORAGE_KEY = 'pinkhunk-reader.shortcuts.v1'

export function loadShortcuts(): ShortcutMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SHORTCUTS }
    const parsed = JSON.parse(raw) as Partial<ShortcutMap>
    return {
      save: { ...DEFAULT_SHORTCUTS.save, ...parsed.save },
      newFile: { ...DEFAULT_SHORTCUTS.newFile, ...parsed.newFile },
      open: { ...DEFAULT_SHORTCUTS.open, ...parsed.open },
      formatJson: { ...DEFAULT_SHORTCUTS.formatJson, ...parsed.formatJson },
      fullscreen: { ...DEFAULT_SHORTCUTS.fullscreen, ...parsed.fullscreen },
      goto: { ...DEFAULT_SHORTCUTS.goto, ...parsed.goto },
      exitFullscreen: { ...DEFAULT_SHORTCUTS.exitFullscreen, ...parsed.exitFullscreen },
    }
  } catch {
    return { ...DEFAULT_SHORTCUTS }
  }
}

export function saveShortcuts(map: ShortcutMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function formatShortcut(b: ShortcutBinding): string {
  const parts: string[] = []
  const apple = isApplePlatform()
  if (b.ctrl) parts.push(apple ? 'Cmd' : 'Ctrl')
  if (b.meta && !b.ctrl) parts.push(apple ? 'Cmd' : 'Meta')
  if (b.alt) parts.push(apple ? 'Option' : 'Alt')
  if (b.shift) parts.push('Shift')
  const key = b.key.length === 1 ? b.key.toUpperCase() : b.key
  parts.push(key)
  return parts.join('+')
}

export function eventMatchesShortcut(e: KeyboardEvent, b: ShortcutBinding): boolean {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const want = b.key.length === 1 ? b.key.toLowerCase() : b.key
  if (key !== want) return false

  // Treat Ctrl bindings as Cmd-or-Ctrl so the same defaults work on macOS.
  if (b.ctrl) {
    if (!(e.ctrlKey || e.metaKey)) return false
  } else if (b.meta) {
    if (!e.metaKey) return false
  } else if (e.ctrlKey || e.metaKey) {
    return false
  }

  if (!!b.alt !== e.altKey) return false
  if (!!b.shift !== e.shiftKey) return false
  return true
}

/** Build binding from a keydown event (for capture UI). */
export function bindingFromEvent(e: KeyboardEvent): ShortcutBinding | null {
  if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return null
  return {
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
    ctrl: e.ctrlKey || undefined,
    meta: e.metaKey || undefined,
    alt: e.altKey || undefined,
    shift: e.shiftKey || undefined,
  }
}
