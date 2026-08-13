import { appendProjectEvents, applyProjectEvent, createProjectBranch, createProjectEvent, deriveBranchState } from './event-log.js';
import { scopeKey } from '../collab/types.js';
const DEFAULT_ALLOWED = {
    safe: ['visual', 'typography', 'spacing', 'layout', 'motion'],
    experimental: ['visual', 'typography', 'spacing', 'layout', 'navigation', 'interactions', 'motion', 'responsive', 'composition'],
    unhinged: ['visual', 'typography', 'spacing', 'layout', 'navigation', 'interactions', 'motion', 'responsive', 'composition'],
};
export function normalizeMutationConstraints(level, input) {
    const allowed = new Set(DEFAULT_ALLOWED[level]);
    const requested = input?.allow?.filter((item) => allowed.has(item)) ?? DEFAULT_ALLOWED[level];
    return { protect: [...new Set(input?.protect ?? [])], allow: [...new Set(requested)], protectedNodeIds: [...new Set(input?.protectedNodeIds ?? [])] };
}
function roleOf(state, nodeId) { return String(state.dna[nodeId]?.semantics?.role ?? state.nodes[nodeId]?.metadata?.semanticRole ?? ''); }
function isProtected(request, nodeId) {
    if (request.constraints.protectedNodeIds?.includes(nodeId))
        return true;
    const role = roleOf(request.state, nodeId);
    return request.constraints.protect.includes('navigation') && /navigation|menu/.test(role) || request.constraints.protect.includes('logo') && /logo/.test(role);
}
function proposalPayloadNodeIds(proposal) {
    const payload = proposal.payload;
    if (proposal.type === 'node.upserted')
        return typeof payload.node?.id === 'string' ? [payload.node.id] : null;
    if (proposal.type === 'relation.upserted')
        return typeof payload.relation?.from === 'string' && typeof payload.relation?.to === 'string' ? [payload.relation.from, payload.relation.to] : null;
    if (proposal.type === 'interaction.upserted')
        return typeof payload.interaction?.sourceId === 'string' && Array.isArray(payload.interaction?.targetIds) ? [payload.interaction.sourceId, ...payload.interaction.targetIds] : null;
    if (proposal.type === 'dna.captured')
        return typeof payload.dna?.nodeId === 'string' ? [payload.dna.nodeId] : null;
    if (proposal.type === 'responsive.upserted')
        return typeof payload.responsive?.nodeId === 'string' ? [payload.responsive.nodeId] : null;
    return null;
}
function proposalAllowed(request, proposal) {
    const scope = new Set(request.scopeNodeIds);
    const payloadNodeIds = proposalPayloadNodeIds(proposal);
    if (!proposal.targetIds.length || proposal.targetIds.some((id) => !scope.has(id) || !request.state.nodes[id]))
        return false;
    if (!payloadNodeIds || payloadNodeIds.some((id) => !scope.has(id) || !request.state.nodes[id] || isProtected(request, id)))
        return false;
    if (!payloadNodeIds.some((id) => proposal.targetIds.includes(id)))
        return false;
    if (!Number.isFinite(proposal.confidence) || typeof proposal.rationale !== 'string' || !proposal.rationale.trim())
        return false;
    if (!request.constraints.allow.includes(proposal.domain))
        return false;
    if (proposal.targetIds.some((id) => isProtected(request, id)))
        return false;
    if (request.level === 'safe' && !['dna.captured', 'interaction.upserted'].includes(proposal.type))
        return false;
    return true;
}
export const deterministicMutationProvider = { id: 'froam-deterministic-mutagen', version: '2', local: true, propose(request) {
        const alternatives = { navigation: 'command-interface', menu: 'contextual-command-interface', card: 'adaptive-detail-browser', list: 'progressive-exploration', form: 'conversational-sequence', unknown: 'contextual-workspace' };
        const proposals = [...request.scopeNodeIds].sort().flatMap((nodeId, index) => {
            const node = request.state.nodes[nodeId];
            if (!node || isProtected(request, nodeId))
                return [];
            const dna = request.state.dna[nodeId];
            const accent = ['#b8ff2c', '#68f7ff', '#ff6bd6'][(index + (request.seed ?? 0)) % 3];
            const visual = { type: 'dna.captured', targetIds: [nodeId], domain: 'visual', confidence: .96, rationale: 'Reframe the surface while preserving semantic content', payload: { dna: { ...(dna ?? { schemaVersion: 1, nodeId, capturedAt: 0 }), capturedAt: request.now, visual: { ...dna?.visual, mutationAccent: accent, mutationLevel: request.level, ...(request.constraints.protect.includes('brand-colors') ? {} : { surfaceTreatment: index % 2 ? 'luminous-edge' : 'tonal-depth' }) }, provenance: { ...dna?.provenance, mutationProvider: 'froam-deterministic-mutagen@2' } } } };
            const result = [visual];
            if (request.level !== 'safe')
                result.push({ type: 'node.upserted', targetIds: [nodeId], domain: 'composition', confidence: .86, rationale: 'Recompose the selected product region without deleting its data semantics', payload: { node: { ...node, metadata: { ...node.metadata, mutation: { level: request.level, composition: index % 2 ? 'adaptive-stack' : 'context-grid', preservesContent: true } } } } });
            if (request.level === 'unhinged') {
                const role = roleOf(request.state, nodeId) || 'unknown';
                result.push({ type: 'node.upserted', targetIds: [nodeId], domain: 'navigation', confidence: .72, rationale: `Replace conventional ${role} presentation with a coherent alternate interaction model`, payload: { node: { ...node, metadata: { ...node.metadata, mutation: { level: 'unhinged', interfaceModel: alternatives[role] ?? alternatives.unknown, preservesPurpose: true, preservesProductData: true } } } } });
                result.push({ type: 'interaction.upserted', targetIds: [nodeId], domain: 'interactions', confidence: .78, rationale: 'Make the alternate model explorable through a reversible reveal', payload: { interaction: { id: `mutation:interaction:${nodeId}`, name: 'Mutagen contextual reveal', sourceId: nodeId, targetIds: [nodeId], trigger: 'click', timeline: [{ at: 0, values: { opacity: .72, transform: 'scale(.985)' } }, { at: 1, values: { opacity: 1, transform: 'scale(1)' } }], durationMs: 280, metadata: { experimental: true, mutationLevel: request.level, preservesContent: true } } } });
            }
            return result;
        });
        return proposals.filter((proposal) => proposalAllowed(request, proposal));
    } };
