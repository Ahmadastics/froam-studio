import { useEffect, useRef } from 'react'

/**
 * Keeps the page clear of Froam's own chrome while editing.
 *
 * The studio toolbar is a fixed layer over the page. Without this, the top of
 * every site — usually its header, logo and navigation — sits permanently
 * underneath it: visible to nobody, clickable by nobody. So while the chrome
 * is showing, the page is moved into the space that's left:
 *
 * - normal flow: padding on <html> (never part of a saved path);
 * - sticky elements: their stick point moves down by the chrome height;
 * - fixed elements overlapping the chrome: nudged down visually (`translate`,
 *   so their size and anchoring are untouched).
 *
 * Nothing is written to inline styles — readLiveElementDraft() saves inline
 * styles as design edits. Rules live in one editor-owned <style>, keyed by a
 * `data-froam-pin` marker that serializers strip and teardown removes.
 */
const STYLE_ID = 'froam-canvas-offset'
const PIN_ATTR = 'data-froam-pin'
const CHROME_SELECTOR = '#froam-editor-portal .froam-chrome'

export function usePageCanvasOffset(active: boolean, getRoot: () => HTMLElement | null) {
  const getRootRef = useRef(getRoot)
  getRootRef.current = getRoot

  useEffect(() => {
    if (!active) return undefined
    const html = document.documentElement
    const style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
    let counter = 0
    let frame = 0

    const measure = () => {
      frame = 0
      const chrome = document.querySelector<HTMLElement>(CHROME_SELECTOR)
      let top = 0
      let bottom = 0
      if (chrome) {
        const rect = chrome.getBoundingClientRect()
        const shown = rect.height > 0 && window.getComputedStyle(chrome).visibility !== 'hidden'
        if (shown && rect.top < window.innerHeight / 2) top = Math.max(0, Math.round(rect.bottom))
        else if (shown) bottom = Math.max(0, Math.round(window.innerHeight - rect.top))
      }

      // Read pinned elements with our own rules switched off, so each one's
      // real (authored) position is what gets offset.
      style.textContent = ''
      const rules: string[] = []
      const root = getRootRef.current()
      if (root && (top || bottom)) {
        for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
          if (el.closest('[data-chef-editor-root="true"]')) continue
          const cs = window.getComputedStyle(el)
          if (cs.position !== 'sticky' && cs.position !== 'fixed') continue
          let id = el.getAttribute(PIN_ATTR)
          if (!id) {
            id = `p${(counter += 1)}`
            el.setAttribute(PIN_ATTR, id)
          }
          const sel = `html[data-chef-editing] [${PIN_ATTR}="${id}"]`
          if (cs.position === 'sticky') {
            if (top && cs.top !== 'auto') rules.push(`${sel}{top:calc(${cs.top} + ${top}px)!important}`)
            if (bottom && cs.bottom !== 'auto') rules.push(`${sel}{bottom:calc(${cs.bottom} + ${bottom}px)!important}`)
          } else {
            const rect = el.getBoundingClientRect()
            if (top && rect.top < top) rules.push(`${sel}{translate:0 ${top}px!important}`)
            else if (bottom && rect.bottom > window.innerHeight - bottom) rules.push(`${sel}{translate:0 -${bottom}px!important}`)
          }
        }
      }
      rules.unshift(`html[data-chef-editing]{padding-top:${top}px!important;padding-bottom:${bottom}px!important;scroll-padding-top:${top}px}`)
      style.textContent = rules.join('\n')
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    // The chrome can resize (UI scale, mobile layout) or move (toolbar top ⇄
    // bottom); the page can add fixed/sticky things (modals, banners).
    const resize = new ResizeObserver(schedule)
    const chrome = document.querySelector(CHROME_SELECTOR)
    if (chrome) resize.observe(chrome)
    const layout = new MutationObserver(schedule)
    const portal = document.getElementById('froam-editor-portal')
    if (portal) layout.observe(portal, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] })
    const root = getRootRef.current()
    let debounce = 0
    const pageChanges = new MutationObserver((records) => {
      // Ignore our own marker writes; react to real structure/class changes.
      if (records.every((r) => r.type === 'attributes' && r.attributeName === PIN_ATTR)) return
      window.clearTimeout(debounce)
      debounce = window.setTimeout(schedule, 600)
    })
    if (root) pageChanges.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', PIN_ATTR] })
    window.addEventListener('resize', schedule)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(debounce)
      resize.disconnect()
      layout.disconnect()
      pageChanges.disconnect()
      window.removeEventListener('resize', schedule)
      style.remove()
      document.querySelectorAll(`[${PIN_ATTR}]`).forEach((el) => el.removeAttribute(PIN_ATTR))
    }
  }, [active])
}
