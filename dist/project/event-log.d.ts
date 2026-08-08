import { FROAM_PROJECT_SCHEMA_VERSION, type FroamBranch, type FroamCheckpoint, type FroamId, type FroamProjectDocument, type FroamProjectEvent, type FroamProjectEventPayload, type FroamProjectEventType, type FroamProjectState } from './types';
export type FroamIdFactory = () => string;
export declare function emptyProjectState(): FroamProjectState;
export declare function compareProjectEvents(a: FroamProjectEvent, b: FroamProjectEvent): number;
export declare function applyProjectEvent(current: FroamProjectState, event: FroamProjectEvent): FroamProjectState;
export declare function createProjectDocument(input: {
    id: FroamId;
    name: string;
    actorId: string;
    branchId?: FroamId;
    branchName?: string;
    now?: number;
    idFactory?: FroamIdFactory;
    initialState?: FroamProjectState;
}): FroamProjectDocument;
export declare function createProjectEvent(input: {
    id?: FroamId;
    projectId: FroamId;
    branchId: FroamId;
    actorId: string;
    clock: number;
    type: FroamProjectEventType;
    payload: FroamProjectEventPayload;
    targetIds?: FroamId[];
    createdAt?: number;
    batchId?: FroamId;
    label?: string;
    idFactory?: FroamIdFactory;
}): FroamProjectEvent;
export declare function appendProjectEvents(document: FroamProjectDocument, incoming: readonly FroamProjectEvent[]): FroamProjectDocument;
export declare function deriveBranchState(document: FroamProjectDocument, branchId?: string): FroamProjectState;
export declare function checkpointBranch(document: FroamProjectDocument, input: {
    branchId?: FroamId;
    actorId: string;
    label?: string;
    now?: number;
    idFactory?: FroamIdFactory;
}): {
    updatedAt: number;
    checkpoints: {
        [x: string]: FroamCheckpoint;
    };
    branches: {
        [x: string]: FroamBranch | {
            baseCheckpointId: string;
            id: FroamId;
            name: string;
            parentBranchId: FroamId | null;
            forkEventId: FroamId | null;
            headEventId: FroamId | null;
            createdAt: number;
            createdBy: import("../collab/types").FroamActorId;
        };
    };
    schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION;
    id: FroamId;
    name: string;
    activeBranchId: FroamId;
    createdAt: number;
    events: FroamProjectEvent[];
    metadata?: Record<string, unknown>;
};
export declare function createProjectBranch(document: FroamProjectDocument, input: {
    id: FroamId;
    name: string;
    actorId: string;
    fromBranchId?: FroamId;
    now?: number;
    idFactory?: FroamIdFactory;
}): {
    activeBranchId: string;
    updatedAt: number;
    checkpoints: {
        [x: string]: FroamCheckpoint;
    };
    branches: {
        [x: string]: FroamBranch;
    };
    schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION;
    id: FroamId;
    name: string;
    createdAt: number;
    events: FroamProjectEvent[];
    metadata?: Record<string, unknown>;
};
export declare function switchProjectBranch(document: FroamProjectDocument, branchId: FroamId): {
    activeBranchId: string;
    schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION;
    id: FroamId;
    name: string;
    createdAt: number;
    updatedAt: number;
    branches: Record<FroamId, FroamBranch>;
    checkpoints: Record<FroamId, FroamCheckpoint>;
    events: FroamProjectEvent[];
    metadata?: Record<string, unknown>;
};
//# sourceMappingURL=event-log.d.ts.map