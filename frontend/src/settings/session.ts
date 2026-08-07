import type { OpenTab } from '../types'

const SESSION_KEY = 'pinkhunk-reader.session.v1'
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
  version: 1
  root: string
  activePath: string | null
  untitledSeq: number
  tabs: SessionTab[]
}

export function loadSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tabs)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSession(state: SessionState) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
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
  root: string,
  activePath: string | null,
  tabs: OpenTab[],
  untitledSeq: number,
): SessionState {
  return {
    version: 1,
    root,
    activePath,
    untitledSeq,
    tabs: tabs.map(tabToSession),
  }
}
