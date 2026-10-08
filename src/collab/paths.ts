/**
 * Froam Rooms — the path format.
 *
 * A path is `tag:n/tag:n/...` from the froam root down, where `n` is the
 * element's 1-based position among its same-tag siblings. Every draft, op,
 * comment and lock is keyed by one, so this is a contract, not an
 * implementation detail — it appears in froam.design.json, in the generated
 * CSS scope, and (from v5) on the wire between a designer and a client.
 *
 * Extracted from the editor so the format has one definition that the log,
 * the anchor resolver and a room server can all agree on.
 */

/**
 * Which elements a path can address: every HTML element, plus an `<svg>` root
 * (icons, logos, illustrations). SVG internals (path, g, circle…) roll up to
 * their <svg>. Siblings are counted per tag, so admitting <svg> changes no
 * existing HTML path — only paths ending in `svg:n` become resolvable.
 *
 * Typed as HTMLElement because the editor treats both uniformly (style,
 * dataset, attributes, geometry); callers must not assume innerText on an svg.
 */
export function isPathElement(node: Element | null | undefined): node is HTMLElement {
  return (node instanceof HTMLElement || node instanceof SVGSVGElement) && !isStageElement(node)
}

/**
 * The phone and tablet preview puts the page on a screen: a frame and a
 * scroller around it (see useDeviceShell). They are not page content and not
 * part of any path — their children count as the children of whatever holds
 * the frame — so an element has the same path in every preview.
 */
export const STAGE_ATTR = 'data-froam-stage'

export function isStageElement(node: Element | null | undefined) {
  return node?.hasAttribute?.(STAGE_ATTR) === true
}

/** An element's children as paths see them: a preview frame is looked through. */
export function pathChildren(parent: Element): Element[] {
  const out: Element[] = []
  walkPathChildren(parent, (child) => { out.push(child) })
  return out
}

/** An element's parent as paths see it. */
export function pathParent(element: Element): HTMLElement | null {
  let parent = element.parentElement
  while (parent && isStageElement(parent)) parent = parent.parentElement
  return parent
}

export function isSafeDraftPath(path: string) {
  return path.trim().length > 0 && path.includes(':')
}

/**
 * Page content outside the root. A React app renders into `#root`, but its
 * portals — modals, drawers, toasts, menus — mount straight on `<body>`, and a
 * page whose root is `<main>` keeps its header and footer outside it. Paths to
 * those start with this segment and count from `<body>`:
 *
 *   `@body/div:2/h2:1`   — the h2 in the second <div> on <body>
 *
 * Nothing about ordinary paths changes, so every saved design still resolves.
 * The nodes can't be moved into the root instead: React removes a portal from
 * its own container when it closes, and throws if the node was re-parented.
 */
export const BODY_SCOPE = '@body'
const BODY_PREFIX = `${BODY_SCOPE}/`

export function isBodyScopedPath(path: string) {
  return path.startsWith(BODY_PREFIX)
}

/**
 * Froam's own nodes on `<body>`: the editor's UI, the device frame, the
 * standalone host. They are never page content, and are not counted in a
 * `@body` path — so the editor numbers `<body>`'s children exactly as a
 * production page (which has none of them) does.
 */
export function isFroamOwnedNode(element: Element) {
  return element.getAttribute('data-chef-editor-root') === 'true' || element.id.startsWith('froam-')
}

/**
 * Visit an element's children as paths see them, in order, without building
 * a list: a preview frame is looked through. Stops when `visit` returns true.
 *
 * Paths are computed on every click, hover and repaint, on pages with
 * thousands of siblings. Walking siblings in place, instead of copying and
 * filtering arrays at every level, is what keeps that cheap.
 */
function walkPathChildren(parent: Element, visit: (child: Element) => boolean | void): boolean {
  const children = parent.children
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (isStageElement(child)) {
      if (walkPathChildren(child, visit)) return true
    } else if (visit(child)) {
      return true
    }
  }
  return false
}

/** An element's tag as a path writes it. */
function tagOf(element: Element) {
  return element.localName ?? element.tagName.toLowerCase()
}

