import { Environment } from '../../wailsjs/runtime/runtime'

export type AppPlatform = 'mac' | 'windows' | 'linux' | 'unknown'

/** Navigator heuristic (works in browser preview). Prefer `detectPlatform()` in app. */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const plat =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    || navigator.platform
    || ''
  return /Mac|iPhone|iPad|iPod/i.test(plat) || /Mac OS X|Macintosh/i.test(ua)
}

function platformFromRuntime(raw: string | undefined | null): AppPlatform {
  const p = (raw || '').toLowerCase().trim()
  if (!p) return 'unknown'
  if (p === 'darwin' || p === 'macos' || p === 'mac' || p.startsWith('darwin')) return 'mac'
  if (p === 'windows' || p.startsWith('windows')) return 'windows'
  if (p === 'linux' || p.startsWith('linux')) return 'linux'
  return 'unknown'
}

function applyPlatformClass(platform: AppPlatform) {
  const root = document.documentElement
  root.classList.remove('platform-mac', 'platform-windows', 'platform-linux')
  root.dataset.platform = platform
  if (platform === 'mac') root.classList.add('platform-mac')
  else if (platform === 'windows') root.classList.add('platform-windows')
  else if (platform === 'linux') root.classList.add('platform-linux')
}

/** Context-menu label for revealing a path in the OS file manager. */
export function revealInOsLabel(): string {
  const platform = (typeof document !== 'undefined' && document.documentElement.dataset.platform) || ''
  if (platform === 'mac' || (!platform && isApplePlatform())) return 'Reveal in Finder'
  if (platform === 'windows') return 'Reveal in File Explorer'
  return 'Show in Folder'
}

/**
 * Tag <html> with OS class so CSS can follow platform chrome
 * (Mac traffic lights left, Windows caption right, etc.).
 */
export async function initPlatformChrome(): Promise<AppPlatform> {
  // Sync guess first to avoid a frame of wrong chrome, then refine via Wails.
  let platform: AppPlatform = isApplePlatform() ? 'mac' : 'windows'
  applyPlatformClass(platform)
  try {
    const env = await Environment()
    const fromRuntime = platformFromRuntime(env?.platform)
    // Never wipe a solid navigator mac guess with "unknown".
    if (fromRuntime !== 'unknown') {
      platform = fromRuntime
      applyPlatformClass(platform)
    }
  } catch {
    // Dev without Wails runtime — keep navigator guess.
  }
  return platform
}
