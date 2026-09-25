import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { configureFroamStudio, getFroamRootElement, getFroamStudioConfig, } from '../config.js';
import { apiGetFresh } from '../lib/api.js';
import FroamReview from './FroamReview.js';
import { readRoomFromLocation } from '../collab/room.js';
import { collectStoreFontFamilies, ensureBrandFontStyle, ensureFontLinks } from './fontSources.js';
import { normalizeFroamRouteKey, useFroamRouteKey } from '../routing.js';
import { isFroamPersonaPath } from './froamPersona.js';
import { SECTION_STRUCTURE_KEY } from './section-structure.js';
import { resolveAnchor } from '../collab/anchor.js';
import { isBodyScopedPath, isFroamOwnedNode, isPathElement } from '../collab/paths.js';
import { applyDraftText } from './draft-text.js';
const CANVAS_KEY = '__froam_canvas__';
const INJECTION_KEY = '__froam_injection__';
const ROOT_PARENT_KEY = '__froam_root__';
const RUNTIME_VISIBILITY_STYLE_ID = 'froam-runtime-visibility';
const DEFAULT_RUNTIME_ROUTES = '*';
/**
 * How often a follower re-asks for the design during a session.
 *
 * Fast enough that a change lands while the designer is still talking about
 * it, slow enough to be unremarkable on a phone connection. Only runs when
 * the page is actually a session.
 */
