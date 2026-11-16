/** Default PinkHunk accent (brand pink). */
export const DEFAULT_ACCENT_HEX = '#ff4da6'

export type ThemeMode = 'system' | 'light' | 'dark'

export type AccentPalette = {
  accent: string
  accentHover: string
  accentActive: string
  accentSoft: string
}

type RGB = { r: number; g: number; b: number }

export function sanitizeThemeMode(value: unknown): ThemeMode {
  if (value === 'dark' || value === 'light' || value === 'system') {
    return value
  }
  return 'system'
}

export function sanitizeAccentHex(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_ACCENT_HEX
  }
  const raw = value.trim()
  const m = /^#?([0-9a-fA-F]{6})$/.exec(raw)
  if (!m) {
    return DEFAULT_ACCENT_HEX
  }
  return `#${m[1].toLowerCase()}`
}

function parseHex(hex: string): RGB | null {
  const normalized = sanitizeAccentHex(hex).slice(1)
  const n = Number.parseInt(normalized, 16)
  if (!Number.isFinite(n)) {
    return null
  }
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  }
}

function toHex({ r, g, b }: RGB): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

function rgba({ r, g, b }: RGB, a: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`
}

export function deriveAccentPalette(accentHex: string, darkMode: boolean): AccentPalette {
  const base = parseHex(accentHex) ?? parseHex(DEFAULT_ACCENT_HEX)!
  const white: RGB = { r: 255, g: 255, b: 255 }
  const black: RGB = { r: 0, g: 0, b: 0 }
  const hover = toHex(mix(base, white, darkMode ? 0.28 : 0.18))
  const active = toHex(mix(base, black, darkMode ? 0.08 : 0.22))
  const soft = darkMode ? rgba(base, 0.16) : toHex(mix(base, white, 0.86))
  return {
    accent: toHex(base),
    accentHover: hover,
    accentActive: active,
    accentSoft: soft,
  }
}

export function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveDarkMode(themeMode: ThemeMode, systemDark: boolean): boolean {
  if (themeMode === 'dark') return true
  if (themeMode === 'light') return false
  return systemDark
}