/** Whether `child` counts toward a `tag:n` segment. The tag is compared first: it is the cheap test. */
function countsAs(child: Element, tag: string, onBody: boolean) {
  return tagOf(child) === tag && isPathElement(child) && !(onBody && isFroamOwnedNode(child))
}

/** The 1-based position of `element` among the children of `parent` that count for its tag. */
function positionIn(parent: Element, element: Element, tag: string) {
  const onBody = parent === parent.ownerDocument?.body
  let position = 0
  const found = walkPathChildren(parent, (child) => {
    if (countsAs(child, tag, onBody)) position += 1
    return child === element
  })
  return found ? Math.max(1, position) : 1
}

/** The `index`-th (0-based) child of `parent` that counts for `tag`. */
function nthCounted(parent: Element, tag: string, index: number): HTMLElement | null {
  const onBody = parent === parent.ownerDocument?.body
  let seen = -1
  let match: HTMLElement | null = null
  walkPathChildren(parent, (child) => {
    if (!countsAs(child, tag, onBody)) return false
    seen += 1
    if (seen !== index) return false
    match = child as HTMLElement
    return true
  })
  return match
}

/**
 * `parent`'s path children with the segment each one adds (`tag:n`), in one
 * pass. For building many paths at once, like the Layers tree: a child's path
 * is its parent's plus this, instead of a fresh walk back up for every node.
 */
export function pathSegmentsOfChildren(parent: Element): Array<[HTMLElement, string]> {
  const onBody = parent === parent.ownerDocument?.body
  const seen = new Map<string, number>()
  const out: Array<[HTMLElement, string]> = []
  walkPathChildren(parent, (child) => {
    if (!isPathElement(child) || (onBody && isFroamOwnedNode(child))) return false
    const tag = tagOf(child)
    const position = (seen.get(tag) ?? 0) + 1
    seen.set(tag, position)
    out.push([child, `${tag}:${position}`])
    return false
  })
  return out
}

/**
 * Whether `element` is page content Froam can address from `root`: inside the
 * root, or elsewhere on `<body>` and not part of Froam's own UI.
 */
export function isInPageScope(element: Element, root: HTMLElement) {
  if (root.contains(element)) return true
  // A root that stands in for <body> (a static page's wrapper) is the whole
  // page; a @body path would count the wrapper itself as a <div>.
  if (root.getAttribute('data-froam-root') === 'page') return false
  const body = element.ownerDocument?.body
  if (!body || root === body || element === body || !body.contains(element)) return false
  for (let node: Element | null = element; node && node !== body; node = node.parentElement) {
    if (isFroamOwnedNode(node)) return false
  }
  return true
}

function segmentsFrom(element: HTMLElement, base: HTMLElement) {
  const segments: string[] = []
  let current: HTMLElement | null = element
  while (current && current !== base) {
    const parent = pathParent(current)
    if (!parent) break
    const tag = tagOf(current)
    segments.push(`${tag}:${positionIn(parent, current, tag)}`)
    current = parent
  }
  return segments.reverse().join('/')
}

export function getElementPath(element: HTMLElement, root: HTMLElement) {
  const body = element.ownerDocument?.body
  if (body && !root.contains(element) && isInPageScope(element, root)) {
    return `${BODY_PREFIX}${segmentsFrom(element, body)}`
  }
  return segmentsFrom(element, root)
}

export function findElementByPath(root: HTMLElement, path: string): HTMLElement | null {
  if (!isSafeDraftPath(path)) return null
  const bodyScoped = isBodyScopedPath(path)
  const segments = (bodyScoped ? path.slice(BODY_PREFIX.length) : path).split('/').filter(Boolean)
  let current: HTMLElement | null = bodyScoped ? root.ownerDocument?.body ?? null : root
  for (const segment of segments) {
    if (!current) return null
    const [tag, position] = segment.split(':')
    const index = Math.max(0, Number(position) - 1)
    const next = nthCounted(current, tag, index)
    if (!next) return null
    current = next
  }
  return current
}

/** The tag a path points at, without touching the DOM. */
export function tagOfPath(path: string) {
  const last = path.split('/').filter(Boolean).at(-1)
  return last && last !== BODY_SCOPE ? last.split(':')[0] : ''
}
