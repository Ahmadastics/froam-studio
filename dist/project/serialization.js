import { FROAM_VIEWPORTS } from '../collab/types.js';
import { createProjectFromLegacyStore } from './adapters.js';
import { FROAM_DNA_SCHEMA_VERSION, FROAM_PROJECT_SCHEMA_VERSION } from './types.js';
import { normalizeProjectState } from './event-log.js';
export function isLegacyDesignFile(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return Number.isFinite(candidate.version) && Boolean(candidate.routes && typeof candidate.routes === 'object');
}
export function isFroamProjectFile(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return candidate.kind === 'froam-project'
        && candidate.schemaVersion === FROAM_PROJECT_SCHEMA_VERSION
        && candidate.project?.schemaVersion === FROAM_PROJECT_SCHEMA_VERSION
        && isLegacyDesignFile(candidate.design);
}
function isV1ProjectFile(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    const project = candidate.project;
    return candidate.kind === 'froam-project' && candidate.schemaVersion === 1 && project?.schemaVersion === 1 && isLegacyDesignFile(candidate.design);
}
/** Additive v6→v7 project migration. Existing event IDs and legacy design remain byte-for-byte meaningful. */
export function migrateProjectFileV1(value) {
    if (!isV1ProjectFile(value))
        return null;
    const oldProject = value.project;
    const checkpoints = Object.fromEntries(Object.entries(oldProject.checkpoints).map(([id, checkpoint]) => [id, {
            ...checkpoint,
            state: normalizeProjectState(checkpoint.state),
        }]));
    const branches = Object.fromEntries(Object.entries(oldProject.branches).map(([id, branch]) => {
        const oldest = Object.values(checkpoints)
            .filter((checkpoint) => checkpoint.branchId === id)
            .sort((a, b) => a.createdAt - b.createdAt)[0];
        return [id, { ...branch, rootCheckpointId: oldest?.id ?? branch.baseCheckpointId }];
    }));
    for (const checkpoint of Object.values(checkpoints)) {
        for (const [nodeId, dna] of Object.entries(checkpoint.state.dna)) {
            if (!dna.schemaVersion)
                checkpoint.state.dna[nodeId] = { ...dna, schemaVersion: FROAM_DNA_SCHEMA_VERSION };
        }
    }
    return {
        kind: 'froam-project',
        schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
        design: value.design,
        project: {
            ...oldProject,
            schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
            branches,
            checkpoints,
            events: oldProject.events.map((event) => ({ ...event, schemaVersion: FROAM_PROJECT_SCHEMA_VERSION })),
        },
    };
}
export function coerceFroamProjectFile(value) {
    return isFroamProjectFile(value) ? value : migrateProjectFileV1(value);
}
export function legacyDesignToEditorStore(design) {
    const store = {};
    for (const [routeKey, route] of Object.entries(design.routes)) {
        for (const viewport of FROAM_VIEWPORTS) {
            const drafts = route[viewport];
            if (drafts && typeof drafts === 'object')
                store[`${routeKey}@@${viewport}`] = drafts;
        }
    }
    return store;
}
export function editorStoreToLegacyDesign(store, previous) {
    const routes = {};
    for (const [scope, drafts] of Object.entries(store)) {
        const separator = scope.lastIndexOf('@@');
        if (separator < 0)
            continue;
        const routeKey = scope.slice(0, separator);
        const viewport = scope.slice(separator + 2);
        if (!FROAM_VIEWPORTS.includes(viewport))
            continue;
        routes[routeKey] = { ...(routes[routeKey] ?? {}), [viewport]: drafts };
    }
    return {
        version: previous?.version ?? 3,
        updatedAt: new Date().toISOString(),
        meta: previous?.meta,
        routes,
    };
}
export function createProjectFileFromLegacyDesign(design, options) {
    const project = createProjectFromLegacyStore({
        projectId: options.projectId,
        actorId: options.actorId,
        name: options.name ?? String(design.meta?.name ?? 'Froam project'),
        store: legacyDesignToEditorStore(design),
        now: options.now,
        idFactory: options.idFactory,
    });
    return { kind: 'froam-project', schemaVersion: FROAM_PROJECT_SCHEMA_VERSION, project, design };
}
export function parseFroamProjectFile(input, migration) {
    const value = typeof input === 'string' ? JSON.parse(input) : input;
    if (isFroamProjectFile(value))
        return { file: value, migrated: false };
    const upgraded = migrateProjectFileV1(value);
    if (upgraded)
        return { file: upgraded, migrated: true };
    if (isLegacyDesignFile(value))
        return { file: createProjectFileFromLegacyDesign(value, migration), migrated: true };
    throw new Error('Not a supported Froam project or design file');
}
export function serializeFroamProjectFile(file) {
    if (!isFroamProjectFile(file))
        throw new Error('Cannot serialize an invalid Froam project file');
    return JSON.stringify(file, null, 2);
}
/** Compatibility escape hatch: existing codegen/runtime receive the exact v3 snapshot. */
export function unwrapLegacyDesign(file) {
    return file.design;
}
//# sourceMappingURL=serialization.js.map