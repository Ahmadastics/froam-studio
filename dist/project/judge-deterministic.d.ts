import type { FroamPageProfile } from './page-profile';
/**
 * Bump on any change to checks, weights or thresholds. Verdicts are only
 * comparable within a version.
 *
 * v2 — touch-targets measures WCAG 2.5.8 geometry instead of proxying through
 * accessibility warning counts, those warnings moved to their own non-normative
 * check, and the confidence curve was recalibrated against the gold set
 * (ECE 0.118 → 0.050).
 */
export declare const FROAM_JUDGE_VERSION = "froam-deterministic-judge-v2";
export type FroamJudgeSeverity = 'veto' | 'major' | 'minor' | 'info';
export type FroamJudgeFinding = {
    id: string;
    check: string;
    severity: FroamJudgeSeverity;
    /** Human-readable, generated from the measurement. Never a stored constant. */
    summary: string;
    measured: number;
    threshold: number;
    evidence?: Record<string, unknown>;
};
export type FroamJudgeCheckResult = {
    id: string;
    /** 0–1, where 1 is ideal. Comparable only against the same check. */
    score: number;
    weight: number;
    /** True when this check measures a published standard rather than a preference. */
    normative: boolean;
    findings: FroamJudgeFinding[];
};
export type FroamPageAudit = {
    schemaVersion: 1;
    judgeVersion: string;
    origin: string;
    routeKey: string;
    /** Weighted mean of check scores, 0–1. */
    score: number;
    checks: FroamJudgeCheckResult[];
    findings: FroamJudgeFinding[];
};
export type FroamJudgeOutcome = 'better' | 'worse' | 'equivalent' | 'abstain';
export type FroamJudgeVerdict = {
    schemaVersion: 1;
    tier: 'deterministic';
    judgeVersion: string;
    outcome: FroamJudgeOutcome;
    /** Populated when a normative check regressed across its threshold. */
    veto: FroamJudgeFinding | null;
    scoreBefore: number;
    scoreAfter: number;
    scoreDelta: number;
    /** 0–1. Exactly 1 for a veto; otherwise scaled by margin over the noise band. */
    confidence: number;
    /** Per-check deltas, so a verdict can always be traced to a measurement. */
    deltas: Array<{
        id: string;
        before: number;
        after: number;
        delta: number;
        weight: number;
    }>;
    /** Why the judge could not decide. Null unless outcome is 'abstain'. */
    abstainReason: string | null;
    explain: string[];
};
/**
 * Stated policy. Normative checks carry more weight because they are the ones
 * with an external standard behind them; taste-adjacent checks are kept light
 * on purpose so no single preference can dominate a verdict.
 */
export declare const FROAM_JUDGE_WEIGHTS: Record<string, number>;
/** Score deltas smaller than this are noise, not improvement. */
export declare const FROAM_JUDGE_EQUIVALENCE_BAND = 0.01;
/** Minimum coverage before two profiles may be compared at all. */
export declare const FROAM_JUDGE_MIN_COVERAGE = 0.5;
/** Maximum relative difference in rendered node count before profiles are treated as different pages. */
export declare const FROAM_JUDGE_MAX_SIZE_DRIFT = 0.4;
/**
 * Map a score margin to a stated confidence.
 *
 * The previous form — margin / (band × 4), linear from zero — was invented, and
 * the gold set showed it: on material breaks the judge was correct in 100% of
 * cases while stating 0.34 and 0.51, an expected calibration error of 0.118
 * driven entirely by underconfidence. Systematically underclaiming is not the
 * safe direction. Downstream code multiplies by this number, so understating it
 * discards verdicts that were right.
 *
 * This measurement is deterministic, so the uncertainty is not in the arithmetic
 * — it is in whether a given score movement reflects a real quality change. The
 * gold set says: once outside the noise band, it does. The curve therefore
 * starts at 0.6 at the band edge (a margin barely distinguishable from noise)
 * and saturates toward the 0.95 ceiling, which only a normative veto may exceed.
 *
 * Re-derive this against the gold set whenever checks or weights change; a
 * calibration fitted to one judge version does not transfer to the next.
 */
export declare const FROAM_CONFIDENCE_FLOOR = 0.6;
export declare const FROAM_CONFIDENCE_CEILING = 0.95;
export declare function confidenceForMargin(margin: number, band?: number): number;
/** Below this, the best-fitting base explains so little that calling it a grid misleads. */
export declare const FROAM_GRID_EXISTS_THRESHOLD = 0.5;
/**
 * Score one page on its own terms. This is the audit surface: every finding
 * states what was measured, what the threshold was, and why it matters.
 */
export declare function auditProfile(profile: FroamPageProfile): FroamPageAudit;
/**
 * Compare two profiles. Returns 'equivalent' inside the noise band and
 * 'abstain' when the profiles cannot be meaningfully compared — neither is a
 * failure, and neither should be treated as a reason to roll back.
 */
export declare function compareProfiles(before: FroamPageProfile, after: FroamPageProfile): FroamJudgeVerdict;
//# sourceMappingURL=judge-deterministic.d.ts.map