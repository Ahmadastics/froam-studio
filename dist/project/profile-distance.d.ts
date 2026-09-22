/**
 * Distance between two page profiles.
 *
 * The measurement that makes generation scoreable. Profile a page, generate a
 * new one from that profile, scan the generation, profile it again — the
 * distance between the two profiles says how faithfully the design system
 * survived the round trip. That number falling over time is what "Froam is
 * learning to build" means; without it the claim is a feeling about screenshots.
 *
 * 0 is identical, 1 is maximally different. Every axis is reported separately,
 * because a single number tells you the generator is wrong and nothing about
 * where — and "palette 0.02, flow 0.6" is a debuggable sentence.
 */
import type { FroamPageProfile } from './page-profile';
export type FroamProfileDistanceAxis = {
    axis: string;
    /** 0–1 within this axis. */
    distance: number;
    weight: number;
    /** What drove it, in plain terms. */
    note: string;
};
export type FroamProfileDistance = {
    /** Weighted mean across axes, 0–1. */
    total: number;
    axes: FroamProfileDistanceAxis[];
};
/**
 * Stated policy, same as the judge's weights.
 *
 * Palette and flow carry the most because they are what make two pages read as
 * the same system; a radius being 6px instead of 8px is a detail.
 */
export declare const FROAM_DISTANCE_WEIGHTS: Record<string, number>;
/** Levenshtein over archetype sequences, normalised by the longer one. */
export declare function sequenceDistance(a: readonly string[], b: readonly string[]): number;
export declare function profileDistance(target: FroamPageProfile, actual: FroamPageProfile): FroamProfileDistance;
//# sourceMappingURL=profile-distance.d.ts.map