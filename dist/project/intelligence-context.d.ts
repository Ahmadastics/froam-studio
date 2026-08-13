/**
 * Froam Intelligence Context Assembler — Phase 2
 *
 * Builds the minimum safe FroamIntelligencePlanRequest from current Froam
 * project state. Browser-safe: no server imports, no credentials, no
 * localStorage wholesale, no source files, no cookies.
 *
 * Scope is conservative by design: the selected stable node is the complete
 * mutation scope. Immediate structure is evidence only and never expands
 * mutation rights. With no reliable selection this assembler returns null.
 */
import type { FroamProjectDocument, FroamScanRecord, FroamDNA, FroamNode, FroamRelation } from './types';
import type { FroamMutationIntelligenceRequest } from './intelligence-transport';
import type { FroamViewport } from '../collab/types';
export type FroamIntentScope = {
    /** Stable node id of the selected element, if any. */
    selectedNodeId?: string | null;
    /** DOM path — secondary locator only, not authoritative. */
    selectedDomPath?: string | null;
    /** Viewport at time of request. */
    viewport: FroamViewport;
    /** Route key at time of request. */
    routeKey: string;
};
export type FroamContextAssemblerInput = {
    project: FroamProjectDocument;
    intent: string;
    scope: FroamIntentScope;
    /** Feedback from a prior attempt, for iterative refinement. */
    priorAttemptFeedback?: string | null;
    /** Caller-supplied request id. */
    requestId?: string;
    /** Consent flag — must be true for remote providers. */
    consent: boolean;
    /** Fresh bounded observation of the selected live element, kept read-only. */
    selectionEvidence?: {
        node: FroamNode;
        scan?: FroamScanRecord;
        dna?: FroamDNA;
        relationships?: FroamRelation[];
    };
};
/**
 * Assemble a bounded FroamIntelligencePlanRequest from current Froam state.
 *
 * Returns null if no safe scope can be determined (e.g. no nodes in project
 * and no selection). The caller should show a user-visible message in that
 * case rather than sending an empty request.
 */
export declare function assembleFroamIntelligenceRequest(input: FroamContextAssemblerInput): FroamMutationIntelligenceRequest | null;
/**
 * Determine whether a query string looks like natural-language intent
 * rather than a known command prefix.
 *
 * Used by the command palette to decide whether to show "Ask Froam".
 * Conservative: requires at least 3 non-whitespace characters and at
 * least one word that is not a single letter.
 */
export declare function looksLikeNaturalLanguageIntent(query: string): boolean;
//# sourceMappingURL=intelligence-context.d.ts.map