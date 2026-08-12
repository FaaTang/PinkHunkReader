import { useCallback, useEffect, useRef, useState } from 'react'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import {
  CheckForUpdates,
  CheckForUpdatesSilently,
  DownloadUpdate,
  GetAppInfo,
  InstallUpdateAndRestart,
  OpenDownloadedUpdatePackage,
} from '../../wailsjs/go/app/App'
import {
  loadUpdatePreferences,
  saveUpdatePreferences,
  shouldAutoPromptUpdate,
  type UpdatePreferences,
} from '../settings/updatePreferences'

export type UpdateInfo = {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseName?: string
  releaseNotes?: string
  releaseNotesUrl?: string
  assetName?: string
  assetUrl?: string
  assetSize?: number
  sha256?: string
  downloaded?: boolean
  downloadPath?: string
}

export type AppInfo = {
  version: string
  author: string
  buildTime?: string
  repoUrl?: string
  issueUrl?: string
  releaseUrl?: string
}

type QueryResult = {
  success?: boolean
  message?: string
  data?: unknown
}

type DownloadProgress = {
  open: boolean
  version: string
  status: 'idle' | 'start' | 'downloading' | 'done' | 'error'
  percent: number
  downloaded: number
  total: number
  message: string
}

const emptyProgress = (): DownloadProgress => ({
  open: false,
  version: '',
  status: 'idle',
  percent: 0,
  downloaded: 0,
  total: 0,
  message: '',
})

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx++
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

