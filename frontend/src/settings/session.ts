import type { OpenTab } from '../types'

const LEGACY_SESSION_KEY = 'pinkhunk-reader.session.v1'
/** Persist buffer content up to this size (bytes, UTF-16-ish approx via length). */
export const SESSION_CONTENT_MAX_CHARS = 2 * 1024 * 1024

export interface SessionTab {
  path: string
  name: string
  kind: string
  editable: boolean
  largeMode: boolean
  size: number
  dirty: boolean
  untitled?: boolean
  languageHint?: string
  /** Present for untitled / dirty / small text buffers. */
  content?: string
}

export interface SessionState {
  version: 2
  windowId: string
  roots: string[]
  activePath: string | null
  untitledSeq: number
  tabs: SessionTab[]
}

/** Legacy v1 session kept only for one-shot migration. */
interface LegacySessionState {
  version: 1
  root: string
  activePath: string | null
  untitledSeq: number
  tabs: SessionTab[]
}

export function loadLegacyLocalSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(LEGACY_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LegacySessionState | SessionState
    if (!parsed || !Array.isArray((parsed as SessionState).tabs ?? (parsed as LegacySessionState).tabs)) {
      return null
    }
    if ((parsed as SessionState).version === 2 && Array.isArray((parsed as SessionState).roots)) {
      return parsed as SessionState
    }
    const v1 = parsed as LegacySessionState
    const roots = v1.root ? [v1.root] : []
    return {
      version: 2,
      windowId: '',
      roots,
      activePath: v1.activePath,
      untitledSeq: v1.untitledSeq,
      tabs: v1.tabs ?? [],
    }
  } catch {
    return null
  }
}

export function clearLegacyLocalSession() {
  try {
    localStorage.removeItem(LEGACY_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function tabToSession(tab: OpenTab): SessionTab {
  const base: SessionTab = {
    path: tab.path,
    name: tab.name,
    kind: tab.kind,
    editable: tab.editable,
    largeMode: tab.largeMode,
    size: tab.size,
    dirty: tab.dirty,
    untitled: tab.untitled,
    languageHint: tab.languageHint,
  }
  const needContent =
    tab.untitled
    || tab.dirty
    || ((tab.kind === 'text' || tab.kind === 'markdown') && !tab.largeMode)
  if (needContent && tab.content.length <= SESSION_CONTENT_MAX_CHARS) {
    base.content = tab.content
  }
  return base
}

export function buildSession(
  windowId: string,
  roots: string[],
  activePath: string | null,
  tabs: OpenTab[],
  untitledSeq: number,
): SessionState {
  return {
    version: 2,
    windowId,
    roots: [...roots],
    activePath,
    untitledSeq,
    tabs: tabs.map(tabToSession),
  }
}
