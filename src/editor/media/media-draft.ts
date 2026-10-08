import type { ImageFitState } from '../image-fit'

export type MediaPlayback = {
  autoplay: boolean
  loop: boolean
  muted: boolean
  controls: boolean
}

/**
 * What a draft says about a picture or video beyond its plain src. Stored as
 * a JSON string in `ElementDraft.media`, so it travels through the op log,
 * rooms and the design file as one field, the way an injected block's HTML
 * travels in `text`.
 */
export type MediaDraft = {
  kind: 'image' | 'video'
  /** A video's file. (An image's src stays in the draft's imageUrl.) */
  src?: string
  /** Widths of the fitted image, for `srcset`; `sizes` says how wide the slot is. */
  srcset?: string
  sizes?: string
  /** A video's first frame, shown before it plays — and instead, for reduced motion. */
  poster?: string
  playback?: MediaPlayback
  /** The upload the fit was cut from, kept in the workspace so it can be redone. */
  source?: string
  fit?: ImageFitState
  /** baked: pixels cut to the crop · live: CSS does the crop (GIF, SVG, video, another site's file). */
  method?: 'baked' | 'live'
}

export const DEFAULT_PLAYBACK: MediaPlayback = { autoplay: true, loop: true, muted: true, controls: false }

export function readMediaDraft(value: unknown): MediaDraft | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const parsed = JSON.parse(value) as MediaDraft
    return parsed && typeof parsed === 'object' && (parsed.kind === 'image' || parsed.kind === 'video') ? parsed : null
  } catch {
    return null
  }
}

/** Keys in one order, so an unchanged media draft is an unchanged string (no op, no save). */
export function writeMediaDraft(media: MediaDraft) {
  const ordered: Record<string, unknown> = {}
  for (const key of ['kind', 'method', 'src', 'srcset', 'sizes', 'poster', 'playback', 'source', 'fit'] as const) {
    if (media[key] !== undefined) ordered[key] = media[key]
  }
  return JSON.stringify(ordered)
}
