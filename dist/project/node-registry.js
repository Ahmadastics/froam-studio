import { ANCHOR_MATCH_THRESHOLD, createAnchor, resolveAnchor, scoreFingerprint } from '../collab/anchor.js';
import { getElementPath } from '../collab/paths.js';
/** The identity attribute Froam already ships on injected nodes. */
export const FROAM_NODE_ATTRIBUTE = 'data-froam-id';
function defaultId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        return crypto.randomUUID();
    return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function safeSelectorValue(value) {
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}
export function isValidFroamNodeId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}
function attributedIdentity(element, root) {
    const value = element.getAttribute(FROAM_NODE_ATTRIBUTE);
    if (!isValidFroamNodeId(value))
        return null;
    const matches = root.querySelectorAll(`[${FROAM_NODE_ATTRIBUTE}="${safeSelectorValue(value)}"]`);
    // The first occurrence keeps an existing identity. Later duplicates are
    // allocated a new one instead of making two objects indistinguishable.
    return matches.length <= 1 || matches[0] === element ? value : null;
}
export function captureNodeRef(element, root, registry, options = {}) {
    const anchor = createAnchor(element, root);
    const attributed = attributedIdentity(element, root);
    const existing = attributed && registry[attributed]
        ? attributed
        : Object.values(registry).find((entry) => {
            if (entry.routeKey !== options.routeKey || entry.viewport !== options.viewport)
                return false;
            // An explicit host id is a stable signal. A path alone may locate an
            // existing registry record, but it never creates the permanent id.
            if (entry.fingerprint?.id && entry.fingerprint.id === anchor.fingerprint.id)
                return true;
            return entry.path === anchor.path
                && Boolean(entry.fingerprint)
                && scoreFingerprint(entry.fingerprint, anchor.fingerprint) >= ANCHOR_MATCH_THRESHOLD;
        })?.nodeId;
    const nodeId = existing || attributed || (options.idFactory ?? defaultId)();
    const ref = {
        nodeId,
        path: anchor.path,
        fingerprint: anchor.fingerprint,
        routeKey: options.routeKey,
        viewport: options.viewport,
    };
    if (options.attach !== false)
        element.setAttribute(FROAM_NODE_ATTRIBUTE, nodeId);
    return {
        ref,
        registry: {
            ...registry,
            [nodeId]: {
                ...ref,
                source: element.dataset.froamInjected === 'true' ? 'froam' : 'host-dom',
                updatedAt: options.now ?? Date.now(),
            },
        },
    };
}
export function resolveNodeRef(ref, root, registry = {}) {
    const stored = registry[ref.nodeId];
    const locator = {
        ...stored,
        ...ref,
        fingerprint: ref.fingerprint ?? stored?.fingerprint,
        path: ref.path ?? stored?.path,
    };
    const byNodeId = root.querySelector(`[${FROAM_NODE_ATTRIBUTE}="${safeSelectorValue(ref.nodeId)}"]`);
    if (byNodeId) {
        const updated = { ...locator, path: getElementPath(byNodeId, root) };
        return {
            status: 'exact',
            element: byNodeId,
            ref: updated,
            registry: updateRegistry(registry, updated, byNodeId),
        };
    }
    // Explicit host identity is stronger than the structural path and remains
    // useful when a host application has rerendered without Froam attributes.
    if (locator.fingerprint?.id) {
        const byHostId = root.querySelector(`#${safeSelectorValue(locator.fingerprint.id)}`);
        if (byHostId && byHostId.tagName.toLowerCase() === locator.fingerprint.tag) {
            byHostId.setAttribute(FROAM_NODE_ATTRIBUTE, ref.nodeId);
            const updated = { ...locator, path: getElementPath(byHostId, root) };
            return { status: 'recovered', element: byHostId, ref: updated, registry: updateRegistry(registry, updated, byHostId) };
        }
    }
    if (!locator.path || !locator.fingerprint)
        return { status: 'orphaned', ref: locator, registry };
    const resolved = resolveAnchor({ path: locator.path, fingerprint: locator.fingerprint }, root);
    if (resolved.status === 'orphaned')
        return { status: 'orphaned', ref: locator, registry };
    resolved.element.setAttribute(FROAM_NODE_ATTRIBUTE, ref.nodeId);
    const updated = { ...locator, path: resolved.path, fingerprint: createAnchor(resolved.element, root).fingerprint };
    return {
        status: resolved.status,
        element: resolved.element,
        ref: updated,
        registry: updateRegistry(registry, updated, resolved.element),
    };
}
function updateRegistry(registry, ref, element) {
    return {
        ...registry,
        [ref.nodeId]: {
            ...registry[ref.nodeId],
            ...ref,
            source: element.dataset.froamInjected === 'true' ? 'froam' : 'host-dom',
            updatedAt: Date.now(),
        },
    };
}
export function registryRef(registry, nodeId) {
    const entry = registry[nodeId];
    if (!entry)
        return null;
    const { source: _source, updatedAt: _updatedAt, ...ref } = entry;
    return ref;
}
//# sourceMappingURL=node-registry.js.map