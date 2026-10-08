import { readImageUrl } from '../chef/dom'
import type { FitSize } from '../image-fit'
import { readMediaDraft, writeMediaDraft, type MediaDraft, type MediaPlayback } from './media-draft'
import { mediaRefsFromUrls, resolveMediaRefs } from './media-refs'

/**
 * Where a picture or video goes, decided from what is selected:
 *
 *   img         a page's <img>: its src (and srcset) change
 *   video       a page's <video>: its src, poster and playback change
 *   frame       a Froam image frame: a background picture
 *   frame-video a Froam frame holding a <video> it owns (zoomable: the frame clips)
 *   background  any other element: a background picture
 *   bg-video    any other element: a video behind its content
 *   new         nothing selected: a new frame
 */
export type MediaRole = 'img' | 'video' | 'frame' | 'frame-video' | 'background' | 'bg-video' | 'new'

export const VIDEO_ATTR = 'data-froam-video'
export const BG_VIDEO_ATTR = 'data-froam-bg-video'
/** On elements inside an injected block, whose drafts don't persist: the fit, carried in the block's HTML. */
export const MEDIA_ATTR = 'data-froam-media'

export function isImageFrame(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.dataset.froamImageFrame === 'true'
}

export function ownedVideoIn(element: HTMLElement): HTMLVideoElement | null {
  return element.querySelector<HTMLVideoElement>(`:scope > video[${VIDEO_ATTR}], :scope > [${BG_VIDEO_ATTR}] > video[${VIDEO_ATTR}]`)
}

/** A video Froam placed belongs to its frame, or to the element it plays behind: that is what gets edited. */
export function mediaHostOf(element: HTMLElement | null): HTMLElement | null {
  if (!(element instanceof HTMLVideoElement) || !element.hasAttribute(VIDEO_ATTR)) return element
  const parent = element.parentElement
  if (parent?.hasAttribute(BG_VIDEO_ATTR)) return parent.parentElement ?? element
  return parent ?? element
}

/** Where an upload of `kind` lands on `target`, or a sentence saying why it can't. */
export function roleFor(target: HTMLElement | null, kind: 'image' | 'video'): MediaRole | string {
  if (!target) return 'new'
  if (kind === 'image') {
    if (target instanceof HTMLImageElement) return 'img'
    if (target instanceof HTMLVideoElement) return 'To change a video, upload a video. For a picture here, select the section around it.'
    return isImageFrame(target) ? 'frame' : 'background'
  }
  if (target instanceof HTMLVideoElement) return 'video'
  if (target instanceof HTMLImageElement) return 'A video can’t go inside a picture. Select the section around it to play it behind the content — or nothing, to add a video block.'
  return isImageFrame(target) ? 'frame-video' : 'bg-video'
}

/** Roles where a live (CSS) fit can also zoom: a background, or media inside a box Froam owns that clips it. */
export function canZoomLive(role: MediaRole) {
  return role !== 'img' && role !== 'video'
}

