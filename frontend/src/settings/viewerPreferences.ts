/**
 * Per-viewer rendering preferences.
 *
 * `pdfDarkInvert` keeps the PDF page readable in dark mode by inverting the
 * rendered canvas. It is only applied when the resolved theme is dark; turning
 * it off keeps the page in its original colours (useful for scans and
 * image-heavy PDFs, where inversion looks like a negative).
 */
export interface ViewerPreferences {
  pdfDarkInvert: boolean
}

const STORAGE_KEY = 'pinkhunk-reader.viewers.v1'

export const DEFAULT_VIEWER_PREFERENCES: ViewerPreferences = {
  pdfDarkInvert: true,
}

export function loadViewerPreferences(): ViewerPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_VIEWER_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<ViewerPreferences>
    return {
      pdfDarkInvert: parsed.pdfDarkInvert !== false,
    }
  } catch {
    return { ...DEFAULT_VIEWER_PREFERENCES }
  }
}

export function saveViewerPreferences(prefs: ViewerPreferences): ViewerPreferences {
  const next: ViewerPreferences = {
    pdfDarkInvert: prefs.pdfDarkInvert !== false,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
  return next
}
