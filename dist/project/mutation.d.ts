import type { FroamProjectDocument, FroamProjectEventPayload, FroamProjectEventType, FroamProjectState } from './types';
export type FroamMutationLevel = 'safe' | 'experimental' | 'unhinged';
export type FroamMutationProposal = {
    type: FroamProjectEventType;
    payload: FroamProjectEventPayload;
    targetIds: string[];
    rationale: string;
};
export type FroamMutationRequest = {
    state: FroamProjectState;
    scopeNodeIds: string[];
    level: FroamMutationLevel;
    constraints?: string[];
    seed?: number;
    now: number;
};
export interface FroamMutationProvider {
    id: string;
    version: string;
    local: boolean;
    propose(request: FroamMutationRequest): FroamMutationProposal[];
}
export declare const deterministicMutationProvider: FroamMutationProvider;
export declare function createMutationPrototype(document: FroamProjectDocument, input: {
    branchId: string;
    name?: string;
    actorId: string;
    level: FroamMutationLevel;
    scopeNodeIds: string[];
    provider?: FroamMutationProvider;
    constraints?: string[];
    now?: number;
    seed?: number;
    idFactory?: () => string;
}): {
    project: {
        metadata: {
            mutations: unknown[];
        };
        activeBranchId: string;
        updatedAt: number;
        checkpoints: {
            [x: string]: import("./types").FroamCheckpoint;
        };
        branches: {
            [x: string]: import("./types").FroamBranch;
        };
        schemaVersion: typeof import("./types").FROAM_PROJECT_SCHEMA_VERSION;
        id: import("./types").FroamId;
        name: string;
        createdAt: number;
        events: import("./types").FroamProjectEvent[];
    };
    provenance: {
        id: string;
        sourceBranchId: string;
        sourceCheckpointId: string;
        level: FroamMutationLevel;
        provider: string;
        operationIds: string[];
        targetScope: string[];
        constraints: string[];
        createdAt: number;
    };
    proposals: FroamMutationProposal[];
};
//# sourceMappingURL=mutation.d.ts.map