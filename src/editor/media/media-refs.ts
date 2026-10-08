import { getFroamStudioConfig } from '../../config'
import { bridgeUrl } from '../../lib/bridge'

/**
 * How a design refers to a placed picture or video: `froam-media:<name>`,
 * where the name is the file's content hash (lib/media-store.mjs). The same
 * reference works everywhere because it is resolved late:
 *
 *   the editor        → the bridge, `/__froam/media/<name>`
 *   generated CSS     → `media/<name>` beside the stylesheet (lib/codegen.mjs)
 *   runtime script    → `media/<name>` beside the script
 *   React runtime     → `mediaBaseUrl`, or the bridge in froam dev, or /froam/media/
 *
 * The editor only ever shows bridge URLs (never blob: URLs), so a URL read
 * back from the page maps to its reference by pattern, with nothing to
 * remember — nothing session-only can leak into a saved design.
 */
export const MEDIA_REF_PREFIX = 'froam-media:'
const NAME = '[a-f0-9]{32}\\.(?:jpg|png|webp|avif|gif|svg|bmp|mp4|webm|mov|ogv)'
const REF = new RegExp(`froam-media:(${NAME})`, 'g')
const BRIDGE_URL = new RegExp(`(?:[a-z][a-z0-9+.-]*://[^\\s"'()<>]*?)?/__froam/media/(${NAME})`, 'gi')
const ONE_REF = new RegExp(`^froam-media:(${NAME})$`)

export type MediaContext = 'editor' | 'runtime'

export function isMediaRef(value: unknown): value is string {
  return typeof value === 'string' && ONE_REF.test(value)
}

export function mediaRefName(ref: string) {
  return ONE_REF.exec(ref)?.[1] ?? null
}

export function hasMediaRef(value: unknown) {
  return typeof value === 'string' && value.includes(MEDIA_REF_PREFIX)
}

/** Where media files are fetched from in this context. Ends with a slash. */
export function mediaBase(context: MediaContext = 'runtime') {
  if (context === 'editor') return bridgeUrl('/__froam/media/')
  const configured = getFroamStudioConfig().mediaBaseUrl
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`
  // froam dev serves the page: the files are on the bridge until they ship.
  const win = typeof window === 'undefined' ? null : window as Window & { __FROAM_BRIDGE_ORIGIN__?: string; __FROAM_BOOT__?: unknown }
  if (win && (win.__FROAM_BRIDGE_ORIGIN__ !== undefined || win.__FROAM_BOOT__)) return bridgeUrl('/__froam/media/')
  return '/froam/media/'
}

/** Every reference in `value` (a src, a srcset, a CSS value, HTML) as a URL. */
export function resolveMediaRefs(value: string, context: MediaContext = 'editor') {
  if (!value.includes(MEDIA_REF_PREFIX)) return value
  const base = mediaBase(context)
  return value.replace(REF, (_, name: string) => `${base}${name}`)
}

/** The reverse, for anything read back off the page: a media URL becomes its reference again. */
export function mediaRefsFromUrls(value: string) {
  if (!value.includes('/__froam/media/')) return value
  return value.replace(BRIDGE_URL, (_, name: string) => `${MEDIA_REF_PREFIX}${name}`)
}

/** The reference a single URL stands for, if it is one of ours. */
export function mediaRefForUrl(url: string) {
  const mapped = mediaRefsFromUrls(url)
  return isMediaRef(mapped) ? mapped : null
}
