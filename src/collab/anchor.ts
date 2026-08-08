/**
 * Froam Rooms — surviving a restructure.
 *
 * Everything in Froam is keyed by a DOM path, which is exact, cheap, and wrong
 * the moment someone wraps a section in a container. A path that used to mean
 * "the hero headline" silently starts meaning "whatever is in that slot now" —
 * so a client's comment thread detaches, and in a room two editors resolve the
 * same path to different elements.
 *
 * The fix is not a better path. It's a second opinion: alongside the path,
 * store enough of what the element *was* to find it again, and be explicit
 * when it genuinely cannot be found rather than quietly pointing at a
 * stranger.
 *
 * Scoring is deliberately split from the DOM walk so the judgement — the part
 * with all the tuning in it — can be tested without a browser.
 */
import {
  getElementPath,
  findElementByPath,
} from './paths'
import type {
  FroamAnchor,
  FroamAnchorFingerprint,
  FroamAnchorResolution,
} from './types'

const TEXT_SAMPLE = 80

/**
 * Below this, a candidate is not the element — better an honest orphan than a
 * comment silently re-attached to the wrong paragraph.
 */
export const ANCHOR_MATCH_THRESHOLD = 0.5

/* ─── scoring (no DOM) ─── */

function words(value: string) {
  return new Set(value.toLowerCase().split(/\W+/).filter(Boolean))
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 1
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const item of a) if (b.has(item)) shared += 1
  return shared / (a.size + b.size - shared)
}

function textSimilarity(want: string, got: string | undefined) {
  if (got === undefined) return 0
  if (want === got) return 1
  if (!want || !got) return 0
  if (want.includes(got) || got.includes(want)) return 0.8
  return jaccard(words(want), words(got))
}

/**
 * How much a candidate looks like the thing the anchor was taken from, 0–1.
 *
 * Weights are normalised over whatever signals the original fingerprint
 * actually carried, so an element with an id is judged mostly on its id, and a
 * bare `<div>` with no id, text or classes can never clear the threshold on
 * tag alone — which is the honest answer for an element with nothing
 * distinguishing about it.
 */
export function scoreFingerprint(want: FroamAnchorFingerprint, got: FroamAnchorFingerprint) {
  // A different tag is a different element, whatever else matches.
  if (want.tag !== got.tag) return 0

  // An id is unique per document, so the same tag with the same id is the same
  // element — however far it has moved or how completely it has been
  // rewritten. (If a page ships duplicate ids the first one wins, which is the
  // same thing querySelector would do.)
  if (want.id && want.id === got.id) return 1

  let earned = 0
  let available = 0
  const weigh = (weight: number, hit: number) => {
    available += weight
    earned += weight * hit
  }

  if (want.id) weigh(0.5, want.id === got.id ? 1 : 0)
  if (want.text) weigh(0.3, textSimilarity(want.text, got.text))
  if (want.className) weigh(0.14, jaccard(words(want.className), words(got.className ?? '')))
  if (want.anchorId) weigh(0.1, want.anchorId === got.anchorId ? 1 : 0)
  if (want.anchorPath) weigh(0.08, want.anchorPath === got.anchorPath ? 1 : 0)
  if (want.ordinal !== undefined) weigh(0.05, want.ordinal === got.ordinal ? 1 : 0)

  // Nothing to go on but the tag. Deliberately not enough to match.
  if (available === 0) return 0

  return earned / available
}

/* ─── capture (DOM) ─── */

function nearestAnchorId(element: HTMLElement, root: HTMLElement) {
  let current: HTMLElement | null = element.parentElement
  while (current && current !== root) {
    if (current.id) return current.id
    current = current.parentElement
  }
  return undefined
}

function ordinalAmongSiblings(element: HTMLElement) {
  const parent = element.parentElement
  if (!parent) return undefined
  const sameTag = Array.from(parent.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === element.tagName,
  )
  const index = sameTag.indexOf(element)
  return index < 0 ? undefined : index + 1
}

