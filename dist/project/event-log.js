import { FROAM_PROJECT_SCHEMA_VERSION, } from './types.js';
import { applyOp } from '../collab/oplog.js';
function defaultId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        return crypto.randomUUID();
    return `froam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export function emptyProjectState() {
    return { legacyStore: {}, nodes: {}, relations: {}, flows: {}, interactions: {}, dna: {}, assets: {}, scans: {}, archive: {}, analyses: {}, responsive: {} };
}
export function normalizeProjectState(state) {
    return {
        legacyStore: { ...(state.legacyStore ?? {}) }, nodes: { ...(state.nodes ?? {}) }, relations: { ...(state.relations ?? {}) },
        flows: { ...(state.flows ?? {}) }, interactions: { ...(state.interactions ?? {}) }, dna: { ...(state.dna ?? {}) }, assets: { ...(state.assets ?? {}) },
        scans: { ...(state.scans ?? {}) }, archive: { ...(state.archive ?? {}) }, analyses: { ...(state.analyses ?? {}) }, responsive: { ...(state.responsive ?? {}) },
    };
}
function cloneState(state) { return normalizeProjectState(state); }
export function compareProjectEvents(a, b) {
    if (a.clock !== b.clock)
        return a.clock - b.clock;
    if (a.actorId !== b.actorId)
        return a.actorId < b.actorId ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
export function applyProjectEvent(current, event) {
    const next = cloneState(current);
    const payload = event.payload;
    switch (event.type) {
        case 'design.store.replaced':
            next.legacyStore = { ...(payload.store ?? {}) };
            break;
        case 'design.op.appended':
            next.legacyStore = applyOp(next.legacyStore, payload.op);
            break;
        case 'node.upserted': {
            const node = payload.node;
            if (node?.id)
                next.nodes[node.id] = node;
            break;
        }
        case 'node.removed': {
            const nodeId = String(payload.nodeId ?? '');
            delete next.nodes[nodeId];
            delete next.dna[nodeId];
            for (const relation of Object.values(next.relations)) {
                if (relation.from === nodeId || relation.to === nodeId)
                    delete next.relations[relation.id];
            }
            break;
        }
        case 'relation.upserted': {
            const relation = payload.relation;
            if (relation?.id)
                next.relations[relation.id] = relation;
            break;
        }
        case 'relation.removed':
            delete next.relations[String(payload.relationId ?? '')];
            break;
        case 'flow.upserted': {
            const flow = payload.flow;
            if (flow?.id)
                next.flows[flow.id] = flow;
            break;
        }
        case 'flow.removed':
            delete next.flows[String(payload.flowId ?? '')];
            break;
        case 'interaction.upserted': {
            const interaction = payload.interaction;
            if (interaction?.id)
                next.interactions[interaction.id] = interaction;
            break;
        }
        case 'interaction.removed':
            delete next.interactions[String(payload.interactionId ?? '')];
            break;
        case 'dna.captured': {
            const dna = payload.dna;
            if (dna?.nodeId)
                next.dna[dna.nodeId] = dna;
            break;
        }
        case 'asset.upserted': {
            const asset = payload.asset;
            if (asset?.id)
                next.assets[asset.id] = asset;
            break;
        }
        case 'asset.removed':
            delete next.assets[String(payload.assetId ?? '')];
            break;
        case 'scan.captured': {
            const scan = payload.scan;
            if (scan?.id)
                next.scans[scan.id] = scan;
            break;
        }
        case 'archive.upserted': {
            const item = payload.archiveItem;
            if (item?.id)
                next.archive[item.id] = item;
            break;
        }
        case 'archive.removed':
            delete next.archive[String(payload.archiveItemId ?? '')];
            break;
        case 'analysis.upserted': {
            const analysis = payload.analysis;
            if (analysis?.id)
                next.analyses[analysis.id] = analysis;
            break;
        }
        case 'analysis.removed':
            delete next.analyses[String(payload.analysisId ?? '')];
            break;
        case 'responsive.upserted': {
            const responsive = payload.responsive;
            if (responsive?.nodeId)
                next.responsive[responsive.nodeId] = responsive;
            break;
        }
        case 'responsive.removed':
            delete next.responsive[String(payload.nodeId ?? '')];
            break;
    }
    return next;
}
export function createProjectDocument(input) {
    const now = input.now ?? Date.now();
    const makeId = input.idFactory ?? defaultId;
    const branchId = input.branchId ?? 'main';
    const checkpointId = makeId();
    const checkpoint = {
        id: checkpointId,
        projectId: input.id,
        branchId,
        createdAt: now,
        createdBy: input.actorId,
        label: 'Initial state',
        eventIds: [],
        state: cloneState(input.initialState ?? emptyProjectState()),
    };
    const branch = {
        id: branchId,
        name: input.branchName ?? 'Main',
        parentBranchId: null,
        forkEventId: null,
        baseCheckpointId: checkpointId,
        headEventId: null,
        createdAt: now,
        createdBy: input.actorId,
        rootCheckpointId: checkpointId,
    };
    return {
        schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
        id: input.id,
        name: input.name,
        activeBranchId: branchId,
        createdAt: now,
        updatedAt: now,
        branches: { [branchId]: branch },
        checkpoints: { [checkpointId]: checkpoint },
        events: [],
    };
}
export function createProjectEvent(input) {
    return {
        schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
        id: input.id ?? (input.idFactory ?? defaultId)(),
        projectId: input.projectId,
        branchId: input.branchId,
        actorId: input.actorId,
        clock: input.clock,
        createdAt: input.createdAt ?? Date.now(),
        type: input.type,
        targetIds: input.targetIds ?? [],
        payload: input.payload,
        batchId: input.batchId,
        label: input.label,
    };
}
export function appendProjectEvents(document, incoming) {
    const known = new Set(document.events.map((event) => event.id));
    const accepted = incoming.filter((event) => (event.schemaVersion === FROAM_PROJECT_SCHEMA_VERSION
        && event.projectId === document.id
        && Boolean(document.branches[event.branchId])
        && !known.has(event.id)
        && (known.add(event.id) || true)));
    if (!accepted.length)
        return document;
    const events = [...document.events, ...accepted].sort(compareProjectEvents);
    const branches = { ...document.branches };
    for (const branchId of new Set(accepted.map((event) => event.branchId))) {
        const branch = branches[branchId];
        const head = events.filter((event) => event.branchId === branchId).at(-1);
        branches[branchId] = { ...branch, headEventId: head?.id ?? branch.headEventId };
    }
    return {
        ...document,
        events,
        branches,
        updatedAt: Math.max(document.updatedAt, ...accepted.map((event) => event.createdAt)),
    };
}
export function deriveBranchState(document, branchId = document.activeBranchId) {
    const branch = document.branches[branchId];
    if (!branch)
        throw new Error(`Unknown Froam branch: ${branchId}`);
    const checkpoint = document.checkpoints[branch.baseCheckpointId];
    if (!checkpoint)
        throw new Error(`Missing checkpoint for Froam branch: ${branchId}`);
    const folded = new Set(checkpoint.eventIds);
    return document.events
        .filter((event) => event.branchId === branchId && !folded.has(event.id))
        .sort(compareProjectEvents)
        .reduce(applyProjectEvent, checkpoint.state);
}
export function checkpointBranch(document, input) {
    const branchId = input.branchId ?? document.activeBranchId;
    const branch = document.branches[branchId];
    if (!branch)
        throw new Error(`Unknown Froam branch: ${branchId}`);
    const checkpoint = {
        id: (input.idFactory ?? defaultId)(),
        projectId: document.id,
        branchId,
        createdAt: input.now ?? Date.now(),
        createdBy: input.actorId,
        label: input.label,
        eventIds: document.events.filter((event) => event.branchId === branchId).map((event) => event.id),
        state: deriveBranchState(document, branchId),
        parentCheckpointId: branch.baseCheckpointId,
    };
    return {
        ...document,
        updatedAt: checkpoint.createdAt,
        checkpoints: { ...document.checkpoints, [checkpoint.id]: checkpoint },
        branches: {
            ...document.branches,
            [branchId]: { ...branch, baseCheckpointId: checkpoint.id },
        },
    };
}
export function createProjectBranch(document, input) {
    if (document.branches[input.id])
        throw new Error(`Froam branch already exists: ${input.id}`);
    const parentId = input.fromBranchId ?? document.activeBranchId;
    const parent = document.branches[parentId];
    if (!parent)
        throw new Error(`Unknown Froam branch: ${parentId}`);
    const now = input.now ?? Date.now();
    const checkpointId = (input.idFactory ?? defaultId)();
    const checkpoint = {
        id: checkpointId,
        projectId: document.id,
        branchId: input.id,
        createdAt: now,
        createdBy: input.actorId,
        label: `Forked from ${parent.name}`,
        eventIds: [],
        state: deriveBranchState(document, parentId),
    };
    const branch = {
        id: input.id,
        name: input.name,
        parentBranchId: parentId,
        forkEventId: parent.headEventId,
        baseCheckpointId: checkpointId,
        headEventId: null,
        createdAt: now,
        createdBy: input.actorId,
        rootCheckpointId: checkpointId,
    };
    return {
        ...document,
        activeBranchId: input.id,
        updatedAt: now,
        checkpoints: { ...document.checkpoints, [checkpointId]: checkpoint },
        branches: { ...document.branches, [input.id]: branch },
    };
}
export function switchProjectBranch(document, branchId) {
    if (!document.branches[branchId])
        throw new Error(`Unknown Froam branch: ${branchId}`);
    return { ...document, activeBranchId: branchId, updatedAt: Date.now() };
}
export function renameProjectBranch(document, branchId, name, now = Date.now()) {
    const branch = document.branches[branchId];
    if (!branch)
        throw new Error(`Unknown Froam branch: ${branchId}`);
    const cleanName = name.trim().slice(0, 80);
    if (!cleanName)
        throw new Error('A Froam prototype needs a name');
    return {
        ...document,
        updatedAt: now,
        branches: { ...document.branches, [branchId]: { ...branch, name: cleanName } },
    };
}
/** Delete only leaf prototypes. Main and parents with descendants are protected. */
export function deleteProjectBranch(document, branchId, now = Date.now()) {
    const branch = document.branches[branchId];
    if (!branch)
        throw new Error(`Unknown Froam branch: ${branchId}`);
    if (branchId === 'main' || branch.parentBranchId === null)
        throw new Error('The main Froam branch cannot be deleted');
    if (Object.values(document.branches).some((candidate) => candidate.parentBranchId === branchId)) {
        throw new Error('Delete child prototypes before deleting their parent');
    }
    const branches = { ...document.branches };
    delete branches[branchId];
    const checkpoints = { ...document.checkpoints };
    for (const checkpoint of Object.values(checkpoints)) {
        if (checkpoint.branchId === branchId)
            delete checkpoints[checkpoint.id];
    }
    return {
        ...document,
        activeBranchId: document.activeBranchId === branchId ? branch.parentBranchId : document.activeBranchId,
        updatedAt: now,
        branches,
        checkpoints,
        events: document.events.filter((event) => event.branchId !== branchId),
    };
}
//# sourceMappingURL=event-log.js.map