export function createArchiveItem(input) {
    return {
        schemaVersion: 1, id: input.id, nodeId: input.nodeId, name: input.name.trim() || 'Archived component',
        createdAt: input.now ?? Date.now(), createdBy: input.actorId,
        snapshot: { html: input.html, legacyPath: input.legacyPath }, dna: input.dna,
        assetIds: input.assetIds ?? [], interactionIds: input.interactionIds ?? [],
        provenance: { projectId: input.projectId, branchId: input.branchId, sourceNodeId: input.nodeId }, usageNodeIds: [],
    };
}
export function upsertArchive(archive, item) { return { ...archive, [item.id]: item }; }
export function removeFromArchive(archive, id) { const next = { ...archive }; delete next[id]; return next; }
export function searchArchive(archive, query) {
    const needle = query.trim().toLowerCase();
    return Object.values(archive).filter((item) => !needle || `${item.name} ${item.dna.semantics?.role ?? ''}`.toLowerCase().includes(needle)).sort((a, b) => b.createdAt - a.createdAt);
}
export function reuseArchiveItem(item, input) {
    return { id: input.nodeId, kind: 'component-instance', name: item.name, parentId: input.parentId ?? null, componentId: item.id, source: 'froam', locator: { routeKey: input.routeKey, path: input.path }, metadata: { archiveItemId: item.id, derivedFrom: item.nodeId } };
}
function signature(item) {
    return JSON.stringify({ structure: item.dna.structure, layout: item.dna.layout, semantics: item.dna.semantics, visual: item.dna.visual });
}
export function similarArchiveItems(archive) {
    const items = Object.values(archive);
    const pairs = [];
    for (let i = 0; i < items.length; i += 1)
        for (let j = i + 1; j < items.length; j += 1) {
            const a = signature(items[i]);
            const b = signature(items[j]);
            if (a === b)
                pairs.push({ left: items[i].id, right: items[j].id, confidence: .95 });
        }
    return pairs;
}
//# sourceMappingURL=archive.js.map