export type OpenPlacementTarget = 'current' | 'new'
export type OpenPlacementMode = 'ask' | 'always'

export interface OpenPlacementPrefs {
  target: OpenPlacementTarget
  mode: OpenPlacementMode
}

export const DEFAULT_OPEN_PLACEMENT: OpenPlacementPrefs = {
  target: 'current',
  mode: 'ask',
}

export function normalizeOpenPlacement(raw: { target?: string; mode?: string } | null | undefined): OpenPlacementPrefs {
  const target = raw?.target === 'new' ? 'new' : 'current'
  const mode = raw?.mode === 'always' ? 'always' : 'ask'
  return { target, mode }
}
