import { isStructuralLayerElement, labelLayerElement } from './layers'

/**
 * A section's name ("Section", "Footer", "Pricing") while it's hovered — drawn
 * over the page, never in it. It used to be a ::before on the section, which
 * meant setting `position: relative` on the page's own element: hovering could
 * move absolutely-positioned art, and every hover restyled the page.
 */
let tag: HTMLElement | null = null
let target: HTMLElement | null = null

function ensureTag() {
  if (tag?.isConnected) return tag
  tag = document.createElement('div')
  tag.id = 'froam-boundary-tag'
  tag.className = 'froam-boundary-tag'
  tag.setAttribute('data-chef-editor-root', 'true')
  tag.setAttribute('aria-hidden', 'true')
  tag.hidden = true
  document.body.appendChild(tag)
  return tag
}

/** Where the editor's own top bar ends: the tag rides below it, never under it. */
function chromeBottom() {
  return document.querySelector('#froam-editor-portal .froam-chrome')?.getBoundingClientRect().bottom ?? 0
}

function place() {
  if (!tag || !target?.isConnected) { hideBoundaryTag(); return }
  const rect = target.getBoundingClientRect()
  const top = Math.max(rect.top - 24, chromeBottom() + 4)
  // Off screen, or scrolled so far that only a sliver shows: no tag.
  if (rect.bottom < top + 28 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) { tag.hidden = true; return }
  tag.style.transform = `translate(${Math.round(Math.max(4, rect.left))}px, ${Math.round(top)}px)`
  tag.hidden = false
}

export function showBoundaryTag(element: HTMLElement) {
  if (!isStructuralLayerElement(element)) { hideBoundaryTag(); return }
  const el = ensureTag()
  target = element
  const label = labelLayerElement(element)
  if (el.textContent !== label) el.textContent = label
  place()
}

export function hideBoundaryTag() {
  target = null
  if (tag && !tag.hidden) tag.hidden = true
}

export function removeBoundaryTag() {
  hideBoundaryTag()
  tag?.remove()
  tag = null
}
