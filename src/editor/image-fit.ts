/**
 * Fitting an image to the place it is going.
 *
 * A photo rarely has the shape of the slot it lands in: a portrait shot in a
 * landscape card, a wide banner in a square tile. Left alone, `cover` crops
 * it around the middle (heads go missing) and an <img> sized by its own
 * pixels reflows the page around the new shape. Here the person picks the
 * crop — where, how close, what shape — and it is baked into a new image of
 * exactly that shape, sized for the slot rather than for the camera.
 *
 * Pure geometry, no DOM: it runs under node in the tests.
 */

export type ImageFitMode = 'fill' | 'fit'
export type ImageFitAspect = 'frame' | 'original' | '1:1' | '4:3' | '3:2' | '16:9' | '4:5' | '3:4'

export type ImageFitState = {
  /** fill: crop to the shape · fit: show the whole image inside it. */
  mode: ImageFitMode
  aspect: ImageFitAspect
  /** 1 = the largest crop of this shape the image allows. */
  zoom: number
  /** Centre of the crop, as a fraction of the image (0–1). */
  x: number
  y: number
}

export type FitSize = { width: number; height: number }
export type CropRect = { sx: number; sy: number; sw: number; sh: number }

export const IMAGE_FIT_ASPECTS: { id: ImageFitAspect; label: string; title: string }[] = [
  { id: 'frame', label: 'Frame', title: 'The shape of the spot it is going into' },
  { id: 'original', label: 'Original', title: 'The photo’s own shape — the frame follows it' },
  { id: '1:1', label: '1:1', title: 'Square' },
  { id: '4:3', label: '4:3', title: 'Landscape 4:3' },
  { id: '3:2', label: '3:2', title: 'Landscape 3:2' },
  { id: '16:9', label: '16:9', title: 'Widescreen 16:9' },
  { id: '4:5', label: '4:5', title: 'Portrait 4:5' },
  { id: '3:4', label: '3:4', title: 'Portrait 3:4' },
]

export const DEFAULT_IMAGE_FIT: ImageFitState = { mode: 'fill', aspect: 'frame', zoom: 1, x: 0.5, y: 0.5 }
export const MAX_IMAGE_FIT_ZOOM = 5
/** Never bake an edge longer than this: the design file carries every pixel. */
export const MAX_OUTPUT_EDGE = 2560
/**
 * Keep at least this much when the source has it. The slot may be fitted in
 * the phone preview and then shown full-width on a desktop.
 */
export const MIN_OUTPUT_EDGE = 1600

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function isUsableSize(size: FitSize | null | undefined): size is FitSize {
  return Boolean(size) && Number.isFinite(size!.width) && Number.isFinite(size!.height) && size!.width > 0 && size!.height > 0
}

/** Width over height of the chosen shape. An unmeasurable frame falls back to the image's own shape. */
export function resolveAspectRatio(aspect: ImageFitAspect, frame: FitSize | null, image: FitSize): number {
  if (aspect === 'frame' && isUsableSize(frame)) return frame.width / frame.height
  if (aspect === 'frame' || aspect === 'original') return image.width / image.height
  const [w, h] = aspect.split(':').map(Number)
  return w / h
}

/** The CSS `aspect-ratio` that gives the element its new shape — none when it keeps the shape it has. */
export function aspectRatioCss(aspect: ImageFitAspect, image: FitSize): string | null {
  if (aspect === 'frame') return null
  if (aspect === 'original') return `${Math.round(image.width)} / ${Math.round(image.height)}`
  return aspect.replace(':', ' / ')
}

/** The part of the image that shows, in image pixels. Always inside the image. */
export function cropRect(image: FitSize, ratio: number, state: Pick<ImageFitState, 'zoom' | 'x' | 'y'>): CropRect {
  const zoom = clamp(Number.isFinite(state.zoom) ? state.zoom : 1, 1, MAX_IMAGE_FIT_ZOOM)
  let baseW = image.width
  let baseH = image.width / ratio
  if (baseH > image.height) {
    baseH = image.height
    baseW = image.height * ratio
  }
  const sw = baseW / zoom
  const sh = baseH / zoom
  const cx = clamp((Number.isFinite(state.x) ? state.x : 0.5) * image.width, sw / 2, image.width - sw / 2)
  const cy = clamp((Number.isFinite(state.y) ? state.y : 0.5) * image.height, sh / 2, image.height - sh / 2)
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh }
}

/** The same state, with zoom in range and the crop pulled back inside the image. */
export function clampFitState(image: FitSize, ratio: number, state: ImageFitState): ImageFitState {
  const zoom = clamp(Number.isFinite(state.zoom) ? state.zoom : 1, 1, MAX_IMAGE_FIT_ZOOM)
  const rect = cropRect(image, ratio, { ...state, zoom })
  return { ...state, zoom, x: (rect.sx + rect.sw / 2) / image.width, y: (rect.sy + rect.sh / 2) / image.height }
}

