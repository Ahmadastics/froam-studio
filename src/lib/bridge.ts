/**
 * Repo-Mode bridge resolution.
 *
 * In a Vite app the bridge endpoints (/__froam/repo/*) live on the same
 * origin (vite plugin middleware). In standalone mode (`froam dev`) the
 * editor may be injected into a page served from a different origin, so
 * the loader records the bridge origin on window and every repo call
 * routes through it.
 */
export function getBridgeOrigin(): string {
  if (typeof window === 'undefined') return ''
  const origin = (window as unknown as { __FROAM_BRIDGE_ORIGIN__?: string }).__FROAM_BRIDGE_ORIGIN__
  if (!origin || origin === window.location.origin) return ''
  return origin
}

export function bridgeUrl(path: string): string {
  return `${getBridgeOrigin()}${path}`
}
