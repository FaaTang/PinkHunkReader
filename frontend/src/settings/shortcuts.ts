import type { TFunction, TranslationKey } from '../i18n'
import { isApplePlatform } from '../utils/platform'

export type ShortcutId =
  | 'save'
  | 'newFile'
  | 'open'
  | 'openFolder'
  | 'closeTab'
  | 'formatJson'
  | 'fullscreen'
  | 'goto'
  | 'exitFullscreen'
  | 'settings'
  | 'toggleExplorer'

export interface ShortcutBinding {
  key: string
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  shift?: boolean
}

export type ShortcutMap = Record<ShortcutId, ShortcutBinding>

/**
 * User-visible action names, held as translation keys so the UI language can
 * change without reloading. Resolve with `shortcutLabel(id, t)` or `t(key)`.
 */
export const SHORTCUT_LABELS: Record<ShortcutId, TranslationKey> = {
  save: 'settings.shortcuts.save',
  newFile: 'settings.shortcuts.newFile',
  open: 'settings.shortcuts.open',
  openFolder: 'settings.shortcuts.openFolder',
  closeTab: 'settings.shortcuts.closeTab',
  formatJson: 'settings.shortcuts.formatJson',
  fullscreen: 'settings.shortcuts.fullscreen',
  goto: 'settings.shortcuts.goto',
  exitFullscreen: 'settings.shortcuts.exitFullscreen',
  settings: 'settings.shortcuts.settings',
  toggleExplorer: 'settings.shortcuts.toggleExplorer',
}

/** Resolve a shortcut action label in the current UI language. */
export function shortcutLabel(id: ShortcutId, t: TFunction): string {
  return t(SHORTCUT_LABELS[id])
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  save: { key: 's', ctrl: true },
  newFile: { key: 'n', ctrl: true },
  open: { key: 'f', ctrl: true, shift: true },
  openFolder: { key: 'd', ctrl: true, shift: true },
  closeTab: { key: 'w', ctrl: true },
  formatJson: { key: 'l', ctrl: true, alt: true },
  fullscreen: { key: 'F11' },
  goto: { key: 'g', ctrl: true },
  exitFullscreen: { key: 'Escape' },
  settings: { key: 's', ctrl: true, alt: true },
  toggleExplorer: { key: ',', ctrl: true },
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
      openFolder: { ...DEFAULT_SHORTCUTS.openFolder, ...parsed.openFolder },
      closeTab: { ...DEFAULT_SHORTCUTS.closeTab, ...parsed.closeTab },
      formatJson: { ...DEFAULT_SHORTCUTS.formatJson, ...parsed.formatJson },
      fullscreen: { ...DEFAULT_SHORTCUTS.fullscreen, ...parsed.fullscreen },
      goto: { ...DEFAULT_SHORTCUTS.goto, ...parsed.goto },
      exitFullscreen: { ...DEFAULT_SHORTCUTS.exitFullscreen, ...parsed.exitFullscreen },
      settings: { ...DEFAULT_SHORTCUTS.settings, ...parsed.settings },
      toggleExplorer: { ...DEFAULT_SHORTCUTS.toggleExplorer, ...parsed.toggleExplorer },
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

/**
 * Physical key name from `KeyboardEvent.code` (layout independent).
 * macOS turns Option+letter into a different `event.key` (Option+L -> "¬"),
 * so bindings that include Alt must fall back to the physical key.
 */
function physicalKey(e: KeyboardEvent): string {
  const code = e.code || ''
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  switch (code) {
    case 'Comma': return ','
    case 'Period': return '.'
    case 'Slash': return '/'
    case 'Backslash': return '\\'
    case 'Semicolon': return ';'
    case 'Quote': return "'"
    case 'BracketLeft': return '['
    case 'BracketRight': return ']'
    case 'Minus': return '-'
    case 'Equal': return '='
    case 'Backquote': return '`'
    case 'Space': return ' '
    default: return ''
  }
}

export function eventMatchesShortcut(e: KeyboardEvent, b: ShortcutBinding): boolean {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const want = b.key.length === 1 ? b.key.toLowerCase() : b.key
  // Alt/Option changes event.key on some layouts; compare the physical key too.
  const altAltered = Boolean(e.altKey) && key !== want && physicalKey(e) === want
  if (key !== want && !altAltered) return false

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
  // Record the physical key when Option rewrites event.key (Option+L -> "¬"),
  // so the captured binding stays portable.
  const rawKey = e.altKey ? (physicalKey(e) || e.key) : e.key
  return {
    key: rawKey.length === 1 ? rawKey.toLowerCase() : rawKey,
    ctrl: e.ctrlKey || undefined,
    meta: e.metaKey || undefined,
    alt: e.altKey || undefined,
    shift: e.shiftKey || undefined,
  }
}
