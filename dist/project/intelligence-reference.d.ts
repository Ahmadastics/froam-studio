/**
 * Froam Intelligence — design reference.
 *
 * What the AI currently sees when asked to change something is twelve scan
 * records for one selected node and its siblings. That is enough to describe
 * the element and nothing at all about the page it lives on, so "make this
 * button clearer" is answered by inventing a colour, a radius and a padding
 * that have no relationship to the system already on the page. The model is not
 * being unhelpful; it was never told there was a system.
 *
 * This module gives it one. A measured profile says the page runs on an 8px
 * grid, that its accent is #ff4138 and reserved for actions, that its type
 * scale has five steps. An edit can then be *on-system* rather than plausible.
 *
 * Two constraints hold throughout:
 *
 * 1. **Reference is not scope.** The existing assembler is careful that
 *    evidence never expands mutation rights, and that boundary is worth more
 *    than any capability added here. A design reference is attached under its
 *    own key, is never merged into `scopeNodeIds`, and carries an explicit
 *    `kind: 'reference-only'` marker.
 *
 * 2. **Small on purpose.** A page profile is a few kilobytes where the scan
 *    records it came from are hundreds. Sending the measurement instead of the
 *    evidence is what makes richer context cheaper rather than more expensive —
 *    the brief below is the compact form, for models billed by the token.
 */
import type { FroamPageProfile } from './page-profile';
import type { FroamPrior } from './judge-priors';
import { type FroamJudgeFinding } from './judge-deterministic';
export declare const FROAM_DESIGN_REFERENCE_VERSION: 1;
export type FroamDesignTokenSummary = {
    surface: string | null;
    raised: string | null;
    ink: string | null;
    muted: string | null;
    accent: string | null;
    /** Whether the accent is reserved for actions on this page, 0–1. */
    accentDiscipline: number;
    modeSignal: 'light' | 'dark' | 'mixed';
};
export type FroamDesignReference = {
    schemaVersion: typeof FROAM_DESIGN_REFERENCE_VERSION;
    /** Explicit: this is evidence about the page, never a licence to change it. */
    kind: 'reference-only';
    origin: string;
    routeKey: string;
    tokens: FroamDesignTokenSummary;
    type: {
        steps: number[];
        ratio: number | null;
        families: string[];
        measureCh: number;
    };
    space: {
        base: number;
        scale: number[];
        adherence: number;
        density: string;
    };
    surface: {
        radii: number[];
        shadowTiers: number;
    };
    flow: string;
    /** Measured problems on this page, so an edit can avoid compounding them. */
    openFindings: Array<Pick<FroamJudgeFinding, 'check' | 'severity' | 'summary'>>;
    /** Corpus regularities this page departs from. Advisory, with their evidence. */
    priorNotes: Array<{
        claim: string;
        heldOutAccuracy: number;
        support: number;
    }>;
    /** Compact natural-language rendering, for prompt inclusion. */
    brief: string;
};
/**
 * Render a profile as a short design brief.
 *
 * Written for a model to read, so it states values and their meaning rather
 * than dumping structure. Anything the profile could not establish is omitted
 * rather than defaulted — a stated "ratio 1.25" that was never measured is
 * worse than silence, because the model will build on it.
 */
export declare function formatDesignBrief(profile: FroamPageProfile, priorNotes?: FroamDesignReference['priorNotes']): string;
export type FroamDesignReferenceInput = {
    profile: FroamPageProfile;
    priors?: readonly FroamPrior[];
    /** Cap on advisory notes, to keep the payload bounded. */
    maxPriorNotes?: number;
    /** Cap on findings quoted back to the model. */
    maxFindings?: number;
};
export declare function buildDesignReference(input: FroamDesignReferenceInput): FroamDesignReference;
/**
 * Attach a design reference to an assembled intelligence request.
 *
 * Deliberately a separate step from assembly. The context assembler decides
 * what may be *changed*; this decides what may be *known*. Keeping them apart
 * means adding knowledge can never widen authority by accident.
 */
export declare function attachDesignReference<T extends {
    context: Record<string, unknown>;
    scopeNodeIds?: string[];
}>(request: T, reference: FroamDesignReference): T;
/**
 * Bytes saved by sending the measurement instead of the evidence.
 *
 * Reported rather than asserted because it is the whole economic argument:
 * richer context that costs less only holds if the numbers say so.
 */
export declare function referenceCostComparison(input: {
    reference: FroamDesignReference;
    scanRecords: unknown[];
}): {
    referenceBytes: number;
    briefBytes: number;
    rawBytes: number;
    /** Raw evidence bytes per byte of brief. */
    compression: number;
};
//# sourceMappingURL=intelligence-reference.d.ts.map