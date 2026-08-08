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
    events: FroamProjectSyncEvent[];
    checkpoints: FroamCheckpoint[];
    branches: FroamBranch[];
};
/** Idempotent client fold. The requested branch cannot import another branch's events/checkpoints. */
export declare function mergeProjectSyncDelta(document: FroamProjectDocument, delta: FroamProjectSyncDelta): FroamProjectDocument;
export declare function projectSyncPush(document: FroamProjectDocument, branchId?: string, cursor?: number, roomSequences?: Record<string, number>): {
    projectId: string;
    branchId: string;
    cursor: number;
    events: {
        event: FroamProjectEvent;
        roomSequence: number;
    }[];
    checkpoints: FroamCheckpoint[];
    branches: FroamBranch[];
};
//# sourceMappingURL=project-sync.d.ts.map