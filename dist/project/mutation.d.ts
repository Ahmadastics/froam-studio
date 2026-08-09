import type { FroamProjectDocument, FroamProjectEvent, FroamProjectEventPayload, FroamProjectEventType, FroamProjectState } from './types';
export type FroamMutationLevel = 'safe' | 'experimental' | 'unhinged';
export type FroamMutationDomain = 'visual' | 'typography' | 'spacing' | 'layout' | 'navigation' | 'interactions' | 'motion' | 'responsive' | 'composition';
export type FroamMutationProtection = 'copy' | 'brand-colors' | 'logo' | 'product-data' | 'navigation' | 'component' | 'section';
export type FroamMutationConstraints = {
    protect: FroamMutationProtection[];
    allow: FroamMutationDomain[];
    protectedNodeIds?: string[];
};
export type FroamMutationProposal = {
    type: FroamProjectEventType;
    payload: FroamProjectEventPayload;
    targetIds: string[];
    rationale: string;
    domain: FroamMutationDomain;
    confidence: number;
    dependencies?: string[];
};
export type FroamMutationRequest = {
    state: FroamProjectState;
    scopeNodeIds: string[];
    level: FroamMutationLevel;
    constraints: FroamMutationConstraints;
    seed?: number;
    now: number;
    projectContext?: Record<string, unknown>;
};
export interface FroamMutationProvider {
    id: string;
    version: string;
    local: boolean;
    propose(request: FroamMutationRequest): FroamMutationProposal[];
}
export type FroamMutationProvenance = {
    id: string;
    sourceBranchId: string;
    sourceCheckpointId: string;
    level: FroamMutationLevel;
    provider: string;
    operationIds: string[];
    targetScope: string[];
    constraints: FroamMutationConstraints;
    createdAt: number;
};
export type FroamMutationComparison = {
    sourceBranchId: string;
    mutationBranchId: string;
    changedNodeIds: string[];
    structural: number;
    visual: number;
    interactions: number;
    responsive: number;
    eventIds: string[];
};
export type FroamAdoptionResult = {
    status: 'adopted' | 'refused';
    project: FroamProjectDocument;
    adoptedEventIds: string[];
    conflicts: Array<{
        eventId: string;
        targetId: string;
        reason: string;
    }>;
};
export declare function normalizeMutationConstraints(level: FroamMutationLevel, input?: Partial<FroamMutationConstraints>): FroamMutationConstraints;
export declare const deterministicMutationProvider: FroamMutationProvider;
export declare function previewMutation(provider: FroamMutationProvider, request: FroamMutationRequest): {
    provider: string;
    level: FroamMutationLevel;
    proposals: FroamMutationProposal[];
    summary: {
        domain: FroamMutationDomain;
        rationale: string;
        targets: number;
        confidence: number;
    }[];
    requiresConfirmation: boolean;
};
export declare function createMutationPrototype(document: FroamProjectDocument, input: {
    branchId: string;
    name?: string;
    actorId: string;
    level: FroamMutationLevel;
    scopeNodeIds: string[];
    provider?: FroamMutationProvider;
    constraints?: Partial<FroamMutationConstraints>;
    projectContext?: Record<string, unknown>;
    now?: number;
    seed?: number;
    idFactory?: () => string;
}): {
    project: {
        metadata: {
            mutations: FroamMutationProvenance[];
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
        events: FroamProjectEvent[];
    };
    provenance: {
        operationIds: string[];
        id: string;
        sourceBranchId: string;
        sourceCheckpointId: string;
        level: FroamMutationLevel;
        provider: string;
        targetScope: string[];
        constraints: FroamMutationConstraints;
        createdAt: number;
    };
    proposals: FroamMutationProposal[];
    preview: {
        provider: string;
        level: FroamMutationLevel;
        proposals: FroamMutationProposal[];
        summary: {
            domain: FroamMutationDomain;
            rationale: string;
            targets: number;
            confidence: number;
        }[];
        requiresConfirmation: boolean;
    };
};
export declare function compareMutationBranches(document: FroamProjectDocument, sourceBranchId: string, mutationBranchId: string): FroamMutationComparison;
export declare function adoptMutationChanges(document: FroamProjectDocument, input: {
    mutationBranchId: string;
    targetBranchId: string;
    eventIds: string[];
    actorId: string;
    now?: number;
    idFactory?: () => string;
}): FroamAdoptionResult;
export declare function materializeMutationPreview(state: FroamProjectState, proposals: readonly FroamMutationProposal[]): FroamProjectState;
//# sourceMappingURL=mutation.d.ts.map