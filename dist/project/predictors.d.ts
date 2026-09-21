/**
 * Froam Predictors — attempts at the pretext tasks, and the baselines that
 * decide whether any of it counted.
 *
 * The corpus predictor is fitted from training profiles only: sequence
 * statistics, positional frequencies, nearest neighbours over geometry, and a
 * model-selection step for interpolation. It is deliberately simple. The point
 * is not that these are sophisticated — it is that the apparatus can now say,
 * with a number, whether looking at the corpus beat not looking at it.
 *
 * Both baselines matter and they fail in opposite directions. Majority is
 * strong wherever one answer dominates, which is exactly where an impressive
 * raw accuracy means nothing; uniform is weak everywhere and flatters anything
 * compared against it. A predictor has to beat the *majority* baseline before
 * anyone should believe it learned something.
 */
import type { FroamPageProfile, FroamSectionArchetype } from './page-profile';
import type { FroamPretextTask, FroamPretextPrediction } from './pretext';
export type FroamPredictor = {
    name: string;
    predict(task: FroamPretextTask): string | number | null;
};
export declare function runPredictor(predictor: FroamPredictor, tasks: readonly FroamPretextTask[]): FroamPretextPrediction[];
/**
 * Answer whatever is most common for this task kind in training.
 *
 * This is the baseline that matters. "Always say hero for the first section"
 * is right most of the time, and any predictor that cannot beat it has learned
 * nothing beyond the shape of the distribution.
 */
export declare function fitMajorityBaseline(trainingTasks: readonly FroamPretextTask[]): FroamPredictor;
/** Deterministic uniform choice. Present as a floor, not as a serious opponent. */
export declare function uniformBaseline(seed?: number): FroamPredictor;
type ArchetypeCounts = Map<string, number>;
export type FroamCorpusModel = {
    /** P(archetype | previous archetype) — a bigram over page narrative. */
    transitions: Map<string, ArchetypeCounts>;
    /** P(archetype | position bucket). */
    positional: Map<string, ArchetypeCounts>;
    /** Nearest-neighbour table over section geometry. */
    geometry: Array<{
        columns: number;
        heightRatio: number;
        isFirst: boolean;
        isLast: boolean;
        archetype: FroamSectionArchetype;
    }>;
    /** Accent role frequencies. */
    accentRoles: ArchetypeCounts;
    /** Density examples keyed by type features. */
    densityExamples: Array<{
        medianStep: number;
        measureCh: number;
        paletteSize: number;
        density: string;
    }>;
    /** Which interpolation fits observed type scales better, chosen on training data. */
    interpolation: 'geometric' | 'arithmetic';
    interpolationFit: {
        geometric: number;
        arithmetic: number;
    };
    trainedOn: number;
};
/**
 * Fit a model from training profiles.
 *
 * Nothing here is hand-written knowledge about design. The transition table,
 * the positional frequencies and the interpolation rule are all read off the
 * corpus, so the model changes when the corpus does — which is the difference
 * between a learned prior and a rule with a confidence field bolted on.
 */
export declare function fitCorpusModel(profiles: readonly FroamPageProfile[]): FroamCorpusModel;
export declare function corpusPredictor(model: FroamCorpusModel): FroamPredictor;
export type FroamPredictorDiagnosis = {
    kind: string;
    tasks: number;
    /** Where the predictor went wrong, most frequent confusion first. */
    confusions: Array<{
        expected: string;
        predicted: string;
        count: number;
    }>;
    /** Share of tasks the predictor declined to answer. */
    abstainRate: number;
};
/**
 * What a predictor gets wrong, not just how often.
 *
 * An accuracy number says a predictor is weak. A confusion table says it calls
 * every three-column section a feature-grid, which is a fixable observation.
 */
export declare function diagnosePredictor(predictor: FroamPredictor, tasks: readonly FroamPretextTask[]): FroamPredictorDiagnosis[];
export {};
//# sourceMappingURL=predictors.d.ts.map