/** First-open size tracks ~85% of the work area (aligned with PinkHunkDB). */
export const FIRST_OPEN_WIDTH_RATIO = 0.85
export const FIRST_OPEN_HEIGHT_RATIO = 0.85

export const FIRST_OPEN_MIN_WIDTH = 900
export const FIRST_OPEN_MIN_HEIGHT = 560

export type ScreenWorkArea = {
  availWidth: number
  availHeight: number
  availLeft?: number
  availTop?: number
}

export type FirstOpenWindowBounds = {
  width: number
  height: number
  x: number
  y: number
}

/**
 * Resolve a medium, non-maximised first-launch window from the current screen work area.
 */
export const resolveFirstOpenWindowBounds = (
  viewport: ScreenWorkArea,
  options?: {
    widthRatio?: number
    heightRatio?: number
    minWidth?: number
    minHeight?: number
  },
): FirstOpenWindowBounds => {
  const availWidth = Math.max(0, Math.trunc(Number(viewport.availWidth) || 0))
  const availHeight = Math.max(0, Math.trunc(Number(viewport.availHeight) || 0))
  const availLeft = Math.trunc(Number(viewport.availLeft) || 0)
  const availTop = Math.trunc(Number(viewport.availTop) || 0)
  const widthRatio = options?.widthRatio ?? FIRST_OPEN_WIDTH_RATIO
  const heightRatio = options?.heightRatio ?? FIRST_OPEN_HEIGHT_RATIO
  const minWidth = options?.minWidth ?? FIRST_OPEN_MIN_WIDTH
  const minHeight = options?.minHeight ?? FIRST_OPEN_MIN_HEIGHT

  const width = Math.min(
    availWidth > 0 ? availWidth : minWidth,
    Math.max(minWidth, Math.trunc(availWidth * widthRatio) || minWidth),
  )
  const height = Math.min(
    availHeight > 0 ? availHeight : minHeight,
    Math.max(minHeight, Math.trunc(availHeight * heightRatio) || minHeight),
  )

  return {
    width,
    height,
    x: availLeft + Math.max(0, Math.trunc((availWidth - width) / 2)),
    y: availTop + Math.max(0, Math.trunc((availHeight - height) / 2)),
  }
}

/**
 * Detect the StartHidden create size (min width/height) that must not stick as the
 * restored window after a failed first-open resize.
 */
export const isCreatePlaceholderWindowBounds = (
  bounds: Pick<FirstOpenWindowBounds, 'width' | 'height'> | null | undefined,
  viewport: ScreenWorkArea,
): boolean => {
  if (!bounds) {
    return true
  }
  const width = Math.trunc(Number(bounds.width) || 0)
  const height = Math.trunc(Number(bounds.height) || 0)
  if (width < 400 || height < 300) {
    return true
  }
  const firstOpen = resolveFirstOpenWindowBounds(viewport)
  const nearCreateMin =
    width <= FIRST_OPEN_MIN_WIDTH + 8 &&
    height <= FIRST_OPEN_MIN_HEIGHT + 8
  const firstOpenMeaningfullyLarger =
    firstOpen.width >= width + 80 || firstOpen.height >= height + 80
  return nearCreateMin && firstOpenMeaningfullyLarger
}

export const readBrowserScreenWorkArea = (): ScreenWorkArea => ({
  availWidth: typeof window === 'undefined' ? 0 : window.screen?.availWidth || 0,
  availHeight: typeof window === 'undefined' ? 0 : window.screen?.availHeight || 0,
  availLeft:
    typeof window === 'undefined'
      ? 0
      : (window.screen as Screen & { availLeft?: number })?.availLeft || 0,
  availTop:
    typeof window === 'undefined'
      ? 0
      : (window.screen as Screen & { availTop?: number })?.availTop || 0,
})
