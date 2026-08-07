import { useCallback, useEffect, useState } from 'react'

/** Remember outline open/closed per file path across tab switches (session). */
const outlineOpenByPath = new Map<string, boolean>()

export function hasOutlinePreference(path: string): boolean {
  return outlineOpenByPath.has(path)
}

export function usePersistedOutlineOpen(path: string, fallback = true) {
  const [open, setOpenState] = useState(() => {
    if (outlineOpenByPath.has(path)) return outlineOpenByPath.get(path)!
    return fallback
  })

  useEffect(() => {
    if (outlineOpenByPath.has(path)) {
      setOpenState(outlineOpenByPath.get(path)!)
    } else {
      setOpenState(fallback)
    }
  }, [path, fallback])

  const setOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setOpenState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      outlineOpenByPath.set(path, next)
      return next
    })
  }, [path])

  return [open, setOpen] as const
}
