import { ANCHOR_MATCH_THRESHOLD, createAnchor, resolveAnchor, scoreFingerprint } from '../collab/anchor.js';
import { findElementByPath, getElementPath } from '../collab/paths.js';
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
    const existing = options.preferredNodeId || (attributed && registry[attributed]
        ? attributed
        : options.skipRegistrySearch ? undefined : Object.values(registry).find((entry) => {
            if (entry.routeKey !== options.routeKey || entry.viewport !== options.viewport)
                return false;
            // An explicit host id is a stable signal. A path alone may locate an
            // existing registry record, but it never creates the permanent id.
            if (entry.fingerprint?.id && entry.fingerprint.id === anchor.fingerprint.id)
                return true;
            return entry.path === anchor.path
                && Boolean(entry.fingerprint)
                && scoreFingerprint(entry.fingerprint, anchor.fingerprint) >= ANCHOR_MATCH_THRESHOLD;
        })?.nodeId);
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
    const entry = { ...ref, source: element.dataset.froamInjected === 'true' ? 'froam' : 'host-dom', updatedAt: options.now ?? Date.now() };
    if (options.mutateRegistry) {
        registry[nodeId] = entry;
        return { ref, registry };
    }
    return { ref, registry: { ...registry, [nodeId]: entry } };
}
export function resolveNodeRef(ref, root, registry = {}, options = {}) {
    const at = options.now ?? Date.now();
    const emit = (event) => options.onDiagnostic?.({ ...event, nodeId: ref.nodeId, at });
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
            resolvedBy: 'attribute',
            element: byNodeId,
            ref: updated,
            registry: updateRegistry(registry, updated, byNodeId, 'attribute', at),
        };
    }
    if (stored)
        emit({ type: 'identity-attribute-lost', path: locator.path });
    // Explicit host identity is stronger than the structural path and remains
    // useful when a host application has rerendered without Froam attributes.
    if (locator.fingerprint?.id) {
        const byHostId = root.querySelector(`#${safeSelectorValue(locator.fingerprint.id)}`);
        if (byHostId && byHostId.tagName.toLowerCase() === locator.fingerprint.tag) {
            byHostId.setAttribute(FROAM_NODE_ATTRIBUTE, ref.nodeId);
            const updated = { ...locator, path: getElementPath(byHostId, root) };
            emit({ type: 'registry-updated', path: updated.path, detail: 'Recovered through explicit host id' });
            return { status: 'recovered', resolvedBy: 'host-id', element: byHostId, ref: updated, registry: updateRegistry(registry, updated, byHostId, 'host-id', at) };
        }
    }
    if (!locator.path || !locator.fingerprint) {
        emit({ type: 'resolution-failed', path: locator.path, detail: 'Missing path or fingerprint' });
        return { status: 'orphaned', ref: locator, registry: markResolution(registry, ref.nodeId, 'failed', at) };
    }
    const atPath = findElementByPath(root, locator.path);
    if (atPath) {
        const pathScore = scoreFingerprint(locator.fingerprint, createAnchor(atPath, root).fingerprint);
        if (pathScore >= ANCHOR_MATCH_THRESHOLD) {
            atPath.setAttribute(FROAM_NODE_ATTRIBUTE, ref.nodeId);
            const updated = { ...locator, fingerprint: createAnchor(atPath, root).fingerprint };
            emit({ type: 'resolved-by-path', path: locator.path, score: pathScore });
            emit({ type: 'registry-updated', path: locator.path });
            return { status: 'recovered', resolvedBy: 'path', element: atPath, ref: updated, registry: updateRegistry(registry, updated, atPath, 'path', at) };
        }
        emit({ type: 'path-stale', path: locator.path, score: pathScore });
    }
    else
        emit({ type: 'path-stale', path: locator.path, detail: 'Path no longer resolves' });
    const scored = Array.from(root.querySelectorAll(locator.fingerprint.tag))
        .map((element) => ({ element, score: scoreFingerprint(locator.fingerprint, createAnchor(element, root).fingerprint) }))
        .filter((candidate) => candidate.score >= ANCHOR_MATCH_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    if (scored.length > 1 && scored[0].score - scored[1].score <= (options.ambiguityDelta ?? 0.05)) {
        emit({ type: 'ambiguous-match', path: locator.path, score: scored[0].score, detail: `${scored.length} viable candidates` });
        return { status: 'orphaned', ref: locator, registry: markResolution(registry, ref.nodeId, 'ambiguous', at) };
    }
    const resolved = resolveAnchor({ path: locator.path, fingerprint: locator.fingerprint }, root);
    if (resolved.status === 'orphaned') {
        emit({ type: 'resolution-failed', path: locator.path });
        return { status: 'orphaned', ref: locator, registry: markResolution(registry, ref.nodeId, 'failed', at) };
    }
    resolved.element.setAttribute(FROAM_NODE_ATTRIBUTE, ref.nodeId);
    const updated = { ...locator, path: resolved.path, fingerprint: createAnchor(resolved.element, root).fingerprint };
    emit({ type: 'fingerprint-match', path: resolved.path, score: resolved.status === 'recovered' ? resolved.score : 1 });
    emit({ type: 'registry-updated', path: resolved.path });
    return {
        status: resolved.status,
        resolvedBy: 'fingerprint',
        element: resolved.element,
        ref: updated,
        registry: updateRegistry(registry, updated, resolved.element, 'fingerprint', at),
    };
}
function markResolution(registry, nodeId, method, at) {
    const entry = registry[nodeId];
    return entry ? { ...registry, [nodeId]: { ...entry, lastResolution: method, updatedAt: at } } : registry;
}
function updateRegistry(registry, ref, element, method, at) {
    const previous = registry[ref.nodeId];
    return {
        ...registry,
        [ref.nodeId]: {
            ...previous,
            ...ref,
            source: element.dataset.froamInjected === 'true' ? 'froam' : 'host-dom',
            updatedAt: at,
            lastResolution: method,
            recoveryCount: (previous?.recoveryCount ?? 0) + (method === 'attribute' ? 0 : 1),
        },
    };
}
export function registryRef(registry, nodeId) {
    const entry = registry[nodeId];
    if (!entry)
        return null;
    const { source: _source, updatedAt: _updatedAt, lastResolution: _lastResolution, recoveryCount: _recoveryCount, ...ref } = entry;
    return ref;
}
/** A project-level diagnostic snapshot. Percentages describe registry entries, not human sessions. */
export function identityHealthReport(registry) {
    const entries = Object.values(registry);
    const counts = { attribute: 0, 'host-id': 0, path: 0, fingerprint: 0, ambiguous: 0, failed: 0, uncaptured: 0 };
    for (const entry of entries)
        counts[entry.lastResolution ?? 'uncaptured'] += 1;
    const total = entries.length;
    const stable = counts.attribute + counts['host-id'] + counts.uncaptured;
    const recovered = counts.path + counts.fingerprint;
    return { total, counts, stablePercent: total ? stable / total * 100 : 100, recoveryPercent: total ? recovered / total * 100 : 0, ambiguous: counts.ambiguous, failed: counts.failed };
}
//# sourceMappingURL=node-registry.js.map