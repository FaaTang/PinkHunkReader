const STORAGE_KEY = 'pinkhunk-reader.autosave.v1'

export const DEFAULT_AUTO_SAVE_ENABLED = true
export const DEFAULT_AUTO_SAVE_INTERVAL_SECONDS = 30
export const MIN_AUTO_SAVE_INTERVAL_SECONDS = 5
export const MAX_AUTO_SAVE_INTERVAL_SECONDS = 600

export interface AutoSavePreferences {
  enabled: boolean
  intervalSeconds: number
}

const DEFAULTS: AutoSavePreferences = {
  enabled: DEFAULT_AUTO_SAVE_ENABLED,
  intervalSeconds: DEFAULT_AUTO_SAVE_INTERVAL_SECONDS,
}

export function clampAutoSaveIntervalSeconds(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_AUTO_SAVE_INTERVAL_SECONDS
  return Math.min(
    MAX_AUTO_SAVE_INTERVAL_SECONDS,
    Math.max(MIN_AUTO_SAVE_INTERVAL_SECONDS, Math.floor(n)),
  )
}

export function loadAutoSavePreferences(): AutoSavePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AutoSavePreferences>
    return {
      enabled: parsed.enabled !== false,
      intervalSeconds: clampAutoSaveIntervalSeconds(
        Number(parsed.intervalSeconds ?? DEFAULT_AUTO_SAVE_INTERVAL_SECONDS),
      ),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAutoSavePreferences(prefs: AutoSavePreferences): AutoSavePreferences {
  const next: AutoSavePreferences = {
    enabled: Boolean(prefs.enabled),
    intervalSeconds: clampAutoSaveIntervalSeconds(prefs.intervalSeconds),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
