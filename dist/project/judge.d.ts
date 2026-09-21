/**
 * Froam Judge — composition.
 *
 * One entry point over the tiers, with a strict authority order that exists to
 * stop the weakest evidence from overruling the strongest:
 *
 *   Tier 1  deterministic   published standards and exact measurement.
 *                           Vetoes. Decides the outcome.
 *   Tier 2  induced priors  what held across a corpus, with held-out accuracy.
 *                           Advises. Never decides, never vetoes.
 *
 * A prior is a statistical regularity — "84% of comparable pages did X". That
 * is genuinely useful and genuinely fallible, and the 16% are not defects. So a
 * prior may raise a finding, sharpen a report and explain a recommendation, but
 * it may never turn a measured improvement into a regression. Letting induction
 * override measurement is how a system ends up confidently enforcing the
 * average of whatever it happened to scan.
 *
 * Tier 3 (perceptual) is deliberately absent. It should only be added once it
 * has been scored on the same gold set and shown to beat Tier 1 on questions
 * Tier 1 cannot answer.
 */
import type { FroamPageProfile } from './page-profile';
import { type FroamJudgeFinding, type FroamJudgeVerdict, type FroamPageAudit } from './judge-deterministic';
import { type FroamPrior, type FroamPriorViolation } from './judge-priors';
export declare const FROAM_COMPOSED_JUDGE_VERSION = "froam-judge-v1";
export type FroamJudgeReport = {
    schemaVersion: 1;
    judgeVersion: string;
    /** Exact, standards-backed measurement. Authoritative. */
    deterministic: FroamPageAudit;
    /** Corpus regularities this page departs from. Advisory. */
    priorViolations: FroamPriorViolation[];
    /** Priors evaluated, so a silent tier is distinguishable from an absent one. */
    priorsEvaluated: number;
    /** Ordered for a reader: vetoes first, then majors, then advisory. */
    findings: FroamJudgeFinding[];
    /** Tier 1 score. Priors deliberately do not move it. */
    score: number;
};
export type FroamComposedVerdict = FroamJudgeVerdict & {
    composedJudgeVersion: string;
    /** Priors the change moved toward or away from. Context only. */
    priorDelta: {
        resolved: FroamPriorViolation[];
        introduced: FroamPriorViolation[];
    };
    priorsEvaluated: number;
};
/**
 * Audit one page across both tiers.
 *
 * This is the report surface: everything a reader needs to act, with each
 * finding carrying the measurement or the evidence that produced it.
 */
export declare function judgePage(profile: FroamPageProfile, priors?: readonly FroamPrior[]): FroamJudgeReport;
/**
 * Compare two pages across both tiers.
 *
 * The outcome is Tier 1's, unchanged. Priors only annotate which corpus
 * regularities the change resolved or introduced, so a reviewer can see them
 * without the verdict having been bent by them.
 */
export declare function judgeChange(before: FroamPageProfile, after: FroamPageProfile, priors?: readonly FroamPrior[]): FroamComposedVerdict;
/**
 * Render a report as plain text.
 *
 * Deliberately not marketing copy: every line states a measurement and the
 * threshold it was measured against, because a claim a reader cannot check is
 * one they should not trust.
 */
export declare function formatJudgeReport(report: FroamJudgeReport, input?: {
    origin?: string;
    routeKey?: string;
}): string;
//# sourceMappingURL=judge.d.ts.map