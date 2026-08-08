import { useEffect, useMemo, useRef, useState } from 'react'
import {
  configureFroamStudio,
  getFroamRootElement,
  getFroamStudioConfig,
  type FroamStudioConfig,
} from '../config'
import { apiGetFresh } from '../lib/api'
import FroamReview from './FroamReview'
import { readRoomFromLocation } from '../collab/room'
import { collectStoreFontFamilies, ensureFontLinks } from './fontSources'
import { normalizeFroamRouteKey, useFroamRouteKey } from '../routing'
import { isFroamPersonaPath } from './froamPersona'

type ElementDraft = {
  text?: string
  imageUrl?: string
  styles?: Record<string, string>
}

type ViewportMode = 'desktop' | 'tablet' | 'mobile'

type RuntimeSnapshot = {
  element: HTMLElement
  text?: string
  imageSrc?: string | null
  styles: Record<string, string>
}

type FroamPublishedResponse = {
  success: boolean
  design?: {
    routeKey: string
    viewportMode: ViewportMode
    store: Record<string, ElementDraft>
    publishedAt?: string | null
    updatedAt?: string | null
  } | null
}

const CANVAS_KEY = '__froam_canvas__'
const INJECTION_KEY = '__froam_injection__'
const ROOT_PARENT_KEY = '__froam_root__'
const DEFAULT_RUNTIME_ROUTES: readonly string[] | '*' = '*'
/**
 * How often a follower re-asks for the design during a session.
 *
 * Fast enough that a change lands while the designer is still talking about
 * it, slow enough to be unremarkable on a phone connection. Only runs when
 * the page is actually a session.
 */
const LIVE_POLL_MS = 4_000

export type FroamLocalDesign = {
  version: number
  updatedAt?: string | null
  routes: Record<string, Partial<Record<ViewportMode, Record<string, ElementDraft>>>>
}

export type FroamRuntimeProps = Pick<FroamStudioConfig, 'apiBaseUrl' | 'fetch' | 'rootSelector'> & {
  enabled?: boolean
  routeKey?: string
  routes?: readonly string[] | '*'
  /**
   * Repo Mode: a committed froam.design.json (see froam-studio/vite).
   * Routes present here are applied locally — no API fetch, ships with
   * the build. Routes absent fall back to the published API when
   * apiBaseUrl is configured.
   */
  design?: FroamLocalDesign | null
  /**
   * Who wins when a route is both committed and published.
   *
   * `'repo'` (default) keeps Froam's promise of no runtime API dependency:
   * a committed route is applied from the bundle and the API is never called.
   * The cost is that publishing to a route you have already committed does
   * nothing visible, with no feedback — publish silently loses.
   *
   * `'newest'` compares the publish time against the committed design's
   * `updatedAt` and applies whichever is more recent, falling back to the
   * committed design if the request fails. Costs one small GET per route.
   * Use it when people publish from devices that can't reach a repo.
   */
  prefer?: 'repo' | 'newest'
}

function getRuntimeViewportMode(): ViewportMode {
  if (typeof window === 'undefined') return 'desktop'
  if (window.matchMedia('(max-width: 640px)').matches) return 'mobile'
  if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet'
  return 'desktop'
}

function getRoot(): HTMLElement | null {
  return getFroamRootElement()
}

function routeMatches(routeKey: string, routes: readonly string[] | '*') {
  return routes === '*' || routes.includes(routeKey)
}

function getCanvasHost() {
  const root = getRoot()
  return root?.querySelector<HTMLElement>('[data-froam-canvas]') ?? null
}

function isSafeDraftPath(path: string) {
  return path.trim().length > 0 && path.includes(':')
}

function isInjectionPath(path: string) {
  return path.startsWith(`${INJECTION_KEY}:`)
}

function camelToKebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function findElementByPath(root: HTMLElement, path: string): HTMLElement | null {
  if (!isSafeDraftPath(path)) return null
  const segments = path.split('/').filter(Boolean)
  let current: HTMLElement | null = root

  for (const segment of segments) {
    const [tag, indexRaw] = segment.split(':')
    const index = Number(indexRaw) - 1
    if (!tag || Number.isNaN(index) || index < 0) return null
    const siblings: HTMLElement[] = Array.from(current.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === tag,
    )
    current = siblings[index] ?? null
    if (!current) return null
  }

  return current
}

