import { Component, lazy, Suspense, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import {
  configureFroamStudio,
  getFroamStudioConfig,
  normalizeOwnerEmails,
  type FroamStudioConfig,
} from '../config'
import { useFroamRouteKey } from '../routing'

const GlobalChefEditor = lazy(() => import('./GlobalChefEditor'))

export type FroamGateProps = Pick<FroamStudioConfig, 'apiBaseUrl' | 'authProvider' | 'fetch' | 'rootSelector'> & {
  enabled?: boolean
  initialOpen?: boolean
  routeKey?: string
  ownerEmails?: readonly string[] | string
  allowLocalhost?: boolean
  localRoutes?: readonly string[] | '*'
  fallback?: ReactNode
  lockedFallback?: ReactNode
}

function getEnvOwnerEmails() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  return env?.VITE_FROAM_OWNER_EMAILS
}

function isFroamOwner(email: string | null | undefined, ownerEmails: readonly string[]) {
  return Boolean(email && ownerEmails.includes(email.toLowerCase()))
}

function isLocalHost() {
  if (typeof window === 'undefined') return false
  return ['127.0.0.1', 'localhost', '::1'].includes(window.location.hostname)
}

function routeMatches(routeKey: string, routes: readonly string[] | '*') {
  return routes === '*' || routes.includes(routeKey)
}

class FroamBoundary extends Component<{ children: ReactNode; onReset: () => void }, { crashed: boolean; errorMessage: string }> {
  state = { crashed: false, errorMessage: '' }

  static getDerivedStateFromError(error: Error) {
    return { crashed: true, errorMessage: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Froam] Editor crashed:', error.message, '\n', error.stack, '\n', info.componentStack)
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 1200, background: '#1e1e2e', border: '1px solid #ff6c4f', borderRadius: 8, padding: '10px 14px', maxWidth: 420, fontSize: 12 }}>
        <p style={{ color: '#ff6c4f', margin: '0 0 6px', fontWeight: 700 }}>Froam crashed</p>
        <p style={{ color: '#a0a0b0', margin: '0 0 8px', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{this.state.errorMessage}</p>
        <button type="button" style={{ color: '#5eead4', background: 'none', border: '1px solid #5eead4', borderRadius: 4, cursor: 'pointer', padding: '3px 10px', fontSize: 11 }} onClick={() => { this.setState({ crashed: false, errorMessage: '' }); this.props.onReset() }}>Restart Froam</button>
      </div>
    )
  }
}

export default function FroamGate({
  apiBaseUrl,
  authProvider,
  enabled,
  fallback = null,
  fetch,
  initialOpen = false,
  localRoutes = '*',
  lockedFallback = null,
  ownerEmails,
  rootSelector,
  routeKey: explicitRouteKey,
  allowLocalhost = true,
}: FroamGateProps) {
  const routeKey = useFroamRouteKey(explicitRouteKey)
  const resolvedOwnerEmails = useMemo(
    () => normalizeOwnerEmails(ownerEmails ?? getFroamStudioConfig().ownerEmails ?? getEnvOwnerEmails()),
    [ownerEmails],
  )
  const localAllowed = allowLocalhost && isLocalHost() && routeMatches(routeKey, localRoutes)
  const [allowed, setAllowed] = useState(enabled === true || localAllowed)
  const [key, setKey] = useState(0)

  useEffect(() => {
    configureFroamStudio({
      apiBaseUrl,
      authProvider,
      enabled,
      fetch,
      ownerEmails: resolvedOwnerEmails,
      rootSelector,
    })
  }, [apiBaseUrl, authProvider, enabled, fetch, resolvedOwnerEmails, rootSelector])

  useEffect(() => {
    let cancelled = false

    if (enabled === false) {
      setAllowed(false)
      return undefined
    }

    if (enabled === true || localAllowed) {
      setAllowed(true)
      return undefined
    }

    setAllowed(false)
    const provider = authProvider ?? getFroamStudioConfig().authProvider
    if (!provider || resolvedOwnerEmails.length === 0) return undefined

    Promise.resolve(provider())
      .then((user) => {
        if (!cancelled) setAllowed(isFroamOwner(user?.email, resolvedOwnerEmails))
      })
      .catch(() => {
        if (!cancelled) setAllowed(false)
      })

    return () => {
      cancelled = true
    }
  }, [authProvider, enabled, localAllowed, resolvedOwnerEmails])

  if (!allowed) return <>{lockedFallback}</>

  return (
    <FroamBoundary onReset={() => setKey((k) => k + 1)}>
      <Suspense fallback={fallback}>
        <GlobalChefEditor key={key} initialOpen={initialOpen} routeKey={routeKey} />
      </Suspense>
    </FroamBoundary>
  )
}
