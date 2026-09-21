/**
 * Froam Judge — Tier 2, induced priors.
 *
 * Tier 1 knows published standards. Tier 2 learns what is actually true across
 * a corpus of real interfaces, and is allowed to be wrong about it.
 *
 * Every prior in this file is derived from measurement. Nothing here contains a
 * pre-written conclusion selected by keyword — that is a rule engine wearing the
 * word "learned", and it cannot discover anything its author did not already
 * believe. A prior's claim text is generated from the numbers that produced it.
 *
 * Four disciplines are enforced structurally, because each one is a way this
 * kind of system usually fails:
 *
 * 1. Held-out scoring, split BY ORIGIN. Two pages of one site share a design
 *    system, so a page-level split leaks the answer and every prior looks
 *    brilliant.
 * 2. A baseline for every prior. A scoped prior is scored against the
 *    unscoped one on the same held-out pages. If conditioning does not help,
 *    lift is 1 and the prior is deleted.
 * 3. A real denominator. holdRate counts the pages where the prior failed, so
 *    confidence can fall. Counting only successes produces a number that rises
 *    forever and means nothing.
 * 4. Counter-examples are retained, never discarded. A prior that has never
 *    failed has not been tested.
 */
import type { FroamPageProfile } from './page-profile';
import type { FroamJudgeFinding } from './judge-deterministic';
export declare const FROAM_PRIORS_VERSION = "froam-induced-priors-v1";
export type FroamPriorScope = {
    key: string;
    feature: string | null;
    value: string | null;
};
export type FroamPrior = {
    id: string;
    kind: 'range' | 'dominance';
    /** Generated from the induced numbers. Never a stored constant. */
    claim: string;
    feature: string;
    scope: FroamPriorScope;
    /** Numeric priors: inclusive bounds. Categorical priors: the modal value. */
    range: {
        low: number;
        high: number;
    } | null;
    value: string | null;
    /** Training pages matching this scope. */
    support: number;
    /** Fraction of training pages where the prior held. Counts failures. */
    holdRate: number;
    /** Fraction of held-out pages where it held. The number that counts. */
    heldOutAccuracy: number;
    /** Accuracy of the unscoped prior on the same held-out pages. */
    baselineAccuracy: number;
    /** Informativeness of the unscoped prior, for comparison. */
    baselineInformativeness: number;
    /**
     * utility / baselineUtility, where utility is heldOutAccuracy × informativeness.
     *
     * A plain accuracy ratio cannot see the usual benefit of conditioning. If
     * dark pages use a 4px base and light pages use 8px, the global range
     * 4–8 is 100% accurate and says nothing; the scoped range 4–4 is also 100%
     * accurate and says everything. Both score 1.0 on accuracy alone, so the
     * genuinely useful prior would be pruned. Weighting by how much each range
     * excludes separates them.
     */
    lift: number;
    /** 0–1: how much uncertainty the prior removes. A prior that admits everything is useless. */
    informativeness: number;
    /** Origins where it failed. Kept, because an untested prior is not evidence. */
    counterExamples: string[];
    inducedAt: number;
    priorsVersion: string;
};
export type FroamPriorInductionReport = {
    priorsVersion: string;
    trainOrigins: number;
    holdOutOrigins: number;
    candidates: number;
    kept: number;
    /** Priors dropped, with the reason. Pruning is evidence, so it is reported. */
    pruned: Array<{
        id: string;
        reason: string;
        lift: number;
        informativeness: number;
        heldOutAccuracy: number;
    }>;
    priors: FroamPrior[];
};
export type FroamFeatureVector = {
    numeric: Record<string, number>;
    categorical: Record<string, string>;
};
/** Flatten a profile into the axes priors may be induced over. Null-valued axes are omitted, never defaulted. */
export declare function profileFeatures(profile: FroamPageProfile): FroamFeatureVector;
/** Scopes a prior may be conditioned on. The global scope is always first. */
export declare function candidateScopes(profiles: readonly FroamPageProfile[]): FroamPriorScope[];
/**
 * Split by origin, never by page.
 *
 * Pages from one site share a palette, a scale and a grid. Splitting on pages
 * puts the answer on both sides of the split, and every induced prior scores
 * near-perfectly while having learned nothing that transfers.
 */
export declare function splitByOrigin(profiles: readonly FroamPageProfile[], holdOutFraction?: number): {
    train: FroamPageProfile[];
    holdOut: FroamPageProfile[];
    holdOutOrigins: string[];
};
export type FroamInductionOptions = {
    /** Minimum training pages in scope before a prior may be proposed. */
    minSupport?: number;
    /** Minimum held-out accuracy to keep a prior. */
    minHeldOutAccuracy?: number;
    /** Minimum share of the observed span a prior must exclude. */
    minInformativeness?: number;
    /** Minimum lift for a scoped prior. Global priors are exempt — there is nothing to condition against. */
    minLift?: number;
    holdOutFraction?: number;
    now?: number;
};
/** Cap for lift against a vacuous baseline, so a prior stays JSON-serialisable. */
export declare const FROAM_MAX_LIFT = 99;
/**
 * Induce priors from a profile corpus.
 *
 * Returns the kept priors *and* everything pruned with its reason, because what
 * failed to generalise is as informative as what did.
 */
export declare function inducePriors(profiles: readonly FroamPageProfile[], options?: FroamInductionOptions): FroamPriorInductionReport;
export type FroamPriorViolation = FroamJudgeFinding & {
    priorId: string;
    heldOutAccuracy: number;
    support: number;
    counterExamples: string[];
};
/**
 * Score a page against induced priors.
 *
 * Every violation cites its evidence — how many pages the prior was induced
 * from, how it scored on pages it never saw, and the origins where it failed.
 * A claim Froam cannot support this way should not be made.
 */
export declare function applyPriors(profile: FroamPageProfile, priors: readonly FroamPrior[]): FroamPriorViolation[];
//# sourceMappingURL=judge-priors.d.ts.map