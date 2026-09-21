/**
 * Froam graded degradation — the gold set generator.
 *
 * A judge whose accuracy is unknown cannot validate anything, and hand-labelling
 * thousands of design pairs is not affordable. So instead of collecting labels,
 * we manufacture them: take a profile, break one property by a known amount, and
 * the correct answer is known by construction.
 *
 * This yields more than accuracy. Because each degradation carries a magnitude,
 * it yields the *detection threshold* — the smallest violation the judge
 * reliably catches. "Detects a 4% spacing-grid break at 91%" is a capability
 * claim. "Compare them objectively" is not.
 *
 * Some degradations are deliberately expected to read as 'equivalent'. A hue
 * rotation is a real change that Tier 1 has no standard to judge, so a Tier 1
 * judge calling it 'worse' is fabricating an opinion. Those pairs measure the
 * false-positive rate, which matters as much as detection.
 */
import type { FroamPageProfile } from './page-profile';
import type { FroamJudgeVerdict } from './judge-deterministic';
export type FroamDegradationKind = 'contrast' | 'touch-targets' | 'spacing-grid' | 'accent-dilution' | 'type-scale' | 'token-drift' | 'component-variance' | 'measure' | 'radius' | 'hue-rotation';
export type FroamDegradedPair = {
    kind: FroamDegradationKind;
    /** 0–1. Larger is a more severe break. */
    magnitude: number;
    expected: 'worse' | 'equivalent';
    /** The Tier 1 check that should catch this, or null when none should. */
    targetCheck: string | null;
    before: FroamPageProfile;
    after: FroamPageProfile;
};
/** Push text under the WCAG AA floor. Should always trip the normative veto. */
export declare function degradeContrast(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/** Shrink interactive targets under the WCAG 2.5.8 minimum. Should trip the normative veto. */
export declare function degradeTouchTargets(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/** Knock spacing values off the base grid. */
export declare function degradeSpacingGrid(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/** Spread the accent onto elements that carry no action meaning. */
export declare function degradeAccentDiscipline(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/** Add off-scale type sizes until the steps stop agreeing with each other. */
export declare function degradeTypeScale(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/** Paint area with colours that fall outside the resolved palette. */
export declare function degradeTokenDrift(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/** Make repeated components disagree with each other about spacing. */
export declare function degradeComponentVariance(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/** Stretch body text past a comfortable line length. */
export declare function degradeMeasure(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/** Multiply distinct corner radii. */
export declare function degradeRadius(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
/**
 * Rotate the accent hue while holding lightness, chroma and every usage rule.
 *
 * This is a real visual change with no standard behind it — whether teal beats
 * violet is a Tier 3 question. A Tier 1 judge must report 'equivalent' here; if
 * it reports 'worse' it is inventing an opinion it has no basis for.
 */
export declare function rotateAccentHue(profile: FroamPageProfile, magnitude: number): FroamPageProfile;
export declare const FROAM_DEFAULT_MAGNITUDES: readonly [0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1];
/**
 * Produce a labelled gold set from one or more source profiles.
 *
 * Every pair carries its own known answer, so the judge can be scored without
 * a single human annotation.
 */
export declare function generateGoldSet(profiles: readonly FroamPageProfile[], magnitudes?: readonly number[]): FroamDegradedPair[];
/**
 * The magnitude at or above which a break should be unmissable.
 *
 * Below it, failing to call a change 'worse' is not an error — it is the judge
 * declining to treat a 5% wobble as a regression, which is a property worth
 * having. Counting those as misses would reward a judge that flags everything,
 * and a judge that flags everything is the one that poisons induction. The
 * sensitivity below this line is reported as detectionThreshold, not as failure.
 */
export declare const FROAM_MATERIALITY_FLOOR = 0.35;
export type FroamJudgeScorecard = {
    judgeVersion: string;
    pairs: number;
    /** Fraction of all pairs matching the known answer, sub-threshold included. Reported, never gated. */
    accuracy: number;
    /** Accuracy restricted to material breaks and to 'equivalent' pairs. This is the number to gate on. */
    materialAccuracy: number;
    materialityFloor: number;
    /**
     * Fraction of 'equivalent' pairs the judge wrongly called better or worse.
     * A judge that flags everything scores perfectly on detection and is useless.
     */
    falsePositiveRate: number;
    /** Fraction of *material* 'worse' pairs the judge failed to catch. */
    missRate: number;
    /** Fraction of pairs the judge declined to call. */
    abstainRate: number;
    /**
     * Expected calibration error: the average gap between stated confidence and
     * observed accuracy, weighted by bucket size. 0 is perfect.
     *
     * An uncalibrated confidence is worse than none, because downstream code
     * multiplies by it. A judge that says 0.9 and is right 0.6 of the time
     * silently inflates every score derived from it.
     */
    expectedCalibrationError: number;
    /** Per-bucket reliability, so miscalibration can be located rather than just reported. */
    calibration: Array<{
        bucket: string;
        pairs: number;
        meanConfidence: number;
        accuracy: number;
        gap: number;
    }>;
    byKind: Array<{
        kind: FroamDegradationKind;
        accuracy: number;
        /** Smallest magnitude caught, and caught at every larger magnitude too. Null when never reliably caught. */
        detectionThreshold: number | null;
        caught: number;
        total: number;
    }>;
};
/**
 * Score a judge against a gold set.
 *
 * `detectionThreshold` is the headline number: the smallest break the judge
 * catches *and keeps catching* as severity rises. A judge that catches 0.2 but
 * misses 0.35 has not detected anything — it got lucky, and the threshold is
 * reported as the point from which it is monotonically correct.
 */
export declare function scoreJudge(pairs: readonly FroamDegradedPair[], compare: (before: FroamPageProfile, after: FroamPageProfile) => FroamJudgeVerdict, materialityFloor?: number): FroamJudgeScorecard;
//# sourceMappingURL=degrade.d.ts.map