import { type FroamViewport } from '../collab/types';
import type { FroamDNA, FroamNode, FroamProjectDocument, FroamProjectEvent, FroamProjectEventPayload, FroamProjectEventType, FroamProjectState, FroamRelation, FroamScanRecord } from './types';
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
/**
 * What the editor read off the page around the selection, for the edits that
 * depend on it (smart Quick Edits). It stays on this device: it is not part of
 * any AI request's evidence.
 */
export type FroamPageContext = {
    /** The element's own solid fill, when it has one. */
    surface?: string;
    /** The solid colour behind the element. */
    behind?: string;
    /** A photo, video or gradient is behind its text. */
    overImage?: boolean;
    /** Which: a photo's contrast can't be measured; a gradient's can, against each of its colours. */
    imageKind?: 'photo' | 'gradient';
    /** A gradient's colours, when that's what is behind. */
    behindStops?: string[];
    /** The site's brand colour, when the page has a clear one. */
    accent?: string;
    /** The corner radius the site's cards and images mostly use. */
    radius?: string;
    /** It reads as text (a heading, a paragraph, a link) rather than a box. */
    text?: boolean;
    tag?: string;
    /** The other elements of its kind on the page, and the styles most of them share where this one differs. */
    lookAlikes?: {
        count: number;
        noun: string;
        styles: Record<string, string>;
    };
};
export type FroamMutationSelectionSnapshot = {
    node: FroamNode;
    scan?: FroamScanRecord;
    dna?: FroamDNA;
    relationships?: FroamRelation[];
    routeKey: string;
    viewport: FroamViewport;
    path: string;
    page?: FroamPageContext;
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
/**
 * Create a mutation prototype branch from an already-validated set of external
 * FroamMutationProposal objects (e.g. from the AI planning pipeline).
 *
 * Uses the SAME branch/provenance/adoption pipeline as createMutationPrototype
 * so all MUTATE protections remain intact. The caller is responsible for
 * validating proposals before passing them here.
 */
export declare function createMutationPrototypeFromProposals(document: FroamProjectDocument, input: {
    branchId: string;
    name?: string;
    actorId: string;
    level: FroamMutationLevel;
    /** Original bounded request scope. Proposals cannot expand it. */
    scopeNodeIds: string[];
    proposals: FroamMutationProposal[];
    constraints: FroamMutationConstraints;
    provider: string;
    /** Fresh selected-node evidence is written to the prototype only. */
    selectionSnapshot?: FroamMutationSelectionSnapshot;
    preserveDimensions?: boolean;
    preserveCopy?: boolean;
    now?: number;
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
    filteredCount: number;
    compiledDesignOperationCount: number;
};
//# sourceMappingURL=mutation.d.ts.map