function canApplyTextDraft(element: HTMLElement) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return false
  if (element.children.length === 0) return true
  const tag = element.tagName.toLowerCase()
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'b', 'i', 'label', 'button', 'a', 'li'].includes(tag)
}

function applyDraft(element: HTMLElement, draft: ElementDraft) {
  if (draft.text !== undefined && canApplyTextDraft(element) && element.innerText !== draft.text) {
    element.innerText = draft.text
  }

  if (element instanceof HTMLImageElement && draft.imageUrl !== undefined) {
    if (draft.imageUrl && element.getAttribute('src') !== draft.imageUrl) element.src = draft.imageUrl
    if (!draft.imageUrl && element.hasAttribute('src')) element.removeAttribute('src')
  }

  if (!draft.styles) return

  for (const [key, value] of Object.entries(draft.styles)) {
    const cssKey = camelToKebab(key)
    if (element.style.getPropertyValue(cssKey) === value) continue
    if (value) element.style.setProperty(cssKey, value)
    else element.style.removeProperty(cssKey)
  }
}

function restoreRuntimeSnapshots(snapshots: RuntimeSnapshot[]) {
  for (const snapshot of snapshots.slice().reverse()) {
    const { element } = snapshot

    if (snapshot.text !== undefined && canApplyTextDraft(element) && element.innerText !== snapshot.text) {
      element.innerText = snapshot.text
    }

    if (snapshot.imageSrc !== undefined && element instanceof HTMLImageElement) {
      if (snapshot.imageSrc) element.src = snapshot.imageSrc
      else element.removeAttribute('src')
    }

    for (const [cssKey, value] of Object.entries(snapshot.styles)) {
      if (value) element.style.setProperty(cssKey, value)
      else element.style.removeProperty(cssKey)
    }
  }
}

function snapshotDraftTarget(element: HTMLElement, draft: ElementDraft, snapshots: RuntimeSnapshot[]) {
  const snapshot: RuntimeSnapshot = { element, styles: {} }

  if (draft.text !== undefined && canApplyTextDraft(element)) {
    snapshot.text = element.innerText
  }

  if (element instanceof HTMLImageElement && draft.imageUrl !== undefined) {
    snapshot.imageSrc = element.getAttribute('src')
  }

  for (const key of Object.keys(draft.styles ?? {})) {
    const cssKey = camelToKebab(key)
    snapshot.styles[cssKey] = element.style.getPropertyValue(cssKey)
  }

  if (snapshot.text !== undefined || snapshot.imageSrc !== undefined || Object.keys(snapshot.styles).length > 0) {
    snapshots.push(snapshot)
  }

  applyDraft(element, draft)
}

function applyCanvasDraftStyles(styles: Record<string, string> | undefined, snapshots: RuntimeSnapshot[]) {
  if (!styles) return
  const host = getCanvasHost()
  if (!host) return

  const snapshot: RuntimeSnapshot = { element: host, styles: {} }
  for (const [key, value] of Object.entries(styles)) {
    if (key === 'customCSS') continue
    const cssKey = camelToKebab(key)
    snapshot.styles[cssKey] = host.style.getPropertyValue(cssKey)
    if (host.style.getPropertyValue(cssKey) === value) continue
    if (value) host.style.setProperty(cssKey, value)
    else host.style.removeProperty(cssKey)
  }

  // Inject custom global CSS at runtime too!
  let styleEl = document.getElementById('froam-global-styles') as HTMLStyleElement | null
  if (styles.customCSS) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'froam-global-styles'
      document.head.appendChild(styleEl)
    }
    if (styleEl.textContent !== styles.customCSS) {
      styleEl.textContent = styles.customCSS
    }
  } else if (styleEl) {
    styleEl.textContent = ''
  }

  if (Object.keys(snapshot.styles).length > 0) {
    snapshots.push(snapshot)
  }
}

function readInjectionDraft(draft: ElementDraft) {
  if (!draft.text) return null
  try {
    const parsed = JSON.parse(draft.text) as {
      html?: unknown
      parentPath?: unknown
      order?: unknown
    }
    if (typeof parsed.html !== 'string') return null
    if (typeof parsed.parentPath !== 'string') return null
    return {
      html: parsed.html,
      parentPath: parsed.parentPath,
      order: typeof parsed.order === 'number' ? parsed.order : 0,
    }
  } catch {
    return null
  }
}