export function fingerprintElement(element: HTMLElement, root: HTMLElement): FroamAnchorFingerprint {
  const anchorId = nearestAnchorId(element, root)
  const anchorRoot = anchorId ? (root.querySelector<HTMLElement>(`#${CSS.escape(anchorId)}`) ?? root) : root
  const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, TEXT_SAMPLE)

  const fingerprint: FroamAnchorFingerprint = { tag: element.tagName.toLowerCase() }
  if (element.id) fingerprint.id = element.id
  if (text) fingerprint.text = text
  if (element.className && typeof element.className === 'string') fingerprint.className = element.className
  if (anchorId) fingerprint.anchorId = anchorId
  const anchorPath = getElementPath(element, anchorRoot)
  if (anchorPath) fingerprint.anchorPath = anchorPath
  const ordinal = ordinalAmongSiblings(element)
  if (ordinal !== undefined) fingerprint.ordinal = ordinal

  return fingerprint
}

export function createAnchor(element: HTMLElement, root: HTMLElement): FroamAnchor {
  return {
    nodeId: element.dataset.froamId || undefined,
    path: getElementPath(element, root),
    fingerprint: fingerprintElement(element, root),
  }
}

/* ─── resolution (DOM) ─── */

/**
 * Find what an anchor points at now.
 *
 * The path is tried first and cheaply, but it is *verified* against the
 * fingerprint rather than trusted — a path that still resolves after a
 * restructure is precisely the dangerous case, because it returns a real
 * element that is the wrong one.
 */
export function resolveAnchor(anchor: FroamAnchor, root: HTMLElement): FroamAnchorResolution {
  if (anchor.nodeId) {
    const byNodeId = root.querySelector<HTMLElement>(`[data-froam-id="${CSS.escape(anchor.nodeId)}"]`)
    if (byNodeId) {
      const path = getElementPath(byNodeId, root)
      if (path === anchor.path) return { status: 'exact', element: byNodeId, path }
      return { status: 'recovered', element: byNodeId, path, score: 1 }
    }
  }
  const atPath = findElementByPath(root, anchor.path)
  if (atPath) {
    const score = scoreFingerprint(anchor.fingerprint, fingerprintElement(atPath, root))
    if (score >= ANCHOR_MATCH_THRESHOLD) {
      if (anchor.nodeId) atPath.setAttribute('data-froam-id', anchor.nodeId)
      return { status: 'exact', element: atPath, path: anchor.path }
    }
  }

  // The id is worth a direct look before scanning the document.
  if (anchor.fingerprint.id) {
    const byId = root.querySelector<HTMLElement>(`#${CSS.escape(anchor.fingerprint.id)}`)
    if (byId && byId.tagName.toLowerCase() === anchor.fingerprint.tag) {
      if (anchor.nodeId) byId.setAttribute('data-froam-id', anchor.nodeId)
      return { status: 'recovered', element: byId, path: getElementPath(byId, root), score: 1 }
    }
  }

  let best: { element: HTMLElement; score: number } | null = null
  const candidates = root.querySelectorAll<HTMLElement>(anchor.fingerprint.tag)
  candidates.forEach((candidate) => {
    const score = scoreFingerprint(anchor.fingerprint, fingerprintElement(candidate, root))
    if (score > (best?.score ?? 0)) best = { element: candidate, score }
  })

  const winner = best as { element: HTMLElement; score: number } | null
  if (winner && winner.score >= ANCHOR_MATCH_THRESHOLD) {
    if (anchor.nodeId) winner.element.setAttribute('data-froam-id', anchor.nodeId)
    return {
      status: 'recovered',
      element: winner.element,
      path: getElementPath(winner.element, root),
      score: winner.score,
    }
  }

  // Gone. The caller shows it in a list; it is never silently dropped and
  // never silently re-pointed at a stranger.
  return { status: 'orphaned' }
}
