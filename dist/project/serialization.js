import { FROAM_VIEWPORTS } from '../collab/types.js';
import { createProjectFromLegacyStore } from './adapters.js';
import { FROAM_PROJECT_SCHEMA_VERSION } from './types.js';
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