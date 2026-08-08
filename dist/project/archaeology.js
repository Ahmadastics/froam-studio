import { compareProjectEvents } from './event-log.js';
export function archaeologyForNode(document, nodeId) {
    const events = document.events.filter((event) => event.targetIds.includes(nodeId) || event.payload.node?.id === nodeId).sort(compareProjectEvents);
    const creationEvent = events.find((event) => event.type === 'node.upserted' || (event.payload.op?.structure?.kind === 'insert'));
    const branchId = creationEvent?.branchId ?? document.activeBranchId;
    const lineage = [];
    let current = document.branches[branchId];
    while (current) {
        lineage.unshift(current.id);
        current = current.parentBranchId ? document.branches[current.parentBranchId] : undefined;
    }
    const node = Object.values(document.checkpoints).map((checkpoint) => checkpoint.state.nodes[nodeId]).find(Boolean);
    const derivedFrom = document.events.filter((event) => event.type === 'relation.upserted').map((event) => event.payload.relation).filter((relation) => relation?.kind === 'derived-from' && relation.from === nodeId).map((relation) => relation.to);
    return {
        nodeId,
        creation: creationEvent ? { eventId: creationEvent.id, actorId: creationEvent.actorId, branchId: creationEvent.branchId, at: creationEvent.createdAt } : null,
        edits: events.map((event) => ({ eventId: event.id, actorId: event.actorId, branchId: event.branchId, at: event.createdAt, label: event.label ?? event.type, category: event.type, ...(event.label?.startsWith('Reason:') ? { rationale: { text: event.label.slice(7).trim(), origin: 'recorded' } } : {}) })),
        branchLineage: lineage, derivedFrom: [...new Set([...(node?.metadata?.derivedFrom ? [String(node.metadata.derivedFrom)] : []), ...derivedFrom])], authors: [...new Set(events.map((event) => event.actorId))],
    };
}
//# sourceMappingURL=archaeology.js.map