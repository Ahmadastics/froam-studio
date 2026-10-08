import { getElementPath, isFroamOwnedNode, isInPageScope, isPathElement } from '../../collab/paths.js';
import { SVG_NS, shouldSkipElement } from './dom.js';
import { subscribePageStyles } from './page-styles.js';
import { isTextVisualLayer } from './writing.js';
/**
 * What the pointer is over, as Froam sees the page: the editable element under
 * a point (SVG internals roll up to their <svg>, Froam's own UI never counts),
 * everything beneath it for Alt+click, and click-through layers
 * (`pointer-events: none`) that the browser's own hit test skips.
 *
 * Page content is the root plus anything else on <body> that isn't Froam's
 * (a React app's portals: modals, drawers, toasts — see isInPageScope).
 *
 * One tester per editable root. It marks click-through layers and keeps the
 * marks current as the page changes; call disconnect() when editing stops.
 */
export function createHitTester(rootElement, getSelectedPath) {
    /** The editable element for a raw event/hit target: SVG internals roll up
     *  to their outermost <svg>; editor UI and skipped tags resolve to null. */
    function resolveTarget(rawTarget) {
        let element = rawTarget instanceof Element ? rawTarget : null;
        if (element && element.namespaceURI === SVG_NS) {
            let svgRoot = element.tagName.toLowerCase() === 'svg' ? element : element.closest('svg');
            while (svgRoot?.parentElement?.namespaceURI === SVG_NS)
                svgRoot = svgRoot.parentElement.closest('svg');
            element = svgRoot;
        }
        while (element && isInPageScope(element, rootElement)) {
            if (element.closest('[data-chef-editor-root="true"]'))
                return null;
            if (isPathElement(element) && !shouldSkipElement(element))
                return element;
            element = element.parentElement;
        }
        return null;
    }
    /**
     * Inside a text block, the caret position says which inline piece was
     * clicked. Only ever refine *inward* (to the target or something inside
     * it) — never out to an ancestor, never across to a neighbour.
     */
    function resolveTextTargetAtPoint(event, fallback) {
        const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
        const start = range?.startContainer;
        let element = start instanceof HTMLElement ? start : start?.parentElement ?? null;
        if (!element || !fallback.contains(element))
            return fallback;
        while (element && element !== fallback) {
            if (isTextVisualLayer(element)) {
                const rect = element.getBoundingClientRect();
                if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)
                    return element;
            }
            element = element.parentElement;
        }
        return fallback;
    }
    function pushSelectionCandidate(candidates, element) {
        if (!element || !isInPageScope(element, rootElement))
            return;
        if (element.closest('[data-chef-editor-root="true"]'))
            return;
        if (shouldSkipElement(element))
            return;
        if (!candidates.includes(element))
            candidates.push(element);
    }
    function selectableAncestors(element) {
        const ancestors = [];
        let current = element;
        while (current && current !== rootElement && isInPageScope(current, rootElement)) {
            pushSelectionCandidate(ancestors, current);
            current = current.parentElement;
        }
        return ancestors;
    }
    /* Click-through layers come from the shared page-style index (found when
       the page is idle, re-read only where it changes) and are marked so
       visualStackAtPoint() can switch just those on. */
    const PE_ATTR = 'data-froam-pe';
    const body = rootElement.ownerDocument.body;
    let clickThroughLayers = [];
    const unsubscribe = subscribePageStyles(rootElement, (index, changed) => {
        if (!changed.clickThrough)
            return;
        const next = new Set(index.clickThrough);
        for (const el of clickThroughLayers)
            if (!next.has(el) && el.isConnected)
                el.removeAttribute(PE_ATTR);
        for (const el of next)
            if (el.getAttribute(PE_ATTR) !== 'none')
                el.setAttribute(PE_ATTR, 'none');
        clickThroughLayers = [...next];
    });
    /**
     * Everything under a point, in visual order — including layers the page
     * made click-through with `pointer-events: none` (overlays, decorations,
     * annotations), which the browser's own hit test skips. Hit-testing is
     * briefly switched to "everything counts" for this one query.
     */
    function visualStackAtPoint(x, y) {
        if (typeof document.elementsFromPoint !== 'function')
            return [];
        // Most points have no click-through layer over them: then the browser's
        // own hit test is already the full answer, and nothing gets restyled.
        const covered = clickThroughLayers.some((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        });
        let hits;
        if (!covered) {
            hits = document.elementsFromPoint(x, y);
        }
        else {
            // On <html>, so layers beside the root (in a portal) switch on too.
            const html = document.documentElement;
            html.setAttribute('data-froam-hittest', 'true');
            try {
                hits = document.elementsFromPoint(x, y);
            }
            finally {
                html.removeAttribute('data-froam-hittest');
            }
        }
        const stack = [];
        for (const hit of hits)
            pushSelectionCandidate(stack, resolveTarget(hit));
        return stack;
    }
    /**
     * A click-through layer that's just atmosphere — no text of its own, and
     * spanning most of the screen (background art, gradient washes, noise) —
     * shouldn't swallow every click. It stays reachable with Alt+click and
     * from Layers; the content beneath it is selected first.
     */
    function isAmbientOverlay(element) {
        if (window.getComputedStyle(element).pointerEvents !== 'none')
            return false;
        if (element.innerText?.trim())
            return false;
        const rect = element.getBoundingClientRect();
        return rect.width * rect.height >= window.innerWidth * window.innerHeight * 0.35;
    }
    function selectionStackAtPoint(event, primary, visual) {
        const stack = [];
        pushSelectionCandidate(stack, primary);
        for (const element of visual)
            pushSelectionCandidate(stack, element);
        for (const ancestor of selectableAncestors(primary))
            pushSelectionCandidate(stack, ancestor);
        return stack;
    }
    /**
     * Froam's UI, or anything inside a node Froam owns on <body> (the standalone
     * host, a host page's own Froam chrome such as a demo's dialog).
     */
    function isOnFroamUi(target) {
        if (!(target instanceof Element))
            return false;
        if (target.closest('[data-chef-editor-root="true"]'))
            return true;
        let top = target;
        while (top.parentElement && top.parentElement !== body)
            top = top.parentElement;
        return top.parentElement === body && isFroamOwnedNode(top);
    }
    /** What a click at this point should select, plus everything beneath it for Alt+click. */
    function resolveClick(event) {
        // A click on Froam's own UI is never also a click on the page beneath it:
        // the point-stack below would find the page under a dialog, select it, and
        // swallow the click before the dialog's button ever saw it.
        if (isOnFroamUi(event.target)) {
            return { target: null, stack: [] };
        }
        // Keyboard-activated clicks (Enter/Space on a focused control) carry no
        // position; fall back to the element the event was fired at.
        const positioned = event.detail > 0 || event.clientX !== 0 || event.clientY !== 0;
        let visual = positioned ? visualStackAtPoint(event.clientX, event.clientY) : [];
        if (visual.length > 1 && isAmbientOverlay(visual[0])) {
            const firstContent = visual.findIndex((element) => !isAmbientOverlay(element));
            if (firstContent > 0)
                visual = [...visual.slice(firstContent), ...visual.slice(0, firstContent)];
        }
        const hit = visual[0] ?? resolveTarget(event.target);
        if (!hit)
            return { target: null, stack: [] };
        const primary = resolveTextTargetAtPoint(event, hit);
        const stack = selectionStackAtPoint(event, primary, visual);
        return { target: chooseSelectionTarget(event, stack), stack };
    }
    function chooseSelectionTarget(event, stack) {
        if (!event.altKey || stack.length < 2)
            return stack[0] ?? null;
        const selectedPath = getSelectedPath();
        const selectedIndex = selectedPath
            ? stack.findIndex((candidate) => getElementPath(candidate, rootElement) === selectedPath)
            : -1;
        return stack[(selectedIndex + 1 + stack.length) % stack.length] ?? stack[0] ?? null;
    }
    function disconnect() {
        unsubscribe();
        for (const el of clickThroughLayers)
            el.removeAttribute(PE_ATTR);
        clickThroughLayers = [];
    }
    return { resolveTarget, resolveClick, disconnect };
}
//# sourceMappingURL=hit-test.js.map