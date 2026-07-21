import { useEffect, useMemo, useRef, useState } from 'react';
import { configureFroamStudio, getFroamRootElement, getFroamStudioConfig, } from '../config.js';
import { apiGetFresh } from '../lib/api.js';
import { collectStoreFontFamilies, ensureFontLinks } from './fontSources.js';
import { normalizeFroamRouteKey, useFroamRouteKey } from '../routing.js';
import { isFroamPersonaPath } from './froamPersona.js';
const CANVAS_KEY = '__froam_canvas__';
const INJECTION_KEY = '__froam_injection__';
const ROOT_PARENT_KEY = '__froam_root__';
const DEFAULT_RUNTIME_ROUTES = '*';
function getRuntimeViewportMode() {
    if (typeof window === 'undefined')
        return 'desktop';
    if (window.matchMedia('(max-width: 640px)').matches)
        return 'mobile';
    if (window.matchMedia('(max-width: 1024px)').matches)
        return 'tablet';
    return 'desktop';
}
function getRoot() {
    return getFroamRootElement();
}
function routeMatches(routeKey, routes) {
    return routes === '*' || routes.includes(routeKey);
}
function getCanvasHost() {
    const root = getRoot();
    return root?.querySelector('[data-froam-canvas]') ?? null;
}
function isSafeDraftPath(path) {
    return path.trim().length > 0 && path.includes(':');
}
function isInjectionPath(path) {
    return path.startsWith(`${INJECTION_KEY}:`);
}
function camelToKebab(value) {
    return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
function findElementByPath(root, path) {
    if (!isSafeDraftPath(path))
        return null;
    const segments = path.split('/').filter(Boolean);
    let current = root;
    for (const segment of segments) {
        const [tag, indexRaw] = segment.split(':');
        const index = Number(indexRaw) - 1;
        if (!tag || Number.isNaN(index) || index < 0)
            return null;
        const siblings = Array.from(current.children).filter((child) => child instanceof HTMLElement && child.tagName.toLowerCase() === tag);
        current = siblings[index] ?? null;
        if (!current)
            return null;
    }
    return current;
}
function canApplyTextDraft(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
        return false;
    if (element.children.length === 0)
        return true;
    const tag = element.tagName.toLowerCase();
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'b', 'i', 'label', 'button', 'a', 'li'].includes(tag);
}
function applyDraft(element, draft) {
    if (draft.text !== undefined && canApplyTextDraft(element) && element.innerText !== draft.text) {
        element.innerText = draft.text;
    }
    if (element instanceof HTMLImageElement && draft.imageUrl !== undefined) {
        if (draft.imageUrl && element.getAttribute('src') !== draft.imageUrl)
            element.src = draft.imageUrl;
        if (!draft.imageUrl && element.hasAttribute('src'))
            element.removeAttribute('src');
    }
    if (!draft.styles)
        return;
    for (const [key, value] of Object.entries(draft.styles)) {
        const cssKey = camelToKebab(key);
        if (element.style.getPropertyValue(cssKey) === value)
            continue;
        if (value)
            element.style.setProperty(cssKey, value);
        else
            element.style.removeProperty(cssKey);
    }
}
function restoreRuntimeSnapshots(snapshots) {
    for (const snapshot of snapshots.slice().reverse()) {
        const { element } = snapshot;
        if (snapshot.text !== undefined && canApplyTextDraft(element) && element.innerText !== snapshot.text) {
            element.innerText = snapshot.text;
        }
        if (snapshot.imageSrc !== undefined && element instanceof HTMLImageElement) {
            if (snapshot.imageSrc)
                element.src = snapshot.imageSrc;
            else
                element.removeAttribute('src');
        }
        for (const [cssKey, value] of Object.entries(snapshot.styles)) {
            if (value)
                element.style.setProperty(cssKey, value);
            else
                element.style.removeProperty(cssKey);
        }
    }
}
function snapshotDraftTarget(element, draft, snapshots) {
    const snapshot = { element, styles: {} };
    if (draft.text !== undefined && canApplyTextDraft(element)) {
        snapshot.text = element.innerText;
    }
    if (element instanceof HTMLImageElement && draft.imageUrl !== undefined) {
        snapshot.imageSrc = element.getAttribute('src');
    }
    for (const key of Object.keys(draft.styles ?? {})) {
        const cssKey = camelToKebab(key);
        snapshot.styles[cssKey] = element.style.getPropertyValue(cssKey);
    }
    if (snapshot.text !== undefined || snapshot.imageSrc !== undefined || Object.keys(snapshot.styles).length > 0) {
        snapshots.push(snapshot);
    }
    applyDraft(element, draft);
}
function applyCanvasDraftStyles(styles, snapshots) {
    if (!styles)
        return;
    const host = getCanvasHost();
    if (!host)
        return;
    const snapshot = { element: host, styles: {} };
    for (const [key, value] of Object.entries(styles)) {
        if (key === 'customCSS')
            continue;
        const cssKey = camelToKebab(key);
        snapshot.styles[cssKey] = host.style.getPropertyValue(cssKey);
        if (host.style.getPropertyValue(cssKey) === value)
            continue;
        if (value)
            host.style.setProperty(cssKey, value);
        else
            host.style.removeProperty(cssKey);
    }
    // Inject custom global CSS at runtime too!
    let styleEl = document.getElementById('froam-global-styles');
    if (styles.customCSS) {
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'froam-global-styles';
            document.head.appendChild(styleEl);
        }
        if (styleEl.textContent !== styles.customCSS) {
            styleEl.textContent = styles.customCSS;
        }
    }
    else if (styleEl) {
        styleEl.textContent = '';
    }
    if (Object.keys(snapshot.styles).length > 0) {
        snapshots.push(snapshot);
    }
}
function readInjectionDraft(draft) {
    if (!draft.text)
        return null;
    try {
        const parsed = JSON.parse(draft.text);
        if (typeof parsed.html !== 'string')
            return null;
        if (typeof parsed.parentPath !== 'string')
            return null;
        return {
            html: parsed.html,
            parentPath: parsed.parentPath,
            order: typeof parsed.order === 'number' ? parsed.order : 0,
        };
    }
    catch {
        return null;
    }
}
function removeRuntimeInjectedBlocks() {
    const root = getRoot();
    if (!root)
        return;
    root.querySelectorAll('[data-froam-runtime-injected="true"]').forEach((element) => {
        element.remove();
    });
}
function restoreInjectedBlocks(store) {
    const root = getRoot();
    if (!root)
        return;
    Object.entries(store)
        .filter(([path]) => isInjectionPath(path))
        .map(([, draft]) => readInjectionDraft(draft))
        .filter((draft) => draft !== null)
        .sort((a, b) => a.order - b.order)
        .forEach((injection) => {
        const parent = injection.parentPath === ROOT_PARENT_KEY
            ? root
            : findElementByPath(root, injection.parentPath);
        if (!parent)
            return;
        const template = document.createElement('template');
        template.innerHTML = injection.html.trim();
        const node = template.content.firstElementChild;
        if (!(node instanceof HTMLElement))
            return;
        node.setAttribute('data-froam-runtime-injected', 'true');
        node.removeAttribute('data-chef-selected');
        node.removeAttribute('data-chef-hovered');
        parent.appendChild(node);
    });
}
function applyFroamStore(store, snapshots) {
    if (document.documentElement.hasAttribute('data-chef-editing'))
        return;
    const root = getRoot();
    if (!root)
        return;
    removeRuntimeInjectedBlocks();
    restoreInjectedBlocks(store);
    for (const [path, draft] of Object.entries(store)) {
        if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
            continue;
        const target = findElementByPath(root, path);
        if (target)
            snapshotDraftTarget(target, draft, snapshots);
    }
    applyCanvasDraftStyles(store[CANVAS_KEY]?.styles, snapshots);
}
export default function FroamRuntime({ apiBaseUrl, design = null, enabled = true, fetch, rootSelector, routeKey: explicitRouteKey, routes, }) {
    const routeKey = useFroamRouteKey(explicitRouteKey);
    const runtimeRoutes = routes ?? getFroamStudioConfig().runtimeRoutes ?? DEFAULT_RUNTIME_ROUTES;
    const isRuntimeRoute = enabled && routeMatches(routeKey, runtimeRoutes);
    const [viewportMode, setViewportMode] = useState(() => getRuntimeViewportMode());
    const [publishedStore, setPublishedStore] = useState(null);
    const appliedSnapshotsRef = useRef([]);
    const endpoint = useMemo(() => {
        const params = new URLSearchParams({ routeKey, viewportMode });
        return `/api/froam/published?${params.toString()}`;
    }, [routeKey, viewportMode]);
    useEffect(() => {
        configureFroamStudio({
            apiBaseUrl,
            enabled,
            fetch,
            rootSelector,
            runtimeRoutes,
        });
    }, [apiBaseUrl, enabled, fetch, rootSelector, runtimeRoutes]);
    useEffect(() => {
        let frame = 0;
        function handleResize() {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setViewportMode(getRuntimeViewportMode()));
        }
        window.addEventListener('resize', handleResize);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', handleResize);
        };
    }, []);
    useEffect(() => {
        if (!isRuntimeRoute || typeof document === 'undefined')
            return;
        document.documentElement.setAttribute('data-froam-route', routeKey);
        return () => {
            document.documentElement.removeAttribute('data-froam-route');
        };
    }, [isRuntimeRoute, routeKey]);
    useEffect(() => {
        if (!isRuntimeRoute) {
            setPublishedStore(null);
            restoreRuntimeSnapshots(appliedSnapshotsRef.current);
            appliedSnapshotsRef.current = [];
            removeRuntimeInjectedBlocks();
            return;
        }
        // Repo Mode: a committed local design wins over the published API.
        // Legacy designs may store keys with trailing slashes — match on the
        // normalized form so a slash never hides a shipped design.
        const localRoute = design?.routes?.[routeKey]
            ?? Object.entries(design?.routes ?? {}).find(([key]) => normalizeFroamRouteKey(key) === routeKey)?.[1];
        if (localRoute && Object.prototype.hasOwnProperty.call(localRoute, viewportMode)) {
            setPublishedStore(localRoute[viewportMode] ?? null);
            return;
        }
        let cancelled = false;
        async function loadPublished() {
            try {
                const response = await apiGetFresh(endpoint);
                if (!cancelled)
                    setPublishedStore(response.design?.store ?? null);
            }
            catch {
                if (!cancelled)
                    setPublishedStore(null);
            }
        }
        void loadPublished();
        return () => {
            cancelled = true;
        };
    }, [design, endpoint, isRuntimeRoute, routeKey, viewportMode]);
    /* Fonts the design references must actually load with it. */
    useEffect(() => {
        if (!isRuntimeRoute || !publishedStore)
            return;
        ensureFontLinks(collectStoreFontFamilies(publishedStore));
    }, [publishedStore, isRuntimeRoute]);
    useEffect(() => {
        const root = getRoot();
        restoreRuntimeSnapshots(appliedSnapshotsRef.current);
        appliedSnapshotsRef.current = [];
        removeRuntimeInjectedBlocks();
        if (!isRuntimeRoute || !publishedStore || !root)
            return;
        const storeToPaint = publishedStore;
        function paint() {
            try {
                restoreRuntimeSnapshots(appliedSnapshotsRef.current);
                removeRuntimeInjectedBlocks();
                const snapshots = [];
                applyFroamStore(storeToPaint, snapshots);
                appliedSnapshotsRef.current = snapshots;
            }
            catch {
                // DOM may be mid-render — safe to skip this paint frame
            }
        }
        paint();
        let paintFrame = 0;
        const observer = new MutationObserver(() => {
            cancelAnimationFrame(paintFrame);
            paintFrame = requestAnimationFrame(paint);
        });
        observer.observe(root, { childList: true, subtree: true });
        return () => {
            cancelAnimationFrame(paintFrame);
            observer.disconnect();
            restoreRuntimeSnapshots(appliedSnapshotsRef.current);
            removeRuntimeInjectedBlocks();
            appliedSnapshotsRef.current = [];
        };
    }, [publishedStore, isRuntimeRoute]);
    return null;
}
//# sourceMappingURL=FroamRuntime.js.map