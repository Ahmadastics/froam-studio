import { useEffect, useRef } from 'react'
import { isInPageScope } from '../collab/paths'

/**
 * Keeps the page clear of Froam's own chrome while editing.
 *
 * The studio toolbar and the side panels are fixed layers over the page.
 * Without this, the top of every site — usually its header, logo and
 * navigation — sits permanently under the toolbar, and whatever you're
 * editing slides under a panel the moment you open one. So while the chrome
 * is showing, the page is moved into the canvas: the space the editor's
 * layout leaves between toolbar and panels (`.froam-figma-layout__canvas`).
 *
 * - normal flow: padding on <html> (never part of a saved path) — the page
 *   reflows to the canvas width, the way it would in a narrower window;
 * - sticky elements: their stick point moves down by the chrome height;
 * - fixed elements under the chrome or a panel: nudged into the canvas
 *   (`translate`, so their size and anchoring are untouched); a full-width
 *   bar is narrowed to the canvas instead.
 *
 * Nothing is written to inline styles — readLiveElementDraft() saves inline
 * styles as design edits. Rules live in one editor-owned <style>, keyed by a
 * `data-froam-pin` marker that serializers strip and teardown removes.
 */
const STYLE_ID = 'froam-canvas-offset'
const PIN_ATTR = 'data-froam-pin'
const CHROME_SELECTOR = '#froam-editor-portal .froam-chrome'
const CANVAS_SELECTOR = '#froam-editor-portal .froam-figma-layout__canvas'

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

      // Side panels: the canvas cell's edges. On phones the panels are sheets
      // over the page, not docks beside it, so the page keeps its full width.
      let left = 0
      let right = 0
      const canvas = document.querySelector<HTMLElement>(CANVAS_SELECTOR)
      if (canvas && !canvas.closest('.froam-figma-layout.is-mobile')) {
        const rect = canvas.getBoundingClientRect()
        if (rect.width >= 320) {
          left = Math.max(0, Math.round(rect.left))
          right = Math.max(0, Math.round(window.innerWidth - rect.right))
        }
      }

      // Read pinned elements with our own rules switched off, so each one's
      // real (authored) position is what gets offset.
      style.textContent = ''
      const rules: string[] = []
      const root = getRootRef.current()
      if (root && (top || bottom || left || right)) {
        // Page content beside the root too (a portal's modal on <body>).
        const base = root === document.body ? root : document.body
        for (const el of Array.from(base.querySelectorAll<HTMLElement>('*'))) {
          if (el.closest('[data-chef-editor-root="true"]')) continue
          if (base !== root && !isInPageScope(el, root)) continue
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
            let dx = 0
            let dy = 0
            if (top && rect.top < top) dy = top
            else if (bottom && rect.bottom > window.innerHeight - bottom) dy = -bottom
            const underLeft = left > 0 && rect.left < left
            const underRight = right > 0 && rect.right > window.innerWidth - right
            if (underLeft && underRight) {
              // A full-width bar (cookie banner, backdrop): narrow it to the canvas.
              rules.push(`${sel}{left:${left}px!important;right:auto!important;width:${window.innerWidth - left - right}px!important;max-width:none!important}`)
            } else if (underLeft) dx = left
            else if (underRight) dx = -right
            if (dx || dy) rules.push(`${sel}{translate:${dx}px ${dy}px!important}`)
          }
        }
      }
      rules.unshift(`html[data-chef-editing]{padding:${top}px ${right}px ${bottom}px ${left}px!important;scroll-padding-top:${top}px}`)
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
    // Panels opening, closing and resizing change the canvas cell's size.
    const canvasCell = document.querySelector(CANVAS_SELECTOR)
    if (canvasCell) resize.observe(canvasCell)
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
