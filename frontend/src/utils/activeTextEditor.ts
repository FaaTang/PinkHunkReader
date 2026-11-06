/** Offset range (UTF-16 code units, same as Monaco / textarea). */
export type TextSelection = {
  startOffset: number
  endOffset: number
  text: string
}

export type ActiveTextEditorHandle = {
  getValue: () => string
  getSelection: () => TextSelection | null
  /** Replace [startOffset, endOffset) and return the new full document. */
  replaceRange: (startOffset: number, endOffset: number, text: string) => string
}

let active: ActiveTextEditorHandle | null = null

/** Register the focused text editor (cleared on unmount / inactive tab). */
export function setActiveTextEditor(handle: ActiveTextEditorHandle | null) {
  active = handle
}

export function getActiveTextEditor(): ActiveTextEditorHandle | null {
  return active
}
