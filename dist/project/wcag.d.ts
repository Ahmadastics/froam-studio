/**
 * WCAG colour maths, once. Every Froam surface that asks "can this be read?"
 * — the A11y tab, the page Health scan, "Fix contrast everywhere", the
 * reviewer checks, the page profile the judge reads — computes the answer
 * here, so two of them can never disagree about the same pair of colours.
 *
 * Pure: no DOM, safe in Node. Channels run 0–255; alpha 0–1.
 */
export type Rgb = {
    r: number;
    g: number;
    b: number;
};
export type Rgba = Rgb & {
    a: number;
};
/** WCAG 2.2 1.4.3 (AA): normal text. */
export declare const WCAG_AA_TEXT = 4.5;
/** WCAG 2.2 1.4.3 (AA): large text — 24px, or 18.66px at weight 700+. */
export declare const WCAG_AA_LARGE_TEXT = 3;
/** WCAG 2.2 1.4.6 (AAA): normal text. */
export declare const WCAG_AAA_TEXT = 7;
/** WCAG 2.2 2.5.8 (AA) minimum target size, in CSS pixels. */
export declare const WCAG_MIN_TARGET_PX = 24;
export declare const WHITE: Rgba;
/** WCAG relative luminance of a colour whose channels run 0–1. */
export declare function relativeLuminance01({ r, g, b }: Rgb): number;
/** WCAG relative luminance of a 0–255 colour. */
export declare function luminance({ r, g, b }: Rgb): number;
/** WCAG contrast ratio between two opaque colours, 1–21. */
export declare function contrastRatio(a: Rgb, b: Rgb): number;
/** `top` painted over `bottom` (source-over). Opaque when `bottom` is. */
export declare function blend(top: Rgba, bottom: Rgba): Rgba;
export declare const isLargeText: (fontSizePx: number, fontWeight: number) => boolean;
/** The AA floor for text of this size and weight. */
export declare const requiredContrast: (fontSizePx: number, fontWeight: number) => 3 | 4.5;
export declare function toHex({ r, g, b }: Rgb): string;
/**
 * Every colour form a computed style emits: hex, rgb()/rgba() in either
 * syntax, color(srgb …), and the CSS Color 4 spaces browsers now keep as
 * authored — oklch() and oklab(), which Tailwind 4 uses for its whole
 * palette. Null for keywords, gradients and spaces it can't convert (an
 * honest "can't read it" beats a wrong number).
 */
export declare function parseColor(value: string | null | undefined): Rgba | null;
//# sourceMappingURL=wcag.d.ts.map