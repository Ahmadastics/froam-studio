/**
 * Froam Studio v3 — standalone entry.
 *
 * Bundled (React included) into dist/standalone/froam-editor.js by
 * scripts/build-standalone.mjs and served by the `froam dev` bridge.
 * One script tag mounts the full editor + runtime on ANY page:
 *
 *   <script src="http://localhost:4600/froam.js" defer></script>
 *
 * The bridge origin is derived from the script's own src, so the repo
 * Save/Load/Status endpoints work whether the page is proxied through
 * the bridge, served by it, or served by a completely different dev
 * server on another port.
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { configureFroamStudio } from './config'
import FroamGate from './editor/FroamGate'
import FroamRuntime, { type FroamLocalDesign } from './editor/FroamRuntime'
import './froam-studio.css'
import './gate-css.css'

const HOST_ID = 'froam-standalone-host'

type BridgeWindow = Window & {
  __FROAM_BRIDGE_ORIGIN__?: string
  __FROAM_STANDALONE_MOUNTED__?: boolean
}

type BridgeConfig = {
  success?: boolean
  projectKey?: string
}

type BootConfig = { origin: string; open: boolean; routes: string; projectKey: string | null }

function resolveScriptConfig() {
  // Loaded as a module by /froam.js (scripts/build-standalone.mjs): the loader
  // read the script tag, because a module has no document.currentScript.
  const boot = (window as Window & { __FROAM_BOOT__?: BootConfig }).__FROAM_BOOT__
  if (boot?.origin) return { origin: boot.origin, initialOpen: boot.open, routes: boot.routes, projectKey: boot.projectKey }
  const script = document.currentScript as HTMLScriptElement | null
  let origin = window.location.origin
  try {
    if (script?.src) origin = new URL(script.src).origin
  } catch {
    /* keep page origin */
  }
  return {
    origin,
    initialOpen: script?.dataset.open === 'true',
    routes: script?.dataset.routes ?? '*',
    projectKey: script?.dataset.froamProject ?? null,
  }
}

type RootScope = 'page' | 'auto'

function designHasDrafts(design: FroamLocalDesign | null | undefined) {
  const routes = (design as { routes?: Record<string, Record<string, Record<string, unknown> | undefined>> } | null)?.routes ?? {}
  return Object.values(routes).some((viewports) => Object.values(viewports ?? {}).some((store) => store && Object.keys(store).length > 0))
}

/**
 * Which element paths are relative to (lib/codegen.mjs designRootScope).
 * A design that already has edits keeps the scope it was made in — its
 * paths depend on it. A fresh design on a plain page edits the whole page:
 * 'auto' would pick <main> and leave the header and footer unreachable.
 * App roots (#root, #__next) keep their own root.
 */
function chooseRootScope(design: FroamLocalDesign | null | undefined): RootScope {
  if ((design as { rootScope?: string } | null)?.rootScope === 'page') return 'page'
  if (designHasDrafts(design)) return 'auto'
  if (document.querySelector('[data-froam-root], #root, #__next')) return 'auto'
  return 'page'
}

function isFroamOwned(el: Element, wrapper: Element) {
  return el === wrapper
    || el.id === HOST_ID
    || el.id.startsWith('froam-')
    || el.hasAttribute('data-chef-editor-root')
    // The phone/tablet preview's frame holds the page; it is never inside it.
    || el.hasAttribute('data-froam-stage')
    || ['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT'].includes(el.tagName)
}

/**
 * A node React owns. React removes a portal's children from the container it
 * rendered them into (`createPortal(…, document.body)` → `body.removeChild`),
 * which throws once the node has been moved — so those are never adopted.
 */
function isReactManaged(node: Node) {
  return Object.keys(node).some((key) => key.startsWith('__reactFiber$') || key.startsWith('__reactContainer$') || key === '_reactRootContainer')
}

/**
 * The editor frames and re-parents the root for device simulation, which
 * <body> itself cannot survive — so the page content is wrapped in a root
 * div that mirrors <body> (same children, same order: the paths match what
 * the production runtime resolves from <body>). `data-froam-root="page"`
 * says so: nothing outside it is page content (see isInPageScope).
 */
