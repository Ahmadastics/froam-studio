/**
 * Froam — design drift.
 *
 * A Froam design is a set of edits keyed by DOM path. The path is exact and
 * cheap and wrong the moment someone wraps a section in a container — and the
 * failure is silent in both directions. Either the path stops resolving and the
 * edit quietly disappears, or, worse, it keeps resolving and now decorates
 * whatever moved into that slot. Nobody finds out until they look at the site.
 *
 * `src/collab/anchor.ts` already solved this for comment pins: store a
 * fingerprint of what the element *was* next to the path, verify the path
 * against it rather than trusting it, and say "orphaned" out loud instead of
 * pointing at a stranger. That machinery was never wired into the design
 * itself, so Froam's comments survive a refactor and Froam's actual designs
 * don't.
 *
 * This module is that judgement, made available where it can run before a merge
 * rather than after a deploy: no browser, no DOM, no dependencies — just a
 * design, some HTML, and an honest answer per edit.
 *
 * The scoring below is a deliberate mirror of `scoreFingerprint` in
 * `src/collab/anchor.ts`. KEEP THE TWO IN SYNC — `scripts/test-drift.mjs`
 * cross-checks them against the compiled bundle on every `npm test`, so a
 * divergence fails CI rather than silently producing two different opinions
 * about whether an element is the same element.
 */
import { CANVAS_KEY, INJECTION_KEY, SECTION_STRUCTURE_KEY, VIEWPORTS } from './codegen.mjs'
import {
  findElementByPath,
  getElementPath,
  parseHtml,
  queryAllByTag,
  queryById,
  resolveFroamRoot,
  textContent,
} from './html-tree.mjs'

const TEXT_SAMPLE = 80

/** Below this, a candidate is not the element. Mirrors `anchor.ts`. */
export const ANCHOR_MATCH_THRESHOLD = 0.5

/* ─── scoring (no tree) ─── */

function words(value) {
  return new Set(String(value).toLowerCase().split(/\W+/).filter(Boolean))
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const item of a) if (b.has(item)) shared += 1
  return shared / (a.size + b.size - shared)
}

function textSimilarity(want, got) {
  if (got === undefined) return 0
  if (want === got) return 1
  if (!want || !got) return 0
  if (want.includes(got) || got.includes(want)) return 0.8
  return jaccard(words(want), words(got))
}

/** How much a candidate looks like the fingerprinted element, 0–1. */
export function scoreFingerprint(want, got) {
  if (want.tag !== got.tag) return 0
  if (want.id && want.id === got.id) return 1

  let earned = 0
  let available = 0
  const weigh = (weight, hit) => {
    available += weight
    earned += weight * hit
  }

  if (want.id) weigh(0.5, want.id === got.id ? 1 : 0)
  if (want.text) weigh(0.3, textSimilarity(want.text, got.text))
  if (want.className) weigh(0.14, jaccard(words(want.className), words(got.className ?? '')))
  if (want.anchorId) weigh(0.1, want.anchorId === got.anchorId ? 1 : 0)
  if (want.anchorPath) weigh(0.08, want.anchorPath === got.anchorPath ? 1 : 0)
  if (want.ordinal !== undefined) weigh(0.05, want.ordinal === got.ordinal ? 1 : 0)

  if (available === 0) return 0
  return earned / available
}

/* ─── capture (tree) ─── */

function nearestAnchorId(element, root) {
  let current = element.parent
  while (current && current !== root) {
    if (current.id) return current.id
    current = current.parent
  }
  return undefined
}

function ordinalAmongSiblings(element) {
  const parent = element.parent
  if (!parent) return undefined
  const sameTag = parent.children.filter((child) => child.tag === element.tag)
  const index = sameTag.indexOf(element)
  return index < 0 ? undefined : index + 1
}

