import type { FroamBranch, FroamCheckpoint, FroamProjectDocument, FroamProjectEvent } from './types';
export type FroamProjectSyncEvent = {
    seq: number;
    roomSequence?: number;
    event: FroamProjectEvent;
};
export type FroamProjectSyncDelta = {
    projectId: string;
    branchId: string;
    cursor: number;
    revision?: number;
    cursorReset?: boolean;
    events: FroamProjectSyncEvent[];
    checkpoints: FroamCheckpoint[];
    branches: FroamBranch[];
};
/** Idempotent client fold. The requested branch cannot import another branch's events/checkpoints. */
export declare function mergeProjectSyncDelta(document: FroamProjectDocument, delta: FroamProjectSyncDelta): FroamProjectDocument;
export declare function projectSyncPush(document: FroamProjectDocument, branchId?: string, cursor?: number, roomSequences?: Record<string, number>, concurrency?: {
    expectedRevision?: number;
    expectedBranchHeadId?: string | null;
}): {
    events: {
        event: FroamProjectEvent;
        roomSequence: number;
    }[];
    checkpoints: FroamCheckpoint[];
    branches: FroamBranch[];
    expectedRevision?: number;
    expectedBranchHeadId?: string | null;
    projectId: string;
    branchId: string;
    cursor: number;
};
//# sourceMappingURL=project-sync.d.ts.map