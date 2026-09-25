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

function resolveScriptConfig() {
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

function markFroamRoot(scope: RootScope) {
  if (document.querySelector('[data-froam-root]')) return
  if (scope === 'page') {
    wrapBodyAsRoot(true)
    return
  }
  if (document.getElementById('root') || document.getElementById('__next')) return
  const main = document.querySelector<HTMLElement>('main')
  if (main) {
    main.setAttribute('data-froam-root', '')
    return
  }
  wrapBodyAsRoot(false)
}

function injectEditorStyles(origin: string) {
  const href = `${origin}/froam.css`
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function StandaloneApp({ origin, initialOpen, initialProjectKey }: { origin: string; initialOpen: boolean; initialProjectKey: string | null }) {
  const [design, setDesign] = useState<FroamLocalDesign | null>(null)
  const [projectKey, setProjectKey] = useState<string | null>(initialProjectKey)
  const [loaded, setLoaded] = useState(false)
  const [rootScope, setRootScope] = useState<RootScope>('auto')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.fetch(`${origin}/__froam/repo/load`, { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
      window.fetch(`${origin}/__froam/config`, { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([designData, configData]: [{ success?: boolean; design?: FroamLocalDesign } | null, BridgeConfig | null]) => {
        if (cancelled) return
        const scope = chooseRootScope(designData?.success ? designData.design : null)
        markFroamRoot(scope)
        setRootScope(scope)
        if (designData?.success && designData.design) setDesign(designData.design)
        if (configData?.success && configData.projectKey) setProjectKey(configData.projectKey)
      })
      .catch(() => {
        /* bridge offline — editor still opens, cloud/local drafts only */
      })
      .finally(() => {
        if (cancelled) return
        // Bridge offline: nothing saved to protect, so mark as a fresh design would.
        if (!document.querySelector('[data-froam-root]')) {
          const scope = chooseRootScope(null)
          markFroamRoot(scope)
          setRootScope(scope)
        }
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [origin])

  if (!loaded) return null

  return (
    <StrictMode>
      {/* apiBaseUrl = bridge origin so publish + published-designs hit the
          bridge's /api/froam/published even in script-tag mode. */}
      <FroamRuntime apiBaseUrl={origin} design={design} routes="*" />
      <FroamGate apiBaseUrl={origin} enabled initialOpen={initialOpen} localRoutes="*" projectKey={projectKey ?? origin} rootScope={rootScope} />
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
}

boot()
