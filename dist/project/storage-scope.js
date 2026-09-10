const DEFAULT_PROJECT_KEY = 'default';
/**
 * Browser storage is shared by every page served from the same origin. Froam's
 * proxy normally lives at localhost:4600, so the origin alone cannot identify
 * a project. The bridge supplies an opaque project key; embedded integrations
 * can pass their own key through FroamGate.
 */
export function normalizeFroamProjectKey(value) {
    const normalized = String(value ?? '').trim();
    return normalized || DEFAULT_PROJECT_KEY;
}
export function fallbackFroamProjectKey() {
    if (typeof window === 'undefined')
        return DEFAULT_PROJECT_KEY;
    return normalizeFroamProjectKey(window.location.origin);
}
export function resolveFroamProjectKey(value) {
    return value ? normalizeFroamProjectKey(value) : fallbackFroamProjectKey();
}
export function froamStorageKey(baseKey, projectKey) {
    return `${baseKey}:project:${encodeURIComponent(normalizeFroamProjectKey(projectKey))}`;
}
export function froamProjectId(projectKey) {
    return `project:${normalizeFroamProjectKey(projectKey)}`;
}
//# sourceMappingURL=storage-scope.js.map