/**
 * Froam Corpus — the scanned record Froam learns from.
 *
 * One design decision is enforced structurally here rather than left to
 * discipline: **nothing enters the corpus without a declared quality tier.**
 *
 * Prediction accuracy teaches a system to reproduce the average of whatever it
 * was shown. A corpus of two hundred mediocre pages produces a model that
 * understands mediocrity perfectly and recommends it confidently. The profile's
 * own `quality` metrics cannot rescue this, because they measure *consistency*
 * — a consistently ugly page scores beautifully. The only fix is a signal from
 * outside the measurement, which means a human saying "this one is good".
 *
 * Making `tier` a required argument is that fix. It costs one judgement per
 * page at ingest and it is the difference between a corpus that teaches taste
 * and one that launders the median of the web back at you.
 */
import type { FroamPageProfile } from './page-profile';
import type { FroamViewport } from '../collab/types';
export declare const FROAM_CORPUS_SCHEMA_VERSION: 1;
/**
 * Curated quality, assigned by a person.
 *
 * reference — worth imitating; the target distribution.
 * good      — sound, unremarkable; safe to learn structure from.
 * baseline  — typical of the niche; context, not a target.
 * negative  — deliberately retained as a counter-example.
 */
export type FroamCorpusTier = 'reference' | 'good' | 'baseline' | 'negative';
/** Tiers priors may be induced from. Baseline and negative are evidence, not aspiration. */
export declare const FROAM_LEARNABLE_TIERS: readonly FroamCorpusTier[];
export type FroamCorpusEntry = {
    profile: FroamPageProfile;
    tier: FroamCorpusTier;
    tags: string[];
    addedAt: number;
    /** Audit score when it entered, so corpus drift is detectable later. */
    scoreAtIngest: number;
    judgeVersion: string;
    /** Free-text reason for the tier. Optional, but the only record of why. */
    note?: string;
};
export type FroamCorpus = {
    schemaVersion: typeof FROAM_CORPUS_SCHEMA_VERSION;
    entries: FroamCorpusEntry[];
};
export type FroamCorpusStats = {
    entries: number;
    origins: number;
    byTier: Record<FroamCorpusTier, number>;
    byViewport: Partial<Record<FroamViewport, number>>;
    byMode: Record<string, number>;
    meanScore: number;
    learnable: number;
    /** Origins holding more than one page. Induction leans on within-site consistency. */
    multiPageOrigins: number;
    /** Distinct judge versions present. Mixed versions make scores incomparable. */
    judgeVersions: string[];
};
export declare function emptyCorpus(): FroamCorpus;
/**
 * Add a profile, replacing any earlier capture of the same origin/route/viewport.
 *
 * `tier` is required. There is no default, because a default would be a silent
 * judgement about quality made by nobody.
 */
export declare function addToCorpus(corpus: FroamCorpus, profile: FroamPageProfile, input: {
    tier: FroamCorpusTier;
    tags?: string[];
    note?: string;
    now?: number;
}): FroamCorpus;
export declare function removeOrigin(corpus: FroamCorpus, origin: string): FroamCorpus;
export type FroamCorpusFilter = {
    tiers?: readonly FroamCorpusTier[];
    viewport?: FroamViewport;
    modeSignal?: FroamPageProfile['color']['modeSignal'];
    tags?: readonly string[];
    /** Section flow archetype that must appear on the page. */
    archetype?: string;
    origins?: readonly string[];
};
export declare function selectEntries(corpus: FroamCorpus, filter?: FroamCorpusFilter): FroamCorpusEntry[];
/**
 * Profiles eligible for prior induction.
 *
 * Baseline and negative pages are deliberately excluded. They are useful for
 * scoring the judge and for contrast, but inducing "what is normal" from pages
 * nobody vouched for is how a corpus starts recommending the median.
 */
export declare function learnableProfiles(corpus: FroamCorpus): FroamPageProfile[];
/** Deliberately-retained bad pages, for contrast and for judge scoring. */
export declare function negativeProfiles(corpus: FroamCorpus): FroamPageProfile[];
export declare function corpusStats(corpus: FroamCorpus): FroamCorpusStats;
export type FroamCorpusReadiness = {
    ready: boolean;
    /** Specific, actionable reasons the corpus cannot yet support induction. */
    blockers: string[];
    warnings: string[];
};
/**
 * Whether the corpus can support induction yet.
 *
 * Reported rather than assumed, because the failure mode of a thin corpus is
 * not an error — it is a confident prior induced from six pages that does not
 * survive contact with a seventh.
 */
export declare function corpusReadiness(corpus: FroamCorpus, input?: {
    minOrigins?: number;
    minLearnable?: number;
}): FroamCorpusReadiness;
/** Re-audit every entry under the current judge, reporting where ingest scores have drifted. */
export declare function reauditCorpus(corpus: FroamCorpus): {
    corpus: {
        entries: {
            scoreAtIngest: number;
            judgeVersion: string;
            profile: FroamPageProfile;
            tier: FroamCorpusTier;
            tags: string[];
            addedAt: number;
            /** Free-text reason for the tier. Optional, but the only record of why. */
            note?: string;
        }[];
        schemaVersion: typeof FROAM_CORPUS_SCHEMA_VERSION;
    };
    drifted: {
        origin: string;
        routeKey: string;
        was: number;
        now: number;
        delta: number;
    }[];
};
//# sourceMappingURL=corpus.d.ts.map