export function previewMutation(provider, request) {
    const proposals = provider.propose(request).filter((proposal) => proposalAllowed(request, proposal));
    return { provider: `${provider.id}@${provider.version}`, level: request.level, proposals, summary: proposals.map((item) => ({ domain: item.domain, rationale: item.rationale, targets: item.targetIds.length, confidence: item.confidence })), requiresConfirmation: proposals.length > 3 || proposals.some((item) => ['layout', 'navigation', 'composition'].includes(item.domain)) };
}
/**
 * Shared lineage relation events for mutation branches.
 * Both deterministic and AI mutations emit these so provenance quality is identical.
 */
function createLineageRelations(input) {
    return input.scopeNodeIds.filter((id) => input.state.nodes[id]).map((nodeId, index) => createProjectEvent({ projectId: input.project.id, branchId: input.branchId, actorId: input.actorId, clock: input.baseClock + input.priorEventCount + index + 1, createdAt: input.now + input.priorEventCount + index, type: 'relation.upserted', payload: { relation: { id: `mutation-lineage:${input.branchId}:${nodeId}`, kind: 'derived-from', from: nodeId, to: nodeId, metadata: { mutationId: input.branchId, sourceBranchId: input.sourceBranchId, sourceCheckpointId: input.sourceCheckpointId, level: input.level, provider: input.provider } } }, targetIds: [nodeId], label: 'Mutation lineage', idFactory: input.idFactory }));
}
export function createMutationPrototype(document, input) {
    const sourceBranchId = document.activeBranchId;
    const sourceCheckpointId = document.branches[sourceBranchId].baseCheckpointId;
    const provider = input.provider ?? deterministicMutationProvider;
    const now = input.now ?? Date.now();
    const constraints = normalizeMutationConstraints(input.level, input.constraints);
    const request = { state: deriveBranchState(document, sourceBranchId), scopeNodeIds: [...new Set(input.scopeNodeIds)], level: input.level, constraints, seed: input.seed, now, projectContext: input.projectContext };
    const preview = previewMutation(provider, request);
    let project = createProjectBranch(document, { id: input.branchId, name: input.name ?? `Mutation ${input.branchId}`, actorId: input.actorId, fromBranchId: sourceBranchId, now, idFactory: input.idFactory });
    const baseClock = Math.max(0, ...project.events.map((event) => event.clock));
    const events = preview.proposals.map((proposal, index) => createProjectEvent({ projectId: project.id, branchId: input.branchId, actorId: input.actorId, clock: baseClock + index + 1, createdAt: now + index, type: proposal.type, payload: proposal.payload, targetIds: proposal.targetIds, label: `MUTATE ${input.level}: ${proposal.rationale}`, idFactory: input.idFactory }));
    project = appendProjectEvents(project, events);
    const provenance = { id: input.branchId, sourceBranchId, sourceCheckpointId, level: input.level, provider: preview.provider, operationIds: events.map((event) => event.id), targetScope: request.scopeNodeIds, constraints, createdAt: now };
    const relationEvents = createLineageRelations({ project, branchId: input.branchId, actorId: input.actorId, scopeNodeIds: request.scopeNodeIds, state: request.state, baseClock, priorEventCount: events.length, now, sourceBranchId, sourceCheckpointId, level: input.level, provider: preview.provider, idFactory: input.idFactory });
    project = appendProjectEvents(project, relationEvents);
    const completeProvenance = { ...provenance, operationIds: [...events, ...relationEvents].map((event) => event.id) };
    return { project: { ...project, metadata: { ...project.metadata, mutations: [...(project.metadata?.mutations ?? []), completeProvenance] } }, provenance: completeProvenance, proposals: preview.proposals, preview };
}
function stable(value) { return JSON.stringify(value); }
function storeField(state, op) {
    const draft = state.legacyStore[scopeKey(op.routeKey, op.viewport)]?.[op.path];
    if (op.field === 'text')
        return draft?.text;
    if (op.field === 'imageUrl')
        return draft?.imageUrl;
    return draft?.styles?.[op.field.slice(6)];
}
export function compareMutationBranches(document, sourceBranchId, mutationBranchId) {
    const source = deriveBranchState(document, sourceBranchId);
    const mutation = deriveBranchState(document, mutationBranchId);
    const changedNodeIds = [...new Set([...Object.keys(source.nodes), ...Object.keys(mutation.nodes), ...Object.keys(source.dna), ...Object.keys(mutation.dna)])].filter((id) => stable(source.nodes[id]) !== stable(mutation.nodes[id]) || stable(source.dna[id]) !== stable(mutation.dna[id]));
    const provenance = (document.metadata?.mutations ?? []).find((item) => item.id === mutationBranchId);
    const operationIds = provenance ? new Set(provenance.operationIds) : null;
    const mutationEvents = document.events.filter((event) => event.branchId === mutationBranchId && (!operationIds || operationIds.has(event.id)));
    return { sourceBranchId, mutationBranchId, changedNodeIds, structural: mutationEvents.filter((event) => event.type.startsWith('node.') || event.type.startsWith('relation.')).length, visual: mutationEvents.filter((event) => event.type === 'dna.captured').length, interactions: mutationEvents.filter((event) => event.type.startsWith('interaction.')).length, responsive: mutationEvents.filter((event) => event.type.startsWith('responsive.')).length, eventIds: mutationEvents.map((event) => event.id) };
}
function valueForEvent(state, event) { const payload = event.payload; if (event.type === 'design.op.appended')
    return storeField(state, payload.op); if (event.type.startsWith('node.'))
    return state.nodes[payload.node?.id ?? payload.nodeId]; if (event.type.startsWith('relation.'))
    return state.relations[payload.relation?.id ?? payload.relationId]; if (event.type.startsWith('interaction.'))
    return state.interactions[payload.interaction?.id ?? payload.interactionId]; if (event.type === 'dna.captured')
    return state.dna[payload.dna?.nodeId]; if (event.type.startsWith('responsive.'))
    return state.responsive[payload.responsive?.nodeId ?? payload.nodeId]; return undefined; }
