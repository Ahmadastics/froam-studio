/**
 * Browser-safe, provider-neutral transport for Froam-native intelligence.
 *
 * The transport carries bounded interface knowledge, never provider secrets,
 * source files, browser memory, or decoded screenshot pixel buffers. Only a
 * `mutate` response can contain executable Froam mutation proposals; every
 * other purpose is analysis-only.
 */
import type { FroamViewport } from '../collab/types';
import type { FroamIntelligenceMemory } from './intelligence-memory';
import type { FroamProviderPrivacy } from './intelligence-provider';
import type { FroamMutationConstraints, FroamMutationProposal } from './mutation';
import type { FroamDNA, FroamRelation, FroamResponsivePolicy, FroamScanRecord } from './types';
export declare const FROAM_INTELLIGENCE_SCHEMA_VERSION: 1;
export declare const FROAM_INTELLIGENCE_MAX_REQUEST_BYTES = 512000;
export declare const FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES = 256000;
export declare const FROAM_INTELLIGENCE_MAX_PROPOSALS = 20;
export type FroamIntelligencePurpose = 'mutate' | 'understand' | 'reference' | 'responsive' | 'evaluate';
export type FroamEvidenceOrigin = 'observed' | 'inferred' | 'generated';
export type FroamIntelligenceEvidence = {
    origin: FroamEvidenceOrigin;
    summary: string;
    source?: string;
    confidence?: number;
};
/** Structured reference knowledge only. Actual image bytes use a future, opaque media channel. */
export type FroamIntelligenceReferenceSummary = {
    id: string;
    /** Opaque handle for a future multimodal transport; never base64 image data. */
    mediaReferenceId?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    route?: string;
    state?: string;
    label?: string;
    reconstructedRegions?: Array<{
        id: string;
        nodeId?: string;
        kind: 'text' | 'image' | 'container' | 'unknown';
        x: number;
        y: number;
        width: number;
        height: number;
        text?: string;
        semanticRole?: string;
        confidence?: number;
        origin: FroamEvidenceOrigin;
    }>;
    ocrText?: Array<{
        text: string;
        confidence?: number;
        origin: 'observed' | 'inferred';
    }>;
    observedHierarchy?: Array<{
        parentId: string;
        childId: string;
        origin: FroamEvidenceOrigin;
        confidence?: number;
    }>;
    dna?: Record<string, FroamDNA>;
    knownLimitations?: string[];
};
export type FroamIntelligenceResponsiveObservation = {
    width: number;
    nodeId?: string;
    summary: string;
    origin: 'observed' | 'inferred';
    confidence?: number;
    markers?: string[];
};
/** Compact derived evidence for reference/responsive analysis. Never contains pixel buffers. */
export type FroamIntelligenceReferenceEvidence = {
    matches: Array<{
        fromReferenceId: string;
        toReferenceId: string;
        fromRegionId: string;
        toRegionId: string;
        confidence: number;
        evidence: string[];
    }>;
    differences: Array<{
        fromReferenceId: string;
        toReferenceId: string;
        appeared: number;
        disappeared: number;
        moved: number;
        ambiguous: number;
    }>;
    responsiveSignature: {
        observedWidths: number[];
        observations: Array<{
            kind: string;
            width: number;
            summary: string;
            origin: 'observed';
            confidence: number;
        }>;
        hypotheses: Array<{
            kind: string;
            summary: string;
            origin: 'inferred';
            confidence: number;
            betweenWidths?: [number, number];
        }>;
    };
    quality: {
        structure?: number;
        geometry?: number;
        text?: number;
        visual?: number;
        responsiveEvidence?: number;
    };
    limitations: string[];
};
export type FroamIntelligenceContext = {
    /** Stable identifiers only; these are not local filesystem paths. */
    projectId: string;
    activeBranchId: string;
    routeKey: string;
    viewport: FroamViewport;
    selectedNodeId?: string | null;
    /** Supporting locator only; stable node identity remains authoritative. */
    selectedPath?: string | null;
    /** Compatibility spelling used by the first browser assembler. */
    selectedDomPath?: string | null;
    scanRecords?: FroamScanRecord[];
    dna?: Record<string, FroamDNA>;
    relationships?: FroamRelation[];
    responsivePolicies?: FroamResponsivePolicy[];
    responsiveObservations?: FroamIntelligenceResponsiveObservation[];
    references?: FroamIntelligenceReferenceSummary[];
    referenceEvidence?: FroamIntelligenceReferenceEvidence;
    memory?: FroamIntelligenceMemory;
};
type FroamIntelligenceRequestBase<P extends FroamIntelligencePurpose> = {
    schemaVersion: typeof FROAM_INTELLIGENCE_SCHEMA_VERSION;
    purpose: P;
    intent: string;
    context: FroamIntelligenceContext;
    /** Optional scope for analysis, mandatory and non-empty for mutation. */
    scopeNodeIds?: string[];
    previousAttemptFeedback?: string | null;
    /** Compatibility spelling retained for existing callers. */
    priorAttemptFeedback?: string | null;
    requestId?: string;
    /** Enforced by the server only when the selected provider is remote. */
    consent?: boolean;
};
export type FroamMutationIntelligenceRequest = FroamIntelligenceRequestBase<'mutate'> & {
    scopeNodeIds: string[];
    constraints: FroamMutationConstraints;
    protectedNodeIds?: string[];
};
export type FroamAnalysisIntelligenceRequest = FroamIntelligenceRequestBase<'understand' | 'reference' | 'responsive' | 'evaluate'> & {
    constraints?: never;
    protectedNodeIds?: never;
};
export type FroamIntelligenceRequest = FroamMutationIntelligenceRequest | FroamAnalysisIntelligenceRequest;
/** Compatibility alias. The endpoint remains `/plan`, but the envelope is purpose-neutral. */
export type FroamIntelligencePlanRequest = FroamIntelligenceRequest;
export type FroamMutationPlanResponse = {
    schemaVersion: typeof FROAM_INTELLIGENCE_SCHEMA_VERSION;
    purpose: 'mutate';
    requestId?: string;
    provider: string;
    proposals: FroamMutationProposal[];
    rationale: string;
    confidence: number;
    warnings?: string[];
};
export type FroamAnalysisFinding = {
    id?: string;
    summary: string;
    detail?: string;
    origin: FroamEvidenceOrigin;
    confidence?: number;
    evidence?: FroamIntelligenceEvidence[];
    nodeIds?: string[];
};
type FroamAnalysisResponseBase<P extends Exclude<FroamIntelligencePurpose, 'mutate'>> = {
    schemaVersion: typeof FROAM_INTELLIGENCE_SCHEMA_VERSION;
    purpose: P;
    requestId?: string;
    provider: string;
    findings: FroamAnalysisFinding[];
    recommendations?: string[];
    limitations?: string[];
};
export type FroamUnderstandingResponse = FroamAnalysisResponseBase<'understand'>;
export type FroamReferenceAnalysisResponse = FroamAnalysisResponseBase<'reference'> & {
    referenceIds?: string[];
};
export type FroamResponsiveAnalysisResponse = FroamAnalysisResponseBase<'responsive'> & {
    breakpointHypotheses?: Array<{
        summary: string;
        origin: 'inferred';
        confidence?: number;
    }>;
};
export type FroamVisualEvaluationResponse = FroamAnalysisResponseBase<'evaluate'> & {
    score?: number;
};
export type FroamIntelligenceResponse = FroamMutationPlanResponse | FroamUnderstandingResponse | FroamReferenceAnalysisResponse | FroamResponsiveAnalysisResponse | FroamVisualEvaluationResponse;
/** Compatibility alias for mutation-only consumers. */
export type FroamIntelligencePlanResponse = FroamMutationPlanResponse;
export type FroamIntelligenceErrorCode = 'not_configured' | 'consent_required' | 'invalid_request' | 'provider_unavailable' | 'provider_invalid_response' | 'no_valid_proposals' | 'unsupported_purpose';
export type FroamIntelligenceErrorResponse = {
    success: false;
    configured?: false;
    error: {
        code: FroamIntelligenceErrorCode;
        message: string;
    };
};
export type FroamIntelligenceNotConfiguredResponse = FroamIntelligenceErrorResponse & {
    configured: false;
    reason: string;
};
export type FroamRequestValidationResult = {
    valid: true;
    request: FroamIntelligenceRequest;
} | {
    valid: false;
    code: 'invalid_request' | 'unsupported_purpose';
    reason: string;
};
export declare function validateIntelligenceRequest(value: unknown): FroamRequestValidationResult;
/** Compatibility boolean predicate. */
export declare function validatePlanRequest(value: unknown): value is FroamIntelligencePlanRequest;
export type FroamIntelligenceValidationResult = {
    valid: true;
    proposals: FroamMutationProposal[];
} | {
    valid: false;
    reason: string;
};
/** Deterministically validate executable model output as native Froam operations. */
export declare function validateIntelligencePlan(raw: unknown, request: FroamIntelligencePlanRequest): FroamIntelligenceValidationResult;
export type FroamResponseValidationResult = {
    valid: true;
    response: FroamIntelligenceResponse;
} | {
    valid: false;
    code: 'provider_invalid_response' | 'no_valid_proposals';
    reason: string;
};
export declare function validateIntelligenceResponse(raw: unknown, request: FroamIntelligenceRequest, provider?: string): FroamResponseValidationResult;
export declare function assertResponseSize(raw: string): void;
export type FroamRemoteIntelligencePrivacy = FroamProviderPrivacy & {
    execution: 'remote';
    requiresConsent: true;
    sendsSourceCode: false;
    sendsCredentials: false;
};
export declare const REMOTE_INTELLIGENCE_PRIVACY: FroamRemoteIntelligencePrivacy;
export declare function assertRemoteIntelligenceConsent(consent: boolean): void;
export {};
//# sourceMappingURL=intelligence-transport.d.ts.map