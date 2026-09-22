/**
 * Froam Page Profile — the measuring instrument.
 *
 * Aggregates per-node scan evidence into one bounded, page-level description
 * of an interface: its palette, type scale, spacing grid, surfaces, section
 * flow and internal consistency.
 *
 * This exists so that "is this design coherent" and "did a change improve it"
 * become computable rather than a matter of opinion. It is the ground truth
 * every judge tier is scored against.
 *
 * Derived statistics only. It never retains source, copy, markup or assets —
 * a profile is a fingerprint of decisions, not a reproduction of a page.
 */
import type { FroamScanRecord, FroamSemanticRole } from './types';
import type { FroamViewport } from '../collab/types';
export declare const FROAM_PAGE_PROFILE_SCHEMA_VERSION: 1;
/** Roles that represent a user action. Accent discipline is measured against these. */
export declare const FROAM_ACTION_ROLES: readonly FroamSemanticRole[];
export type FroamOklch = {
    l: number;
    c: number;
    h: number;
};
export type FroamPaletteEntry = {
    oklch: FroamOklch;
    /** Representative sRGB, for display only. Never authoritative. */
    hex: string;
    /** Share of estimated painted area, 0–1. */
    areaShare: number;
    role: 'surface' | 'raised' | 'ink' | 'muted' | 'accent' | 'border' | 'other';
    /** Semantic roles this colour was observed painting. */
    appearsOn: FroamSemanticRole[];
    /** How the colour was used, which decides how area was estimated. */
    channel: 'background' | 'text';
    nodeCount: number;
};
export type FroamTypeStep = {
    px: number;
    weight: number;
    lineHeight: number;
    usedBy: FroamSemanticRole[];
    count: number;
};
export type FroamSectionArchetype = 'hero' | 'proof' | 'feature-grid' | 'split' | 'testimonial' | 'pricing' | 'faq' | 'cta' | 'content' | 'footer' | 'unknown';
export type FroamSectionProfile = {
    index: number;
    archetype: FroamSectionArchetype;
    confidence: number;
    grid: {
        columns: number;
        gapPx: number;
        maxWidthPx: number;
    };
    heightRatio: number;
    childRoles: FroamSemanticRole[];
};
export type FroamContrastPair = {
    nodeId: string;
    ratio: number;
    required: number;
    largeText: boolean;
    role: FroamSemanticRole;
};
export type FroamTargetMeasurement = {
    nodeId: string;
    role: FroamSemanticRole;
    tag: string;
    width: number;
    height: number;
    /** Smaller dimension, which is what the standard constrains. */
    shortestSide: number;
};
/** Smallest font size treated as a type-scale step. Below this it is decoration. */
export declare const FROAM_MIN_TYPE_PX = 10;
/** WCAG 2.5.8 AA minimum target size, in CSS pixels. */
export declare const FROAM_MIN_TARGET_PX = 24;
export type FroamPageProfile = {
    schemaVersion: typeof FROAM_PAGE_PROFILE_SCHEMA_VERSION;
    origin: string;
    routeKey: string;
    capturedAt: number;
    viewport: FroamViewport;
    color: {
        palette: FroamPaletteEntry[];
        /** Fraction of accent-painted nodes that are action roles, 0–1. */
        accentDiscipline: number;
        /** Worst text contrast ratio actually rendered. Infinity when no text. */
        contrastFloor: number;
        /** Every text pair that failed its WCAG AA threshold. */
        contrastFailures: FroamContrastPair[];
        /** Text nodes evaluated, so failure counts have an honest denominator. */
        contrastSamples: number;
        /** Text whose backdrop is a gradient or image, so contrast cannot be computed. */
        contrastUnmeasurable: number;
        modeSignal: 'light' | 'dark' | 'mixed';
    };
    type: {
        families: Array<{
            stack: string;
            role: 'display' | 'body' | 'mono';
            areaShare: number;
        }>;
        scale: FroamTypeStep[];
        /** Median ratio between consecutive steps, or null when no scale holds. */
        ratio: number | null;
        /** Spread of consecutive ratios. High spread means the scale is nominal only. */
        ratioSpread: number;
        /** Text nodes below the 10px scale floor: icons, sr-only labels, decoration. */
        belowMinimumSizes: number;
        /** Body line length in characters, approximate. */
        measureCh: number;
    };
    space: {
        base: number;
        scale: number[];
        /** Fraction of spacing values landing on the base grid, 0–1. */
        adherence: number;
        sectionGapPx: number[];
        density: 'tight' | 'balanced' | 'airy';
    };
    surface: {
        radii: number[];
        shadowTiers: number;
        borderWeights: number[];
    };
    interaction: {
        /** Interactive elements measured, after exemptions. */
        targetSamples: number;
        /** Targets whose shortest side is under the WCAG 2.5.8 minimum. */
        undersizedTargets: FroamTargetMeasurement[];
        /** Shortest side across all measured targets. Infinity when none. */
        smallestTargetPx: number;
        /** Inline links inside running text, exempt from the size rule but counted for honesty. */
        exemptInlineTargets: number;
        /** Undersized targets passing the WCAG 2.5.8 spacing exception. */
        exemptSpacedTargets: number;
    };
    flow: {
        sections: FroamSectionProfile[];
        signature: string;
    };
    components: Array<{
        signature: string;
        role: FroamSemanticRole;
        instances: number;
        variance: number;
    }>;
    quality: {
        /** Fraction of colour usages falling outside the resolved palette, 0–1. */
        tokenDrift: number;
        /** 1 − spacing adherence. */
        spacingDrift: number;
        accessibilityWarnings: number;
        uniqueColors: number;
        uniqueSizes: number;
    };
    provenance: {
        derivedOnly: true;
        sourceCaptured: false;
        copyCaptured: false;
        assetsCaptured: false;
        nodesObserved: number;
        nodesRendered: number;
        /** Rendered / observed. Low coverage makes a profile unsafe to compare. */
        coverage: number;
    };
};
/** Parse the colour forms computed styles actually emit. Returns null for gradients and keywords. */
export declare function parseCssColor(value: string | undefined): {
    r: number;
    g: number;
    b: number;
    a: number;
} | null;
/** sRGB → OKLab. Clustering in sRGB treats #111 and #131214 as different decisions; OKLab does not. */
export declare function rgbToOklab(rgb: {
    r: number;
    g: number;
    b: number;
}): {
    L: number;
    a: number;
    b: number;
};
export declare function oklabToRgb(lab: {
    L: number;
    a: number;
    b: number;
}): {
    r: number;
    g: number;
    b: number;
};
export declare function oklabToOklch(lab: {
    L: number;
    a: number;
    b: number;
}): FroamOklch;
export declare function oklchToOklab(oklch: FroamOklch): {
    L: number;
    a: number;
    b: number;
};
export declare function oklchToHex(oklch: FroamOklch): string;
/** WCAG 2.x relative luminance. Deliberately not OKLab — the standard defines this exact formula. */
export declare function relativeLuminance(rgb: {
    r: number;
    g: number;
    b: number;
}): number;
export declare function contrastRatio(foreground: {
    r: number;
    g: number;
    b: number;
}, background: {
    r: number;
    g: number;
    b: number;
}): number;
/** WCAG AA threshold: 3.0 for large text (≥24px, or ≥18.66px at weight ≥700), else 4.5. */
export declare function contrastRequirement(fontSizePx: number, fontWeight: number): 3 | 4.5;
type NodeView = {
    id: string;
    role: FroamSemanticRole;
    tag: string;
    text: string;
    parentId?: string;
    childIds: string[];
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    area: number;
    ownArea: number;
    visible: boolean;
    background: ReturnType<typeof parseCssColor>;
    backgroundImage: string;
    colour: ReturnType<typeof parseCssColor>;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    fontFamily: string;
    radius: number;
    shadow: string;
    border: string;
    padding: string;
    margin: string;
    position: string;
    gap: number;
    display: string;
    gridTemplateColumns: string;
    accessibilityWarnings: number;
    focusable: boolean;
    signature: string;
};
/**
 * Greedy perceptual clustering. Threshold is OKLab ΔE — below it, two values
 * are one design decision.
 *
 * Backgrounds cluster tighter than text on purpose. An elevation system is
 * built from 1–3% lightness steps: #ffffff against #fafafa is ΔE 0.0155, a
 * deliberate surface/raised distinction that a text-grade threshold would
 * silently average into one off-white. The same difference between two text
 * colours is invisible and should merge.
 */
