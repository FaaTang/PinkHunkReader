# UI i18n

Lightweight, dependency-free UI localization for PinkHunkReader.

## Files

- `types.ts` — `Lang` (`'en' | 'zh'`), `LangPref` (`'system' | Lang`).
- `locale.ts` — persisted language preference (`localStorage` key
  `pinkhunk-reader.language`), system-locale detection, document `lang` attribute,
  subscriber store, and the hook used to mirror the language into the Go backend
  (`registerBackendLangSync`).
- `index.ts` — dictionary lookup, `t()` (imperative), `useT()` / `useLang()`
  (reactive). Re-exported from `src/i18n`.
- `locales/en/<namespace>.ts` — English source of truth (default export object).
- `locales/zh/<namespace>.ts` — Chinese dictionary, typed as
  `Record<keyof typeof enNamespace, string>` so a missing translation fails `tsc`.

## Usage

Inside a React component:

```tsx
import { useT } from '../i18n'

function Example() {
  const t = useT()
  return <button title={t('common.save')}>{t('tree.menu.open')}</button>
}
```

Outside React (event callbacks created per render, plain modules):

```ts
import { t } from '../i18n'
const message = t('app.status.openedFolder', { label })
```

- Keys are flat, dot-separated and namespaced: `tree.menu.open`, `viewers.pdf.page`.
- The namespace prefix must match the dictionary file that owns the key.
- Parameter placeholders use `{name}`; pass `{ name: value }`.
- Plural-sensitive English wording uses two keys (`...One` / `...Many`) chosen by
  the caller; Chinese uses one wording for both.
- `useT()` re-renders on language change; `t()` reads the current language at call
  time and is meant for callbacks and non-component modules.

## Rules

- Never hard-code user-visible English in components; add a key instead.
- Do not translate class names, ids, `data-*` attributes, file extensions, MIME
  types, Monaco language ids, keyboard key names or paths.
- Keep the JSX/DOM structure identical; replace text and `title` / `aria-label` /
  `placeholder` / `alt` values only.
- Dialogs receive already-localized `title` / `message` props from `App.tsx`;
  internal strings of each dialog are keyed in its own namespace.
