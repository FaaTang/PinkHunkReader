import { loader } from '@monaco-editor/react'

let configured: Promise<void> | null = null
let ready = false
let readyWaiters: Array<() => void> = []

function markReady(): void {
  if (ready) return
  ready = true
  for (const waiter of readyWaiters) waiter()
  readyWaiters = []
}

/** Configure Monaco to use the locally bundled editor (no CDN). */
export function ensureMonaco(): Promise<void> {
  if (!configured) {
    configured = import('monaco-editor').then((monaco) => {
      loader.config({ monaco })
      markReady()
    })
  }
  return configured
}

export function isMonacoReady(): boolean {
  return ready
}

/** Subscribe to Monaco readiness; runs immediately when already loaded. */
export function whenMonacoReady(onReady: () => void): () => void {
  if (ready) {
    onReady()
    return () => {}
  }
  readyWaiters.push(onReady)
  return () => {
    readyWaiters = readyWaiters.filter((waiter) => waiter !== onReady)
  }
}
