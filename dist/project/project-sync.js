/** Idempotent client fold. The requested branch cannot import another branch's events/checkpoints. */
export function mergeProjectSyncDelta(document, delta) {
    if (delta.projectId !== document.id)
        throw new Error('Project sync delta belongs to another project');
    const events = new Map(document.events.map((event) => [event.id, event]));
    for (const item of delta.events) {
        if (item.event.branchId !== delta.branchId)
            throw new Error('Project sync branch contamination refused');
        events.set(item.event.id, item.event);
    }
    const checkpoints = { ...document.checkpoints };
    for (const checkpoint of delta.checkpoints) {
        if (checkpoint.branchId !== delta.branchId)
            throw new Error('Project sync checkpoint contamination refused');
        checkpoints[checkpoint.id] = checkpoint;
    }
    const branches = { ...document.branches };
    for (const branch of delta.branches)
        branches[branch.id] = branch;
    return { ...document, events: [...events.values()], checkpoints, branches, updatedAt: Math.max(document.updatedAt, ...delta.events.map((item) => item.event.createdAt), 0) };
}
export function projectSyncPush(document, branchId = document.activeBranchId, cursor = 0, roomSequences = {}) {
    if (!document.branches[branchId])
        throw new Error(`Unknown Froam branch: ${branchId}`);
    return {
        projectId: document.id, branchId, cursor,
        events: document.events.filter((event) => event.branchId === branchId).map((event) => ({ event, roomSequence: roomSequences[event.id] })),
        checkpoints: Object.values(document.checkpoints).filter((checkpoint) => checkpoint.branchId === branchId),
        branches: Object.values(document.branches).filter((branch) => branch.id === branchId || branch.id === document.branches[branchId].parentBranchId),
    };
}
//# sourceMappingURL=project-sync.js.map