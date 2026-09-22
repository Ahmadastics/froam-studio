/**
 * Froam Generation — build a page that obeys a measured design system.
 *
 * This is the half of "recreate" that is worth having. It does not reproduce a
 * scanned page; it produces a *new* page that runs on the same system — the same
 * palette roles, the same type scale, the same spacing base, the same section
 * rhythm — carrying neutral placeholder content.
 *
 * That boundary is not a compromise, it is the product. "Give me a page built on
 * this system, with my content" is the thing people pay for. "Give me a copy of
 * that company's homepage" is the thing that ends a company. The distinction is
 * also structural rather than a matter of restraint: a profile contains no copy,
 * no markup and no assets, so reproducing the original is not something this
 * function could do if it tried.
 *
 * Generation exists mainly to be *measured*. Emit a page from a profile,
 * re-scan it, profile it again, and the distance between the two profiles is a
 * number — see profileDistance. That number falling is what "Froam is learning
 * to build" means, as opposed to a feeling about some screenshots.
 */
import type { FroamPageProfile, FroamSectionArchetype } from './page-profile';
export declare const FROAM_GENERATOR_VERSION = "froam-generator-v1";
export type FroamGenerateOptions = {
    /** Page title. Never taken from a scanned page. */
    title?: string;
    /** Sections to emit. Defaults to the profile's own flow. */
    flow?: FroamSectionArchetype[];
    /** Seed for the placeholder text lengths, so output is deterministic. */
    seed?: number;
};
type Tokens = {
    surface: string;
    raised: string;
    ink: string;
    muted: string;
    accent: string;
    onAccent: string;
    base: number;
    radius: number;
    steps: number[];
    bodyFont: string;
    displayFont: string;
    measureCh: number;
    sectionPad: number;
    /** Padding inside cards and panels, scaled to the target's measured density. */
    cardPad: number;
    /** Horizontal section padding, also density-scaled — see the note in resolveTokens. */
    gutter: number;
    gap: number;
};
/**
 * Resolve a profile into the concrete values a page needs.
 *
 * Every fallback here is a deliberate, plain default rather than an invented
 * measurement — a page generated from a thin profile should look unremarkable,
 * not confidently wrong.
 */
export declare function resolveTokens(profile: FroamPageProfile): Tokens;
/**
 * Emit a self-contained page built on a profile's design system.
 *
 * Deliberately inline-styled and dependency-free: the output has to be
 * scannable by the same pipeline that produced the profile, and a build step
 * between generation and measurement is a place for the two to disagree.
 */
export declare function generatePageFromProfile(profile: FroamPageProfile, options?: FroamGenerateOptions): string;
export {};
//# sourceMappingURL=generate.d.ts.map