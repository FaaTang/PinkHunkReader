export type OpenPlacementTarget = 'current' | 'new'
export type OpenPlacementMode = 'ask' | 'always'
export type OpenParentFolderTarget = 'parent' | 'file'
export type OpenParentFolderMode = 'ask' | 'always'

export interface OpenPlacementPrefs {
  target: OpenPlacementTarget
  mode: OpenPlacementMode
  parentFolderTarget: OpenParentFolderTarget
  parentFolderMode: OpenParentFolderMode
}

export const DEFAULT_OPEN_PLACEMENT: OpenPlacementPrefs = {
  target: 'current',
  mode: 'ask',
  parentFolderTarget: 'file',
  parentFolderMode: 'always',
}

export function normalizeOpenPlacement(
  raw: {
    target?: string
    mode?: string
    parentFolderTarget?: string
    parentFolderMode?: string
  } | null | undefined,
): OpenPlacementPrefs {
  const target = raw?.target === 'new' ? 'new' : 'current'
  const mode = raw?.mode === 'always' ? 'always' : 'ask'
  const parentFolderTarget = raw?.parentFolderTarget === 'parent' ? 'parent' : 'file'
  const parentFolderMode = raw?.parentFolderMode === 'ask' ? 'ask' : 'always'
  return { target, mode, parentFolderTarget, parentFolderMode }
}
