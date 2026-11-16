import {
  DEFAULT_ACCENT_HEX,
  deriveAccentPalette,
  readSystemPrefersDark,
  resolveDarkMode,
  sanitizeAccentHex,
  sanitizeThemeMode,
  type ThemeMode,
} from '../utils/themeAccent'

export type { ThemeMode }
export { DEFAULT_ACCENT_HEX, deriveAccentPalette, readSystemPrefersDark, resolveDarkMode, sanitizeAccentHex, sanitizeThemeMode }

export type ThemePreferences = {
  mode: ThemeMode
  accent: string
}

const STORAGE_KEY = 'pinkhunk-reader.theme'

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: 'system',
  accent: DEFAULT_ACCENT_HEX,
}

export function loadThemePreferences(): ThemePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_THEME_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<ThemePreferences>
    return {
      mode: sanitizeThemeMode(parsed.mode),
      accent: sanitizeAccentHex(parsed.accent),
    }
  } catch {
    return { ...DEFAULT_THEME_PREFERENCES }
  }
}

export function saveThemePreferences(prefs: ThemePreferences): ThemePreferences {
  const next: ThemePreferences = {
    mode: sanitizeThemeMode(prefs.mode),
    accent: sanitizeAccentHex(prefs.accent),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/** Apply resolved light/dark + accent CSS variables on documentElement. */
export function applyThemeToDocument(darkMode: boolean, accentHex: string): void {
  const palette = deriveAccentPalette(accentHex, darkMode)
  const root = document.documentElement
  root.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  root.style.colorScheme = darkMode ? 'dark' : 'light'
  root.style.setProperty('--ph-accent', palette.accent)
  root.style.setProperty('--ph-accent-2', palette.accentActive)
  root.style.setProperty('--ph-accent-soft', palette.accentSoft)
  root.style.setProperty('--ph-accent-hover', palette.accentHover)
}
