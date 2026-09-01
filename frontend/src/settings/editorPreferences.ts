export const DEFAULT_LARGE_FILE_THRESHOLD_MB = 100
export const MIN_LARGE_FILE_THRESHOLD_MB = 1

export interface EditorPrefs {
  largeFileThresholdMB: number
}

export const DEFAULT_EDITOR_PREFS: EditorPrefs = {
  largeFileThresholdMB: DEFAULT_LARGE_FILE_THRESHOLD_MB,
}

export function clampLargeFileThresholdMB(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LARGE_FILE_THRESHOLD_MB
  const v = Math.floor(n)
  if (v < MIN_LARGE_FILE_THRESHOLD_MB) {
    return DEFAULT_LARGE_FILE_THRESHOLD_MB
  }
  return v
}

export function normalizeEditorPrefs(raw: Partial<EditorPrefs> | null | undefined): EditorPrefs {
  return {
    largeFileThresholdMB: clampLargeFileThresholdMB(
      Number(raw?.largeFileThresholdMB ?? DEFAULT_LARGE_FILE_THRESHOLD_MB),
    ),
  }
}
