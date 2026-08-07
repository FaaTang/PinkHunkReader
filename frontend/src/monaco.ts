import { loader } from '@monaco-editor/react'

let configured: Promise<void> | null = null

/** Configure Monaco to use the locally bundled editor (no CDN). */
export function ensureMonaco(): Promise<void> {
  if (!configured) {
    configured = import('monaco-editor').then((monaco) => {
      loader.config({ monaco })
    })
  }
  return configured
}
