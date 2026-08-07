const STORAGE_KEY = 'pinkhunk-reader.updatePrefs.v1'

export interface UpdatePreferences {
  autoPromptEnabled: boolean
  skippedVersion: string
}

const DEFAULTS: UpdatePreferences = {
  autoPromptEnabled: true,
  skippedVersion: '',
}

export function loadUpdatePreferences(): UpdatePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<UpdatePreferences>
    return {
      autoPromptEnabled: parsed.autoPromptEnabled !== false,
      skippedVersion: String(parsed.skippedVersion || ''),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveUpdatePreferences(prefs: UpdatePreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function shouldAutoPromptUpdate(
  latestVersion: string,
  prefs: UpdatePreferences,
): boolean {
  if (!prefs.autoPromptEnabled) return false
  const latest = latestVersion.replace(/^v/i, '').trim()
  const skipped = prefs.skippedVersion.replace(/^v/i, '').trim()
  if (latest && skipped && latest === skipped) return false
  return true
}
