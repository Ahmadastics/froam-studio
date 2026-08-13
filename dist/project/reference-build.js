import { scopeKey } from '../collab/types.js';
import { appendProjectEvents, createProjectBranch, createProjectEvent, deriveBranchState } from './event-log.js';
import { referenceValidationWidths } from './reference-intelligence.js';
export const FROAM_REFERENCE_BUILD_VERSION = 1;
export const FROAM_REFERENCE_BUILD_LIMITS = { maxNewNodes: 100, maxDepth: 12, maxStructuralOperations: 50, maxValidationWidths: 12, maxCorrectionPasses: 3 };
const INJECTION_PREFIX = '__froam_injection__:';
const ROOT_PARENT_PATH = '__froam_root__';
function safe(value) { return value.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 80) || 'reference-build'; }
function clamp(value) { return Math.max(0, Math.min(1, value)); }
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined; }
function unique(values) { return [...new Set(values)]; }
function evidenceId(prefix, value) { return `${prefix}:${safe(value)}`; }
function observedViewport(width) { return width <= 480 ? 'mobile' : width <= 900 ? 'tablet' : 'desktop'; }
function priorityWidths(understanding) {
    const observed = understanding.responsiveSignature.observedWidths;
    const intervals = understanding.responsiveSignature.hypotheses.flatMap((item) => item.betweenWidths ? [item.betweenWidths] : []);
    const all = referenceValidationWidths(observed, understanding.responsiveSignature.hypotheses);
    const strategic = unique([
        ...observed,
        320,
        390,
        1440,
        ...intervals.flatMap(([lower, upper]) => [lower, Math.round((lower + upper) / 2), upper]),
        ...all,
    ]).filter((width) => width >= 240 && width <= 2560);
    const ranked = strategic.sort((a, b) => {
        const score = (width) => observed.includes(width) ? 0 : intervals.some(([lower, upper]) => width === lower || width === upper) ? 1 : [320, 390, 1440].includes(width) ? 2 : 3;
        return score(a) - score(b) || a - b;
    }).slice(0, FROAM_REFERENCE_BUILD_LIMITS.maxValidationWidths);
    return ranked.sort((a, b) => a - b);
}
function responsiveConstraints(understanding) {
    const constraints = [];
    for (const observation of understanding.responsiveSignature.observations) {
        if (observation.kind === 'grid' && typeof observation.values?.columns === 'number')
            constraints.push({ id: `constraint:${observation.id}`, kind: 'grid-columns', origin: 'observed', evidenceIds: [observation.id], width: observation.width, expected: { columns: observation.values.columns } });
        if (observation.kind === 'layout' && typeof observation.values?.orientation === 'string')
            constraints.push({ id: `constraint:${observation.id}`, kind: 'orientation', origin: 'observed', evidenceIds: [observation.id], width: observation.width, expected: { orientation: observation.values.orientation } });
        if (observation.kind === 'navigation') {
            const textItems = Number(observation.values?.textItems ?? 0);
            const compactControls = Number(observation.values?.compactControls ?? 0);
            constraints.push({ id: `constraint:${observation.id}`, kind: 'navigation-shape', origin: 'observed', evidenceIds: [observation.id], width: observation.width, expected: { shape: compactControls > 0 && textItems <= 1 ? 'compact' : 'expanded', textItems, compactControls } });
        }
        if (observation.kind === 'container' && typeof observation.values?.viewportRatio === 'number')
            constraints.push({ id: `constraint:${observation.id}`, kind: 'container-ratio', origin: 'observed', evidenceIds: [observation.id], width: observation.width, expected: { ratio: observation.values.viewportRatio } });
    }
    for (const hypothesis of understanding.responsiveSignature.hypotheses)
        if (hypothesis.betweenWidths)
            constraints.push({ id: `constraint:${hypothesis.id}`, kind: 'transition-interval', origin: 'inferred', evidenceIds: hypothesis.evidenceIds, betweenWidths: hypothesis.betweenWidths, expected: { transition: hypothesis.kind } });
    return constraints.slice(0, 80);
}
function dominantMode(constraints) {
    if (constraints.some((item) => item.kind === 'grid-columns'))
        return 'grid';
    if (constraints.some((item) => item.kind === 'orientation'))
        return 'hero';
    if (constraints.some((item) => item.kind === 'navigation-shape'))
        return 'navigation';
    return 'layout';
}
function selectedStyles(mode, attempt) {
    const cardMinimum = [260, 240, 220][Math.max(0, Math.min(2, attempt - 1))];
    if (mode === 'grid')
        return { display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${cardMinimum}px),1fr))`, gap: attempt === 1 ? '24px' : attempt === 2 ? '20px' : '16px', width: '100%', maxWidth: '1200px', marginInline: 'auto', boxSizing: 'border-box' };
    if (mode === 'hero')
        return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', alignItems: 'center', gap: attempt === 1 ? '48px' : attempt === 2 ? '36px' : '28px', width: '100%', boxSizing: 'border-box' };
    if (mode === 'navigation')
        return { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: attempt === 1 ? '20px' : '14px', width: '100%', boxSizing: 'border-box' };
    return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: '24px', width: '100%', boxSizing: 'border-box' };
}
function structureFor(understanding, target) {
    const structure = [{ id: `structure:${target.nodeId}`, nodeId: target.nodeId, parentNodeId: null, kind: 'target', role: target.kind === 'current-page' ? 'page-section' : 'selected-target', depth: 0, origin: 'observed', evidenceIds: understanding.reconstructions.map((item) => item.reference.id) }];
    const relationships = [];
    if (target.kind === 'selected')
        return { structure, relationships };
    const primary = understanding.reconstructions.at(-1);
    const repeated = primary?.reconstruction.regions.filter((region) => region.componentFamilyId) ?? [];
    const family = repeated[0]?.componentFamilyId;
    const rootId = `${target.nodeId}:layout`;
    structure.push({ id: `structure:${rootId}`, nodeId: rootId, parentNodeId: target.nodeId, kind: 'section', role: 'reconstructed-layout', depth: 1, origin: 'inferred', evidenceIds: primary ? [primary.reference.id] : [], placeholder: true });
    relationships.push({ id: `relation:${target.nodeId}:${rootId}`, kind: 'contains', from: target.nodeId, to: rootId, origin: 'inferred', evidenceIds: primary ? [primary.reference.id] : [] });
    const contentId = `${rootId}:content`;
    structure.push({ id: `structure:${contentId}`, nodeId: contentId, parentNodeId: rootId, kind: 'content', role: 'generic-content', depth: 2, origin: 'inferred', evidenceIds: primary ? [primary.reference.id] : [], placeholder: true });
    relationships.push({ id: `relation:${rootId}:${contentId}`, kind: 'contains', from: rootId, to: contentId, origin: 'inferred', evidenceIds: primary ? [primary.reference.id] : [] });
    if (family) {
        const definitionId = `${rootId}:family`;
        structure.push({ id: `structure:${definitionId}`, nodeId: definitionId, parentNodeId: rootId, kind: 'component-definition', role: 'observed-repeated-family', depth: 2, origin: 'observed', evidenceIds: repeated.map((item) => item.id), componentFamilyId: family });
        const count = Math.min(8, Math.max(2, repeated.length));
        for (let index = 0; index < count; index += 1) {
            const nodeId = `${rootId}:item:${index + 1}`;
            structure.push({ id: `structure:${nodeId}`, nodeId, parentNodeId: rootId, kind: 'component-instance', role: 'generic-repeated-item', depth: 2, origin: 'inferred', evidenceIds: repeated.map((item) => item.id), componentFamilyId: family, placeholder: true });
            relationships.push({ id: `relation:${rootId}:${nodeId}`, kind: 'contains', from: rootId, to: nodeId, origin: 'inferred', evidenceIds: repeated.map((item) => item.id) }, { id: `relation:${nodeId}:${definitionId}`, kind: 'instance-of', from: nodeId, to: definitionId, origin: 'inferred', evidenceIds: repeated.map((item) => item.id) });
        }
    }
    return { structure, relationships };
}
export function createDeterministicReferenceBuildPlan(input) {
    const { understanding, target } = input;
    const now = input.now ?? Date.now();
    const attempt = Math.max(1, Math.min(FROAM_REFERENCE_BUILD_LIMITS.maxCorrectionPasses, Math.floor(input.attempt ?? 1)));
    const constraints = responsiveConstraints(understanding);
    const mode = dominantMode(constraints);
    const graph = structureFor(understanding, target);
    const evidence = [
        ...understanding.responsiveSignature.observations.map((item) => ({ id: item.id, origin: 'observed', summary: item.summary, referenceIds: item.referenceIds })),
        ...understanding.responsiveSignature.hypotheses.map((item) => ({ id: item.id, origin: 'inferred', summary: item.summary, referenceIds: item.evidenceIds })),
    ].slice(0, 120);
    const operations = [];
    if (target.kind === 'selected') {
        for (const viewport of ['desktop', 'tablet', 'mobile'])
            for (const [property, value] of Object.entries(selectedStyles(mode, attempt)))
                operations.push({ id: `style:${viewport}:${property}`, kind: 'style', nodeId: target.nodeId, path: target.path, viewport, property, value, origin: constraints.some((item) => item.origin === 'observed') ? 'observed' : 'inferred', evidenceIds: constraints.filter((item) => !item.width || observedViewport(item.width) === viewport).flatMap((item) => item.evidenceIds).slice(0, 12) });
    }
    else
        operations.push({ id: `insert:${target.nodeId}:layout`, kind: 'insert', nodeId: `${target.nodeId}:layout`, parentNodeId: target.nodeId, parentPath: ROOT_PARENT_PATH, index: 0, origin: 'inferred', evidenceIds: evidence.filter((item) => item.origin === 'observed').flatMap((item) => item.referenceIds).slice(0, 12) });
    operations.push({ id: `dna:${target.nodeId}`, kind: 'capture-dna', nodeId: target.nodeId, origin: 'inferred', evidenceIds: constraints.flatMap((item) => item.evidenceIds).slice(0, 12) }, { id: `responsive:${target.nodeId}`, kind: 'responsive-policy', nodeId: target.nodeId, origin: 'inferred', evidenceIds: constraints.flatMap((item) => item.evidenceIds).slice(0, 12) });
    const primary = understanding.reconstructions.at(-1);
    const dnaChanges = [
        { id: `dna-layout:${target.nodeId}`, nodeId: target.nodeId, section: 'layout', values: { strategy: mode, normalizedGeometryEvidence: understanding.normalizedRegions.filter((item) => item.referenceId === primary?.reference.id).slice(0, 30) }, origin: 'observed', evidenceIds: primary ? [primary.reference.id] : [], executable: true },
        { id: `dna-responsive:${target.nodeId}`, nodeId: target.nodeId, section: 'responsive', values: { constraints, exactBreakpointsRecovered: false }, origin: 'inferred', evidenceIds: constraints.flatMap((item) => item.evidenceIds).slice(0, 30), executable: true },
        { id: `dna-provenance:${target.nodeId}`, nodeId: target.nodeId, section: 'provenance', values: { source: 'reference-screenshots', implementationRecovered: false, copySource: 'protected-project-or-generic-placeholder' }, origin: 'observed', evidenceIds: understanding.referenceSet.references.map((item) => item.id), executable: true },
    ];
    const plan = { schemaVersion: FROAM_REFERENCE_BUILD_VERSION, id: `reference-build:${safe(understanding.referenceSet.id)}:${now.toString(36)}:${attempt}`, target, sourceReferenceSetId: understanding.referenceSet.id, sourceBranchId: input.sourceBranchId, mode: 'structure-visual-responsive', attempt, previousPrototypeBranchId: input.previousPrototypeBranchId, createdAt: now, structure: graph.structure, dnaChanges, relationships: graph.relationships, responsiveConstraints: constraints, operations, validationWidths: priorityWidths(understanding), protections: { copy: true, brand: true, logo: true, navigationContent: true, productData: true, assets: true }, evidence, limitations: unique([...understanding.limitations, ...understanding.quality.limitations, 'Screenshots do not reveal source code, exact breakpoints, interactions, original assets, or actual source-component boundaries.', ...(target.kind === 'selected' ? ['Existing descendants are preserved; the first pass changes only the authorized target layout.'] : ['New page-level structure uses generic placeholders and neutral assets.']), ...(mode === 'navigation' ? ['Screenshot evidence cannot prove menu interactions; no click behavior is created.'] : [])]) };
    return validateReferenceBuildPlan(plan);
}
export function validateReferenceBuildPlan(plan) {
    if (plan.schemaVersion !== FROAM_REFERENCE_BUILD_VERSION)
        throw new Error('Unsupported reference build plan version');
    if (!plan.target.explicit)
        throw new Error('Reference build target must be explicitly confirmed');
    if (!plan.target.nodeId || !plan.target.routeKey)
        throw new Error('Reference build target is incomplete');
    const allowed = new Set([plan.target.nodeId, ...plan.target.authorizedNodeIds, ...plan.structure.map((item) => item.nodeId)]);
    if (plan.structure.length > FROAM_REFERENCE_BUILD_LIMITS.maxNewNodes + 1)
        throw new Error('Reference build exceeds the node limit');
    if (plan.structure.some((item) => item.depth < 0 || item.depth > FROAM_REFERENCE_BUILD_LIMITS.maxDepth))
        throw new Error('Reference build exceeds the hierarchy depth limit');
    if (plan.operations.filter((item) => item.kind === 'insert').length > FROAM_REFERENCE_BUILD_LIMITS.maxStructuralOperations)
        throw new Error('Reference build exceeds the structural operation limit');
    const ids = new Set();
    for (const node of plan.structure) {
        if (ids.has(node.nodeId))
            throw new Error(`Duplicate reference build node id: ${node.nodeId}`);
        ids.add(node.nodeId);
        if (node.parentNodeId && !allowed.has(node.parentNodeId))
            throw new Error(`Invalid reference build parent: ${node.parentNodeId}`);
        if (node.parentNodeId === node.nodeId)
            throw new Error('Reference build hierarchy cannot contain a self-cycle');
    }
    const byNodeId = new Map(plan.structure.map((item) => [item.nodeId, item]));
    for (const node of plan.structure) {
        const seen = new Set([node.nodeId]);
        let parentId = node.parentNodeId;
        while (parentId && byNodeId.has(parentId)) {
            if (seen.has(parentId))
                throw new Error('Reference build hierarchy cannot contain a cycle');
            seen.add(parentId);
            parentId = byNodeId.get(parentId)?.parentNodeId ?? null;
        }
    }
    for (const operation of plan.operations) {
        if (!allowed.has(operation.nodeId))
            throw new Error(`Reference build operation escapes target scope: ${operation.nodeId}`);
        if (operation.kind === 'style' && (operation.path !== (plan.target.kind === 'selected' ? plan.target.path : '') || operation.nodeId !== plan.target.nodeId))
            throw new Error('Reference build style operation escapes selected target');
        if (operation.kind === 'insert' && plan.target.kind !== 'current-page')
            throw new Error('Structural insertion is only allowed for an explicit page target');
    }
    for (const constraint of plan.responsiveConstraints)
        if (constraint.origin === 'inferred' && constraint.kind === 'transition-interval' && (!constraint.betweenWidths || constraint.width !== undefined))
            throw new Error('Inferred transitions must remain bounded intervals');
    return structuredClone(plan);
}
function genericPageHtml(plan) {
    const mode = dominantMode(plan.responsiveConstraints);
    const rootId = `${plan.target.nodeId}:layout`;
    const items = plan.structure.filter((item) => item.kind === 'component-instance');
    const cards = (items.length ? items : Array.from({ length: 4 }, (_, index) => ({ nodeId: `${rootId}:item:${index + 1}` }))).map((item, index) => `<article data-froam-injected="true" data-froam-id="${safe(item.nodeId)}" style="min-width:0;padding:24px;border:1px solid rgba(100,116,139,.28);border-radius:16px;background:rgba(255,255,255,.04)"><strong style="display:block;margin-bottom:8px">Item ${index + 1}</strong><span style="opacity:.68">Add your project content here.</span></article>`).join('');
    const body = mode === 'hero'
        ? `<div data-froam-reference-hero="true" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));align-items:center;gap:40px"><div><small style="letter-spacing:.12em;text-transform:uppercase;opacity:.62">Reference layout</small><h2 style="font:inherit;font-size:clamp(2rem,5vw,4.5rem);line-height:1.02;margin:16px 0">Your headline goes here</h2><p style="max-width:58ch;opacity:.72">Use your existing brand copy and project assets.</p></div><div data-froam-reference-media="true" style="min-height:260px;aspect-ratio:4/3;border:1px dashed currentColor;border-radius:20px;opacity:.3"></div></div>`
        : `<header style="max-width:720px;margin-bottom:36px"><small style="letter-spacing:.12em;text-transform:uppercase;opacity:.62">Reference layout</small><h2 style="font:inherit;font-size:clamp(2rem,5vw,4rem);line-height:1.05;margin:14px 0">Your project content</h2><p style="opacity:.72">Structure and responsive behavior are reconstructed without copying identity.</p></header><div data-froam-reference-grid="true" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:20px">${cards}</div>`;
    return `<section data-froam-injected="true" data-froam-block="true" data-froam-reference-build="${safe(plan.id)}" data-froam-id="${safe(rootId)}" style="width:min(100%,1200px);margin:32px auto;padding:clamp(24px,5vw,64px);box-sizing:border-box;color:inherit;background:transparent">${body}</section>`;
}
function operationEvents(document, branchId, actorId, plan, snapshot, now) {
    const source = deriveBranchState(document, plan.sourceBranchId);
    let clock = Math.max(0, ...document.events.map((event) => event.clock));
    const events = [];
    const batch = `reference-build:${branchId}`;
    const event = (type, payload, targetIds, label) => events.push(createProjectEvent({ projectId: document.id, branchId, actorId, clock: ++clock, createdAt: now + events.length, type, payload, targetIds, label, batchId: batch }));
    const rootNode = snapshot?.node ?? { id: plan.target.nodeId, kind: plan.target.kind === 'current-page' ? 'page' : 'element', name: plan.target.label, source: 'froam', locator: { path: plan.target.kind === 'selected' ? plan.target.path : undefined, routeKey: plan.target.routeKey } };
    event('node.upserted', { node: rootNode }, [rootNode.id], 'Reference build target');
    const dna = { ...(snapshot?.dna ?? { schemaVersion: 1, nodeId: rootNode.id, capturedAt: now }), schemaVersion: 1, nodeId: rootNode.id, capturedAt: now, layout: { ...(snapshot?.dna?.layout ?? {}), referenceBuildStrategy: dominantMode(plan.responsiveConstraints) }, responsive: { ...(snapshot?.dna?.responsive ?? {}), constraints: plan.responsiveConstraints, exactBreakpointsRecovered: false }, provenance: { ...(snapshot?.dna?.provenance ?? {}), referenceBuildPlanId: plan.id, sourceReferenceSetId: plan.sourceReferenceSetId, copyProtected: true, assetsProtected: true, sourceImplementationRecovered: false } };
    event('dna.captured', { dna }, [rootNode.id], 'Reference build DNA');
    const policy = { schemaVersion: 1, nodeId: rootNode.id, priority: 'high', canHide: false, canCollapse: dominantMode(plan.responsiveConstraints) === 'navigation', canWrap: true, canTruncate: false, canCrop: dominantMode(plan.responsiveConstraints) === 'hero', canReposition: true, updatedAt: now, updatedBy: actorId };
    event('responsive.upserted', { responsive: policy }, [rootNode.id], 'Reference responsive policy');
    if (plan.target.kind === 'current-page') {
        for (const item of plan.structure.filter((candidate) => candidate.nodeId !== rootNode.id)) {
            const node = { id: item.nodeId, kind: item.kind === 'component-definition' ? 'component-definition' : item.kind === 'component-instance' ? 'component-instance' : item.kind === 'section' ? 'frame' : 'element', name: item.role, parentId: item.parentNodeId, componentId: item.kind === 'component-instance' ? plan.structure.find((candidate) => candidate.kind === 'component-definition')?.nodeId : undefined, source: 'froam', metadata: { referenceBuildPlanId: plan.id, origin: item.origin, observedRepeatedVisualFamily: Boolean(item.componentFamilyId), actualSourceComponentKnown: false, placeholder: item.placeholder === true } };
            event('node.upserted', { node }, [node.id], 'Reference build structure');
        }
        for (const item of plan.relationships) {
            const relation = { id: item.id, kind: item.kind, from: item.from, to: item.to, metadata: { referenceBuildPlanId: plan.id, origin: item.origin, evidenceIds: item.evidenceIds } };
            event('relation.upserted', { relation }, [relation.from, relation.to], 'Reference build relationship');
        }
    }
    for (const operation of plan.operations) {
        if (operation.kind === 'style') {
            const before = source.legacyStore[scopeKey(plan.target.routeKey, operation.viewport)]?.[operation.path]?.styles?.[operation.property];
            const op = { id: `reference-op:${safe(branchId)}:${safe(operation.id)}`, kind: 'edit', actor: actorId, clock: clock + 1, ts: now + events.length, routeKey: plan.target.routeKey, viewport: operation.viewport, path: operation.path, nodeId: operation.nodeId, field: `style:${operation.property}`, before, after: operation.value, label: `Reference: ${operation.property}`, batch };
            event('design.op.appended', { op }, [operation.nodeId], `Reference layout: ${operation.property}`);
        }
        if (operation.kind === 'insert')
            for (const viewport of ['desktop', 'tablet', 'mobile']) {
                const path = `${INJECTION_PREFIX}${safe(operation.nodeId)}`;
                const after = JSON.stringify({ parentPath: operation.parentPath, order: operation.index, html: genericPageHtml(plan) });
                const op = { id: `reference-op:${safe(branchId)}:${safe(operation.id)}:${viewport}`, kind: 'edit', actor: actorId, clock: clock + 1, ts: now + events.length, routeKey: plan.target.routeKey, viewport, path, nodeId: operation.nodeId, field: 'text', before: source.legacyStore[scopeKey(plan.target.routeKey, viewport)]?.[path]?.text, after, label: 'Reference structure insertion', batch, structure: { kind: 'insert', nodeId: operation.nodeId, parentPath: operation.parentPath, index: operation.index } };
                event('design.op.appended', { op }, [operation.nodeId, plan.target.nodeId], `Reference structure insertion · ${viewport}`);
            }
    }
    return events;
}
export function createReferenceBuildPrototype(document, input) {
    const plan = validateReferenceBuildPlan(input.plan);
    if (document.activeBranchId !== plan.sourceBranchId)
        throw new Error('Reference build source branch changed');
    const now = input.now ?? Date.now();
    let project = createProjectBranch(document, { id: input.branchId, name: input.name, actorId: input.actorId, fromBranchId: plan.sourceBranchId, now });
    const events = operationEvents(project, input.branchId, input.actorId, plan, input.selectionSnapshot, now);
    project = appendProjectEvents(project, events);
    const constraints = { protect: ['copy', 'brand-colors', 'logo', 'product-data', 'navigation'], allow: ['layout', 'spacing', 'responsive', 'composition'], protectedNodeIds: [] };
    const provenance = { id: input.branchId, sourceBranchId: plan.sourceBranchId, sourceCheckpointId: document.branches[plan.sourceBranchId].baseCheckpointId, level: 'experimental', provider: 'froam-deterministic-reference-build@1', operationIds: events.map((item) => item.id), targetScope: [plan.target.nodeId], constraints, createdAt: now };
    const referenceBuild = { planId: plan.id, branchId: input.branchId, sourceReferenceSetId: plan.sourceReferenceSetId, sourceBranchId: plan.sourceBranchId, previousPrototypeBranchId: plan.previousPrototypeBranchId, attempt: plan.attempt, target: plan.target, operationIds: events.map((item) => item.id), evidence: plan.evidence, limitations: plan.limitations, createdAt: now };
    project = { ...project, metadata: { ...project.metadata, mutations: [...(project.metadata?.mutations ?? []), provenance], referenceBuilds: [...(project.metadata?.referenceBuilds ?? []), referenceBuild] } };
    return { project, plan, provenance, operationCount: events.length, structuralOperationCount: plan.operations.filter((item) => item.kind === 'insert').length };
}
function measurementScore(measurements, kind) { const values = measurements.filter((item) => item.kind === kind && item.measured && item.pass !== undefined); return values.length ? values.filter((item) => item.pass).length / values.length : undefined; }
export function validateReferenceBuildCandidate(plan, observations, now = Date.now()) {
    const byWidth = new Map(observations.map((item) => [item.width, item]));
    const measurements = [];
    for (const constraint of plan.responsiveConstraints.filter((item) => item.width !== undefined)) {
        const observation = byWidth.get(constraint.width);
        const missing = !observation || !observation.targetFound;
        if (constraint.kind === 'grid-columns') {
            const expected = Number(constraint.expected.columns);
            const actual = observation?.gridColumns;
            measurements.push({ width: constraint.width, kind: 'structure', measured: !missing && actual !== undefined, expected, actual, delta: actual === undefined ? undefined : actual - expected, pass: actual === undefined ? undefined : actual === expected, summary: actual === undefined ? `Grid columns at ${constraint.width}px were not measured.` : `Grid at ${constraint.width}px is ${actual} column${actual === 1 ? '' : 's'}; reference is ${expected}.` });
        }
        if (constraint.kind === 'orientation') {
            const expected = String(constraint.expected.orientation);
            const actual = observation?.orientation;
            measurements.push({ width: constraint.width, kind: 'structure', measured: !missing && actual !== undefined, expected, actual, pass: actual === undefined ? undefined : actual === expected, summary: actual === undefined ? `Orientation at ${constraint.width}px was not measured.` : `Orientation at ${constraint.width}px is ${actual}; reference is ${expected}.` });
        }
        if (constraint.kind === 'navigation-shape') {
            const expected = String(constraint.expected.shape);
            const actual = observation?.navigationShape;
            measurements.push({ width: constraint.width, kind: 'responsive', measured: !missing && actual !== undefined, expected, actual, pass: actual === undefined ? undefined : actual === expected, summary: actual === undefined ? `Navigation shape at ${constraint.width}px was not measured.` : `Navigation at ${constraint.width}px is ${actual}; reference is ${expected}.` });
        }
        if (constraint.kind === 'container-ratio') {
            const expected = Number(constraint.expected.ratio);
            const actual = observation?.targetWidthRatio;
            const delta = actual === undefined ? undefined : Math.abs(actual - expected);
            measurements.push({ width: constraint.width, kind: 'geometry', measured: !missing && actual !== undefined, expected: Number(expected.toFixed(3)), actual: actual === undefined ? undefined : Number(actual.toFixed(3)), delta: delta === undefined ? undefined : Number(delta.toFixed(3)), pass: delta === undefined ? undefined : delta <= .12, summary: actual === undefined ? `Container geometry at ${constraint.width}px was not measured.` : `Container width ratio at ${constraint.width}px differs by ${(delta * 100).toFixed(1)} percentage points.` });
        }
    }
    for (const observation of observations)
        if (observation.visualSimilarity !== undefined)
            measurements.push({ width: observation.width, kind: 'visual', measured: true, expected: 1, actual: Number(observation.visualSimilarity.toFixed(3)), delta: Number((1 - observation.visualSimilarity).toFixed(3)), pass: observation.visualSimilarity >= .85, summary: `Measured pixel similarity at ${observation.width}px is ${(observation.visualSimilarity * 100).toFixed(1)}%.` });
    if (!measurements.some((item) => item.kind === 'visual'))
        measurements.push({ width: observations[0]?.width ?? 0, kind: 'visual', measured: false, summary: 'Pixel similarity was not measured.' });
    measurements.push({ width: observations[0]?.width ?? 0, kind: 'text', measured: false, summary: 'Text match is not scored because project copy is protected.' });
    const health = observations.reduce((result, item) => ({ overflow: result.overflow + (item.overflowX ? 1 : 0), collisions: result.collisions + item.collisions, clipping: result.clipping + item.clipped, hiddenCritical: result.hiddenCritical + item.hiddenCritical, touchTargets: result.touchTargets + item.touchTargetFailures, healthy: result.healthy && !item.overflowX && item.collisions === 0 && item.clipped === 0 && item.hiddenCritical === 0 }), { overflow: 0, collisions: 0, clipping: 0, hiddenCritical: 0, touchTargets: 0, healthy: true });
    const responsiveMeasured = observations.map((item) => !item.overflowX && item.collisions === 0 && item.clipped === 0 && item.hiddenCritical === 0 ? 1 : 0);
    const differences = unique([...measurements.filter((item) => item.measured && item.pass === false).map((item) => item.summary), ...observations.flatMap((item) => [item.overflowX ? `Horizontal overflow at ${item.width}px.` : '', item.collisions ? `${item.collisions} collision${item.collisions === 1 ? '' : 's'} at ${item.width}px.` : '', item.clipped ? `${item.clipped} clipped region${item.clipped === 1 ? '' : 's'} at ${item.width}px.` : '', item.hiddenCritical ? `${item.hiddenCritical} critical region${item.hiddenCritical === 1 ? '' : 's'} hidden at ${item.width}px.` : '']).filter(Boolean)]).slice(0, 12);
    const scorecard = { structure: measurementScore(measurements, 'structure'), geometry: measurementScore(measurements, 'geometry'), responsive: mean(responsiveMeasured), visual: measurementScore(measurements, 'visual'), text: measurementScore(measurements, 'text') };
    const required = measurements.filter((item) => item.measured && ['structure', 'geometry', 'responsive'].includes(item.kind));
    const successful = health.healthy && required.every((item) => item.pass !== false);
    return { planId: plan.id, measuredAt: now, widths: [...observations.map((item) => item.width)].sort((a, b) => a - b), measurements, scorecard, health, differences, successful };
}
export function referenceBuildRetryFeedback(validation) { const facts = validation.differences.length ? validation.differences : ['No measured improvement was found.']; return `Previous protected reference candidate measurements: ${facts.slice(0, 6).join(' ')} Preserve the same target, reference evidence, copy, brand, assets, and bounded responsive intervals.`.slice(0, 1000); }
export async function runBoundedReferenceCorrections(input) {
    const limit = Math.max(0, Math.min(FROAM_REFERENCE_BUILD_LIMITS.maxCorrectionPasses, Math.floor(input.maxPasses ?? FROAM_REFERENCE_BUILD_LIMITS.maxCorrectionPasses)));
    let candidate = input.initial;
    let best = await input.evaluate(candidate, 0);
    const history = [{ pass: 0, planId: 'initial', score: best.score, improved: true, failures: best.failures.slice(0, 12) }];
    for (let pass = 1; pass <= limit; pass += 1) {
        const next = await input.correct(candidate, pass, best.failures.slice(0, 12));
        const result = await input.evaluate(next, pass);
        const improved = result.score > best.score + .0001;
        history.push({ pass, planId: `correction:${pass}`, score: result.score, improved, failures: result.failures.slice(0, 12) });
        if (!improved)
            break;
        candidate = next;
        best = result;
        if (!best.failures.length || best.score >= .9999)
            break;
    }
    return { candidate, score: best.score, failures: best.failures, history };
}
//# sourceMappingURL=reference-build.js.map