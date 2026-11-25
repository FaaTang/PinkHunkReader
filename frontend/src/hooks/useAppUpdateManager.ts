import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import type { TranslationKey } from '../i18n'
import type { TranslateParams } from '../i18n/types'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import {
  CancelUpdateDownload,
  CheckForUpdates,
  CheckForUpdatesSilently,
  DownloadUpdate,
  GetAppInfo,
  InstallUpdateAndRestart,
  OpenDownloadedUpdatePackage,
  PauseUpdateDownload,
  ResumeUpdateDownload,
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
  status: 'idle' | 'start' | 'downloading' | 'paused' | 'done' | 'error' | 'cancelled'
  percent: number
  downloaded: number
  total: number
  message: string
}

/**
 * Descriptor of a translated message kept in state, so it can be re-rendered
 * when the UI language changes. Backend-supplied messages have no descriptor.
 */
type MessageDescriptor = {
  key: TranslationKey
  params?: TranslateParams
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
  const t = useT()
  const checkInFlight = useRef(false)
  const downloadInFlight = useRef(false)
  const downloadedVersionRef = useRef<string | null>(null)
  const onPromptRef = useRef(opts?.onPromptUpdate)
  onPromptRef.current = opts?.onPromptUpdate
  const onBeforeInstallRef = useRef(opts?.onBeforeInstall)
  onBeforeInstallRef.current = opts?.onBeforeInstall
  const [prefs, setPrefs] = useState<UpdatePreferences>(() => loadUpdatePreferences())
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [status, setStatus] = useState(() => t('update.status.notChecked'))
  const [lastUpdate, setLastUpdate] = useState<UpdateInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<DownloadProgress>(emptyProgress)

  // Last key-generated status / error / progress message (null when the text
  // came from the backend or a raw exception and must stay as-is).
  const statusMsg = useRef<MessageDescriptor | null>({ key: 'update.status.notChecked' })
  const errorMsg = useRef<MessageDescriptor | null>(null)
  const progressMsg = useRef<MessageDescriptor | null>(null)

  const showStatus = useCallback((key: TranslationKey, params?: TranslateParams) => {
    statusMsg.current = { key, params }
    setStatus(t(key, params))
  }, [t])

  const showRawStatus = useCallback((text: string) => {
    statusMsg.current = null
    setStatus(text)
  }, [])

  const showError = useCallback((key: TranslationKey | null, params?: TranslateParams) => {
    if (!key) {
      errorMsg.current = null
      setError('')
      return
    }
    errorMsg.current = { key, params }
    setError(t(key, params))
  }, [t])

  const showRawError = useCallback((text: string) => {
    errorMsg.current = null
    setError(text)
  }, [])

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
      showStatus('update.status.upToDate', { version: info.currentVersion || '?' })
      return merged
    }
    showStatus(
      downloaded ? 'update.status.downloaded' : 'update.status.available',
      { version: info.latestVersion },
    )
    return merged
  }, [showStatus])

  const checkForUpdates = useCallback(async (silent: boolean) => {
    if (checkInFlight.current) return null
    checkInFlight.current = true
    if (!silent) {
      setBusy(true)
      showError(null)
      showStatus('update.status.checking')
    }
    try {
      const res = (await (silent ? CheckForUpdatesSilently() : CheckForUpdates())) as QueryResult
      if (!res?.success) {
        if (!silent) {
          if (res?.message) showRawError(res.message)
          else showError('update.error.checkFailed')
          showStatus('update.error.checkFailedDetail', {
            message: res?.message || t('update.error.unknown'),
          })
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
        showRawError(String(e))
        showStatus('update.error.checkFailedDetail', { message: String(e) })
      }
      return null
    } finally {
      checkInFlight.current = false
      if (!silent) setBusy(false)
    }
  }, [applyUpdateInfo, showError, showRawError, showStatus, t])

  const downloadUpdate = useCallback(async () => {
    if (downloadInFlight.current || !lastUpdate?.hasUpdate) return
    downloadInFlight.current = true
    setBusy(true)
    showError(null)
    progressMsg.current = null
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
        const cancelled =
          /cancel/i.test(res?.message || '')
          || false
        if (cancelled) {
          showError(null)
        } else if (res?.message) {
          showRawError(res.message)
        } else {
          showError('update.error.downloadFailed')
        }
        const failureKey: TranslationKey = cancelled
          ? 'update.error.downloadCancelled'
          : 'update.error.downloadFailed'
        progressMsg.current = res?.message ? null : { key: failureKey }
        setProgress((p) => ({
          ...p,
          open: true,
          status: cancelled || p.status === 'cancelled' ? 'cancelled' : 'error',
          message: res?.message || t(failureKey),
        }))
        return
      }
      const data = (res.data || {}) as { downloadPath?: string; info?: UpdateInfo }
      downloadedVersionRef.current = lastUpdate.latestVersion
      progressMsg.current = null
      setProgress((p) => ({
        ...p,
        status: 'done',
        percent: 100,
        downloaded: p.total || lastUpdate.assetSize || 0,
        open: true,
        message: '',
      }))
      applyUpdateInfo({
        ...lastUpdate,
        downloaded: true,
        downloadPath: data.downloadPath || lastUpdate.downloadPath,
      })
    } catch (e) {
      showRawError(String(e))
      progressMsg.current = null
      setProgress((p) => ({ ...p, open: true, status: 'error', message: String(e) }))
    } finally {
      downloadInFlight.current = false
      setBusy(false)
    }
  }, [applyUpdateInfo, lastUpdate, showError, showRawError, t])

  const pauseDownload = useCallback(async () => {
    try {
      const res = (await PauseUpdateDownload()) as QueryResult
      if (!res?.success) {
        if (res?.message) showRawError(res.message)
        else showError('update.error.pauseFailed')
        return
      }
      setProgress((p) => ({ ...p, open: true, status: 'paused' }))
    } catch (e) {
      showRawError(String(e))
    }
  }, [showError, showRawError])

  const resumeDownload = useCallback(async () => {
    try {
      const res = (await ResumeUpdateDownload()) as QueryResult
      if (!res?.success) {
        if (res?.message) showRawError(res.message)
        else showError('update.error.resumeFailed')
        return
      }
      setProgress((p) => ({ ...p, open: true, status: 'downloading' }))
    } catch (e) {
      showRawError(String(e))
    }
  }, [showError, showRawError])

  const cancelDownload = useCallback(async () => {
    try {
      const res = (await CancelUpdateDownload()) as QueryResult
      if (!res?.success) {
        if (res?.message) showRawError(res.message)
        else showError('update.error.cancelFailed')
        return
      }
      progressMsg.current = res?.message ? null : { key: 'update.error.downloadCancelled' }
      setProgress((p) => ({
        ...p,
        open: true,
        status: 'cancelled',
        message: res?.message || t('update.error.downloadCancelled'),
      }))
    } catch (e) {
      showRawError(String(e))
    }
  }, [showError, showRawError, t])

  const installUpdate = useCallback(async () => {
    setBusy(true)
    showError(null)
    try {
      if (onBeforeInstallRef.current) {
        await onBeforeInstallRef.current()
      }
      const res = (await InstallUpdateAndRestart()) as QueryResult
      if (!res?.success) {
        if (res?.message) showRawError(res.message)
        else showError('update.error.installFailed')
        return
      }
      if (res.message) showRawStatus(res.message)
      else showStatus('update.status.installerStarted')
      setProgress((p) => ({ ...p, open: false }))
    } catch (e) {
      showRawError(String(e))
    } finally {
      setBusy(false)
    }
  }, [showError, showRawError, showRawStatus, showStatus])

  const openDownloadedPackage = useCallback(async () => {
    try {
      const res = (await OpenDownloadedUpdatePackage()) as QueryResult
      if (!res?.success) {
        if (res?.message) showRawError(res.message)
        else showError('update.error.openPackageFailed')
      }
    } catch (e) {
      showRawError(String(e))
    }
  }, [showError, showRawError])

  const skipThisVersion = useCallback(() => {
    if (!lastUpdate?.latestVersion) return
    persistPrefs({ ...prefs, skippedVersion: lastUpdate.latestVersion })
    showStatus('update.status.skipped', { version: lastUpdate.latestVersion })
  }, [lastUpdate, persistPrefs, prefs, showStatus])

  const setAutoPrompt = useCallback((enabled: boolean) => {
    persistPrefs({ ...prefs, autoPromptEnabled: enabled })
  }, [persistPrefs, prefs])

  useEffect(() => {
    void refreshAppInfo()
    const timer = window.setTimeout(() => {
      void checkForUpdates(true)
    }, 2000)
    const interval = window.setInterval(() => {
      void checkForUpdates(true)
    }, 30 * 60 * 1000)
    return () => {
      window.clearTimeout(timer)
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
        const forceOpen = status === 'done' || status === 'error' || status === 'cancelled'
        const message = payload?.message
          || (status === 'cancelled' ? t('update.error.downloadCancelled') : prev.message)
        progressMsg.current = payload?.message
          ? null
          : status === 'cancelled'
            ? { key: 'update.error.downloadCancelled' }
            : progressMsg.current
        return {
          ...prev,
          // Respect Hide while downloading; reopen only for terminal states.
          open: forceOpen ? true : prev.open,
          status,
          percent: typeof payload?.percent === 'number' ? payload.percent : prev.percent,
          downloaded: typeof payload?.downloaded === 'number' ? payload.downloaded : prev.downloaded,
          total: typeof payload?.total === 'number' && payload.total > 0 ? payload.total : prev.total,
          message,
        }
      })
    })
  }, [t])

  // Re-render status / error / progress text kept in state after a language switch.
  useEffect(() => {
    const statusDescriptor = statusMsg.current
    if (statusDescriptor) setStatus(t(statusDescriptor.key, statusDescriptor.params))
    const errorDescriptor = errorMsg.current
    if (errorDescriptor) setError(t(errorDescriptor.key, errorDescriptor.params))
    const progressDescriptor = progressMsg.current
    if (progressDescriptor) {
      setProgress((p) => ({ ...p, message: t(progressDescriptor.key, progressDescriptor.params) }))
    }
  }, [t])

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
    pauseDownload,
    resumeDownload,
    cancelDownload,
    installUpdate,
    openDownloadedPackage,
    skipThisVersion,
    setAutoPrompt,
    hideProgress: () => setProgress((p) => ({ ...p, open: false })),
    showProgress: () => setProgress((p) => (p.status === 'idle' ? p : { ...p, open: true })),
  }
}
