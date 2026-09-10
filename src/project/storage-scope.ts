const DEFAULT_PROJECT_KEY = 'default'

/**
 * Browser storage is shared by every page served from the same origin. Froam's
 * proxy normally lives at localhost:4600, so the origin alone cannot identify
 * a project. The bridge supplies an opaque project key; embedded integrations
 * can pass their own key through FroamGate.
 */
export function normalizeFroamProjectKey(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim()
  return normalized || DEFAULT_PROJECT_KEY
}

export function fallbackFroamProjectKey(): string {
  if (typeof window === 'undefined') return DEFAULT_PROJECT_KEY
  return normalizeFroamProjectKey(window.location.origin)
}

export function resolveFroamProjectKey(value?: string | null): string {
  return value ? normalizeFroamProjectKey(value) : fallbackFroamProjectKey()
}

export function froamStorageKey(baseKey: string, projectKey: string): string {
  return `${baseKey}:project:${encodeURIComponent(normalizeFroamProjectKey(projectKey))}`
}

export function froamProjectId(projectKey: string): string {
  return `project:${normalizeFroamProjectKey(projectKey)}`
}