const LIVE_POLL_MS = 4_000;
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
function isInsideFroamUi(node) {
    for (let element = node instanceof Element ? node : node.parentElement; element; element = element.parentElement) {
        if (isFroamOwnedNode(element))
            return true;
    }
    return false;
}
function findElementByPath(root, path) {
    if (!isSafeDraftPath(path))
        return null;
    // "@body/…" is content beside the root — a portal's modal (src/collab/paths.ts).
    const fromBody = isBodyScopedPath(path);
    const segments = (fromBody ? path.slice(path.indexOf('/') + 1) : path).split('/').filter(Boolean);
    let current = fromBody ? document.body : root;
    for (const segment of segments) {
        const [tag, indexRaw] = segment.split(':');
        const index = Number(indexRaw) - 1;
        if (!tag || Number.isNaN(index) || index < 0)
            return null;
        const onBody = current === document.body;
        const siblings = Array.from(current.children).filter((child) => isPathElement(child) && child.tagName.toLowerCase() === tag && !(onBody && isFroamOwnedNode(child)));
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
    if (draft.text !== undefined && canApplyTextDraft(element))
        applyDraftText(element, draft.text);
    if (element instanceof HTMLImageElement && draft.imageUrl !== undefined) {
        if (draft.imageUrl && element.getAttribute('src') !== draft.imageUrl)
            element.src = draft.imageUrl;
        if (!draft.imageUrl && element.hasAttribute('src'))
            element.removeAttribute('src');
    }
    if (!draft.styles)
        return;
    for (const [key, value] of Object.entries(draft.styles)) {
        if (key.startsWith('__froamState:'))
            continue;
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
        if (key.startsWith('__froamState:'))
            continue;
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
            parentId: typeof parsed.parentId === 'string' ? parsed.parentId : undefined,
            order: typeof parsed.order === 'number' ? parsed.order : 0,
        };
    }
    catch {
        return null;
    }
}
function restoreSectionRuntimeSnapshots(snapshots) {
    snapshots.slice().sort((left, right) => left.order - right.order).forEach((snapshot) => {
        const currentOrder = snapshot.element.parentElement === snapshot.parent
            ? Array.from(snapshot.parent.children).indexOf(snapshot.element)
            : -1;
        if (currentOrder !== snapshot.order) {
            snapshot.element.remove();
            snapshot.parent.insertBefore(snapshot.element, snapshot.parent.children.item(snapshot.order));
        }
        snapshot.element.hidden = snapshot.hidden;
        if (snapshot.exportHidden === null)
            snapshot.element.removeAttribute('data-froam-export-hidden');
        else
            snapshot.element.setAttribute('data-froam-export-hidden', snapshot.exportHidden);
        if (snapshot.deleted === null)
            snapshot.element.removeAttribute('data-froam-structure-deleted');
        else
            snapshot.element.setAttribute('data-froam-structure-deleted', snapshot.deleted);
    });
}
function applySectionStructure(store, snapshots) {
    const root = getRoot();
    const draft = store[SECTION_STRUCTURE_KEY];
    if (!root || !draft?.text)
        return;
    try {
        const manifest = JSON.parse(draft.text);
        if (manifest.version !== 1 || !Array.isArray(manifest.sections))
            return;
        const resolved = manifest.sections.map((value) => {
            const entry = value;
            if (typeof entry.nodeId !== 'string' || typeof entry.sourcePath !== 'string' || typeof entry.parentPath !== 'string' || typeof entry.order !== 'number')
                return null;
            const element = root.querySelector(`[data-froam-id="${CSS.escape(entry.nodeId)}"]`) ?? findElementByPath(root, entry.sourcePath);
            if (!element || element.dataset.froamRuntimeInjected === 'true' || !element.parentElement)
                return null;
            snapshots.push({
                element,
                parent: element.parentElement,
                order: Array.from(element.parentElement.children).indexOf(element),
                hidden: element.hidden,
                exportHidden: element.getAttribute('data-froam-export-hidden'),
                deleted: element.getAttribute('data-froam-structure-deleted'),
            });
            element.dataset.froamId = entry.nodeId;
            return { entry, element };
        }).filter((item) => item !== null);
        resolved.filter(({ entry }) => !entry.deleted).sort((left, right) => left.entry.order - right.entry.order).forEach(({ entry, element }) => {
            const parent = entry.parentPath === ROOT_PARENT_KEY ? root : findElementByPath(root, entry.parentPath);
            if (parent) {
                const currentOrder = element.parentElement === parent ? Array.from(parent.children).indexOf(element) : -1;
                if (currentOrder !== entry.order) {
                    element.remove();
                    parent.insertBefore(element, parent.children.item(entry.order));
                }
            }
            element.hidden = Boolean(entry.exportHidden);
            if (entry.exportHidden)
                element.dataset.froamExportHidden = 'true';
            else
                element.removeAttribute('data-froam-export-hidden');
            element.removeAttribute('data-froam-structure-deleted');
        });
        resolved.filter(({ entry }) => entry.deleted).forEach(({ element }) => {
            element.hidden = true;
            element.dataset.froamStructureDeleted = 'true';
        });
    }
    catch {
        // Ignore a malformed structure draft without blocking ordinary styling.
    }
}
function ensureRuntimeVisibilityStyle() {
    let style = document.getElementById(RUNTIME_VISIBILITY_STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = RUNTIME_VISIBILITY_STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = 'html:not([data-chef-editing]) [data-froam-export-hidden="true"],html:not([data-chef-editing]) [data-froam-structure-deleted="true"]{display:none!important}';
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
        const parent = injection.parentId
            ? root.querySelector(`[data-froam-id="${CSS.escape(injection.parentId)}"]`)
            : injection.parentPath === ROOT_PARENT_KEY
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
        // Blocks saved before 8.5 carried contenteditable — never live for visitors.
        for (const editable of [node, ...Array.from(node.querySelectorAll('[contenteditable]'))])
            editable.removeAttribute('contenteditable');
        parent.insertBefore(node, parent.children.item(injection.order));
    });
}
/**
 * Find the element a draft is actually for.
 *
 * A path alone has two silent failure modes after the page is restructured: it
 * stops resolving and the edit vanishes, or — the dangerous one — it keeps
 * resolving and now decorates whatever moved into that slot. A draft carrying a
 * fingerprint can tell those apart, so it gets the benefit: verified at its
 * path, recovered wherever it went, or skipped outright rather than painting a
 * stranger.
 *
 * Drafts saved before fingerprints existed keep exactly the old behaviour.
 * Being wrong the way it has always been wrong is better than changing what a
 * live site looks like on the strength of a guess we can't make.
 */
