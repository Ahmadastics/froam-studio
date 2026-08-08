import type { EditorStore, ElementDraft, FroamViewport } from '../collab/types';
import { FROAM_PROJECT_SCHEMA_VERSION, type FroamProjectDocument } from './types';
export type FroamLegacyDesignFile = {
    version: number;
    updatedAt?: string | null;
    meta?: Record<string, unknown>;
    routes: Record<string, Partial<Record<FroamViewport, Record<string, ElementDraft>>>>;
};
export type FroamProjectFile = {
    kind: 'froam-project';
    schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION;
    project: FroamProjectDocument;
    /** Preserved verbatim so current runtime and codegen can keep consuming v3. */
    design: FroamLegacyDesignFile;
};
export declare function isLegacyDesignFile(value: unknown): value is FroamLegacyDesignFile;
export declare function isFroamProjectFile(value: unknown): value is FroamProjectFile;
export declare function legacyDesignToEditorStore(design: FroamLegacyDesignFile): EditorStore;
export declare function createProjectFileFromLegacyDesign(design: FroamLegacyDesignFile, options: {
    projectId: string;
    actorId: string;
    name?: string;
    now?: number;
    idFactory?: () => string;
}): FroamProjectFile;
export declare function parseFroamProjectFile(input: string | unknown, migration: {
    projectId: string;
    actorId: string;
    name?: string;
    now?: number;
    idFactory?: () => string;
}): {
    file: FroamProjectFile;
    migrated: boolean;
};
export declare function serializeFroamProjectFile(file: FroamProjectFile): string;
/** Compatibility escape hatch: existing codegen/runtime receive the exact v3 snapshot. */
export declare function unwrapLegacyDesign(file: FroamProjectFile): FroamLegacyDesignFile;
//# sourceMappingURL=serialization.d.ts.map