function removeRuntimeInjectedBlocks() {
  const root = getRoot()
  if (!root) return
  root.querySelectorAll<HTMLElement>('[data-froam-runtime-injected="true"]').forEach((element) => {
    element.remove()
  })
}

function restoreInjectedBlocks(store: Record<string, ElementDraft>) {
  const root = getRoot()
  if (!root) return

  Object.entries(store)
    .filter(([path]) => isInjectionPath(path))
    .map(([, draft]) => readInjectionDraft(draft))
    .filter((draft): draft is NonNullable<ReturnType<typeof readInjectionDraft>> => draft !== null)
    .sort((a, b) => a.order - b.order)
    .forEach((injection) => {
      const parent = injection.parentPath === ROOT_PARENT_KEY
        ? root
        : findElementByPath(root, injection.parentPath)
      if (!parent) return

      const template = document.createElement('template')
      template.innerHTML = injection.html.trim()
      const node = template.content.firstElementChild
      if (!(node instanceof HTMLElement)) return
      node.setAttribute('data-froam-runtime-injected', 'true')
      node.removeAttribute('data-chef-selected')
      node.removeAttribute('data-chef-hovered')
      parent.appendChild(node)
    })
}

function applyFroamStore(store: Record<string, ElementDraft>, snapshots: RuntimeSnapshot[]) {
  if (document.documentElement.hasAttribute('data-chef-editing')) return
  const root = getRoot()
  if (!root) return

  removeRuntimeInjectedBlocks()
  restoreInjectedBlocks(store)

  for (const [path, draft] of Object.entries(store)) {
    if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path)) continue
    const target = findElementByPath(root, path)
    if (target) snapshotDraftTarget(target, draft, snapshots)
  }

  applyCanvasDraftStyles(store[CANVAS_KEY]?.styles, snapshots)
}

