import type { EditorStore, FroamOp } from '../collab/types';
import type { FroamWireframeSection } from '../editor/FroamPlannerTypes';
import type { FroamNode, FroamProjectDocument, FroamProjectEvent, FroamRelation } from './types';
/** Carries today's proven field operations into project history unchanged. */
export declare function legacyOpsToProjectEvents(ops: readonly FroamOp[], input: {
    projectId: string;
    branchId: string;
}): FroamProjectEvent[];
export declare function createProjectFromLegacyStore(input: {
    projectId: string;
    name: string;
    actorId: string;
    store: EditorStore;
    now?: number;
    idFactory?: () => string;
}): FroamProjectDocument;
export type LegacySitePage = {
    id: string;
    name: string;
    path: string;
    parentId: string | null;
    status: string;
    sections: FroamWireframeSection[];
};
/** Converts the current Site Planner tree into graph records without changing its UI storage. */
export declare function sitePlanGraphRecords(pages: readonly LegacySitePage[]): {
    nodes: FroamNode[];
    relations: FroamRelation[];
};
export declare function withActiveBranch(document: FroamProjectDocument, activeBranchId: string): {
    activeBranchId: string;
    schemaVersion: typeof import("./types").FROAM_PROJECT_SCHEMA_VERSION;
    id: import("./types").FroamId;
    name: string;
    createdAt: number;
    updatedAt: number;
    branches: Record<import("./types").FroamId, import("./types").FroamBranch>;
    checkpoints: Record<import("./types").FroamId, import("./types").FroamCheckpoint>;
    events: FroamProjectEvent[];
    metadata?: Record<string, unknown>;
};
//# sourceMappingURL=adapters.d.ts.map