export function useAppUpdateManager(opts?: {
  onPromptUpdate?: () => void
  onBeforeInstall?: () => Promise<void>
}) {
  const checkInFlight = useRef(false)
  const downloadInFlight = useRef(false)
  const downloadedVersionRef = useRef<string | null>(null)
  const onPromptRef = useRef(opts?.onPromptUpdate)
  onPromptRef.current = opts?.onPromptUpdate
  const onBeforeInstallRef = useRef(opts?.onBeforeInstall)
  onBeforeInstallRef.current = opts?.onBeforeInstall
  const [prefs, setPrefs] = useState<UpdatePreferences>(() => loadUpdatePreferences())
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [status, setStatus] = useState('Not checked')
  const [lastUpdate, setLastUpdate] = useState<UpdateInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<DownloadProgress>(emptyProgress)

  const persistPrefs = useCallback((next: UpdatePreferences) => {
    saveUpdatePreferences(next)
    setPrefs(next)
  }, [])

  const refreshAppInfo = useCallback(async () => {
    try {
      const res = (await GetAppInfo()) as QueryResult
      if (res?.success && res.data) {
        setAppInfo(res.data as AppInfo)
      }
    } catch (e) {
      console.warn('GetAppInfo failed', e)
    }
  }, [])

  const applyUpdateInfo = useCallback((info: UpdateInfo) => {
    const localDownloaded = downloadedVersionRef.current === info.latestVersion
    const downloaded = Boolean(info.downloaded) || localDownloaded
    const merged = { ...info, downloaded }
    setLastUpdate(merged)
    if (!info.hasUpdate) {
      setStatus(`Up to date (v${info.currentVersion || '?'})`)
      return merged
    }
    setStatus(
      downloaded
        ? `Update v${info.latestVersion} downloaded`
        : `Update available: v${info.latestVersion}`,
    )
    return merged
  }, [])

  const checkForUpdates = useCallback(async (silent: boolean) => {
    if (checkInFlight.current) return null
    checkInFlight.current = true
    if (!silent) {
      setBusy(true)
      setError('')
      setStatus('Checking…')
    }
    try {
      const res = (await (silent ? CheckForUpdatesSilently() : CheckForUpdates())) as QueryResult
      if (!res?.success) {
        if (!silent) {
          setError(res?.message || 'Check failed')
          setStatus(`Check failed: ${res?.message || 'unknown'}`)
        }
        return null
      }
      const info = res.data as UpdateInfo
      if (!info) return null
      const merged = applyUpdateInfo(info)
      if (
        silent
        && info.hasUpdate
        && shouldAutoPromptUpdate(info.latestVersion, loadUpdatePreferences())
      ) {
        onPromptRef.current?.()
      }
      return merged
    } catch (e) {
      if (!silent) {
        setError(String(e))
        setStatus(`Check failed: ${String(e)}`)
      }
      return null
    } finally {
      checkInFlight.current = false
      if (!silent) setBusy(false)
    }
  }, [applyUpdateInfo])

  const downloadUpdate = useCallback(async () => {
    if (downloadInFlight.current || !lastUpdate?.hasUpdate) return
    downloadInFlight.current = true
    setBusy(true)
    setError('')
    setProgress({
      open: true,
      version: lastUpdate.latestVersion,
      status: 'start',
      percent: 0,
      downloaded: 0,
      total: lastUpdate.assetSize || 0,
      message: '',
    })
    try {
      const res = (await DownloadUpdate()) as QueryResult
      if (!res?.success) {
        setError(res?.message || 'Download failed')
        setProgress((p) => ({ ...p, open: true, status: 'error', message: res?.message || 'Download failed' }))
        return
      }
      const data = (res.data || {}) as { downloadPath?: string; info?: UpdateInfo }
      downloadedVersionRef.current = lastUpdate.latestVersion
      setProgress((p) => ({
        ...p,
        status: 'done',
        percent: 100,
        downloaded: p.total || lastUpdate.assetSize || 0,
        open: true,
      }))
      applyUpdateInfo({
        ...lastUpdate,
        downloaded: true,
        downloadPath: data.downloadPath || lastUpdate.downloadPath,
      })
    } catch (e) {
      setError(String(e))
      setProgress((p) => ({ ...p, open: true, status: 'error', message: String(e) }))
    } finally {
      downloadInFlight.current = false
      setBusy(false)
    }
  }, [applyUpdateInfo, lastUpdate])

  const installUpdate = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      if (onBeforeInstallRef.current) {
        await onBeforeInstallRef.current()
      }
      const res = (await InstallUpdateAndRestart()) as QueryResult
      if (!res?.success) {
        setError(res?.message || 'Install failed')
        return
      }
      setStatus(res.message || 'Installer started')
      setProgress((p) => ({ ...p, open: false }))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const openDownloadedPackage = useCallback(async () => {
    try {
      const res = (await OpenDownloadedUpdatePackage()) as QueryResult
      if (!res?.success) setError(res?.message || 'Could not open package')
    } catch (e) {
      setError(String(e))
    }
  }, [])

  const skipThisVersion = useCallback(() => {
    if (!lastUpdate?.latestVersion) return
    persistPrefs({ ...prefs, skippedVersion: lastUpdate.latestVersion })
    setStatus(`Skipped v${lastUpdate.latestVersion}`)
  }, [lastUpdate, persistPrefs, prefs])

  const setAutoPrompt = useCallback((enabled: boolean) => {
    persistPrefs({ ...prefs, autoPromptEnabled: enabled })
  }, [persistPrefs, prefs])

  useEffect(() => {
    void refreshAppInfo()
    const t = window.setTimeout(() => {
      void checkForUpdates(true)
    }, 2000)
    const interval = window.setInterval(() => {
      void checkForUpdates(true)
    }, 30 * 60 * 1000)
    return () => {
      window.clearTimeout(t)
      window.clearInterval(interval)
    }
  }, [checkForUpdates, refreshAppInfo])

  useEffect(() => {
    return EventsOn('update:download-progress', (payload: {
      status?: string
      percent?: number
      downloaded?: number
      total?: number
      message?: string
    }) => {
      setProgress((prev) => {
        const status = (payload?.status as DownloadProgress['status']) || prev.status
        const forceOpen = status === 'done' || status === 'error'
        return {
          ...prev,
          // Respect Hide while downloading; reopen only for terminal states.
          open: forceOpen ? true : prev.open,
          status,
          percent: typeof payload?.percent === 'number' ? payload.percent : prev.percent,
          downloaded: typeof payload?.downloaded === 'number' ? payload.downloaded : prev.downloaded,
          total: typeof payload?.total === 'number' && payload.total > 0 ? payload.total : prev.total,
          message: payload?.message || prev.message,
        }
      })
    })
  }, [])

  const canInstall = Boolean(lastUpdate?.hasUpdate)
    && (Boolean(lastUpdate?.downloaded) || downloadedVersionRef.current === lastUpdate?.latestVersion)

  return {
    appInfo,
    status,
    error,
    busy,
    lastUpdate,
    progress,
    prefs,
    formatBytes,
    canInstall,
    refreshAppInfo,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    openDownloadedPackage,
    skipThisVersion,
    setAutoPrompt,
    hideProgress: () => setProgress((p) => ({ ...p, open: false })),
    showProgress: () => setProgress((p) => (p.status === 'idle' ? p : { ...p, open: true })),
  }
}