/** Drag the picture by (dx, dy) screen pixels in a preview `viewWidth` wide: it follows the pointer. */
export function panFit(image: FitSize, ratio: number, state: ImageFitState, dx: number, dy: number, viewWidth: number): ImageFitState {
  const { sw } = cropRect(image, ratio, state)
  const scale = viewWidth / sw
  if (!Number.isFinite(scale) || scale <= 0) return state
  return clampFitState(image, ratio, {
    ...state,
    x: state.x - dx / scale / image.width,
    y: state.y - dy / scale / image.height,
  })
}

/**
 * Zoom to `nextZoom`, keeping the image point under (px, py) — a fraction of
 * the preview, 0.5/0.5 being its middle — where it is.
 */
export function zoomFitAt(image: FitSize, ratio: number, state: ImageFitState, nextZoom: number, px = 0.5, py = 0.5): ImageFitState {
  const before = cropRect(image, ratio, state)
  const ix = before.sx + px * before.sw
  const iy = before.sy + py * before.sh
  const zoom = clamp(nextZoom, 1, MAX_IMAGE_FIT_ZOOM)
  const after = cropRect(image, ratio, { zoom, x: 0.5, y: 0.5 })
  return clampFitState(image, ratio, {
    ...state,
    zoom,
    x: (ix - px * after.sw + after.sw / 2) / image.width,
    y: (iy - py * after.sh + after.sh / 2) / image.height,
  })
}

/** The pixels of the source the result is made from: the crop, or the whole image when fitting. */
export function sourceRect(image: FitSize, ratio: number, state: ImageFitState): CropRect {
  return state.mode === 'fill' ? cropRect(image, ratio, state) : { sx: 0, sy: 0, sw: image.width, sh: image.height }
}

/**
 * The size of the slot once the shape is applied. The element keeps its
 * width; a new shape changes its height.
 */
export function slotSize(frame: FitSize | null, aspect: ImageFitAspect, ratio: number): FitSize | null {
  if (!isUsableSize(frame)) return null
  if (aspect === 'frame') return frame
  return { width: frame.width, height: frame.width / ratio }
}

/**
 * Baked size: twice the slot (sharp on retina), at least MIN_OUTPUT_EDGE on
 * the long edge, at most MAX_OUTPUT_EDGE — and never more pixels than the
 * source has. Upscaling only adds bytes.
 */