/** Mirrors `fingerprintElement` in `src/collab/anchor.ts`. */
export function fingerprintNode(element, root) {
  const anchorId = nearestAnchorId(element, root)
  const anchorRoot = anchorId ? (queryById(root, anchorId) ?? root) : root
  const text = textContent(element).trim().replace(/\s+/g, ' ').slice(0, TEXT_SAMPLE)

  const fingerprint = { tag: element.tag }
  if (element.id) fingerprint.id = element.id
  if (text) fingerprint.text = text
  if (element.className) fingerprint.className = element.className
  if (anchorId) fingerprint.anchorId = anchorId
  const anchorPath = getElementPath(element, anchorRoot)
  if (anchorPath) fingerprint.anchorPath = anchorPath
  const ordinal = ordinalAmongSiblings(element)
  if (ordinal !== undefined) fingerprint.ordinal = ordinal

  return fingerprint
}

/* ─── resolution (tree) ─── */

/** Mirrors `resolveAnchor` in `src/collab/anchor.ts`, minus the DOM side effects. */
export function resolveAnchor(anchor, root) {
  const atPath = findElementByPath(root, anchor.path)
  if (atPath) {
    const score = scoreFingerprint(anchor.fingerprint, fingerprintNode(atPath, root))
    if (score >= ANCHOR_MATCH_THRESHOLD) return { status: 'exact', element: atPath, path: anchor.path }
  }

  if (anchor.fingerprint.id) {
    const byId = queryById(root, anchor.fingerprint.id)
    if (byId && byId.tag === anchor.fingerprint.tag) {
      return { status: 'recovered', element: byId, path: getElementPath(byId, root), score: 1 }
    }
  }

  let best = null
  for (const candidate of queryAllByTag(root, anchor.fingerprint.tag)) {
    const score = scoreFingerprint(anchor.fingerprint, fingerprintNode(candidate, root))
    if (score > (best?.score ?? 0)) best = { element: candidate, score }
  }

  if (best && best.score >= ANCHOR_MATCH_THRESHOLD) {
    return {
      status: 'recovered',
      element: best.element,
      path: getElementPath(best.element, root),
      score: best.score,
    }
  }

  return { status: 'orphaned' }
}

/* ─── checking a whole design ─── */

export function isSpecialDraftPath(draftPath) {
  return draftPath === CANVAS_KEY
    || draftPath === SECTION_STRUCTURE_KEY
    || draftPath.startsWith(`${INJECTION_KEY}:`)
    || draftPath.startsWith('__froam')
}

function draftIsEmpty(draft) {
  if (!draft || typeof draft !== 'object') return true
  if (draft.text !== undefined || draft.imageUrl !== undefined) return false
  return !draft.styles || Object.keys(draft.styles).length === 0
}

/** A short human name for an edit, so a report reads like a page, not a tree. */
export function describeDraft(path, draft) {
  const fingerprint = draft?.fingerprint
  const tag = fingerprint?.tag ?? path.split('/').filter(Boolean).at(-1)?.split(':')[0] ?? '?'
  const text = (fingerprint?.text ?? draft?.text ?? '').trim().replace(/\s+/g, ' ')
  if (text) return `${tag} "${text.length > 36 ? `${text.slice(0, 35)}…` : text}"`
  if (fingerprint?.id) return `${tag}#${fingerprint.id}`
  const firstClass = (fingerprint?.className ?? '').trim().split(/\s+/).filter(Boolean)[0]
  if (firstClass) return `${tag}.${firstClass}`
  return tag
}

const EMPTY_COUNTS = () => ({ anchored: 0, moved: 0, orphaned: 0, unverified: 0, missing: 0 })

function addCounts(into, from) {
  for (const key of Object.keys(from)) into[key] += from[key]
}

/**
 * Resolve every anchored edit in one route's design against that route's HTML.
 *
 * `unverified` and `missing` are the pre-fingerprint answers: the design was
 * saved before drafts carried fingerprints, so the path either resolves or
 * doesn't and there is no way to tell whether the element it found is the one
 * the edit was made against. They are reported separately from `anchored` and
 * `orphaned` precisely so that distinction stays visible instead of being
 * rounded up into false confidence.
 */