export declare const OKLAB_MERGE_THRESHOLD = 0.035;
export declare const OKLAB_MERGE_THRESHOLD_BACKGROUND = 0.01;
/**
 * Smallest value treated as layout spacing.
 *
 * A 1px padding is a hairline rule or an optical nudge, not a step in a spacing
 * system. Counting them is not harmless: across eighteen real sites the spacing
 * scale came back as [1,2,3,4,5] and every site resolved to a 4px base, because
 * sub-pixel noise outnumbered the actual 16/24/32px layout values. The grid was
 * being inferred from borders.
 */
export declare const FROAM_MIN_SPACING_PX = 2;
/**
 * Find a page's sections.
 *
 * Real pages nest, and they do not nest uniformly. Beneath `<body>` sit a
 * framework mount, a theme provider and a layout shell before anything that
 * resembles a section; sections then appear at different depths, because a hero
 * might be a direct child of the shell while three feature blocks sit inside a
 * container and the footer is a sibling of all of it.
 *
 * Reading the direct children of any single parent therefore cannot work. The
 * first version of this walked down to one "section parent" and found a single
 * section on every real page, silently emptying the flow axis and with it three
 * of the six pretext tasks.
 *
 * What actually identifies a section stack is **vertical tiling**: sections
 * partition the height of what contains them, edge to edge, with little overlap.
 * That property survives arbitrary nesting, so this walks the tree deciding at
 * each node whether it *is* a section or is a band that should be exploded into
 * the sections beneath it.
 */
export declare function resolveSections(documentRoot: NodeView | undefined, childrenOf: (view: NodeView) => NodeView[]): NodeView[];
/** A repeated sibling group: the geometric signature of a grid, a price table, a testimonial row. */
export type FroamItemGroup = {
    count: number;
    columns: number;
    withMedia: number;
    withHeading: number;
};
/**
 * Find the strongest repeated-sibling group inside a section.
 *
 * This replaces counting `role === 'card'`, which came from scan.ts matching the
 * *class name* "card" or "tile". Across eighteen real sites that fired twice —
 * Stripe, Linear, Vercel and Tailwind all have obvious feature grids and none of
 * them name the class that way. Geometry does not care what the class is called:
 * three boxes of near-identical size sitting in a row is a grid, whatever the
 * markup calls them.
 */
export declare function detectItemGroup(section: NodeView, childrenOf: (view: NodeView) => NodeView[], isMedia: (view: NodeView) => boolean): FroamItemGroup;
export type FroamProfileInput = {
    records: readonly FroamScanRecord[];
    origin: string;
    routeKey: string;
    viewport: FroamViewport;
    capturedAt?: number;
};
export declare function buildPageProfile(input: FroamProfileInput): FroamPageProfile;
export {};
//# sourceMappingURL=page-profile.d.ts.map