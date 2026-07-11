/**
 * Repo-Mode bridge resolution.
 *
 * In a Vite app the bridge endpoints (/__froam/repo/*) live on the same
 * origin (vite plugin middleware). In standalone mode (`froam dev`) the
 * editor may be injected into a page served from a different origin, so
 * the loader records the bridge origin on window and every repo call
 * routes through it.
 */
export function getBridgeOrigin() {
    if (typeof window === 'undefined')
        return '';
    const origin = window.__FROAM_BRIDGE_ORIGIN__;
    if (!origin || origin === window.location.origin)
        return '';
    return origin;
}
export function bridgeUrl(path) {
    return `${getBridgeOrigin()}${path}`;
}
//# sourceMappingURL=bridge.js.map