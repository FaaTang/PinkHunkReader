import { SetUILanguage } from '../../wailsjs/go/app/App'
import { registerBackendLangSync } from './locale'
import type { Lang } from './types'

/**
 * Mirror the UI language into the Go backend so backend-generated messages
 * (update status, proxy save result) match the visible language.
 * Safe to call in a plain browser where the Wails bindings are absent.
 */
export function initBackendLanguage(): void {
  registerBackendLangSync((lang: Lang) => {
    void (async () => {
      try {
        await SetUILanguage(lang)
      } catch {
        /* Wails bindings unavailable (browser-only dev) */
      }
    })()
  })
}
