import type { FroamAnalysisIntelligenceRequest } from './intelligence-transport';
import type { FroamResponsiveObservation } from './responsive';
import type { FroamResponsivePolicy, FroamScanRecord } from './types';
import type { FroamScreenshotPixels, FroamScreenshotProvider, FroamScreenshotReconstruction } from './screenshot-reconstruction';
import { type FroamScreenshotStateDifference } from './screenshot-state';
export declare const FROAM_REFERENCE_SCHEMA_VERSION: 1;
export declare const FROAM_BASELINE_VALIDATION_WIDTHS: readonly [320, 360, 390, 430, 480, 640, 768, 834, 1024, 1280, 1440, 1600, 1920];
export type FroamReferenceEvidenceOrigin = 'observed' | 'inferred';
export type FroamReferenceViewport = {
    width: number;
    height: number;
    devicePixelRatio?: number;
};
export type FroamReferenceState = {
    key: string;
    label?: string;
};
/** Opaque future media descriptor. It never contains bytes, data URLs, paths, or credentials. */
export type FroamMediaReference = {
    id: string;
    mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
    width?: number;
    height?: number;
    provider?: string;
};
export type FroamReference = {
    id: string;
    viewport: FroamReferenceViewport;
    route?: string;
    state?: FroamReferenceState;
    label?: string;
    source: 'screenshot' | 'current-page-capture' | 'imported';
    media?: FroamMediaReference;
    limitations?: string[];
};
export type FroamReferenceSet = {
    schemaVersion: typeof FROAM_REFERENCE_SCHEMA_VERSION;
    id: string;
    references: FroamReference[];
    label?: string;
};
export type FroamReferenceReconstruction = {
    reference: FroamReference;
    reconstruction: FroamScreenshotReconstruction;
};
export type FroamNormalizedRegion = {
    referenceId: string;
    regionId: string;
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
};
export type FroamGeometryRelationship = {
    referenceId: string;
    fromRegionId: string;
    toRegionId?: string;
    kind: 'full-width' | 'contained' | 'aligned-left' | 'aligned-center' | 'same-row' | 'stacked' | 'equal-width' | 'repeated-grid-member';
    origin: 'observed';
    confidence: number;
};
export type FroamReferencePairComparison = {
    fromReferenceId: string;
    toReferenceId: string;
    fromWidth: number;
    toWidth: number;
    difference: FroamScreenshotStateDifference;
};
export type FroamResponsiveSignatureObservation = {
    id: string;
    kind: 'container' | 'layout' | 'grid' | 'visibility' | 'geometry' | 'typography' | 'spacing' | 'navigation';
    origin: 'observed';
    width: number;
    summary: string;
    confidence: number;
    referenceIds: string[];
    regionIds?: string[];
    values?: Record<string, number | string | boolean | null>;
};
export type FroamResponsiveSignatureHypothesis = {
    id: string;
    kind: 'breakpoint' | 'layout-transition' | 'navigation-transformation' | 'visibility-change' | 'container-behavior' | 'geometry-change' | 'crop-or-aspect-change' | 'typography-change' | 'spacing-change';
    origin: 'inferred';
    summary: string;
    confidence: number;
    betweenWidths?: [number, number];
    evidenceIds: string[];
};
export type FroamResponsiveSignature = {
    schemaVersion: typeof FROAM_REFERENCE_SCHEMA_VERSION;
    id: string;
    referenceSetId: string;
    observedWidths: number[];
    observations: FroamResponsiveSignatureObservation[];
    hypotheses: FroamResponsiveSignatureHypothesis[];
    limitations: string[];
};
export type FroamReferenceQuality = {
    structure?: number;
    geometry?: number;
    text?: number;
    visual?: number;
    responsiveEvidence?: number;
    limitations: string[];
};
export type FroamReferenceUnderstanding = {
    schemaVersion: typeof FROAM_REFERENCE_SCHEMA_VERSION;
    id: string;
    referenceSet: FroamReferenceSet;
    reconstructions: FroamReferenceReconstruction[];
    normalizedRegions: FroamNormalizedRegion[];
    relationships: FroamGeometryRelationship[];
    comparisons: FroamReferencePairComparison[];
    responsiveSignature: FroamResponsiveSignature;
    quality: FroamReferenceQuality;
    validationWidths: number[];
    limitations: string[];
};
export type FroamReferenceMismatch = {
    width: number;
    referenceId?: string;
    nodeId?: string;
    kind: 'geometry' | 'text' | 'visual' | 'visibility';
    summary: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
};
export type FroamResponsiveHealth = {
    testedWidths: number[];
    observations: FroamResponsiveObservation[];
    referenceMismatches: FroamReferenceMismatch[];
    issueCount: number;
    criticalIssueCount: number;
    healthy: boolean;
};
export type FroamResponsiveValidationPlan = {
    widths: number[];
    cinemaSweep: number[];
    observationContract: 'observeResponsiveState';
    suggestions: Array<{
        width: number;
        items: Array<{
            nodeId: string;
            action: string;
            reason: string;
        }>;
    }>;
};
export interface FroamReferenceCaptureProvider {
    id: string;
    local: boolean;
    capture(input: {
        target: {
            kind: 'current-page';
            route?: string;
            state?: FroamReferenceState;
        };
        widths: number[];
        maxCaptures: number;
    }): Promise<Array<{
        reference: FroamReference;
        pixels: FroamScreenshotPixels;
    }>>;
}
export declare function validateReferenceSet(value: FroamReferenceSet): FroamReferenceSet;
export declare function normalizeReferenceRegions(entry: FroamReferenceReconstruction): FroamNormalizedRegion[];
export declare function deriveGeometryRelationships(entry: FroamReferenceReconstruction): FroamGeometryRelationship[];
export declare function inferResponsiveSignature(referenceSetId: string, entries: FroamReferenceReconstruction[], comparisons: FroamReferencePairComparison[]): FroamResponsiveSignature;
export declare function referenceValidationWidths(referenceWidths: readonly number[], hypotheses: readonly Pick<FroamResponsiveSignatureHypothesis, 'betweenWidths'>[], delta?: number): number[];
export declare function analyzeReferenceReconstructions(referenceSetInput: FroamReferenceSet, reconstructionInput: readonly FroamScreenshotReconstruction[]): FroamReferenceUnderstanding;
export declare function reconstructReferenceSet(referenceSetInput: FroamReferenceSet, pixelsByReferenceId: Readonly<Record<string, FroamScreenshotPixels>>, provider?: FroamScreenshotProvider): Promise<FroamReferenceUnderstanding>;
export declare function validateResponsiveHealth(observations: readonly FroamResponsiveObservation[], referenceMismatches?: readonly FroamReferenceMismatch[]): FroamResponsiveHealth;
/** Uses the existing cinema sweep and policy suggestion engine; DOM observations are supplied by observeResponsiveState. */
export declare function planResponsiveValidation(records: readonly FroamScanRecord[], policies: Record<string, FroamResponsivePolicy>, referenceWidths: readonly number[], hypotheses: readonly FroamResponsiveSignatureHypothesis[]): FroamResponsiveValidationPlan;
export declare function adaptiveBreakpointSearch<T>(input: {
    lowerWidth: number;
    upperWidth: number;
    lowerState: T;
    upperState: T;
    observe: (width: number) => Promise<T> | T;
    sameState?: (left: T, right: T) => boolean;
    maxProbes?: number;
    minimumInterval?: number;
}): Promise<{
    transitionFound: boolean;
    interval: undefined;
    probes: {
        width: number;
        state: T;
        origin: "observed";
    }[];
    origin: "inferred";
    confidence: number;
} | {
    transitionFound: boolean;
    interval: [number, number];
    probes: {
        width: number;
        state: T;
        origin: "observed";
    }[];
    origin: "inferred";
    confidence: number;
}>;
export declare function createReferenceIntelligenceRequest(understanding: FroamReferenceUnderstanding, input: {
    projectId: string;
    activeBranchId: string;
    routeKey: string;
    intent: string;
    consent?: boolean;
    requestId?: string;
}): FroamAnalysisIntelligenceRequest;
export declare function createResponsiveIntelligenceRequest(understanding: FroamReferenceUnderstanding, input: {
    projectId: string;
    activeBranchId: string;
    routeKey: string;
    intent: string;
    consent?: boolean;
    requestId?: string;
}): FroamAnalysisIntelligenceRequest;
/** Compact, additive metadata suitable for project metadata without a schema migration. */
export declare function serializeReferenceMetadata(understanding: FroamReferenceUnderstanding): {
    schemaVersion: 1;
    referenceSet: FroamReferenceSet;
    responsiveSignature: FroamResponsiveSignature;
    quality: FroamReferenceQuality;
    validationWidths: number[];
    limitations: string[];
};
//# sourceMappingURL=reference-intelligence.d.ts.map