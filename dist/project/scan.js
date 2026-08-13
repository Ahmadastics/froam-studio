import { captureNodeRef } from './node-registry.js';
import { ANCHOR_MATCH_THRESHOLD, createAnchor, scoreFingerprint } from '../collab/anchor.js';
import { FROAM_DNA_SCHEMA_VERSION } from './types.js';
function semanticRole(element) {
    const tag = element.tagName.toLowerCase();
    const explicit = element.getAttribute('role');
    if (tag === 'nav' || explicit === 'navigation')
        return { role: 'navigation', confidence: 1, reason: 'semantic HTML/role' };
    if (tag === 'button')
        return { role: 'button', confidence: 1, reason: 'semantic HTML' };
    if (/^h[1-6]$/.test(tag))
        return { role: 'heading', confidence: 1, reason: 'semantic HTML' };
    if (tag === 'p')
        return { role: 'paragraph', confidence: 1, reason: 'semantic HTML' };
    if (tag === 'form')
        return { role: 'form', confidence: 1, reason: 'semantic HTML' };
    if (['input', 'select', 'textarea'].includes(tag))
        return { role: 'input', confidence: 1, reason: 'semantic HTML' };
    if (tag === 'footer')
        return { role: 'footer', confidence: 1, reason: 'semantic HTML' };
    if (['ul', 'ol'].includes(tag))
        return { role: 'list', confidence: 1, reason: 'semantic HTML' };
    if (['img', 'picture', 'video', 'svg', 'canvas'].includes(tag))
        return { role: 'media', confidence: .98, reason: 'media element' };
    const text = `${element.id} ${typeof element.className === 'string' ? element.className : ''} ${element.textContent ?? ''}`.toLowerCase();
    if (tag === 'a' && /(buy|start|join|sign up|checkout|book|contact)/.test(text))
        return { role: 'cta', confidence: .78, reason: 'action copy heuristic' };
    if (/(^|\W)hero(\W|$)/.test(text))
        return { role: 'hero', confidence: .72, reason: 'name/class heuristic' };
    if (/(^|\W)(card|tile)(\W|$)/.test(text))
        return { role: 'card', confidence: .68, reason: 'name/class heuristic' };
    if (/(^|\W)badge(\W|$)/.test(text))
        return { role: 'badge', confidence: .68, reason: 'name/class heuristic' };
    if (/(^|\W)(modal|dialog)(\W|$)/.test(text) || explicit === 'dialog')
        return { role: 'modal', confidence: explicit === 'dialog' ? 1 : .7, reason: explicit ? 'role' : 'name/class heuristic' };
    if (/(^|\W)menu(\W|$)/.test(text))
        return { role: 'menu', confidence: .65, reason: 'name/class heuristic' };
    return { role: 'unknown', confidence: 0, reason: 'insufficient evidence' };
}
function px(value) { const number = Number.parseFloat(value); return Number.isFinite(number) ? number : undefined; }
function usefulStyle(style) {
    return {
        display: style.display, position: style.position, width: style.width, height: style.height,
        minWidth: style.minWidth, maxWidth: style.maxWidth, minHeight: style.minHeight, maxHeight: style.maxHeight,
        flexDirection: style.flexDirection, flexWrap: style.flexWrap, justifyContent: style.justifyContent, alignItems: style.alignItems,
        gridTemplateColumns: style.gridTemplateColumns, gridTemplateRows: style.gridTemplateRows, gap: style.gap,
        margin: style.margin, padding: style.padding, overflow: style.overflow,
    };
}
function appearance(style) {
    return {
        color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage,
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing, border: style.border, borderRadius: style.borderRadius,
        boxShadow: style.boxShadow, opacity: style.opacity,
    };
}
function accessibility(element, style) {
    const tag = element.tagName.toLowerCase();
    const label = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || undefined;
    const alt = tag === 'img' ? element.getAttribute('alt') : undefined;
    const focusable = element.tabIndex >= 0 || ['a', 'button', 'input', 'select', 'textarea'].includes(tag);
    const warnings = [];
    if (tag === 'img' && alt === null)
        warnings.push('Image has no alt attribute');
    if (['button', 'a'].includes(tag) && !label && !(element.textContent ?? '').trim())
        warnings.push('Interactive element has no accessible name');
    const rect = element.getBoundingClientRect();
    if (focusable && (rect.width < 24 || rect.height < 24))
        warnings.push('Small interactive target');
    return { semanticTag: tag, role: element.getAttribute('role') ?? undefined, ariaLabel: label, alt, focusable, outline: style.outline, warnings };
}
function structuralSignature(element, role, style) {
    const children = Array.from(element.children).map((child) => child.tagName.toLowerCase()).join(',');
    return `${element.tagName.toLowerCase()}|${role}|${style.display}|${children}`;
}
export function detectComponentFamilies(records) {
    const buckets = new Map();
    for (const record of records) {
        const structure = record.signals.find((signal) => signal.kind === 'structure')?.values;
        const semantics = record.signals.find((signal) => signal.kind === 'semantics')?.values;
        const signature = String(structure?.signature ?? '');
        if (!signature || semantics?.role === 'unknown')
            continue;
        buckets.set(signature, [...(buckets.get(signature) ?? []), record.node.nodeId]);
    }
    return [...buckets.entries()].filter(([, members]) => members.length >= 2).map(([signature, memberNodeIds], index) => ({
        id: `family:${index}:${signature.length}`, signature, memberNodeIds, confidence: Math.min(.92, .7 + memberNodeIds.length * .04),
    }));
}
/** Local-only DOM understanding. It never uploads source or credentials. */
export function scanDomTree(root, registry, options) {
    const capturedAt = options.now ?? Date.now();
    const scanRoot = options.selectedRoot ?? root;
    const elements = [scanRoot, ...Array.from(scanRoot.querySelectorAll('*'))]
        .filter((element) => !element.closest('[data-chef-editor-root]'))
        .slice(0, options.maxNodes ?? 600);
    let nextRegistry = { ...registry };
    const registryByPath = new Map(Object.values(registry).filter((entry) => entry.path).map((entry) => [`${entry.routeKey ?? ''}|${entry.viewport ?? ''}|${entry.path}`, entry]));
    const refs = new Map();
    for (const element of elements) {
        const anchor = createAnchor(element, root);
        const indexed = registryByPath.get(`${options.routeKey}|${options.viewport}|${anchor.path}`);
        const preferredNodeId = indexed?.fingerprint && scoreFingerprint(indexed.fingerprint, anchor.fingerprint) >= ANCHOR_MATCH_THRESHOLD ? indexed.nodeId : undefined;
        const captured = captureNodeRef(element, root, nextRegistry, { routeKey: options.routeKey, viewport: options.viewport, now: capturedAt, preferredNodeId, skipRegistrySearch: true, mutateRegistry: true });
        nextRegistry = captured.registry;
        refs.set(element, captured.ref);
    }
    const records = [];
    const nodes = [];
    const relations = [];
    for (const element of elements) {
        const ref = refs.get(element);
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const semantic = semanticRole(element);
        const parent = element.parentElement ? refs.get(element.parentElement) : undefined;
        const childNodeIds = Array.from(element.children).map((child) => refs.get(child)?.nodeId).filter((id) => Boolean(id));
        const siblingNodeIds = element.parentElement ? Array.from(element.parentElement.children).filter((child) => child !== element).map((child) => refs.get(child)?.nodeId).filter((id) => Boolean(id)) : [];
        const signals = [
            { kind: 'identity', origin: 'observed', source: 'dom', values: { nodeId: ref.nodeId, path: ref.path, routeKey: options.routeKey, viewport: options.viewport, sourceType: element.dataset.froamInjected === 'true' ? 'froam' : 'host-dom', fingerprint: ref.fingerprint } },
            { kind: 'structure', origin: 'observed', source: 'dom', values: { parentNodeId: parent?.nodeId, childNodeIds, siblingNodeIds, tag: element.tagName.toLowerCase(), signature: structuralSignature(element, semantic.role, style) } },
            { kind: 'layout', origin: 'observed', source: 'computed-style', values: { ...usefulStyle(style), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, gapPx: px(style.gap) } },
            { kind: 'appearance', origin: 'observed', source: 'computed-style', values: appearance(style) },
            { kind: 'semantics', origin: semantic.role === 'unknown' ? 'inferred' : semantic.confidence === 1 ? 'observed' : 'inferred', source: semantic.confidence === 1 ? 'dom' : 'heuristic', confidence: semantic.confidence, values: { role: semantic.role, reason: semantic.reason, textContent: (element.innerText || '').trim().slice(0, 1_000) || undefined } },
            { kind: 'behavior', origin: 'observed', source: 'runtime', values: { clickable: element.onclick !== null || element.hasAttribute('onclick') || ['a', 'button'].includes(element.tagName.toLowerCase()), transition: style.transition, animation: style.animation, hoverInspectable: typeof element.matches === 'function', focusable: element.tabIndex >= 0 } },
            { kind: 'responsive', origin: 'observed', source: 'computed-style', values: { viewport: options.viewport, visible: style.display !== 'none' && style.visibility !== 'hidden', wrapping: style.flexWrap, overflowX: style.overflowX, overflowY: style.overflowY, width: rect.width, height: rect.height } },
            { kind: 'accessibility', origin: 'observed', source: 'dom', values: accessibility(element, style) },
        ];
        const record = { schemaVersion: 1, id: `scan:${ref.nodeId}:${capturedAt}`, node: ref, capturedAt, signals, childNodeIds, siblingNodeIds };
        records.push(record);
        nodes.push({ id: ref.nodeId, kind: element.dataset.froamInjected === 'true' ? 'component-instance' : 'element', name: semantic.role === 'unknown' ? element.tagName.toLowerCase() : semantic.role, parentId: parent?.nodeId ?? null, source: element.dataset.froamInjected === 'true' ? 'froam' : 'host-dom', locator: ref, metadata: { semanticRole: semantic.role, semanticConfidence: semantic.confidence, scanId: record.id } });
        if (parent)
            relations.push({ id: `contains:${parent.nodeId}:${ref.nodeId}`, kind: 'contains', from: parent.nodeId, to: ref.nodeId });
    }
    const families = detectComponentFamilies(records);
    for (const family of families) {
        const familyNodeId = family.id;
        nodes.push({ id: familyNodeId, kind: 'component-definition', name: 'Detected family', source: 'froam', metadata: { confidence: family.confidence, signature: family.signature } });
        for (const member of family.memberNodeIds)
            relations.push({ id: `instance:${member}:${familyNodeId}`, kind: 'instance-of', from: member, to: familyNodeId, metadata: { confidence: family.confidence } });
    }
    return { schemaVersion: 1, capturedAt, rootNodeId: refs.get(scanRoot).nodeId, records, nodes, relations, registry: nextRegistry, families };
}
/** Convert evidence into versioned DNA without erasing uncertainty or provenance. */
export function dnaFromScan(record) {
    const dna = { schemaVersion: FROAM_DNA_SCHEMA_VERSION, nodeId: record.node.nodeId, capturedAt: record.capturedAt, knowledge: {} };
    const target = { identity: 'identity', structure: 'structure', layout: 'layout', appearance: 'visual', semantics: 'semantics', behavior: 'behavior', responsive: 'responsive', accessibility: 'accessibility', provenance: 'provenance' };
    for (const signal of record.signals) {
        const key = target[signal.kind];
        if (!key)
            continue;
        const current = dna[key] ?? {};
        dna[key] = { ...current, ...signal.values };
        dna.knowledge[`${signal.kind}.$source`] = { value: null, origin: signal.origin, source: signal.source, confidence: signal.confidence, capturedAt: record.capturedAt };
        if (signal.origin !== 'observed' || signal.confidence !== undefined)
            for (const [field, value] of Object.entries(signal.values))
                dna.knowledge[`${signal.kind}.${field}`] = { value, origin: signal.origin, source: signal.source, confidence: signal.confidence, capturedAt: record.capturedAt };
    }
    const projectionHash = dnaProjectionHash(dna);
    dna.provenance = { ...dna.provenance, _froamProjection: { kind: 'scan-derived-v1', scanId: record.id, hash: projectionHash } };
    return dna;
}
/** Fingerprint the exact derived DNA payload while excluding its own storage marker. */
export function dnaProjectionHash(dna) {
    const provenance = { ...dna.provenance };
    delete provenance._froamProjection;
    const normalized = Object.keys(provenance).length ? { ...dna, provenance } : Object.fromEntries(Object.entries(dna).filter(([key]) => key !== 'provenance'));
    const serialized = JSON.stringify(normalized);
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    for (let index = 0; index < serialized.length; index += 1) {
        const code = serialized.charCodeAt(index);
        a = Math.imul(a ^ code, 0x01000193);
        b = Math.imul(b ^ code, 0x85ebca6b);
    }
    return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}:${serialized.length}`;
}
/** Re-scan only the highest changed roots; callers keep unaffected records/DNA. */
export function scanDomChanges(root, changed, registry, options) {
    const unique = changed.filter((element, index, all) => root.contains(element) && !all.some((other, otherIndex) => otherIndex !== index && other.contains(element)));
    let nextRegistry = registry;
    const bundles = [];
    for (const element of unique) {
        const bundle = scanDomTree(root, nextRegistry, { routeKey: options.routeKey, viewport: options.viewport, now: options.now, selectedRoot: element, maxNodes: options.maxNodesPerRegion ?? 600 });
        nextRegistry = bundle.registry;
        bundles.push(bundle);
    }
    const records = bundles.flatMap((bundle) => bundle.records);
    return { records, dna: records.map(dnaFromScan), nodes: bundles.flatMap((bundle) => bundle.nodes), relations: bundles.flatMap((bundle) => bundle.relations), registry: nextRegistry, invalidatedNodeIds: [...new Set(records.map((record) => record.node.nodeId))] };
}
//# sourceMappingURL=scan.js.map