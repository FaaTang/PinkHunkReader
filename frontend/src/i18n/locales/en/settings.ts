const en = {
  // Dialog shell
  'settings.navLabel': 'Settings groups',

  // Navigation sections
  'settings.nav.general.title': 'General',
  'settings.nav.general.description': 'Recent files & folders, auto-save, and other preferences',
  'settings.nav.appearance.title': 'Appearance',
  'settings.nav.appearance.description': 'Theme mode and accent color',
  'settings.nav.shortcuts.title': 'Shortcuts',
  'settings.nav.shortcuts.description': 'Keyboard bindings for common actions',
  'settings.nav.proxy.title': 'Proxy',
  'settings.nav.proxy.description': 'HTTP / SOCKS5 for updates',
  'settings.nav.about.title': 'About',
  'settings.nav.about.description': 'Version and software updates',

  // Shortcuts section
  'settings.shortcuts.title': 'Shortcuts',
  'settings.shortcuts.description':
    'Click a binding, then press the new keys. Escape cancels capture.',
  'settings.shortcuts.pressKeys': 'Press keys…',
  'settings.shortcuts.hint':
    'Defaults use Ctrl on Windows and Cmd on macOS for Save / Go to.',
  'settings.shortcuts.reset': 'Reset shortcuts',
  'settings.shortcuts.save': 'Save file',
  'settings.shortcuts.newFile': 'New file',
  'settings.shortcuts.open': 'Open',
  'settings.shortcuts.openFolder': 'Open folder',
  'settings.shortcuts.closeTab': 'Close tab',
  'settings.shortcuts.formatJson': 'Format / minify JSON',
  'settings.shortcuts.fullscreen': 'Toggle full screen',
  'settings.shortcuts.goto': 'Go to page / line',
  'settings.shortcuts.exitFullscreen': 'Exit full screen',
  'settings.shortcuts.settings': 'Open settings',
  'settings.shortcuts.toggleExplorer': 'Show / hide explorer',

  // Appearance section
  'settings.appearance.title': 'Appearance',
  'settings.appearance.description':
    'Choose System / Light / Dark, and a custom accent color. Soft/hover shades are derived automatically.',
  'settings.appearance.themeModeTitle': 'Theme mode',
  'settings.appearance.themeModeDescription': 'Default follows the operating system',
  'settings.appearance.themeSystem': 'System',
  'settings.appearance.themeSystemDescription': 'Follow OS light / dark preference',
  'settings.appearance.themeLight': 'Light',
  'settings.appearance.themeLightDescription': 'Always use the light theme',
  'settings.appearance.themeDark': 'Dark',
  'settings.appearance.themeDarkDescription': 'Always use the dark theme',
  'settings.appearance.accentTitle': 'Accent color',
  'settings.appearance.accentDescription':
    'Used for highlights, selection, and primary actions',
  'settings.appearance.accentAria': 'Accent color',
  'settings.appearance.languageTitle': 'Language',
  'settings.appearance.languageDescription': 'Interface language',

  // Interface language options
  'settings.language.system': 'Follow system',
  'settings.language.systemDescription': 'Use the operating system language',
  'settings.language.english': 'English',
  'settings.language.englishDescription': 'Always use English',
  'settings.language.zh': '简体中文',
  'settings.language.zhDescription': 'Always use Simplified Chinese',

  // General section
  'settings.general.title': 'General',
  'settings.general.description':
    'Recent files & folders, auto-save, and shell / open preferences.',
  'settings.general.recentMaxTitle': 'Recent items to keep',
  'settings.general.recentMaxRange': '{min}–{max} (default {default})',
  'settings.general.recentMaxAria': 'Recent items to keep',
  'settings.general.savedRecentlyTitle': 'Saved recently',
  'settings.general.recentItemsOne': '1 item',
  'settings.general.recentItemsMany': '{count} items',
  'settings.general.clearRecent': 'Clear list',
  'settings.general.autoSaveTitle': 'Auto-save',
  'settings.general.autoSaveDescription':
    'Write dirty files to disk on an interval (untitled and missing-on-disk buffers still need Save / Save As). Default on.',
  'settings.general.autoSaveIntervalTitle': 'Auto-save interval',
  'settings.general.autoSaveIntervalRange': '{min}–{max} seconds (default {default})',
  'settings.general.autoSaveIntervalAria': 'Auto-save interval in seconds',
  'settings.general.largeFileTitle': 'Large file threshold',
  'settings.general.largeFileDescription':
    'Text / Markdown larger than this (MB) open in paged mode: content loads in chunks while scrolling, Format JSON is disabled, and a missing source file only shows a notice (no Keep-in-editor prompt). Files stay editable; Save still writes the full document. Minimum {min}MB (default {default}). No upper limit — very large values use more memory. Applies to newly opened files.',
  'settings.general.largeFileAria': 'Large file threshold in megabytes',
  'settings.general.shellMenuTitle': 'OS context menu',
  'settings.general.shellMenuDescription':
    'Add "Open with PinkHunkReader" for files and folders (portable). Default on; rewrites the current exe path on each launch when enabled.',
  'settings.general.openInTitle': 'Open in',
  'settings.general.openInDescription': 'When continuing to open files or folders',
  'settings.general.openInAria': 'Open in',
  'settings.general.openInCurrent': 'Current window',
  'settings.general.openInNew': 'New window',
  'settings.general.whenOpenTitle': 'When already open',
  'settings.general.whenOpenDescription': 'Ask each time, or always use the preference above',
  'settings.general.whenOpenAria': 'When already open',
  'settings.general.askEveryTime': 'Ask every time',
  'settings.general.alwaysUsePreference': 'Always use preference',
  'settings.general.parentFolderTitle': 'When opening a file',
  'settings.general.parentFolderDescription':
    'Add the parent folder to Explorer, or open the file alone',
  'settings.general.parentFolderAria': 'When opening a file',
  'settings.general.parentFolderOpenParent': 'Open parent folder',
  'settings.general.parentFolderFileOnly': 'File only',
  'settings.general.parentFolderModeTitle': 'Remember parent folder choice',
  'settings.general.parentFolderModeDescription':
    'Ask each time, or always use the preference above',
  'settings.general.parentFolderModeAria': 'Remember parent folder choice',

  // Proxy section
  'settings.proxy.title': 'Proxy',
  'settings.proxy.description':
    'Used for GitHub update checks and downloads. When disabled, system proxy env vars still apply.',
  'settings.proxy.enable': 'Enable global proxy',
  'settings.proxy.type': 'Type',
  'settings.proxy.port': 'Port',
  'settings.proxy.host': 'Host',
  'settings.proxy.username': 'Username',
  'settings.proxy.password': 'Password',
  'settings.proxy.loadFailed': 'Failed to load proxy settings',
  'settings.proxy.saveFailed': 'Failed to save proxy settings',
  'settings.proxy.enabledStatus': 'Proxy enabled for update downloads',
  'settings.proxy.disabledStatus': 'Proxy disabled · system proxy (if any) still applies',
  'settings.proxy.saving': 'Saving…',
  'settings.proxy.save': 'Save proxy',

  // About section
  'settings.about.title': 'About',
  'settings.about.description': 'Version info and GitHub Release updates.',
  'settings.about.version': 'v{version}',
  'settings.about.updatesTitle': 'Updates',
  'settings.about.notChecked': 'Not checked',
  'settings.about.autoPrompt': 'Auto-prompt when an update is available',
  'settings.about.checkForUpdates': 'Check for updates',
  'settings.about.showUpdate': 'Show update',
  'settings.about.showDownloadError': 'Show download error',
  'settings.about.showCancelledDownload': 'Show cancelled download',
  'settings.about.showPausedDownload': 'Show paused download ({percent}%)',
  'settings.about.showDownloadProgress': 'Show download progress ({percent}%)',
  'settings.about.downloadSizeSuffix': ' ({size})',
  'settings.about.installAndRestart': 'Install and restart',
  'settings.about.openPackage': 'Open package',
}

export default en
