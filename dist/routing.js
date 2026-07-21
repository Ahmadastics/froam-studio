import { useEffect, useState } from 'react';
const NAVIGATION_EVENT = 'froam-studio:navigation';
let historyPatched = false;
/**
 * One canonical form for route keys so a design edited at `/page`,
 * `/page/` or `/page/index.html` applies at ALL of them — servers
 * disagree about trailing slashes, the design must not care.
 * KEEP IN SYNC with normalizeRouteKey in lib/codegen.mjs.
 */
export function normalizeFroamRouteKey(value) {
    let p = String(value || '/').split('?')[0].split('#')[0];
    p = p.replace(/\/index\.html?$/i, '/');
    p = p.replace(/\/+$/, '');
    return p || '/';
}
function readBrowserRoute() {
    if (typeof window === 'undefined')
        return '/';
    return normalizeFroamRouteKey(window.location.pathname);
}
function dispatchNavigationEvent() {
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
}
function patchHistoryNavigation() {
    if (historyPatched || typeof window === 'undefined')
        return;
    historyPatched = true;
    const patch = (method) => {
        const original = window.history[method];
        window.history[method] = function patchedHistoryMethod(...args) {
            const result = original.apply(this, args);
            dispatchNavigationEvent();
            return result;
        };
    };
    patch('pushState');
    patch('replaceState');
}
export function getCurrentRouteKey(explicitRouteKey) {
    return explicitRouteKey ? normalizeFroamRouteKey(explicitRouteKey) : readBrowserRoute();
}
export function useFroamRouteKey(explicitRouteKey) {
    const [routeKey, setRouteKey] = useState(() => getCurrentRouteKey(explicitRouteKey));
    useEffect(() => {
        if (explicitRouteKey) {
            setRouteKey(normalizeFroamRouteKey(explicitRouteKey));
            return undefined;
        }
        patchHistoryNavigation();
        const updateRoute = () => setRouteKey(readBrowserRoute());
        window.addEventListener('popstate', updateRoute);
        window.addEventListener(NAVIGATION_EVENT, updateRoute);
        updateRoute();
        return () => {
            window.removeEventListener('popstate', updateRoute);
            window.removeEventListener(NAVIGATION_EVENT, updateRoute);
        };
    }, [explicitRouteKey]);
    return routeKey;
}
//# sourceMappingURL=routing.js.map