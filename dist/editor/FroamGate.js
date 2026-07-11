import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Component, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { configureFroamStudio, getFroamStudioConfig, normalizeOwnerEmails, } from '../config.js';
import { useFroamRouteKey } from '../routing.js';
const GlobalChefEditor = lazy(() => import('./GlobalChefEditor.js'));
function getEnvOwnerEmails() {
    const env = import.meta.env;
    return env?.VITE_FROAM_OWNER_EMAILS;
}
function isFroamOwner(email, ownerEmails) {
    return Boolean(email && ownerEmails.includes(email.toLowerCase()));
}
function isLocalHost() {
    if (typeof window === 'undefined')
        return false;
    return ['127.0.0.1', 'localhost', '::1'].includes(window.location.hostname);
}
function routeMatches(routeKey, routes) {
    return routes === '*' || routes.includes(routeKey);
}
class FroamBoundary extends Component {
    state = { crashed: false, errorMessage: '' };
    static getDerivedStateFromError(error) {
        return { crashed: true, errorMessage: error.message };
    }
    componentDidCatch(error, info) {
        console.error('[Froam] Editor crashed:', error.message, '\n', error.stack, '\n', info.componentStack);
    }
    render() {
        if (!this.state.crashed)
            return this.props.children;
        return (_jsxs("div", { style: { position: 'fixed', left: 16, bottom: 16, zIndex: 1200, background: '#1e1e2e', border: '1px solid #ff6c4f', borderRadius: 8, padding: '10px 14px', maxWidth: 420, fontSize: 12 }, children: [_jsx("p", { style: { color: '#ff6c4f', margin: '0 0 6px', fontWeight: 700 }, children: "Froam crashed" }), _jsx("p", { style: { color: '#a0a0b0', margin: '0 0 8px', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }, children: this.state.errorMessage }), _jsx("button", { type: "button", style: { color: '#5eead4', background: 'none', border: '1px solid #5eead4', borderRadius: 4, cursor: 'pointer', padding: '3px 10px', fontSize: 11 }, onClick: () => { this.setState({ crashed: false, errorMessage: '' }); this.props.onReset(); }, children: "Restart Froam" })] }));
    }
}
export default function FroamGate({ apiBaseUrl, authProvider, enabled, fallback = null, fetch, initialOpen = false, localRoutes = '*', lockedFallback = null, ownerEmails, rootSelector, routeKey: explicitRouteKey, allowLocalhost = true, }) {
    const routeKey = useFroamRouteKey(explicitRouteKey);
    const resolvedOwnerEmails = useMemo(() => normalizeOwnerEmails(ownerEmails ?? getFroamStudioConfig().ownerEmails ?? getEnvOwnerEmails()), [ownerEmails]);
    const localAllowed = allowLocalhost && isLocalHost() && routeMatches(routeKey, localRoutes);
    const [allowed, setAllowed] = useState(enabled === true || localAllowed);
    const [key, setKey] = useState(0);
    useEffect(() => {
        configureFroamStudio({
            apiBaseUrl,
            authProvider,
            enabled,
            fetch,
            ownerEmails: resolvedOwnerEmails,
            rootSelector,
        });
    }, [apiBaseUrl, authProvider, enabled, fetch, resolvedOwnerEmails, rootSelector]);
    useEffect(() => {
        let cancelled = false;
        if (enabled === false) {
            setAllowed(false);
            return undefined;
        }
        if (enabled === true || localAllowed) {
            setAllowed(true);
            return undefined;
        }
        setAllowed(false);
        const provider = authProvider ?? getFroamStudioConfig().authProvider;
        if (!provider || resolvedOwnerEmails.length === 0)
            return undefined;
        Promise.resolve(provider())
            .then((user) => {
            if (!cancelled)
                setAllowed(isFroamOwner(user?.email, resolvedOwnerEmails));
        })
            .catch(() => {
            if (!cancelled)
                setAllowed(false);
        });
        return () => {
            cancelled = true;
        };
    }, [authProvider, enabled, localAllowed, resolvedOwnerEmails]);
    if (!allowed)
        return _jsx(_Fragment, { children: lockedFallback });
    return (_jsx(FroamBoundary, { onReset: () => setKey((k) => k + 1), children: _jsx(Suspense, { fallback: fallback, children: _jsx(GlobalChefEditor, { initialOpen: initialOpen, routeKey: routeKey }, key) }) }));
}
//# sourceMappingURL=FroamGate.js.map