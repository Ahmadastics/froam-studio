/**
 * Froam — what an edit remembers about the element it was made against.
 *
 * A draft is keyed by DOM path, and a path stops being true the moment someone
 * wraps a section in a container. `src/collab/anchor.ts` already knows how to
 * survive that; this is the small amount of care needed to capture a
 * fingerprint that will still be recognisable *in the host's source*, which is
 * what `froam check` reads later.
 *
 * The subtlety is text. `fingerprintElement` samples the live DOM, but by save
 * time the live DOM may be showing Froam's edit — so fingerprinting a headline
 * the user just rewrote would record the new words, and nothing in the repo
 * would ever match them again. The original is therefore preferred whenever the
 * editor still holds one.
 *
 * Known boundary: if the editor is opened on a page where the production
 * runtime had already painted a previous design, the "live" text is that
 * design's text rather than the source's. Matching is deliberately fuzzy
 * (substring and word overlap, plus class, id, ordinal and ancestor path) so
 * this degrades into a *reported* recovery rather than a silent mismatch.
 */
import { fingerprintElement } from '../collab/anchor'
import type { FroamAnchorFingerprint } from '../collab/types'

/** Same sample width as `fingerprintElement`, so both sides compare like for like. */
const TEXT_SAMPLE = 80

export function sampleFingerprintText(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, TEXT_SAMPLE)
}

/**
 * Fingerprint `element` for storage alongside a draft.
 *
 * `originalText` is the element's text before Froam touched it, when the editor
 * has one. `undefined` means the text was never edited, in which case what is
 * on screen is what is in the repo and the live sample is correct.
 */
export function fingerprintForDraft(
  element: HTMLElement,
  root: HTMLElement,
  originalText?: string,
): FroamAnchorFingerprint {
  const fingerprint = fingerprintElement(element, root)
  if (originalText === undefined) return fingerprint

  const original = sampleFingerprintText(originalText)
  // An element edited down to nothing has no text worth matching on; dropping
  // the key entirely is what keeps the weighting honest, because `anchor.ts`
  // normalises over the signals a fingerprint actually carries.
  if (original) fingerprint.text = original
  else delete fingerprint.text
  return fingerprint
}
