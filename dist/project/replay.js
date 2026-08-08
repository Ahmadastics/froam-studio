import { applyProjectEvent, compareProjectEvents } from './event-log.js';
export function replayCategory(event) {
    if (event.type.startsWith('interaction.'))
        return 'interaction';
    if (event.type.startsWith('node.') || event.type.startsWith('relation.') || event.type.startsWith('flow.'))
        return 'structural';
    if (event.type !== 'design.op.appended')
        return 'other';
    const op = event.payload.op;
    if (op?.structure)
        return 'structural';
    if (op?.field === 'text')
        return 'text';
    if (op?.field?.startsWith('style:') || op?.field === 'imageUrl')
        return 'styling';
    return 'other';
}
export function filterReplayEvents(events, filter = {}) {
    return events.filter((event) => {
        if (!filter.includeBaseline && event.actorId === 'baseline')
            return false;
        if (filter.actorId && event.actorId !== filter.actorId)
            return false;
        if (filter.category && replayCategory(event) !== filter.category)
            return false;
        return true;
    }).sort(compareProjectEvents);
}
export function branchReplayEvents(document, branchId = document.activeBranchId, filter = {}) {
    const branch = document.branches[branchId];
    if (!branch)
        throw new Error(`Unknown Froam branch: ${branchId}`);
    const replayCheckpointId = branch.rootCheckpointId ?? branch.baseCheckpointId;
    const folded = new Set(document.checkpoints[replayCheckpointId]?.eventIds ?? []);
    return filterReplayEvents(document.events.filter((event) => event.branchId === branchId && !folded.has(event.id)), filter);
}
/** Fold to a cursor without mutating the project. Checkpoints make the initial state cheap. */
export function replayStateAt(document, cursor, branchId = document.activeBranchId, filter = { includeBaseline: true }) {
    const branch = document.branches[branchId];
    if (!branch)
        throw new Error(`Unknown Froam branch: ${branchId}`);
    const checkpoint = document.checkpoints[branch.rootCheckpointId ?? branch.baseCheckpointId];
    if (!checkpoint)
        throw new Error(`Missing checkpoint for Froam branch: ${branchId}`);
    const folded = new Set(checkpoint.eventIds);
    const baseline = document.events
        .filter((event) => event.branchId === branchId && event.actorId === 'baseline' && !folded.has(event.id))
        .sort(compareProjectEvents)
        .reduce(applyProjectEvent, checkpoint.state);
    const events = branchReplayEvents(document, branchId, { ...filter, includeBaseline: false });
    return events.slice(0, Math.max(0, Math.min(cursor, events.length))).reduce(applyProjectEvent, baseline);
}
export function replayActors(events) {
    return [...new Set(events.map((event) => event.actorId).filter((actor) => actor !== 'baseline'))].sort();
}
/** Walked on demand so older checkpoint state does not inflate normal Replay work. */
export function checkpointAncestry(document, checkpointId) {
    const lineage = [];
    const seen = new Set();
    let current = document.checkpoints[checkpointId];
    while (current && !seen.has(current.id)) {
        lineage.push(current);
        seen.add(current.id);
        current = current.parentCheckpointId ? document.checkpoints[current.parentCheckpointId] : undefined;
    }
    return lineage;
}
export function replayEventLabel(event) {
    const op = event.type === 'design.op.appended' ? event.payload.op : undefined;
    return event.label || op?.label || event.type.replaceAll('.', ' ');
}
//# sourceMappingURL=replay.js.map