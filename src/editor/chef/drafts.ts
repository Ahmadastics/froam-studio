import { SECTION_STRUCTURE_KEY } from '../section-structure'
import { applyDraftText, isBeingWritten } from '../draft-text'
import { type ElementDraft, INJECTION_KEY } from './types'
import { persistedStyleKeys } from './style-options'
import { getCanvasHost, applyGlobalCSS, camelToKebab, readImageUrl } from './dom'
import { canApplyTextDraft } from './writing'
import { applyMediaSource, readImageSource } from '../media/apply-media'
import { hasMediaRef, mediaRefsFromUrls, resolveMediaRefs } from '../media/media-refs'

export function sanitizeDraftForElement(element: HTMLElement, draft: ElementDraft): ElementDraft {
  if (draft.text === undefined || canApplyTextDraft(element)) return draft
  const safeDraft = { ...draft }
  delete safeDraft.text
  return safeDraft
}

/* Each element's own style attribute, as the site wrote it, from before Froam
   first painted on it. Taking Froam's edits away puts exactly this back, so a
   site's own inline styles (a positioned caption, a sized hero) survive Undo,
   Cancel and Clear instead of being wiped with the edits. */
const pageStyles = new WeakMap<HTMLElement, string | null>()

/**
 * Take Froam's styles off an element: back to the style attribute the site
 * gave it. For an element Froam hasn't seen being painted (the page replaced
 * it since), only the properties in `styles` — Froam's — are removed.
 */
export function restorePageStyle(element: HTMLElement, styles?: Record<string, string>) {
  if (pageStyles.has(element)) {
    const own = pageStyles.get(element)
    if (own === null || own === undefined) element.removeAttribute('style')
    else element.setAttribute('style', own)
    return
  }
  for (const key of Object.keys(styles ?? {})) if (!key.startsWith('__froamState:')) element.style.removeProperty(camelToKebab(key))
  if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
}

export function applyDraft(element: HTMLElement, draft: ElementDraft) {
  try {
    const safeDraft = sanitizeDraftForElement(element, draft)
    if (safeDraft.styles && !pageStyles.has(element)) pageStyles.set(element, element.getAttribute('style'))
    if (safeDraft.text !== undefined && !isBeingWritten(element)) {
      applyDraftText(element, safeDraft.text)
    }
    if (safeDraft.imageUrl !== undefined || safeDraft.media !== undefined) {
      applyMediaSource(element, safeDraft.imageUrl, safeDraft.media, 'editor')
    }
    if (safeDraft.styles) {
      for (const [key, raw] of Object.entries(safeDraft.styles)) {
        if (key.startsWith('__froamState:')) continue
        // setProperty requires kebab-case, but our store uses camelCase
        const kebabKey = camelToKebab(key)
        // A placed picture is stored by reference and shown from the bridge.
        const value = hasMediaRef(raw) ? resolveMediaRefs(raw, 'editor') : raw
        // Repaints are frequent; an unchanged value is not rewritten.
        if (element.style.getPropertyValue(kebabKey) === value) continue
        element.style.setProperty(kebabKey, value)
      }
    }
  } catch {
    // Element may have been removed from DOM by React re-render — safe to ignore
  }
}

export function isInjectionPath(path: string) {
  return path.startsWith(`${INJECTION_KEY}:`)
}

export function isSectionStructurePath(path: string) {
  return path === SECTION_STRUCTURE_KEY
}

export function readInjectionDraft(draft: ElementDraft) {
  if (!draft.text) return null
  try {
    const parsed = JSON.parse(draft.text) as {
      html?: unknown
      parentPath?: unknown
      parentId?: unknown
      order?: unknown
    }
    if (typeof parsed.html !== 'string') return null
    if (typeof parsed.parentPath !== 'string') return null
    return {
      html: parsed.html,
      parentPath: parsed.parentPath,
      parentId: typeof parsed.parentId === 'string' ? parsed.parentId : undefined,
      order: typeof parsed.order === 'number' ? parsed.order : 0,
    }
  } catch {
    return null
  }
}

/* Shorthands and the longhands a browser expands them into. Reading an element
   back, `border-radius: 999px` also reads as four corner radii; those copies
   are the browser's, not an edit. Saved into the design they became a
   baseline Undo can't reach, so a look taken back after a reload left its
   corners behind. */
const SHORTHANDS: Record<string, readonly string[]> = {
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  borderRadius: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'],
  border: ['borderWidth', 'borderStyle', 'borderColor'],
  background: ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment'],
  flex: ['flexGrow', 'flexShrink', 'flexBasis'],
}
/** A key that only restates, in another form, a property the draft already sets. */
function restates(key: string, draft: Record<string, string>) {
  for (const [shorthand, longhands] of Object.entries(SHORTHANDS)) {
    if (longhands.includes(key) && draft[shorthand]) return true
    if (key === shorthand && longhands.some((longhand) => draft[longhand])) return true
  }
  return false
}

export function readLiveElementDraft(element: HTMLElement, existingDraft: ElementDraft = {}): ElementDraft {
  const nextDraft: ElementDraft = { ...existingDraft }

  if (existingDraft.text !== undefined || element.isContentEditable || canApplyTextDraft(element)) {
    nextDraft.text = element.innerText || ''
  }

  const drafted = existingDraft.styles ?? {}
  const liveStyles: Record<string, string> = { ...drafted }
  persistedStyleKeys.forEach((key) => {
    const shown = element.style[key]
    if (!shown) return
    // What the page shows from the bridge is stored as the reference it came from.
    const value = mediaRefsFromUrls(shown)
    // What the draft sets is refreshed; a new key is taken only when it is a
    // property of its own (an aligned element's left/top), not a restatement.
    if (key in drafted || !restates(key, drafted)) liveStyles[key] = value
  })

  const imageUrl = element instanceof HTMLImageElement
    ? readImageSource(element)
    : mediaRefsFromUrls(readImageUrl(element.style.backgroundImage))

  if (imageUrl || existingDraft.imageUrl !== undefined) {
    nextDraft.imageUrl = imageUrl
  }

  if (Object.keys(liveStyles).length > 0) {
    nextDraft.styles = liveStyles
  }

  return nextDraft
}

export function applyCanvasDraftStyles(background?: string, color?: string, styles?: Record<string, string>) {
  const host = getCanvasHost()
  if (!host) return
  if (background) host.style.setProperty('background-color', background)
  else host.style.removeProperty('background-color')
  if (color) host.style.setProperty('color', color)
  else host.style.removeProperty('color')

  const imageKeys = ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment']
  imageKeys.forEach((key) => {
    const value = styles?.[key]
    const cssKey = camelToKebab(key)
    if (value) host.style.setProperty(cssKey, hasMediaRef(value) ? resolveMediaRefs(value, 'editor') : value)
    else host.style.removeProperty(cssKey)
  })

  applyGlobalCSS(styles?.customCSS)
}

export function clearCanvasDraftStyles() {
  const host = getCanvasHost()
  if (!host) return
  host.style.removeProperty('background-color')
  host.style.removeProperty('color')
  host.style.removeProperty('background-image')
  host.style.removeProperty('background-size')
  host.style.removeProperty('background-position')
  host.style.removeProperty('background-repeat')
  host.style.removeProperty('background-attachment')
  applyGlobalCSS('')
}
