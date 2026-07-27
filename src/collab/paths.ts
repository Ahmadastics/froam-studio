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

export function isSafeDraftPath(path: string) {
  return path.trim().length > 0 && path.includes(':')
}

export function getElementPath(element: HTMLElement, root: HTMLElement) {
  const segments: string[] = []
  let current: HTMLElement | null = element
  while (current && current !== root) {
    const parent: HTMLElement | null = current.parentElement
    if (!parent) break
    const tag = current.tagName.toLowerCase()
    const currentTag = current.tagName
    const siblings = Array.from(parent.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === currentTag,
    )
    const index = Math.max(1, siblings.indexOf(current) + 1)
    segments.unshift(`${tag}:${index}`)
    current = parent
  }
  return segments.join('/')
}

export function findElementByPath(root: HTMLElement, path: string): HTMLElement | null {
  if (!isSafeDraftPath(path)) return null
  const segments = path.split('/').filter(Boolean)
  let current: HTMLElement | null = root
  for (const segment of segments) {
    if (!current) return null
    const [tag, position] = segment.split(':')
    const index = Math.max(0, Number(position) - 1)
    const next: HTMLElement | undefined = Array.from(current.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === tag,
    )[index]
    if (!next) return null
    current = next
  }
  return current
}

/** The tag a path points at, without touching the DOM. */
export function tagOfPath(path: string) {
  const last = path.split('/').filter(Boolean).at(-1)
  return last ? last.split(':')[0] : ''
}
