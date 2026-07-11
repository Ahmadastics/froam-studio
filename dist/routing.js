import { useEffect, useState } from 'react';
const NAVIGATION_EVENT = 'froam-studio:navigation';
let historyPatched = false;
function readBrowserRoute() {
    if (typeof window === 'undefined')
        return '/';
    return window.location.pathname || '/';
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
    return explicitRouteKey || readBrowserRoute();
}
export function useFroamRouteKey(explicitRouteKey) {
    const [routeKey, setRouteKey] = useState(() => getCurrentRouteKey(explicitRouteKey));
    useEffect(() => {
        if (explicitRouteKey) {
            setRouteKey(explicitRouteKey);
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