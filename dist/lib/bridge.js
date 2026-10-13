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
/* ── pairing a phone ──
   `froam dev --host` prints a link (and a QR code) for the owner's own phone:
   http://<computer>:<port>/#froam-pair=<key>. A phone that opened it sends
   the key back, and the bridge lets it Save to Repo like the computer itself.
   The key lives in the #fragment so it never reaches a server log; it's kept
   in this origin's storage and taken out of the address bar at once, so it
   isn't bookmarked, shared or shown. Each `froam dev` run makes a new one. */
const DEVICE_KEY = 'froam:device-key:v1';
const PAIR_PARAM = /(?:^#|&)froam-pair=([A-Za-z0-9_-]{16,64})/;
/** This device's pairing key, picking it up from the address on first sight. */
export function pairedDeviceKey() {
    if (typeof window === 'undefined')
        return null;
    const match = PAIR_PARAM.exec(window.location.hash);
    if (match) {
        try {
            window.localStorage.setItem(DEVICE_KEY, match[1]);
        }
        catch { /* storage blocked: the key works for this visit */ }
        const rest = window.location.hash.replace(PAIR_PARAM, '').replace(/^#&/, '#');
        try {
            window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${rest === '#' ? '' : rest}`);
        }
        catch { /* sandboxed */ }
        ;
        window.__FROAM_DEVICE_KEY__ = match[1];
        return match[1];
    }
    const held = window.__FROAM_DEVICE_KEY__;
    if (held)
        return held;
    try {
        return window.localStorage.getItem(DEVICE_KEY);
    }
    catch {
        return null;
    }
}
/* This open editor, so the bridge's change events can say which one saved:
   an editor never re-reads its own save, and another tab or device does. */
const CLIENT_ID = `c${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
export function bridgeClientId() {
    return CLIENT_ID;
}
/** Headers for a bridge request: this editor, and the pairing key when this device has one. */
export function bridgeHeaders(extra = {}) {
    const key = pairedDeviceKey();
    const headers = { ...extra, 'X-Froam-Client': CLIENT_ID };
    return key ? { ...headers, 'X-Froam-Device': key } : headers;
}
//# sourceMappingURL=bridge.js.map