export function outputSize(source: FitSize, slot: FitSize | null): FitSize {
  const slotLong = isUsableSize(slot) ? Math.max(slot.width, slot.height) * 2 : 0
  const wantLong = Math.min(MAX_OUTPUT_EDGE, Math.max(MIN_OUTPUT_EDGE, slotLong))
  const scale = Math.min(1, wantLong / Math.max(source.width, source.height))
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

/**
 * How many screen pixels each source pixel is stretched over in the slot.
 * Above 1 the image is being enlarged and will look soft.
 */
export function enlargement(image: FitSize, ratio: number, state: ImageFitState, slot: FitSize | null): number {
  if (!isUsableSize(slot)) return 0
  if (state.mode === 'fill') return slot.width / cropRect(image, ratio, state).sw
  return Math.min(slot.width / image.width, slot.height / image.height)
}

/**
 * Widths to bake for an <img>'s `srcset`: the slot at 1×, 1.5× and 2× (a
 * phone and a retina laptop each download what they show), plus the size
 * `outputSize` picks — never wider than the crop, near-duplicates dropped.
 */
export function srcsetWidths(cropWidth: number, slot: FitSize | null, largest: number): number[] {
  const base = isUsableSize(slot) ? slot.width : largest / 2
  const wanted = [base, base * 1.5, base * 2, largest]
    .map((width) => Math.round(Math.min(width, cropWidth, MAX_OUTPUT_EDGE)))
    .filter((width) => width >= 16)
    .sort((a, b) => a - b)
  const widths: number[] = []
  for (const width of wanted) if (!widths.length || width > widths[widths.length - 1] * 1.15) widths.push(width)
  return widths
}

const pct = (value: number) => `${Math.round(value * 10000) / 100}%`
const clamp01 = (value: number) => clamp(Number.isFinite(value) ? value : 0.5, 0, 1)

/**
 * Where a cover-fitted picture sits so its visible part is centred on (x, y):
 * the `object-position` / `background-position` percentage for one axis,
 * when the visible part is `visible` (a fraction) of the whole.
 */
export function positionFor(center: number, visible: number) {
  return visible >= 0.9999 ? 0.5 : clamp01((center - visible / 2) / (1 - visible))
}

/**
 * Fitting by CSS alone: the file is shown as it is and only cropped on the
 * page. For what can't be redrawn without losing something — a GIF's motion,
 * an SVG's sharpness, a video, another site's picture.
 *
 *   element     a page's own <img>/<video>: fill/fit, position and shape.
 *               (No zoom: it would need a transform and a clip on an element
 *               whose clip-path a Look may already be using.)
 *   contained   an <img>/<video> inside a Froam frame that clips it: zoom too,
 *               by scaling around the crop's centre.
 *   background  a CSS background: zoom by background-size.
 */
export function liveFitStyles(options: {
  kind: 'element' | 'contained' | 'background'
  state: ImageFitState
  image: FitSize
  slot: FitSize | null
  url?: string
  aspectCss: string | null
  isImageFrame?: boolean
  frameRatio?: number
}): Record<string, string> {
  const { kind, image, slot, url, aspectCss, isImageFrame, frameRatio } = options
  const state = kind === 'element' ? { ...options.state, zoom: 1 } : options.state
  const ratio = resolveAspectRatio(state.aspect, slot, image)
  const crop = cropRect(image, ratio, state)
  const x = (crop.sx + crop.sw / 2) / image.width
  const y = (crop.sy + crop.sh / 2) / image.height
  const styles: Record<string, string> = {}

  if (kind === 'background') {
    styles.backgroundImage = url ? `url("${url}")` : ''
    styles.backgroundRepeat = 'no-repeat'
    if (state.mode === 'fit') {
      styles.backgroundSize = 'contain'
      styles.backgroundPosition = 'center'
    } else {
      const imageRatio = image.width / image.height
      const width = Math.max(1, imageRatio / ratio) * state.zoom
      const u = 1 / width
      const v = imageRatio / (width * ratio)
      styles.backgroundSize = `${pct(width)} auto`
      styles.backgroundPosition = `${pct(positionFor(x, u))} ${pct(positionFor(y, v))}`
    }
  } else if (state.mode === 'fit') {
    styles.objectFit = 'contain'
    styles.objectPosition = '50% 50%'
    if (kind === 'contained') {
      styles.transform = ''
      styles.transformOrigin = ''
    }
  } else {
    // The zoom-1 crop of this shape, placed as near (x, y) as the edges allow…
    const bw = Math.min(1, (image.height * ratio) / image.width)
    const bh = Math.min(1, image.width / ratio / image.height)
    const left = clamp(x - bw / 2, 0, 1 - bw)
    const top = clamp(y - bh / 2, 0, 1 - bh)
    styles.objectFit = 'cover'
    styles.objectPosition = `${pct(positionFor(x, bw))} ${pct(positionFor(y, bh))}`
    if (kind === 'contained') {
      // …then scaled around the point that keeps the zoomed crop centred
      // on (x, y). The frame around it clips the rest.
      const z = state.zoom
      if (z > 1.0001) {
        const ox = clamp01((x - bw / (2 * z) - left) / (bw * (1 - 1 / z)))
        const oy = clamp01((y - bh / (2 * z) - top) / (bh * (1 - 1 / z)))
        styles.transform = `scale(${Math.round(z * 1000) / 1000})`
        styles.transformOrigin = `${pct(ox)} ${pct(oy)}`
      } else {
        styles.transform = ''
        styles.transformOrigin = ''
      }
    }
  }

  if (aspectCss) {
    styles.aspectRatio = aspectCss
    styles.height = 'auto'
    if (kind !== 'background' || isImageFrame) styles.minHeight = '0px'
  } else if (kind === 'element' && frameRatio && Number.isFinite(frameRatio)) {
    // Shown as it is, the file keeps its own proportions — and an <img>
    // whose height follows them would reshape the page. Pin the slot's.
    styles.aspectRatio = String(Math.round(frameRatio * 10000) / 10000)
  }
  return styles
}

/** The styles that give a box a picked shape (none when it keeps its own). */
export function shapeStyles(aspectCss: string | null, letShrink: boolean): Record<string, string> {
  if (!aspectCss) return {}
  return { aspectRatio: aspectCss, height: 'auto', ...(letShrink ? { minHeight: '0px' } : {}) }
}

/** The inline styles that make the element show the baked image the way it was previewed. */
export function imageFitStyles(options: {
  kind: 'img' | 'background'
  state: ImageFitState
  url: string
  aspectCss: string | null
  /** A Froam image frame: its placeholder content must not hold the new shape open. */
  isImageFrame?: boolean
  /** Width over height of the slot as measured, for an <img> that would otherwise take the new image's shape. */
  frameRatio?: number
}): Record<string, string> {
  const { kind, state, url, aspectCss, isImageFrame, frameRatio } = options
  const size = state.mode === 'fill' ? 'cover' : 'contain'
  const styles: Record<string, string> = kind === 'img'
    ? { objectFit: size, objectPosition: '50% 50%' }
    : {
        backgroundImage: `url("${url}")`,
        backgroundSize: size,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
  if (aspectCss) {
    styles.aspectRatio = aspectCss
    styles.height = 'auto'
    if (kind === 'img' || isImageFrame) styles.minHeight = '0px'
  } else if (kind === 'img' && state.mode === 'fit' && frameRatio && Number.isFinite(frameRatio)) {
    // A whole image of another shape would re-shape an <img> whose height
    // follows its pixels. Pin the slot's shape; a height the site sets
    // itself still wins, since aspect-ratio yields to it.
    styles.aspectRatio = String(Math.round(frameRatio * 10000) / 10000)
  }
  return styles
}
