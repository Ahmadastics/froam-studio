import type { CropRect } from '../image-fit'

export type EncodedImage = { blob: Blob; width: number; height: number }

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement
type AnyContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function context2d(canvas: AnyCanvas): AnyContext {
  const context = canvas.getContext('2d') as AnyContext | null
  if (!context) throw new Error('This browser could not prepare the image')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  return context
}

/** Encoding is asynchronous either way: convertToBlob, or toBlob's callback. */
function toBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) => (canvas as HTMLCanvasElement).toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))), type, quality))
}

let webp: Promise<boolean> | null = null
/** WebP is about a third smaller than JPEG at the same look, and keeps transparency. */
function canEncodeWebp() {
  webp ??= (async () => {
    const probe = makeCanvas(2, 2)
    // An OffscreenCanvas without a context can't be encoded at all.
    context2d(probe).fillRect(0, 0, 2, 2)
    return (await toBlob(probe, 'image/webp', 0.8)).type === 'image/webp'
  })().catch(() => false)
  return webp
}

function hasTransparency(context: AnyContext, width: number, height: number) {
  const { data } = context.getImageData(0, 0, width, height)
  for (let index = 3; index < data.length; index += 4) if (data[index] < 255) return true
  return false
}

async function decodeWhole(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob)
  } catch {
    const url = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      return image
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** Draw `rect` of `from` into `context` at width × height, halving first when the drop is steep (sharper than one jump). */
function drawDown(context: AnyContext, from: CanvasImageSource, rect: CropRect, width: number, height: number) {
  let source: CanvasImageSource = from
  let { sx, sy, sw, sh } = rect
  while (sw / width > 2 && sh / height > 2) {
    const step = makeCanvas(Math.round(sw / 2), Math.round(sh / 2))
    const stepContext = context2d(step)
    stepContext.drawImage(source, sx, sy, sw, sh, 0, 0, step.width, step.height)
    source = step
    sx = 0
    sy = 0
    sw = step.width
    sh = step.height
  }
  context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
}

/**
 * Cut `rect` out of an image file and encode it once per width.
 *
 * Decoding, cropping and resizing happen inside createImageBitmap — off the
 * main thread in Chromium — and encoding in convertToBlob, also async, so
 * placing a 12-megapixel photo no longer freezes the page. Widths are done
 * one at a time to keep memory flat.
 */
export async function bakeCrop(blob: Blob, rect: CropRect, widths: number[], mayHaveAlpha: boolean): Promise<EncodedImage[]> {
  const useWebp = await canEncodeWebp()
  const crop = {
    sx: Math.max(0, Math.round(rect.sx)),
    sy: Math.max(0, Math.round(rect.sy)),
    sw: Math.max(1, Math.round(rect.sw)),
    sh: Math.max(1, Math.round(rect.sh)),
  }
  const results: EncodedImage[] = []
  let whole: ImageBitmap | HTMLImageElement | null = null
  try {
    for (const width of widths) {
      const height = Math.max(1, Math.round((width * crop.sh) / crop.sw))
      const canvas = makeCanvas(width, height)
      const context = context2d(canvas)
      let bitmap: ImageBitmap | null = null
      try {
        bitmap = await createImageBitmap(blob, crop.sx, crop.sy, crop.sw, crop.sh, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' })
      } catch {
        bitmap = null
      }
      if (bitmap && bitmap.width === width && bitmap.height === height) {
        context.drawImage(bitmap, 0, 0)
      } else {
        // No resize in createImageBitmap here (older Safari): scale ourselves, in steps.
        whole ??= await decodeWhole(blob)
        drawDown(context, whole, crop, width, height)
      }
      bitmap?.close()
      const type = useWebp ? 'image/webp' : mayHaveAlpha && hasTransparency(context, width, height) ? 'image/png' : 'image/jpeg'
      const encoded = await toBlob(canvas, type, type === 'image/png' ? undefined : useWebp ? 0.86 : 0.9)
      results.push({ blob: encoded, width, height })
    }
  } finally {
    if (whole && 'close' in whole) whole.close()
  }
  return results
}

/** A data URL for one blob — only where there is no bridge to keep files. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the image')))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'))
    reader.readAsDataURL(blob)
  })
}

/**
 * A video's still for `poster`: shown before it plays, while it loads, and
 * instead of it for people who asked for less motion. Null when the video's
 * pixels can't be read (another site's, without permission).
 */
export async function capturePoster(videoUrl: string, maxEdge = 1920): Promise<Blob | null> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.src = videoUrl
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Video failed to load'))
    })
    const target = Math.min(0.1, (video.duration || 1) / 2)
    if (video.currentTime !== target) {
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve()
        video.currentTime = target
      })
    }
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
    const width = Math.max(1, Math.round(video.videoWidth * scale))
    const height = Math.max(1, Math.round(video.videoHeight * scale))
    const canvas = makeCanvas(width, height)
    context2d(canvas).drawImage(video, 0, 0, width, height)
    return await toBlob(canvas, (await canEncodeWebp()) ? 'image/webp' : 'image/jpeg', 0.82)
  } catch {
    return null
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}
