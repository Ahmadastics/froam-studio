import { appendProjectEvents, createProjectBranch, createProjectEvent, deriveBranchState } from './event-log.js';
export const deterministicMutationProvider = { id: 'froam-deterministic-mutagen', version: '1', local: true, propose(request) {
        return [...request.scopeNodeIds].sort().flatMap((nodeId, index) => {
            const node = request.state.nodes[nodeId];
            if (!node)
                return [];
            const dna = request.state.dna[nodeId];
            const accent = ['#b8ff2c', '#68f7ff', '#ff6bd6'][(index + (request.seed ?? 0)) % 3];
            const proposals = [{ type: 'dna.captured', targetIds: [nodeId], rationale: 'Deterministic surface mutation', payload: { dna: { ...(dna ?? { schemaVersion: 1, nodeId, capturedAt: 0 }), capturedAt: request.now, visual: { ...dna?.visual, mutationAccent: accent, mutationLevel: request.level }, provenance: { ...dna?.provenance, mutationProvider: 'froam-deterministic-mutagen' } } } }];
            if (request.level !== 'safe')
                proposals.push({ type: 'node.upserted', targetIds: [nodeId], rationale: 'Experimental composition metadata', payload: { node: { ...node, metadata: { ...node.metadata, mutation: { level: request.level, composition: index % 2 ? 'stack' : 'grid' } } } } });
            if (request.level === 'unhinged')
                proposals.push({ type: 'interaction.upserted', targetIds: [nodeId], rationale: 'Alternative command-style interaction', payload: { interaction: { id: `mutation:interaction:${nodeId}`, name: 'Mutagen command reveal', sourceId: nodeId, targetIds: [nodeId], trigger: 'click', timeline: [{ at: 0, values: { opacity: .65, transform: 'scale(.98)' } }, { at: 1, values: { opacity: 1, transform: 'scale(1)' } }], durationMs: 280, metadata: { experimental: true, mutationLevel: request.level } } } });
            return proposals;
        });
    } };
export function createMutationPrototype(document, input) {
    const sourceBranchId = document.activeBranchId;
    const sourceCheckpointId = document.branches[sourceBranchId].baseCheckpointId;
    const provider = input.provider ?? deterministicMutationProvider;
    const now = input.now ?? Date.now();
    let project = createProjectBranch(document, { id: input.branchId, name: input.name ?? `Mutation ${input.branchId}`, actorId: input.actorId, fromBranchId: sourceBranchId, now, idFactory: input.idFactory });
    const proposals = provider.propose({ state: deriveBranchState(document, sourceBranchId), scopeNodeIds: input.scopeNodeIds, level: input.level, constraints: input.constraints, seed: input.seed, now });
    const baseClock = Math.max(0, ...project.events.map((event) => event.clock));
    const events = proposals.map((proposal, index) => createProjectEvent({ projectId: project.id, branchId: input.branchId, actorId: input.actorId, clock: baseClock + index + 1, createdAt: now + index, type: proposal.type, payload: proposal.payload, targetIds: proposal.targetIds, label: `MUTATE ${input.level}: ${proposal.rationale}`, idFactory: input.idFactory }));
    project = appendProjectEvents(project, events);
    const provenance = { id: input.branchId, sourceBranchId, sourceCheckpointId, level: input.level, provider: `${provider.id}@${provider.version}`, operationIds: events.map((event) => event.id), targetScope: input.scopeNodeIds, constraints: input.constraints ?? [], createdAt: now };
    return { project: { ...project, metadata: { ...project.metadata, mutations: [...(project.metadata?.mutations ?? []), provenance] } }, provenance, proposals };
}
//# sourceMappingURL=mutation.js.map