function wrapBodyAsRoot(adoptLateNodes: boolean) {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-froam-root', 'page')
  // Froam's own host is already in <body> by now; it stays out of the page.
  for (const node of Array.from(document.body.childNodes)) {
    if (node instanceof Element && isFroamOwned(node, wrapper)) continue
    wrapper.appendChild(node)
  }
  document.body.prepend(wrapper)
  if (!adoptLateNodes) return
  // Modals, banners and portals a page appends to <body> after load are part
  // of the page: keep them inside the root so they're editable too (and in
  // the same order the production runtime sees them).
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement && node.parentElement === document.body && !isFroamOwned(node, wrapper) && !isReactManaged(node)) {
          wrapper.appendChild(node)
        }
      })
    }
  }).observe(document.body, { childList: true })
}

type HydratingWindow = Window & { __next_f?: unknown; __remixContext?: unknown; __reactRouterContext?: unknown }

/**
 * Whether the app renders <body> itself and hydrates it (Next's App Router,
 * Remix, React Router). React owns <body>'s children then. Wrapping them makes
 * hydration fail, and React's next `body.removeChild(child)` throws "The node
 * to be removed is not a child of this node", because the child has moved.
 */
function appOwnsBody() {
  const win = window as HydratingWindow
  return Boolean(win.__next_f || win.__remixContext || win.__reactRouterContext) || isReactManaged(document)
}

/**
 * Resolves once React has hydrated the server's markup. Any change to it
 * before then (even an attribute on <html>) is a hydration mismatch.
 */
function whenAppHydrated() {
  return new Promise<void>((resolve) => {
    if (!appOwnsBody()) return resolve()
    const started = Date.now()
    const check = () => {
      const claimed = Array.from(document.body.children).some((node) => node.id !== HOST_ID && isReactManaged(node))
      // React hydrates in slices; a frame and an idle moment let the pass commit.
      if (claimed || Date.now() - started > 10_000) {
        requestAnimationFrame(() => {
          const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback
          if (idle) idle(() => resolve(), { timeout: 500 })
          else window.setTimeout(resolve, 50)
        })
      } else window.setTimeout(check, 50)
    }
    check()
  })
}

/**
 * A page that rebuilds <body> after load takes Froam's nodes with it: React
 * recovering from a hydration error renders the document again from scratch
 * (linear.app), and the Froam button vanished with nothing to bring it back.
 * The host and the editor's portal are put back wherever they're dropped.
 */
function keepOnPage(host: HTMLElement) {
  let portal: HTMLElement | null = null
  let watched: HTMLElement | null = null
  const restore = () => {
    portal ??= document.getElementById('froam-editor-portal')
    const body = document.body
    if (!body) return
    for (const node of [host, portal]) if (node && !node.isConnected) body.appendChild(node)
    if (watched !== body) {
      // A replaced <body> is a new node to watch.
      observer.disconnect()
      observer.observe(body, { childList: true })
      observer.observe(document.documentElement, { childList: true })
      watched = body
    }
  }
  const observer = new MutationObserver(restore)
  restore()
}

/** The root when the app owns <body>: <body> itself, the same element the production runtime counts paths from. */
const selectBody = () => document.body

/** Marks the editable root. Returns true when it is <body> itself, which nothing marks. */
function markFroamRoot(scope: RootScope) {
  if (document.querySelector('[data-froam-root]')) return false
  const ownedBody = appOwnsBody()
  if (scope === 'page') {
    // The wrapper mirrors <body>, so <body> as the root gives the same paths
    // without moving React's nodes.
    if (ownedBody) return true
    wrapBodyAsRoot(true)
    return false
  }
  if (document.getElementById('root') || document.getElementById('__next')) return false
  const main = document.querySelector<HTMLElement>('main')
  if (main) {
    main.setAttribute('data-froam-root', '')
    return false
  }
  if (ownedBody) return true
  wrapBodyAsRoot(false)
  return false
}