function resolveDraftTarget(root, path, draft) {
    if (!draft.fingerprint)
        return findElementByPath(root, path);
    const resolution = resolveAnchor({ path, fingerprint: draft.fingerprint }, root);
    return resolution.status === 'orphaned' ? null : resolution.element;
}
function applyFroamStore(store, snapshots, sectionSnapshots) {
    ensureRuntimeVisibilityStyle();
    if (document.documentElement.hasAttribute('data-chef-editing'))
        return;
    const root = getRoot();
    if (!root)
        return;
    removeRuntimeInjectedBlocks();
    applySectionStructure(store, sectionSnapshots);
    restoreInjectedBlocks(store);
    for (const [path, draft] of Object.entries(store)) {
        if (path === CANVAS_KEY || path === SECTION_STRUCTURE_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
            continue;
        const target = resolveDraftTarget(root, path, draft);
        if (target)
            snapshotDraftTarget(target, draft, snapshots);
    }
    applyCanvasDraftStyles(store[CANVAS_KEY]?.styles, snapshots);
}
export default function FroamRuntime({ apiBaseUrl, design = null, enabled = true, fetch, rootSelector, routeKey: explicitRouteKey, routes, prefer = 'repo', }) {
    const routeKey = useFroamRouteKey(explicitRouteKey);
    const runtimeRoutes = routes ?? getFroamStudioConfig().runtimeRoutes ?? DEFAULT_RUNTIME_ROUTES;
    const isRuntimeRoute = enabled && routeMatches(routeKey, runtimeRoutes);
    const [viewportMode, setViewportMode] = useState(() => getRuntimeViewportMode());
    const [publishedStore, setPublishedStore] = useState(null);
    // Fixed for the life of the page: an invite in the URL is what makes this a
    // session, and nothing else should start a poll loop.
    const inSession = useMemo(() => readRoomFromLocation() !== null, []);
    const appliedSnapshotsRef = useRef([]);
    const appliedSectionSnapshotsRef = useRef([]);
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
            restoreSectionRuntimeSnapshots(appliedSectionSnapshotsRef.current);
            appliedSnapshotsRef.current = [];
            appliedSectionSnapshotsRef.current = [];
            removeRuntimeInjectedBlocks();
            return;
        }
        // Repo Mode: a committed local design wins over the published API.
        // Legacy designs may store keys with trailing slashes — match on the
        // normalized form so a slash never hides a shipped design.
        const localRoute = design?.routes?.[routeKey]
            ?? Object.entries(design?.routes ?? {}).find(([key]) => normalizeFroamRouteKey(key) === routeKey)?.[1];
        const hasCommitted = !!localRoute && Object.prototype.hasOwnProperty.call(localRoute, viewportMode);
        const committedStore = hasCommitted ? (localRoute?.[viewportMode] ?? null) : null;
        if (hasCommitted && prefer === 'repo') {
            setPublishedStore(committedStore);
            return;
        }
        let cancelled = false;
        async function loadPublished() {
            try {
                const response = await apiGetFresh(endpoint);
                if (cancelled)
                    return;
                const published = response.design?.store ?? null;
                if (!hasCommitted) {
                    setPublishedStore(published);
                    return;
                }
                // prefer === 'newest': a design published after the last commit is
                // what someone most recently meant to ship. Without this, publishing
                // to an already-committed route does nothing and says nothing — which
                // reads as "saving is broken" to whoever pressed the button.
                const publishedAt = Date.parse(response.design?.publishedAt ?? response.design?.updatedAt ?? '') || 0;
                const committedAt = Date.parse(design?.updatedAt ?? '') || 0;
                setPublishedStore(published && publishedAt > committedAt ? published : committedStore);
            }
            catch {
                // Offline, or no publish backend at all: the committed design still
                // ships, which is the whole point of Repo Mode.
                if (!cancelled)
                    setPublishedStore(committedStore);
            }
        }
        void loadPublished();
        const receiveLivePublish = (event) => {
            const detail = event.detail;
            if (detail?.routeKey === routeKey && detail.viewport === viewportMode && !document.hidden)
                void loadPublished();
        };
        window.addEventListener('froam:design-published', receiveLivePublish);
        /**
         * In a session, keep asking.
         *
         * The presenter publishes as they work, so the client's page has to notice
         * without them refreshing — that is the whole "watch me change it" of a
         * review call. Polling rather than a socket because the same code has to
         * run on the dev bridge and on serverless, where nothing holds a
         * connection open.
         *
         * Only while the tab is visible: a buried tab repainting a design nobody
         * is looking at is just cost.
         */
        let poll = 0;
        if (inSession) {
            poll = window.setInterval(() => {
                if (!document.hidden)
                    void loadPublished();
            }, LIVE_POLL_MS);
        }
        return () => {
            cancelled = true;
            if (poll)
                window.clearInterval(poll);
            window.removeEventListener('froam:design-published', receiveLivePublish);
        };
    }, [design, endpoint, inSession, isRuntimeRoute, prefer, routeKey, viewportMode]);
    /* Fonts the design references must actually load with it. */
    useEffect(() => {
        if (!isRuntimeRoute || !publishedStore)
            return;
        ensureFontLinks(collectStoreFontFamilies(publishedStore));
    }, [publishedStore, isRuntimeRoute]);
    /* Brand faces travel inside the design, so they load without a stylesheet. */
    useEffect(() => {
        if (!isRuntimeRoute)
            return;
        ensureBrandFontStyle(design?.brandFonts);
    }, [design, isRuntimeRoute]);
    useEffect(() => {
        const root = getRoot();
        restoreRuntimeSnapshots(appliedSnapshotsRef.current);
        restoreSectionRuntimeSnapshots(appliedSectionSnapshotsRef.current);
        appliedSnapshotsRef.current = [];
        appliedSectionSnapshotsRef.current = [];
        removeRuntimeInjectedBlocks();
        if (!isRuntimeRoute || !publishedStore || !root)
            return;
        const storeToPaint = publishedStore;
        function paint() {
            try {
                restoreRuntimeSnapshots(appliedSnapshotsRef.current);
                restoreSectionRuntimeSnapshots(appliedSectionSnapshotsRef.current);
                removeRuntimeInjectedBlocks();
                const snapshots = [];
                const sectionSnapshots = [];
                applyFroamStore(storeToPaint, snapshots, sectionSnapshots);
                appliedSnapshotsRef.current = snapshots;
                appliedSectionSnapshotsRef.current = sectionSnapshots;
            }
            catch {
                // DOM may be mid-render — safe to skip this paint frame
            }
        }
        let paintFrame = 0;
        const observer = new MutationObserver((records) => {
            // Froam's own UI on the page (the gate, a review bar) isn't page content.
            if (records.every((record) => isInsideFroamUi(record.target)))
                return;
            cancelAnimationFrame(paintFrame);
            paintFrame = requestAnimationFrame(paintOwnChanges);
        });
        // A paint restores and re-applies, which mutates the root; dropping those
        // records keeps it from scheduling itself again on every frame.
        function paintOwnChanges() {
            paint();
            observer.takeRecords();
        }
        paintOwnChanges();
        // A portal's modal mounts on <body>, long after load: watch it too.
        const watchBody = root !== document.body && Object.keys(storeToPaint).some(isBodyScopedPath);
        observer.observe(watchBody ? document.body : root, { childList: true, subtree: true });
        return () => {
            cancelAnimationFrame(paintFrame);
            observer.disconnect();
            restoreRuntimeSnapshots(appliedSnapshotsRef.current);
            restoreSectionRuntimeSnapshots(appliedSectionSnapshotsRef.current);
            removeRuntimeInjectedBlocks();
            appliedSnapshotsRef.current = [];
            appliedSectionSnapshotsRef.current = [];
        };
    }, [publishedStore, isRuntimeRoute]);
    // The runtime paints a design and otherwise renders nothing. A review
    // session is the one exception: the client has no editor, so this is the
    // only Froam surface they will ever see.
    if (!isRuntimeRoute)
        return null;
    return _jsx(FroamReview, { routeKey: routeKey, viewport: viewportMode });
}
//# sourceMappingURL=FroamRuntime.js.map