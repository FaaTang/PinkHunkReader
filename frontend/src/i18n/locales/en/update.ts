const en = {
  // Status line under Settings → About
  'update.status.notChecked': 'Not checked',
  'update.status.checking': 'Checking…',
  'update.status.upToDate': 'Up to date (v{version})',
  'update.status.available': 'Update available: v{version}',
  'update.status.downloaded': 'Update v{version} downloaded',
  'update.status.skipped': 'Skipped v{version}',
  'update.status.installerStarted': 'Installer started',

  // Failures raised by the update flow (backend messages are already localized)
  'update.error.checkFailed': 'Check failed',
  'update.error.checkFailedDetail': 'Check failed: {message}',
  'update.error.unknown': 'unknown',
  'update.error.downloadFailed': 'Download failed',
  'update.error.downloadCancelled': 'Download cancelled',
  'update.error.pauseFailed': 'Pause failed',
  'update.error.resumeFailed': 'Resume failed',
  'update.error.cancelFailed': 'Cancel failed',
  'update.error.installFailed': 'Install failed',
  'update.error.openPackageFailed': 'Could not open package',
}

export default en