function injectEditorStyles(origin: string) {
  const href = `${origin}/froam.css`
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

/** How long the editor waits for the bridge before opening anyway. */
const BRIDGE_PATIENCE_MS = 3_500

function StandaloneApp({ origin, initialOpen, initialProjectKey }: { origin: string; initialOpen: boolean; initialProjectKey: string | null }) {
  const [design, setDesign] = useState<FroamLocalDesign | null>(null)
  const [projectKey, setProjectKey] = useState<string | null>(initialProjectKey)
  const [loaded, setLoaded] = useState(false)
  const [rootScope, setRootScope] = useState<RootScope>('auto')
  const [bodyRoot, setBodyRoot] = useState(false)

  useEffect(() => {
    let cancelled = false
    let marked = false
    const mark = (scope: RootScope) => {
      marked = true
      const isBody = markFroamRoot(scope)
      // Set before anything renders: FroamRuntime resolves the root on its
      // first pass, ahead of FroamGate's own configure.
      if (isBody) configureFroamStudio({ rootSelector: selectBody })
      setBodyRoot(isBody)
      setRootScope(scope)
    }
    const markFresh = () => {
      // Nothing saved known yet: mark as a fresh design would.
      if (!marked && !document.querySelector('[data-froam-root]')) mark(chooseRootScope(null))
    }
    // The editor never waits long on the bridge: through a share link it sits
    // on someone else's computer, and a slow answer must not hide the editor.
    // The saved design still applies the moment it arrives.
    const patience = window.setTimeout(() => {
      if (cancelled) return
      markFresh()
      setLoaded(true)
    }, BRIDGE_PATIENCE_MS)
    Promise.all([
      window.fetch(`${origin}/__froam/repo/load`, { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
      window.fetch(`${origin}/__froam/config`, { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([designData, configData]: [{ success?: boolean; design?: FroamLocalDesign } | null, BridgeConfig | null]) => {
        if (cancelled) return
        const scope = chooseRootScope(designData?.success ? designData.design : null)
        if (!marked) mark(scope)
        else setRootScope(scope)
        if (designData?.success && designData.design) setDesign(designData.design)
        if (configData?.success && configData.projectKey) setProjectKey(configData.projectKey)
      })
      .catch(() => {
        /* bridge offline — editor still opens, cloud/local drafts only */
      })
      .finally(() => {
        window.clearTimeout(patience)
        if (cancelled) return
        markFresh()
        setLoaded(true)
      })
    return () => {
      cancelled = true
      window.clearTimeout(patience)
    }
  }, [origin])

  if (!loaded) return null

  return (
    <StrictMode>
      {/* apiBaseUrl = bridge origin so publish + published-designs hit the
          bridge's /api/froam/published even in script-tag mode. */}
      <FroamRuntime apiBaseUrl={origin} design={design} routes="*" />
      {/* This bundle is built for production but only the bridge serves it,
          so every page that loads it is one someone opened to edit. */}
      <FroamGate apiBaseUrl={origin} enabled showInProduction initialOpen={initialOpen} localRoutes="*" projectKey={projectKey ?? origin} rootScope={rootScope} rootSelector={bodyRoot ? selectBody : undefined} />
    </StrictMode>
  )
}

function boot() {
  const win = window as BridgeWindow
  if (win.__FROAM_STANDALONE_MOUNTED__) return
  win.__FROAM_STANDALONE_MOUNTED__ = true

  const { origin, initialOpen, projectKey } = resolveScriptConfig()
  win.__FROAM_BRIDGE_ORIGIN__ = origin

  const mount = () => {
    // The root is marked once the saved design is known (StandaloneApp): its
    // scope decides which element paths are relative to.
    injectEditorStyles(origin)
    let host = document.getElementById(HOST_ID)
    if (!host) {
      host = document.createElement('div')
      host.id = HOST_ID
      host.setAttribute('data-chef-editor-root', 'true')
      document.body.appendChild(host)
    }
    createRoot(host).render(<StandaloneApp origin={origin} initialOpen={initialOpen} initialProjectKey={projectKey} />)
    keepOnPage(host)
    // The button is up; fetch the full editor behind it, so opening it is instant.
    const warm = () => { void import('./editor/GlobalChefEditor').catch(() => {}) }
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback
    if (idle) idle(warm, { timeout: 2500 })
    else window.setTimeout(warm, 1200)
  }

  // A hydrating app gets its server markup back untouched first: the host
  // node, the editor's styles and the route attribute all come after.
  const start = () => { void whenAppHydrated().then(mount) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
}

boot()
