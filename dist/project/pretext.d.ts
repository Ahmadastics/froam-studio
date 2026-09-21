/**
 * Froam Pretext Tasks — the learning engine.
 *
 * Storing scans teaches Froam nothing. Understanding is not a data structure,
 * it is a capability, and a capability has to be exercised against something
 * that can mark it wrong. So each scanned page is turned into questions whose
 * answers are already known: hide part of a profile, ask what was hidden,
 * compare to the truth. The error is the lesson.
 *
 * This is why scanning is worth doing. A scanned page is *self-labelling* —
 * the answers come free, so a corpus of two hundred pages yields thousands of
 * graded questions with no annotation budget at all.
 *
 * Two rules this file exists to enforce:
 *
 * 1. **No leakage.** Every masked input is built by removing the answer from
 *    the profile *and* from everything derived from it. `flow.signature`
 *    contains the archetype of the section being hidden; shipping it in the
 *    input makes the task trivially solvable and the resulting accuracy a lie.
 *    The leakage guards below are not paranoia, they are the whole validity of
 *    the measurement.
 *
 * 2. **Every task carries a baseline.** Accuracy alone is meaningless: a
 *    predictor that always answers "hero" for the first section is right most
 *    of the time. Only the margin over the dumb answer is evidence of learning.
 */
import type { FroamPageProfile, FroamSectionArchetype } from './page-profile';
export declare const FROAM_PRETEXT_VERSION = "froam-pretext-v1";
export type FroamPretextTaskKind = 'section-infill' | 'next-section' | 'accent-placement' | 'scale-infill' | 'blind-role' | 'density-match';
export type FroamPretextTask = {
    id: string;
    kind: FroamPretextTaskKind;
    /** Origin the task came from, so scoring can hold out by site. */
    origin: string;
    routeKey: string;
    /** Everything the predictor may see. Guaranteed free of the answer. */
    input: Record<string, unknown>;
    /** The known-correct answer, taken from the unmasked profile. */
    answer: string | number;
    /** Candidate answers for a closed task, or null when open-ended. */
    choices: Array<string | number> | null;
};
export declare const FROAM_SECTION_ARCHETYPES: readonly FroamSectionArchetype[];
/** Turn profiles into graded questions. No annotation, no model, no cost. */
export declare function generatePretextTasks(profiles: readonly FroamPageProfile[], kinds?: readonly FroamPretextTaskKind[]): FroamPretextTask[];
/**
 * Check that a task's input does not contain its own answer.
 *
 * Run over every generated task in the test suite. A leak does not throw or
 * warn at runtime — it silently produces excellent scores, which is the single
 * most likely way this whole apparatus ends up lying.
 */
export declare function detectLeakage(task: FroamPretextTask): string[];
export type FroamPretextPrediction = {
    taskId: string;
    answer: string | number | null;
};
/** Numeric answers are correct within a relative tolerance; a type step is not a lottery number. */
export declare const FROAM_NUMERIC_TOLERANCE = 0.1;
export declare function isCorrect(task: FroamPretextTask, predicted: string | number | null | undefined): boolean;
export type FroamPretextScorecard = {
    pretextVersion: string;
    predictor: string;
    baseline: string;
    tasks: number;
    accuracy: number;
    baselineAccuracy: number;
    /** accuracy / baselineAccuracy. At or below 1, nothing was learned. */
    lift: number;
    /** Task kinds scored together, which sets the multiple-comparison correction. */
    comparisons: number;
    byKind: Array<{
        kind: FroamPretextTaskKind;
        tasks: number;
        accuracy: number;
        baselineAccuracy: number;
        lift: number;
        /** Z-score of the margin, reported so a borderline call can be inspected. */
        z: number;
        /** Bonferroni-corrected threshold z had to clear. */
        significanceThreshold: number;
        significant: boolean;
    }>;
};
export declare function scorePretext(tasks: readonly FroamPretextTask[], predictions: readonly FroamPretextPrediction[], baselinePredictions: readonly FroamPretextPrediction[], input: {
    predictor: string;
    baseline: string;
}): FroamPretextScorecard;
//# sourceMappingURL=pretext.d.ts.map