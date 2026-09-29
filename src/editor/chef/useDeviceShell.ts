import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { isFroamPersonaPath } from '../froamPersona'
import { findElementByPath, isFroamOwnedNode, STAGE_ATTR } from '../../collab/paths'
import { getRoot } from './dom'
import { applyCanvasDraftStyles, applyDraft, clearCanvasDraftStyles, isInjectionPath } from './drafts'
import { emulateViewport, restoreViewport } from './viewport-emulation'
import type { DeviceFrame, DeviceSize } from './device-sizes'
import {
  CANVAS_KEY,
  DEVICE_SHELL_ID,
  type EditorStore,
  type SelectionState,
  type ViewportMode,
} from './types'

type Ref<T> = { current: T }
type Setter<T> = Dispatch<SetStateAction<T>>

export type UseDeviceShellOptions = {
  routeKey: string
  store: EditorStore
  viewportMode: ViewportMode
  /** The screen to preview; null on desktop. */
  deviceSize: DeviceSize | null
  zoom: number
  currentSelectionRef: Ref<HTMLElement | null>
  setPanelPosition: Setter<{ x: number; y: number } | null>
  setSelection: Setter<SelectionState | null>
  onFrame?: (frame: DeviceFrame | null) => void
}

const CANVAS_SELECTOR = '#froam-editor-portal .froam-figma-layout__canvas'
const CHROME_SELECTOR = '#froam-editor-portal .froam-chrome'
/** Room under the frame for its size bar. */
const BAR_SPACE = 52
const MARGIN = 24
const NOT_PAGE = ['SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'STYLE', 'LINK']

const ROOT_PROPS = ['width', 'min-height', 'height', 'overflow-y', 'overflow-x', 'position', 'left', 'top', 'z-index', 'border-radius', 'box-shadow', 'background', 'transform', 'transform-origin', 'max-width', 'margin-inline', 'margin-left', 'margin-right', 'margin-top', 'margin', 'isolation', 'overscroll-behavior']
const BODY_PROPS = ['overflow', 'background', 'display', 'align-items', 'justify-content', 'min-height']

function clearInline(element: HTMLElement, props: string[]) {
  for (const prop of props) element.style.removeProperty(prop)
}

/** The page's own background, so the phone screen isn't the editor's backdrop colour. */
function pageBackground() {
  for (const el of [document.body, document.documentElement]) {
    const bg = window.getComputedStyle(el).backgroundColor
    if (bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) return bg
  }
  return '#ffffff'
}

/** Whether a colour is dark enough to want light status-bar text. */
function isDark(color: string) {
  const [r = 255, g = 255, b = 255] = (color.match(/[\d.]+/g) ?? []).map(Number)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140
}

/** React draws this node itself (not just its contents): it must not be moved. */
function reactOwns(element: Element) {
  return Object.keys(element).some((key) => key.startsWith('__reactFiber$') || key.startsWith('__reactProps$'))
}

/** A node React put on <body> (a portal) or renders into: moving it would make React throw later. */
function reactManaged(node: Node) {
  return Object.keys(node).some((key) => key.startsWith('__reactFiber$') || key.startsWith('__reactContainer$') || key === '_reactRootContainer')
}

/** Page content on <body> that can go on the screen. */
function movable(node: Element) {
  return !isFroamOwnedNode(node) && !node.hasAttribute(STAGE_ATTR) && !NOT_PAGE.includes(node.tagName) && !reactManaged(node)
}

/**
 * Where the preview can go: the canvas — between the top bar and whatever
 * panels are open — so opening a panel never hides part of the phone.
 */
function canvasBox() {
  const cell = document.querySelector<HTMLElement>(CANVAS_SELECTOR)?.getBoundingClientRect()
  if (cell && cell.width > 120 && cell.height > 120) return { left: cell.left, top: cell.top, width: cell.width, height: cell.height }
  const top = document.querySelector<HTMLElement>(CHROME_SELECTOR)?.getBoundingClientRect().bottom ?? 0
  return { left: 0, top, width: window.innerWidth, height: window.innerHeight - top }
}

/**
 * Tablet and phone preview. The page is put on a device-sized screen, scaled
 * to fit the canvas, and — the part that matters — told it's on that device:
 * its media queries, viewport units and matchMedia() answer for the device
 * (viewport-emulation.ts), so a responsive site shows its real phone layout.
 *
 * The screen is a frame with a scroller inside it: sticky headers stick to the
 * top of the phone, fixed bars stay put while the page scrolls, the way they
 * do on the device. On a plain page the whole of <body> goes on the screen —
 * header and footer too; an app mounted in #root puts #root there; a document
 * React draws itself (Next's app router) is framed where it stands, since
 * moving React's nodes would break it. Desktop puts everything back.
 */
export function useDeviceShell({ routeKey, store, viewportMode, deviceSize, zoom, currentSelectionRef, setPanelPosition, setSelection, onFrame }: UseDeviceShellOptions) {
  const prevViewportRef = useRef<ViewportMode>('desktop')
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame
  useEffect(() => {
    const appRoot = getRoot()
    if (!appRoot) return

    // Strip previous viewport's drafted styles
    const prevKey = `${routeKey}@@${prevViewportRef.current}`
    const prevDrafts = store[prevKey] ?? {}
    Object.keys(prevDrafts).forEach((path) => {
      if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path)) return
      const el = findElementByPath(appRoot, path)
      if (el) el.removeAttribute('style')
    })
    if (prevDrafts[CANVAS_KEY]) clearCanvasDraftStyles()

    document.getElementById(DEVICE_SHELL_ID)?.remove()
    clearInline(appRoot, ROOT_PROPS)
    clearInline(document.body, BODY_PROPS)

    prevViewportRef.current = viewportMode
    setPanelPosition(null)

    const paint = () => {
      const drafts = store[`${routeKey}@@${viewportMode}`] ?? {}
      Object.entries(drafts).forEach(([path, draft]) => {
        if (path === CANVAS_KEY || isFroamPersonaPath(path)) return
        const el = findElementByPath(appRoot, path)
        if (el) applyDraft(el, draft)
      })
      const cd = drafts[CANVAS_KEY]
      applyCanvasDraftStyles(cd?.styles?.backgroundColor, cd?.styles?.color, cd?.styles)
      currentSelectionRef.current?.removeAttribute('data-chef-selected')
      currentSelectionRef.current = null
      setSelection(null)
    }

    if (viewportMode === 'desktop' || !deviceSize) {
      restoreViewport()
      onFrameRef.current?.(null)
      paint()
      // Desktop stays true to the page. Froam controls float above it instead of
      // pushing the canvas into a dark editor workbench.
      appRoot.style.minHeight = '100vh'
      appRoot.style.transformOrigin = 'top left'
      appRoot.style.transform = zoom !== 1 ? `scale(${zoom})` : ''
      return
    }

    const kind = viewportMode === 'mobile' ? 'mobile' : 'tablet'
    const deviceW = deviceSize.width
    const deviceH = deviceSize.height
    const radius = kind === 'mobile' ? 40 : 22
    const background = pageBackground()
    const body = document.body
    const inPlace = appRoot !== body && (reactOwns(appRoot) || reactOwns(body))

    // The screen: a frame (fixed, scaled — the containing block for the page's
    // fixed elements) with a scroller inside (sticky sticks to its top).
    const stage = document.createElement('div')
    const scroller = document.createElement('div')
    let adopt: MutationObserver | null = null
    let screen: HTMLElement
    if (inPlace) {
      screen = appRoot
      appRoot.style.overflowY = 'auto'
      appRoot.style.overflowX = 'hidden'
      appRoot.style.overscrollBehavior = 'contain'
      appRoot.style.background = background
      appRoot.style.isolation = 'isolate'
    } else {
      stage.setAttribute(STAGE_ATTR, 'frame')
      scroller.setAttribute(STAGE_ATTR, 'scroll')
      stage.style.cssText = `position:fixed;overflow:hidden;z-index:1045;isolation:isolate;transform-origin:0 0;background:${background}`
      scroller.style.cssText = `position:absolute;inset:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;background:${background}`
      stage.appendChild(scroller)
      // An app's own root (or the page wrapper the standalone editor makes) holds
      // everything; a root that's just <main> leaves the header and footer
      // beside it on <body>, so the whole page goes on the screen.
      const container = /^(root|__next)$/.test(appRoot.id) || appRoot.getAttribute('data-froam-root') === 'page'
      const whole = appRoot === body || !container
      const pageNodes = whole ? Array.from(body.children).filter(movable) : [appRoot]
      body.insertBefore(stage, pageNodes[0] ?? null)
      for (const node of pageNodes) scroller.appendChild(node)
      screen = stage
      if (whole) {
        // A plain page that adds something to <body> later (a modal, a banner)
        // shows it on the phone too.
        adopt = new MutationObserver((records) => {
          for (const record of records) for (const node of Array.from(record.addedNodes)) {
            if (node instanceof HTMLElement && node.parentElement === body && movable(node)) scroller.appendChild(node)
          }
        })
        adopt.observe(body, { childList: true })
      }
    }

    const theme = document.getElementById('froam-editor-portal')?.dataset.froamUiTheme
    body.style.overflow = 'hidden'
    body.style.background = theme === 'light' ? '#e7e9ed' : '#0b0c0f'

    // The device, in the page's eyes.
    emulateViewport({ width: deviceW, height: deviceH, touch: true })

    const bezel = document.createElement('div')
    bezel.id = DEVICE_SHELL_ID
    bezel.setAttribute('data-chef-editor-root', 'true')
    bezel.setAttribute('aria-hidden', 'true')
    body.appendChild(bezel)
    // A phone's status bar, above the page the way Safari has it — the page's
    // viewport starts below it, so nothing of the page hides under the island.
    const statusUnits = kind === 'mobile' ? (deviceSize.island ? 47 : 20) : 0
    const status = document.createElement('div')
    if (statusUnits) {
      status.className = `froam-device-status${isDark(background) ? ' is-dark' : ''}`
      status.style.background = background
      status.innerHTML = '<span class="froam-device-status__time">9:41</span>'
        + (deviceSize.island ? '<span class="froam-device-island"></span>' : '')
        + '<span class="froam-device-status__icons"><i class="is-signal"></i><i class="is-battery"></i></span>'
      bezel.appendChild(status)
    }

    let frame = 0
    const layout = () => {
      frame = 0
      const box = canvasBox()
      const scale = Math.max(0.2, Math.min((box.width - MARGIN * 2) / deviceW, (box.height - MARGIN * 2 - BAR_SPACE) / (deviceH + statusUnits), 1))
      const width = deviceW * scale
      const height = deviceH * scale
      const statusPx = statusUnits * scale
      const outer = height + statusPx
      const left = Math.round(box.left + (box.width - width) / 2)
      const top = Math.round(box.top + MARGIN + Math.max(0, (box.height - MARGIN * 2 - BAR_SPACE - outer) / 2))
      Object.assign(screen.style, {
        position: 'fixed', left: `${left}px`, top: `${top + statusPx}px`, width: `${deviceW}px`, height: `${deviceH}px`,
        minHeight: `${deviceH}px`, maxWidth: 'none', margin: '0', zIndex: '1045',
        transformOrigin: 'top left', transform: `scale(${scale})`, borderRadius: statusUnits ? `0 0 ${radius}px ${radius}px` : `${radius}px`,
      })
      if (statusUnits) {
        status.style.height = `${statusPx}px`
        status.style.borderRadius = `${radius * scale}px ${radius * scale}px 0 0`
        status.style.setProperty('--froam-device-scale', String(scale))
      }
      const pad = kind === 'mobile' ? 10 : 12
      bezel.className = `froam-device-bezel is-${kind}`
      bezel.style.left = `${left - pad}px`
      bezel.style.top = `${top - pad}px`
      bezel.style.width = `${width + pad * 2}px`
      bezel.style.height = `${outer + pad * 2}px`
      bezel.style.borderRadius = `${Math.round(radius * scale + pad)}px`
      bezel.style.setProperty('--froam-device-pad', `${pad}px`)
      bezel.style.setProperty('--froam-device-scale', String(scale))
      onFrameRef.current?.({ kind, size: deviceSize, scale, left, top, width, height: outer })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(layout) }
    layout()
    const resize = new ResizeObserver(schedule)
    const cell = document.querySelector(CANVAS_SELECTOR)
    if (cell) resize.observe(cell)
    window.addEventListener('resize', schedule)

    paint()

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      window.removeEventListener('resize', schedule)
      adopt?.disconnect()
      restoreViewport()
      bezel.remove()
      if (inPlace) clearInline(appRoot, ROOT_PROPS)
      else {
        // Back where they were, in order.
        for (const node of Array.from(scroller.childNodes)) body.insertBefore(node, stage)
        stage.remove()
      }
      clearInline(body, BODY_PROPS)
      onFrameRef.current?.(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportMode, routeKey, zoom, deviceSize?.id])

  return prevViewportRef
}
