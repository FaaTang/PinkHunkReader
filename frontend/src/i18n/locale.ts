import type { Lang, LangPref } from './types'

const STORAGE_KEY = 'pinkhunk-reader.language'

function readStoredPref(): LangPref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return sanitizeLangPref(raw)
  } catch {
    return 'system'
  }
}

export function sanitizeLangPref(value: unknown): LangPref {
  return value === 'en' || value === 'zh' || value === 'system' ? value : 'system'
}

export function detectSystemLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  const list = navigator.languages?.length
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : []
  return list.some((tag) => /^zh(-|$)/i.test(tag)) ? 'zh' : 'en'
}

export function resolveLang(pref: LangPref): Lang {
  return pref === 'system' ? detectSystemLang() : pref
}

function applyDocumentLang(lang: Lang): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.documentElement.setAttribute('data-lang', lang)
}

type BackendLangSync = (lang: Lang) => void

let backendSync: BackendLangSync | null = null

/** Register the Wails bridge that mirrors the UI language into the Go backend. */
export function registerBackendLangSync(sync: BackendLangSync): void {
  backendSync = sync
  backendSync(lang)
}

let pref: LangPref = readStoredPref()
let lang: Lang = resolveLang(pref)
const listeners = new Set<() => void>()

applyDocumentLang(lang)

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getLang(): Lang {
  return lang
}

export function getLangPref(): LangPref {
  return pref
}

function refresh(): void {
  const next = resolveLang(pref)
  applyDocumentLang(next)
  backendSync?.(next)
  lang = next
  // Emit even when the resolved language is unchanged (e.g. switching from
  // "中文" to "system" on a Chinese OS) so preference UIs re-render.
  emit()
}

/** Persist the preference and notify every subscriber. */
export function setLangPref(next: LangPref): void {
  const normalized = sanitizeLangPref(next)
  try {
    localStorage.setItem(STORAGE_KEY, normalized)
  } catch {
    /* ignore quota / private mode */
  }
  pref = normalized
  refresh()
}

if (typeof window !== 'undefined') {
  // Follow the OS when the user picked "system" and the OS locale changes at runtime.
  window.addEventListener('languagechange', () => {
    if (pref === 'system') refresh()
  })
}
