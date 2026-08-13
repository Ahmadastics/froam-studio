import { type FroamViewport } from '../collab/types';
import { type FroamReferenceUnderstanding } from './reference-intelligence';
import type { FroamMutationProvenance, FroamMutationSelectionSnapshot } from './mutation';
import type { FroamProjectDocument, FroamProjectEvent } from './types';
export declare const FROAM_REFERENCE_BUILD_VERSION: 1;
export declare const FROAM_REFERENCE_BUILD_LIMITS: {
    readonly maxNewNodes: 100;
    readonly maxDepth: 12;
    readonly maxStructuralOperations: 50;
    readonly maxValidationWidths: 12;
    readonly maxCorrectionPasses: 3;
};
export type FroamReferenceBuildOrigin = 'observed' | 'inferred';
export type FroamReferenceBuildTarget = {
    kind: 'selected';
    nodeId: string;
    path: string;
    routeKey: string;
    label: string;
    authorizedNodeIds: string[];
    explicit: true;
} | {
    kind: 'current-page';
    nodeId: string;
    routeKey: string;
    label: string;
    authorizedNodeIds: string[];
    explicit: true;
};
export type FroamReferenceBuildStructure = {
    id: string;
    nodeId: string;
    parentNodeId: string | null;
    kind: 'target' | 'section' | 'content' | 'media' | 'component-definition' | 'component-instance';
    role: string;
    depth: number;
    origin: FroamReferenceBuildOrigin;
    evidenceIds: string[];
    componentFamilyId?: string;
    placeholder?: boolean;
};
export type FroamReferenceBuildDnaChange = {
    id: string;
    nodeId: string;
    section: 'structure' | 'layout' | 'visual' | 'responsive' | 'provenance';
    values: Record<string, unknown>;
    origin: FroamReferenceBuildOrigin;
    evidenceIds: string[];
    executable: boolean;
};
export type FroamReferenceBuildRelationship = {
    id: string;
    kind: 'contains' | 'instance-of' | 'derived-from' | 'governed-by';
    from: string;
    to: string;
    origin: FroamReferenceBuildOrigin;
    evidenceIds: string[];
};
export type FroamReferenceBuildConstraint = {
    id: string;
    kind: 'grid-columns' | 'orientation' | 'navigation-shape' | 'visibility' | 'container-ratio' | 'transition-interval';
    origin: FroamReferenceBuildOrigin;
    evidenceIds: string[];
    width?: number;
    betweenWidths?: [number, number];
    expected: Record<string, number | string | boolean | null>;
};
export type FroamReferenceBuildOperation = {
    id: string;
    kind: 'insert';
    nodeId: string;
    parentNodeId: string;
    parentPath: string;
    index: number;
    origin: FroamReferenceBuildOrigin;
    evidenceIds: string[];
} | {
    id: string;
    kind: 'style';
    nodeId: string;
    path: string;
    viewport: FroamViewport;
    property: string;
    value: string;
    origin: FroamReferenceBuildOrigin;
    evidenceIds: string[];
} | {
    id: string;
    kind: 'capture-dna';
    nodeId: string;
    origin: FroamReferenceBuildOrigin;
    evidenceIds: string[];
} | {
    id: string;
    kind: 'responsive-policy';
    nodeId: string;
    origin: FroamReferenceBuildOrigin;
    evidenceIds: string[];
};
export type FroamReferenceBuildPlan = {
    schemaVersion: typeof FROAM_REFERENCE_BUILD_VERSION;
    id: string;
    target: FroamReferenceBuildTarget;
    sourceReferenceSetId: string;
    sourceBranchId: string;
    mode: 'structure-visual-responsive';
    attempt: number;
    previousPrototypeBranchId?: string;
    createdAt: number;
    structure: FroamReferenceBuildStructure[];
    dnaChanges: FroamReferenceBuildDnaChange[];
    relationships: FroamReferenceBuildRelationship[];
    responsiveConstraints: FroamReferenceBuildConstraint[];
    operations: FroamReferenceBuildOperation[];
    validationWidths: number[];
    protections: {
        copy: true;
        brand: true;
        logo: true;
        navigationContent: true;
        productData: true;
        assets: true;
    };
    evidence: Array<{
        id: string;
        origin: FroamReferenceBuildOrigin;
        summary: string;
        referenceIds: string[];
    }>;
    limitations: string[];
};
export type FroamReferenceCandidateObservation = {
    width: number;
    targetFound: boolean;
    targetWidthRatio?: number;
    gridColumns?: number;
    orientation?: 'row' | 'column';
    navigationShape?: 'expanded' | 'compact';
    visible?: boolean;
    regionCount?: number;
    overflowX: boolean;
    collisions: number;
    clipped: number;
    hiddenCritical: number;
    touchTargetFailures: number;
    visualSimilarity?: number;
};
export type FroamReferenceBuildMeasurement = {
    width: number;
    referenceId?: string;
    kind: 'structure' | 'geometry' | 'responsive' | 'visual' | 'text';
    measured: boolean;
    expected?: number | string | boolean;
    actual?: number | string | boolean;
    delta?: number;
    pass?: boolean;
    summary: string;
};
export type FroamReferenceBuildValidation = {
    planId: string;
    measuredAt: number;
    widths: number[];
    measurements: FroamReferenceBuildMeasurement[];
    scorecard: {
        structure?: number;
        geometry?: number;
        responsive?: number;
        visual?: number;
        text?: number;
    };
    health: {
        overflow: number;
        collisions: number;
        clipping: number;
        hiddenCritical: number;
        touchTargets: number;
        healthy: boolean;
    };
    differences: string[];
    successful: boolean;
};
export type FroamReferenceCorrectionPass = {
    pass: number;
    planId: string;
    score: number;
    improved: boolean;
    failures: string[];
};
export declare function createDeterministicReferenceBuildPlan(input: {
    understanding: FroamReferenceUnderstanding;
    target: FroamReferenceBuildTarget;
    sourceBranchId: string;
    attempt?: number;
    previousPrototypeBranchId?: string;
    now?: number;
}): FroamReferenceBuildPlan;
export declare function validateReferenceBuildPlan(plan: FroamReferenceBuildPlan): FroamReferenceBuildPlan;
export declare function createReferenceBuildPrototype(document: FroamProjectDocument, input: {
    plan: FroamReferenceBuildPlan;
    branchId: string;
    name: string;
    actorId: string;
    selectionSnapshot?: FroamMutationSelectionSnapshot;
    now?: number;
}): {
    project: {
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
        metadata?: Record<string, unknown>;
    };
    plan: FroamReferenceBuildPlan;
    provenance: FroamMutationProvenance;
    operationCount: number;
    structuralOperationCount: number;
};
export declare function validateReferenceBuildCandidate(plan: FroamReferenceBuildPlan, observations: readonly FroamReferenceCandidateObservation[], now?: number): FroamReferenceBuildValidation;
export declare function referenceBuildRetryFeedback(validation: FroamReferenceBuildValidation): string;
export declare function runBoundedReferenceCorrections<T>(input: {
    initial: T;
    evaluate: (candidate: T, pass: number) => Promise<{
        score: number;
        failures: string[];
    }>;
    correct: (candidate: T, pass: number, failures: string[]) => Promise<T>;
    maxPasses?: number;
}): Promise<{
    candidate: T;
    score: number;
    failures: string[];
    history: FroamReferenceCorrectionPass[];
}>;
//# sourceMappingURL=reference-build.d.ts.map