export default function FroamRuntime({
  apiBaseUrl,
  design = null,
  enabled = true,
  fetch,
  rootSelector,
  routeKey: explicitRouteKey,
  routes,
  prefer = 'repo',
}: FroamRuntimeProps) {
  const routeKey = useFroamRouteKey(explicitRouteKey)
  const runtimeRoutes = routes ?? getFroamStudioConfig().runtimeRoutes ?? DEFAULT_RUNTIME_ROUTES
  const isRuntimeRoute = enabled && routeMatches(routeKey, runtimeRoutes)
  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => getRuntimeViewportMode())
  const [publishedStore, setPublishedStore] = useState<Record<string, ElementDraft> | null>(null)
  // Fixed for the life of the page: an invite in the URL is what makes this a
  // session, and nothing else should start a poll loop.
  const inSession = useMemo(() => readRoomFromLocation() !== null, [])
  const appliedSnapshotsRef = useRef<RuntimeSnapshot[]>([])

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ routeKey, viewportMode })
    return `/api/froam/published?${params.toString()}`
  }, [routeKey, viewportMode])

  useEffect(() => {
    configureFroamStudio({
      apiBaseUrl,
      enabled,
      fetch,
      rootSelector,
      runtimeRoutes,
    })
  }, [apiBaseUrl, enabled, fetch, rootSelector, runtimeRoutes])

  useEffect(() => {
    let frame = 0

    function handleResize() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setViewportMode(getRuntimeViewportMode()))
    }

    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isRuntimeRoute || typeof document === 'undefined') return
    document.documentElement.setAttribute('data-froam-route', routeKey)
    return () => {
      document.documentElement.removeAttribute('data-froam-route')
    }
  }, [isRuntimeRoute, routeKey])

  useEffect(() => {
    if (!isRuntimeRoute) {
      setPublishedStore(null)
      restoreRuntimeSnapshots(appliedSnapshotsRef.current)
      appliedSnapshotsRef.current = []
      removeRuntimeInjectedBlocks()
      return
    }

    // Repo Mode: a committed local design wins over the published API.
    // Legacy designs may store keys with trailing slashes — match on the
    // normalized form so a slash never hides a shipped design.
    const localRoute = design?.routes?.[routeKey]
      ?? Object.entries(design?.routes ?? {}).find(([key]) => normalizeFroamRouteKey(key) === routeKey)?.[1]
    const hasCommitted = !!localRoute && Object.prototype.hasOwnProperty.call(localRoute, viewportMode)
    const committedStore = hasCommitted ? (localRoute?.[viewportMode] ?? null) : null

    if (hasCommitted && prefer === 'repo') {
      setPublishedStore(committedStore)
      return
    }

    let cancelled = false

    async function loadPublished() {
      try {
        const response = await apiGetFresh<FroamPublishedResponse>(endpoint)
        if (cancelled) return
        const published = response.design?.store ?? null

        if (!hasCommitted) {
          setPublishedStore(published)
          return
        }

        // prefer === 'newest': a design published after the last commit is
        // what someone most recently meant to ship. Without this, publishing
        // to an already-committed route does nothing and says nothing — which
        // reads as "saving is broken" to whoever pressed the button.
        const publishedAt = Date.parse(response.design?.publishedAt ?? response.design?.updatedAt ?? '') || 0
        const committedAt = Date.parse(design?.updatedAt ?? '') || 0
        setPublishedStore(published && publishedAt > committedAt ? published : committedStore)
      } catch {
        // Offline, or no publish backend at all: the committed design still
        // ships, which is the whole point of Repo Mode.
        if (!cancelled) setPublishedStore(committedStore)
      }
    }

    void loadPublished()

    const receiveLivePublish = (event: Event) => {
      const detail = (event as CustomEvent<{ routeKey?: string; viewport?: ViewportMode }>).detail
      if (detail?.routeKey === routeKey && detail.viewport === viewportMode && !document.hidden) void loadPublished()
    }
    window.addEventListener('froam:design-published', receiveLivePublish)

    /**
     * In a session, keep asking.
     *
     * The presenter publishes as they work, so the client's page has to notice
     * without them refreshing — that is the whole "watch me change it" of a
     * review call. Polling rather than a socket because the same code has to
     * run on the dev bridge and on serverless, where nothing holds a
     * connection open.
     *
     * Only while the tab is visible: a buried tab repainting a design nobody
     * is looking at is just cost.
     */
    let poll = 0
    if (inSession) {
      poll = window.setInterval(() => {
        if (!document.hidden) void loadPublished()
      }, LIVE_POLL_MS)
    }

    return () => {
      cancelled = true
      if (poll) window.clearInterval(poll)
      window.removeEventListener('froam:design-published', receiveLivePublish)
    }
  }, [design, endpoint, inSession, isRuntimeRoute, prefer, routeKey, viewportMode])

  /* Fonts the design references must actually load with it. */
  useEffect(() => {
    if (!isRuntimeRoute || !publishedStore) return
    ensureFontLinks(collectStoreFontFamilies(publishedStore))
  }, [publishedStore, isRuntimeRoute])

  useEffect(() => {
    const root = getRoot()
    restoreRuntimeSnapshots(appliedSnapshotsRef.current)
    appliedSnapshotsRef.current = []
    removeRuntimeInjectedBlocks()
    if (!isRuntimeRoute || !publishedStore || !root) return
    const storeToPaint = publishedStore

    function paint() {
      try {
        restoreRuntimeSnapshots(appliedSnapshotsRef.current)
        removeRuntimeInjectedBlocks()
        const snapshots: RuntimeSnapshot[] = []
        applyFroamStore(storeToPaint, snapshots)
        appliedSnapshotsRef.current = snapshots
      } catch {
        // DOM may be mid-render — safe to skip this paint frame
      }
    }

    paint()

    let paintFrame = 0
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(paintFrame)
      paintFrame = requestAnimationFrame(paint)
    })

    observer.observe(root, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(paintFrame)
      observer.disconnect()
      restoreRuntimeSnapshots(appliedSnapshotsRef.current)
      removeRuntimeInjectedBlocks()
      appliedSnapshotsRef.current = []
    }
  }, [publishedStore, isRuntimeRoute])

  // The runtime paints a design and otherwise renders nothing. A review
  // session is the one exception: the client has no editor, so this is the
  // only Froam surface they will ever see.
  if (!isRuntimeRoute) return null
  return <FroamReview routeKey={routeKey} viewport={viewportMode} />
}