export function checkRoute({ routeKey, html, viewports }) {
  const document = parseHtml(html)
  const { element: root, via } = resolveFroamRoot(document)
  const entries = []
  const counts = EMPTY_COUNTS()

  for (const viewport of VIEWPORTS) {
    const store = viewports?.[viewport]
    if (!store) continue
    for (const [path, draft] of Object.entries(store)) {
      if (isSpecialDraftPath(path) || draftIsEmpty(draft)) continue

      const entry = { routeKey, viewport, path, label: describeDraft(path, draft) }

      if (!draft.fingerprint) {
        const found = findElementByPath(root, path)
        entry.status = found ? 'unverified' : 'missing'
        entries.push(entry)
        counts[entry.status] += 1
        continue
      }

      const resolution = resolveAnchor({ path, fingerprint: draft.fingerprint }, root)
      if (resolution.status === 'exact') {
        entry.status = 'anchored'
      } else if (resolution.status === 'recovered') {
        entry.status = 'moved'
        entry.newPath = resolution.path
        entry.score = resolution.score
        entry.newFingerprint = fingerprintNode(resolution.element, root)
      } else {
        entry.status = 'orphaned'
      }
      entries.push(entry)
      counts[entry.status] += 1
    }
  }

  return { routeKey, checked: true, rootVia: via, entries, counts }
}

/**
 * Check a whole design against the HTML actually served for each route.
 *
 * `pages` maps a route key to that route's HTML. A route with no page supplied
 * is reported as unchecked rather than assumed healthy — "I did not look" and
 * "I looked and it is fine" are different answers and a CI gate needs to be
 * able to tell them apart.
 */
export function checkDesign(design, pages) {
  const routes = []
  const counts = EMPTY_COUNTS()
  const warnings = []

  for (const [routeKey, viewports] of Object.entries(design?.routes ?? {})) {
    const html = pages?.[routeKey]
    if (typeof html !== 'string') {
      routes.push({ routeKey, checked: false, reason: 'no page supplied for this route', entries: [], counts: EMPTY_COUNTS() })
      continue
    }
    const result = checkRoute({ routeKey, html, viewports })
    addCounts(counts, result.counts)

    // The generated CSS scopes to `[data-froam-root], #root, #__next` only. A
    // page that falls through to `main` or `body` still works, but only because
    // froam.runtime.js stamps `data-froam-root` on load — so shipping the CSS
    // without the runtime silently ships nothing.
    if ((result.rootVia === 'main' || result.rootVia === 'body' || result.rootVia === 'document')
      && !html.includes('froam.runtime.js')
      && result.counts.anchored + result.counts.unverified + result.counts.moved > 0) {
      warnings.push({
        routeKey,
        kind: 'css-root-unstamped',
        message: `root resolved to <${result.rootVia}> and froam.runtime.js is not on the page — generated CSS is scoped to [data-froam-root]/#root/#__next and will not apply`,
      })
    }

    routes.push(result)
  }

  const drift = counts.moved + counts.orphaned + counts.missing > 0
  return { routes, counts, warnings, drift }
}

/**
 * Re-key every `moved` edit onto the path it was found at, refreshing its
 * fingerprint from where it landed so the anchor doesn't decay across
 * successive refactors.
 *
 * A move onto a path another edit already occupies is refused, not merged:
 * two edits that both believe they own an element is exactly the ambiguity
 * this whole module exists to surface.
 */
export function applyDriftFix(design, report) {
  const next = { ...design, routes: { ...(design.routes ?? {}) } }
  const applied = []
  const refused = []

  for (const route of report.routes) {
    if (!route.checked) continue
    for (const entry of route.entries) {
      if (entry.status !== 'moved') continue

      const viewports = next.routes[entry.routeKey]
      const store = viewports?.[entry.viewport]
      const draft = store?.[entry.path]
      if (!draft) continue

      if (entry.newPath in store && entry.newPath !== entry.path) {
        refused.push({ ...entry, reason: 'another edit already owns that path' })
        continue
      }

      next.routes[entry.routeKey] = { ...viewports, [entry.viewport]: { ...store } }
      const target = next.routes[entry.routeKey][entry.viewport]
      delete target[entry.path]
      target[entry.newPath] = { ...draft, fingerprint: entry.newFingerprint ?? draft.fingerprint }
      applied.push(entry)
    }
  }

  return { design: next, applied, refused }
}
