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
  }
}

function markFroamRoot() {
  if (document.querySelector('[data-froam-root]') || document.getElementById('root') || document.getElementById('__next')) {
    return
  }
  const root = document.querySelector<HTMLElement>('main') ?? document.body
  root.setAttribute('data-froam-root', '')
}

function injectEditorStyles(origin: string) {
  const href = `${origin}/froam.css`
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function StandaloneApp({ origin, initialOpen }: { origin: string; initialOpen: boolean }) {
  const [design, setDesign] = useState<FroamLocalDesign | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    window
      .fetch(`${origin}/__froam/repo/load`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { success?: boolean; design?: FroamLocalDesign } | null) => {
        if (!cancelled && data?.success && data.design) setDesign(data.design)
      })
      .catch(() => {
        /* bridge offline — editor still opens, cloud/local drafts only */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [origin])

  if (!loaded) return null

  return (
    <StrictMode>
      <FroamRuntime design={design} routes="*" />
      <FroamGate enabled initialOpen={initialOpen} localRoutes="*" />
    </StrictMode>
  )
}

function boot() {
  const win = window as BridgeWindow
  if (win.__FROAM_STANDALONE_MOUNTED__) return
  win.__FROAM_STANDALONE_MOUNTED__ = true

  const { origin, initialOpen } = resolveScriptConfig()
  win.__FROAM_BRIDGE_ORIGIN__ = origin

  const mount = () => {
    markFroamRoot()
    injectEditorStyles(origin)
    let host = document.getElementById(HOST_ID)
    if (!host) {
      host = document.createElement('div')
      host.id = HOST_ID
      host.setAttribute('data-chef-editor-root', 'true')
      document.body.appendChild(host)
    }
    createRoot(host).render(<StandaloneApp origin={origin} initialOpen={initialOpen} />)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
}

boot()
