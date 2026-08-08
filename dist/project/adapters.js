import { createProjectDocument } from './event-log.js';
/** Carries today's proven field operations into project history unchanged. */
export function legacyOpsToProjectEvents(ops, input) {
    return ops.map((op) => ({
        schemaVersion: 1,
        id: op.id,
        projectId: input.projectId,
        branchId: input.branchId,
        actorId: op.actor,
        clock: op.clock,
        createdAt: op.ts,
        type: 'design.op.appended',
        targetIds: op.nodeId ? [op.nodeId] : [],
        payload: { op },
        batchId: op.batch,
        label: op.label,
    }));
}
export function createProjectFromLegacyStore(input) {
    const initialState = {
        legacyStore: input.store,
        nodes: {},
        relations: {},
        flows: {},
        interactions: {},
        dna: {},
        assets: {},
    };
    return createProjectDocument({ ...input, id: input.projectId, initialState });
}
/** Converts the current Site Planner tree into graph records without changing its UI storage. */
export function sitePlanGraphRecords(pages) {
    const nodes = [];
    const relations = [];
    for (const page of pages) {
        nodes.push({
            id: page.id,
            kind: 'page',
            name: page.name,
            parentId: page.parentId,
            source: 'froam',
            locator: { routeKey: page.path },
            metadata: { status: page.status },
        });
        if (page.parentId) {
            relations.push({ id: `contains:${page.parentId}:${page.id}`, kind: 'contains', from: page.parentId, to: page.id });
        }
        for (const section of page.sections) {
            nodes.push({
                id: section.id,
                kind: 'frame',
                name: section.name,
                parentId: page.id,
                componentId: section.componentId,
                source: 'froam',
                metadata: { frame: section.frame },
            });
            relations.push({ id: `contains:${page.id}:${section.id}`, kind: 'contains', from: page.id, to: section.id });
            if (section.componentId) {
                relations.push({ id: `instance:${section.id}:${section.componentId}`, kind: 'instance-of', from: section.id, to: section.componentId });
            }
        }
    }
    return { nodes, relations };
}
export function withActiveBranch(document, activeBranchId) {
    if (!document.branches[activeBranchId])
        throw new Error(`Unknown Froam branch: ${activeBranchId}`);
    return { ...document, activeBranchId };
}
//# sourceMappingURL=adapters.js.map