const ADOPTABLE = new Set(['design.op.appended', 'node.upserted', 'relation.upserted', 'interaction.upserted', 'dna.captured', 'responsive.upserted']);
export function adoptMutationChanges(document, input) {
    const mutation = document.branches[input.mutationBranchId];
    const target = document.branches[input.targetBranchId];
    if (!mutation || !target)
        throw new Error('Unknown mutation or target branch');
    const base = document.checkpoints[mutation.rootCheckpointId ?? mutation.baseCheckpointId]?.state;
    if (!base)
        throw new Error('Mutation fork checkpoint is missing');
    const targetState = deriveBranchState(document, input.targetBranchId);
    const chosen = document.events.filter((event) => event.branchId === input.mutationBranchId && input.eventIds.includes(event.id) && ADOPTABLE.has(event.type));
    const conflicts = [];
    for (const event of chosen)
        if (stable(valueForEvent(targetState, event)) !== stable(valueForEvent(base, event)))
            for (const targetId of event.targetIds.length ? event.targetIds : ['project'])
                conflicts.push({ eventId: event.id, targetId, reason: 'Target changed since the mutation fork' });
    if (conflicts.length)
        return { status: 'refused', project: document, adoptedEventIds: [], conflicts };
    const now = input.now ?? Date.now();
    const baseClock = Math.max(0, ...document.events.map((event) => event.clock));
    const adopted = chosen.map((event, index) => createProjectEvent({ projectId: document.id, branchId: input.targetBranchId, actorId: input.actorId, clock: baseClock + index + 1, createdAt: now + index, type: event.type, payload: structuredClone(event.payload), targetIds: event.targetIds, label: `Adopted from ${input.mutationBranchId}: ${event.label ?? event.type}`, idFactory: input.idFactory }));
    let project = appendProjectEvents(document, adopted);
    const adoption = { mutationBranchId: input.mutationBranchId, targetBranchId: input.targetBranchId, sourceEventIds: chosen.map((event) => event.id), adoptedEventIds: adopted.map((event) => event.id), createdAt: now, actorId: input.actorId };
    project = { ...project, metadata: { ...project.metadata, mutationAdoptions: [...(project.metadata?.mutationAdoptions ?? []), adoption] } };
    return { status: 'adopted', project, adoptedEventIds: adopted.map((event) => event.id), conflicts: [] };
}
export function materializeMutationPreview(state, proposals) { return proposals.reduce((current, proposal, index) => applyProjectEvent(current, { schemaVersion: 2, id: `preview-${index}`, projectId: 'preview', branchId: 'preview', actorId: 'preview', clock: index + 1, createdAt: 0, type: proposal.type, targetIds: proposal.targetIds, payload: proposal.payload }), structuredClone(state)); }
const COMPILED_STYLE_FIELDS = {
    visual: ['color', 'backgroundColor', 'border', 'borderColor', 'borderRadius', 'boxShadow', 'opacity'],
    typography: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'textDecorationLine'],
    spacing: ['margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'rowGap', 'columnGap'],
    motion: ['transition', 'animation', 'transform'],
    layout: ['display', 'position', 'top', 'right', 'bottom', 'left', 'zIndex', 'overflow', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'aspectRatio', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'gridTemplateColumns', 'gridTemplateRows'], navigation: [], interactions: [], responsive: [], composition: [],
};
const DIMENSION_SENSITIVE_STYLES = new Set(['border', 'fontSize', 'lineHeight', 'letterSpacing', 'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'rowGap', 'columnGap', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'transform']);
function safeCompiledStyle(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 300 || /url\s*\(|expression\s*\(|javascript:|[{};]/i.test(trimmed))
        return null;
    return trimmed;
}
function proposalStyleRecord(proposal) {
    if (proposal.type !== 'dna.captured')
        return null;
    const dna = proposal.payload.dna;
    if (!dna)
        return null;
    return proposal.domain === 'spacing' || proposal.domain === 'layout'
        ? dna.layout
        : proposal.domain === 'motion'
            ? dna.motion ?? dna.behavior
            : dna.visual;
}
function baselineStyleRecord(dna, domain) {
    return domain === 'spacing' || domain === 'layout' ? dna?.layout : domain === 'motion' ? dna?.motion ?? dna?.behavior : dna?.visual;
}
function compileMutationDesignEvents(input) {
    const sourceState = deriveBranchState(input.project, input.project.branches[input.branchId].parentBranchId ?? input.project.activeBranchId);
    const scope = sourceState.legacyStore[scopeKey(input.snapshot.routeKey, input.snapshot.viewport)] ?? {};
    const draft = scope[input.snapshot.path];
    const compiled = [];
    for (const proposal of input.proposals) {
        if (!proposal.targetIds.includes(input.snapshot.node.id))
            continue;
        const proposedDna = proposal.type === 'dna.captured' ? proposal.payload.dna : undefined;
        const proposedText = proposedDna?.semantics?.textContent;
        const baselineText = input.snapshot.dna?.semantics?.textContent;
        if (!input.preserveCopy && typeof proposedText === 'string' && proposedText.trim() && proposedText.length <= 1_000 && proposedText !== baselineText && !compiled.some((item) => item.property === '$text')) {
            compiled.push({ property: '$text', value: proposedText.trim(), rationale: proposal.rationale });
        }
        const record = proposalStyleRecord(proposal);
        if (!record)
            continue;
        const baseline = baselineStyleRecord(input.snapshot.dna, proposal.domain);
        for (const property of COMPILED_STYLE_FIELDS[proposal.domain]) {
            if (input.preserveDimensions && DIMENSION_SENSITIVE_STYLES.has(property))
                continue;
            const value = safeCompiledStyle(record[property]);
            if (!value || value === baseline?.[property] || compiled.some((item) => item.property === property))
                continue;
            compiled.push({ property, value, rationale: proposal.rationale });
            if (compiled.length >= 12)
                break;
        }
        if (compiled.length >= 12)
            break;
    }
    return compiled.map((item, index) => {
        const clock = input.baseClock + index + 1;
        const isText = item.property === '$text';
        const observedText = input.snapshot.dna?.semantics?.textContent;
        const op = { id: `intent-op:${input.branchId}:${index + 1}`, kind: 'edit', actor: input.actorId, clock, ts: input.now + index, routeKey: input.snapshot.routeKey, viewport: input.snapshot.viewport, path: input.snapshot.path, nodeId: input.snapshot.node.id, field: isText ? 'text' : `style:${item.property}`, before: isText ? draft?.text ?? (typeof observedText === 'string' ? observedText : undefined) : draft?.styles?.[item.property], after: item.value, label: `Froam: ${item.rationale}`, batch: `intent:${input.branchId}` };
        return createProjectEvent({ projectId: input.project.id, branchId: input.branchId, actorId: input.actorId, clock, createdAt: input.now + index, type: 'design.op.appended', payload: { op }, targetIds: [input.snapshot.node.id], label: `Froam experiment: ${item.rationale}`, idFactory: input.idFactory });
    });
}
/**
 * Create a mutation prototype branch from an already-validated set of external
 * FroamMutationProposal objects (e.g. from the AI planning pipeline).
 *
 * Uses the SAME branch/provenance/adoption pipeline as createMutationPrototype
 * so all MUTATE protections remain intact. The caller is responsible for
 * validating proposals before passing them here.
 */
export function createMutationPrototypeFromProposals(document, input) {
    const sourceBranchId = document.activeBranchId;
    const sourceCheckpointId = document.branches[sourceBranchId].baseCheckpointId;
    const now = input.now ?? Date.now();
    // Filter proposals through the same proposalAllowed guard used by the
    // deterministic provider so protections are never bypassed.
    const sourceState = deriveBranchState(document, sourceBranchId);
    const state = input.selectionSnapshot ? {
        ...sourceState,
        nodes: { ...sourceState.nodes, [input.selectionSnapshot.node.id]: input.selectionSnapshot.node },
        dna: input.selectionSnapshot.dna ? { ...sourceState.dna, [input.selectionSnapshot.dna.nodeId]: input.selectionSnapshot.dna } : sourceState.dna,
        scans: input.selectionSnapshot.scan ? { ...sourceState.scans, [input.selectionSnapshot.scan.id]: input.selectionSnapshot.scan } : sourceState.scans,
        relations: Object.fromEntries([
            ...Object.entries(sourceState.relations),
            ...(input.selectionSnapshot.relationships ?? []).map((relation) => [relation.id, relation]),
        ]),
    } : sourceState;
    const constraints = normalizeMutationConstraints(input.level, input.constraints);
    const request = {
        state,
        scopeNodeIds: [...new Set(input.scopeNodeIds)].filter((id) => Boolean(state.nodes[id])),
        level: input.level,
        constraints,
        now,
    };
    const allowed = input.proposals.filter((p) => proposalAllowed(request, p));
    if (allowed.length === 0)
        throw new Error('No safe mutation proposals');
    let project = createProjectBranch(document, {
        id: input.branchId,
        name: input.name ?? `AI Mutation ${input.branchId}`,
        actorId: input.actorId,
        fromBranchId: sourceBranchId,
        now,
        idFactory: input.idFactory,
    });
    let baseClock = Math.max(0, ...project.events.map((e) => e.clock));
    const observationEvents = [];
    if (input.selectionSnapshot) {
        const snapshot = input.selectionSnapshot;
        observationEvents.push(createProjectEvent({ projectId: project.id, branchId: input.branchId, actorId: input.actorId, clock: ++baseClock, createdAt: now, type: 'node.upserted', payload: { node: snapshot.node }, targetIds: [snapshot.node.id], label: 'Intent selection observation', idFactory: input.idFactory }));
        if (snapshot.scan)
            observationEvents.push(createProjectEvent({ projectId: project.id, branchId: input.branchId, actorId: input.actorId, clock: ++baseClock, createdAt: now, type: 'scan.captured', payload: { scan: snapshot.scan }, targetIds: [snapshot.node.id], label: 'Intent scan evidence', idFactory: input.idFactory }));
        if (snapshot.dna)
            observationEvents.push(createProjectEvent({ projectId: project.id, branchId: input.branchId, actorId: input.actorId, clock: ++baseClock, createdAt: now, type: 'dna.captured', payload: { dna: snapshot.dna }, targetIds: [snapshot.node.id], label: 'Intent DNA evidence', idFactory: input.idFactory }));
        for (const relation of (snapshot.relationships ?? []).slice(0, 16))
            observationEvents.push(createProjectEvent({ projectId: project.id, branchId: input.branchId, actorId: input.actorId, clock: ++baseClock, createdAt: now, type: 'relation.upserted', payload: { relation }, targetIds: [relation.from, relation.to], label: 'Intent relationship evidence', idFactory: input.idFactory }));
        project = appendProjectEvents(project, observationEvents);
    }
    const events = allowed.map((proposal, index) => createProjectEvent({
        projectId: project.id,
        branchId: input.branchId,
        actorId: input.actorId,
        clock: baseClock + index + 1,
        createdAt: now + index,
        type: proposal.type,
        payload: proposal.payload,
        targetIds: proposal.targetIds,
        label: `AI MUTATE ${input.level}: ${proposal.rationale}`,
        idFactory: input.idFactory,
    }));
    project = appendProjectEvents(project, events);
    const designEvents = input.selectionSnapshot ? compileMutationDesignEvents({ project, branchId: input.branchId, actorId: input.actorId, proposals: allowed, snapshot: input.selectionSnapshot, baseClock: baseClock + events.length, now: now + events.length, preserveDimensions: input.preserveDimensions === true, preserveCopy: input.preserveCopy === true, idFactory: input.idFactory }) : [];
    project = appendProjectEvents(project, designEvents);
    const provenance = {
        id: input.branchId,
        sourceBranchId,
        sourceCheckpointId,
        level: input.level,
        provider: input.provider,
        operationIds: [...events, ...designEvents].map((e) => e.id),
        targetScope: request.scopeNodeIds,
        constraints,
        createdAt: now,
    };
    // Emit the same lineage relation events as the deterministic path
    // so AI mutations preserve full native Froam provenance.
    // Use the post-filter scope: only nodes with accepted proposals get lineage.
    const acceptedScopeNodeIds = [...new Set(allowed.flatMap((p) => p.targetIds))];
    const relationEvents = createLineageRelations({
        project, branchId: input.branchId, actorId: input.actorId,
        scopeNodeIds: acceptedScopeNodeIds, state,
        baseClock, priorEventCount: events.length + designEvents.length, now,
        sourceBranchId, sourceCheckpointId,
        level: input.level, provider: input.provider,
        idFactory: input.idFactory,
    });
    project = appendProjectEvents(project, relationEvents);
    const completeProvenance = { ...provenance, operationIds: [...events, ...designEvents, ...relationEvents].map((e) => e.id) };
    return {
        project: {
            ...project,
            metadata: {
                ...project.metadata,
                mutations: [...(project.metadata?.mutations ?? []), completeProvenance],
            },
        },
        provenance: completeProvenance,
        proposals: allowed,
        filteredCount: input.proposals.length - allowed.length,
        compiledDesignOperationCount: designEvents.length,
    };
}
//# sourceMappingURL=mutation.js.map