/** The box the picture fills, in CSS pixels: an <img>/<video>'s content box, a background's padding box. */
export function measureSlot(target: HTMLElement | null): FitSize | null {
  if (!target) return null
  let width = target.clientWidth
  let height = target.clientHeight
  if (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) {
    const style = window.getComputedStyle(target)
    width -= (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    height -= (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
  }
  return width > 1 && height > 1 ? { width, height } : null
}

/** What media an element shows now, as a design would store it — for Adjust. */
export function currentMediaOf(target: HTMLElement, draftMedia?: string): { kind: 'image' | 'video'; url: string; media: MediaDraft | null; role: MediaRole } | null {
  const fromAttr = (element: Element) => readMediaDraft(element.getAttribute(MEDIA_ATTR) ?? undefined)
  if (target instanceof HTMLImageElement) {
    const own = target.getAttribute('src')
    const url = own && own.includes('/__froam/media/') ? mediaRefsFromUrls(own) : target.currentSrc || target.src || ''
    return url ? { kind: 'image', url, media: readMediaDraft(draftMedia) ?? fromAttr(target), role: 'img' } : null
  }
  if (target instanceof HTMLVideoElement) {
    const url = mediaRefsFromUrls(target.getAttribute('src') || target.currentSrc || '')
    return url ? { kind: 'video', url, media: readMediaDraft(draftMedia) ?? fromAttr(target), role: 'video' } : null
  }
  const video = ownedVideoIn(target)
  if (video) {
    const url = mediaRefsFromUrls(video.getAttribute('src') ?? '')
    return url ? { kind: 'video', url, media: fromAttr(video), role: isImageFrame(target) ? 'frame-video' : 'bg-video' } : null
  }
  const background = readImageUrl(window.getComputedStyle(target).backgroundImage)
  if (!background) return null
  return {
    kind: 'image',
    url: mediaRefsFromUrls(background),
    media: readMediaDraft(draftMedia) ?? fromAttr(target),
    role: isImageFrame(target) ? 'frame' : 'background',
  }
}

/** Whether there is something to Adjust on this element. */
export function hasAdjustableMedia(element: HTMLElement | null) {
  return Boolean(element && currentMediaOf(element))
}

const FILL: Record<string, string> = { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', maxWidth: 'none' }

function setPlayback(video: HTMLVideoElement, playback: MediaPlayback) {
  video.toggleAttribute('autoplay', playback.autoplay)
  video.toggleAttribute('loop', playback.loop)
  video.toggleAttribute('muted', playback.muted)
  video.toggleAttribute('controls', playback.controls)
  video.setAttribute('playsinline', '')
  video.setAttribute('preload', playback.autoplay ? 'auto' : 'metadata')
  video.muted = playback.muted
}

/**
 * The <video> a frame or a background plays, made or updated in place. Its
 * attributes and inline styles are its whole state: it lives in an injected
 * block's HTML, which is what persists (references, not bridge URLs, once
 * serialized — see mediaRefsFromUrls).
 */
export function writeOwnedVideo(video: HTMLVideoElement, media: MediaDraft, fitStyles: Record<string, string>) {
  for (const [key, value] of Object.entries({ ...FILL, ...fitStyles })) {
    const property = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    if (value) video.style.setProperty(property, value)
    else video.style.removeProperty(property)
  }
  video.setAttribute(VIDEO_ATTR, 'true')
  if (media.src) video.setAttribute('src', resolveMediaRefs(media.src, 'editor'))
  if (media.poster) video.setAttribute('poster', resolveMediaRefs(media.poster, 'editor'))
  else video.removeAttribute('poster')
  if (media.playback) setPlayback(video, media.playback)
  video.setAttribute(MEDIA_ATTR, writeMediaDraft(media))
  if (media.playback?.autoplay && video.paused) void video.play().catch(() => {})
}

/** A video behind `host`'s content: an injected layer under everything else in it. */
export function ensureBackgroundVideo(host: HTMLElement) {
  let layer = host.querySelector<HTMLElement>(`:scope > [${BG_VIDEO_ATTR}]`)
  if (!layer) {
    // Its own tag: paths number siblings per tag, so a <div> here would
    // shift every <div> beside it and re-aim edits already made to them.
    layer = document.createElement('froam-backdrop')
    layer.setAttribute('data-froam-injected', 'true')
    layer.setAttribute('data-froam-block', 'true')
    layer.setAttribute(BG_VIDEO_ATTR, 'true')
    layer.setAttribute('aria-hidden', 'true')
    Object.assign(layer.style, { position: 'absolute', inset: '0', overflow: 'hidden', zIndex: '-1', pointerEvents: 'none', borderRadius: 'inherit' })
    host.insertBefore(layer, host.firstChild)
  }
  let video = layer.querySelector<HTMLVideoElement>(`:scope > video[${VIDEO_ATTR}]`)
  if (!video) {
    video = document.createElement('video')
    layer.appendChild(video)
  }
  return { layer, video }
}

/** A frame's own video, made if it has none yet; its background picture and placeholder step aside. */
export function ensureFrameVideo(frame: HTMLElement) {
  let video = frame.querySelector<HTMLVideoElement>(`:scope > video[${VIDEO_ATTR}]`)
  if (!video) {
    video = document.createElement('video')
    frame.insertBefore(video, frame.firstChild)
  }
  frame.style.backgroundImage = 'none'
  return video
}

/** Whether a file of this type is a still photo whose pixels can be cut (not a GIF, SVG or video). */
export function isBakeable(type: string) {
  return /^image\/(?:jpeg|png|webp|avif|bmp)$/i.test(type)
}

/** A media type from a reference's or URL's extension, for files we did not upload ourselves. */
export function typeFromName(url: string) {
  const ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? ''
  const types: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif',
    svg: 'image/svg+xml', bmp: 'image/bmp', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg',
  }
  if (url.startsWith('data:')) return /^data:([^;,]+)/.exec(url)?.[1] ?? ''
  return types[ext] ?? ''
}
