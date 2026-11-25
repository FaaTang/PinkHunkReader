import { useMemo, useSyncExternalStore } from 'react'
import en from './locales/en'
import zh from './locales/zh'
import { getLang, setLangPref, subscribeLang, getLangPref } from './locale'
import type { Lang, TranslateParams } from './types'

export type TranslationKey = keyof typeof en
export type TFunction = (key: TranslationKey, params?: TranslateParams) => string

const DICTS = { en, zh } as const

export function formatMessage(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  )
}

export function translate(
  lang: keyof typeof DICTS,
  key: TranslationKey,
  params?: TranslateParams,
): string {
  const dict = DICTS[lang] ?? en
  return formatMessage(dict[key] ?? en[key] ?? key, params)
}

/** Imperative translation for callbacks / plain modules; re-render components via useT(). */
export function t(key: TranslationKey, params?: TranslateParams): string {
  return translate(getLang(), key, params)
}

function getLangSnapshot(): string {
  return `${getLangPref()}|${getLang()}`
}

export function useLang(): Lang {
  useSyncExternalStore(subscribeLang, getLangSnapshot, getLangSnapshot)
  return getLang()
}

/** Reactive translator: returns a new function whenever the language changes. */
export function useT(): TFunction {
  const lang = useLang()
  return useMemo(
    () => (key: TranslationKey, params?: TranslateParams) => translate(lang, key, params),
    [lang],
  )
}

export { getLang, getLangPref, setLangPref, subscribeLang }
export type { Lang, LangPref } from './types'
