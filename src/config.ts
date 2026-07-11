export type FroamAuthUser = {
  email?: string | null
} | null

export type FroamAuthProvider = () => FroamAuthUser | Promise<FroamAuthUser>

export type FroamStudioConfig = {
  apiBaseUrl?: string
  authProvider?: FroamAuthProvider
  enabled?: boolean
  fetch?: typeof globalThis.fetch
  ownerEmails?: readonly string[]
  rootSelector?: string | (() => HTMLElement | null)
  runtimeRoutes?: readonly string[] | '*'
}

let config: FroamStudioConfig = {}

export function configureFroamStudio(next: FroamStudioConfig = {}) {
  config = { ...config, ...next }
  return config
}

export function getFroamStudioConfig() {
  return config
}

export function resetFroamStudioConfig() {
  config = {}
}

export function normalizeOwnerEmails(value?: readonly string[] | string | null) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',')
  return values
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function getFroamRootElement() {
  if (typeof document === 'undefined') return null

  const selector = config.rootSelector
  if (typeof selector === 'function') return selector()
  if (selector) return document.querySelector<HTMLElement>(selector)

  return (
    document.querySelector<HTMLElement>('[data-froam-root]')
    ?? document.getElementById('root')
    ?? document.getElementById('__next')
    ?? document.querySelector<HTMLElement>('main')
    ?? document.body
  )
}
