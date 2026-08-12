import { useCallback, useEffect, useState } from 'react'
import {
  WindowFullscreen,
  WindowIsFullscreen,
  WindowUnfullscreen,
} from '../../wailsjs/runtime/runtime'

/**
 * App-wide OS fullscreen (Wails WindowFullscreen).
 * Keyboard bindings are handled by App via editable shortcuts.
 */
export function useAppFullscreen() {
  const [fullscreen, setFullscreen] = useState(false)

  const sync = useCallback(async () => {
    try {
      const on = await WindowIsFullscreen()
      setFullscreen(on)
    } catch {
      /* runtime unavailable in plain browser preview */
    }
  }, [])

  const enter = useCallback(() => {
    try {
      WindowFullscreen()
      setFullscreen(true)
      // Layout chrome hides asynchronously; nudge viewers to re-measure fit width.
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 200)
    } catch {
      setFullscreen(false)
    }
  }, [])

  const exit = useCallback(() => {
    try {
      WindowUnfullscreen()
      setFullscreen(false)
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 200)
    } catch {
      setFullscreen(false)
    }
  }, [])

  const toggle = useCallback(async () => {
    try {
      const on = await WindowIsFullscreen()
      if (on) exit()
      else enter()
    } catch {
      if (fullscreen) exit()
      else enter()
    }
  }, [enter, exit, fullscreen])

  useEffect(() => {
    void sync()
    const onFocus = () => void sync()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(() => void sync(), 1500)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [sync])

  return { fullscreen, toggle, enter, exit }
}
