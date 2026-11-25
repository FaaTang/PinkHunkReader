/** Supported UI languages. */
export type Lang = 'en' | 'zh'

/** User preference: an explicit language or follow the operating system. */
export type LangPref = 'system' | Lang

export type TranslateParams = Record<string, string | number>

export type Dict = Record<string, string>
