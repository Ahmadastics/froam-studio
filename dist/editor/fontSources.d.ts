/**
 * Google Fonts families with the weights that exist for each.
 *
 * A weight that does not exist makes the whole css2 request fail, so only
 * add a family with weights you have confirmed. Grouped by the job the face
 * does — the picker reads FONT_CATALOG below for that, but keeping the
 * groups visible here stops the list drifting back into nine versions of
 * the same geometric sans.
 *
 * KEEP IN SYNC with the mirror in lib/codegen.mjs — production @import
 * lines come from that copy, so a family missing there loads in the editor
 * and then silently falls back to Times on the deployed site.
 */
export declare const GOOGLE_FONTS: Record<string, string>;
/** Fontshare families (free ITF fonts) with their available weights. */
export declare const FONTSHARE_FONTS: Record<string, string>;
export type FontRole = 'display' | 'sans' | 'humanist' | 'condensed' | 'serif' | 'slab' | 'mono' | 'hand';
export declare const FONT_ROLE_LABELS: Record<FontRole, string>;
export interface FontCatalogEntry {
    family: string;
    role: FontRole;
    /** When to reach for it, in a designer's terms — not a history lesson. */
    note: string;
    /** Families that hold up beside it. */
    pairsWith?: string[];
}
export declare const FONT_CATALOG: readonly FontCatalogEntry[];
/** Catalog entries for one role, in catalog order. */
export declare function fontsByRole(role: FontRole): FontCatalogEntry[];
export interface FontOption {
    label: string;
    value: string;
    role: FontRole | 'brand' | 'system';
}
/**
 * The font picker's list, derived from the catalog rather than hand-kept.
 *
 * A hardcoded picker drifts: it ends up offering faces that are in no font
 * source at all, which load nowhere and silently fall back — the control
 * says one thing and the page renders another. Deriving it means the picker
 * can only ever offer families the editor and codegen can both load, and
 * brand fonts appear the moment they are added.
 */
export declare function fontOptionsFor(brandFonts?: readonly BrandFont[] | null): FontOption[];
export type FontOptionGroup = FontOption['role'];
export declare const FONT_GROUP_LABELS: Record<FontOptionGroup, string>;
/** Options bucketed by role, in FONT_GROUP_ORDER, skipping empty groups. */
export declare function groupFontOptions(options: readonly FontOption[]): [FontOptionGroup, FontOption[]][];
/** Keep only brand fonts that can compile. Mirrors sanitizeBrandFonts in lib/codegen.mjs. */
export declare function sanitizeBrandFonts(value: unknown): BrandFont[];
export type BrandFontFormat = 'woff2' | 'woff' | 'truetype' | 'opentype';
export interface BrandFontFace {
    /** 400, or a variable range like '400 700'. Defaults to 400. */
    weight?: number | string;
    style?: 'normal' | 'italic';
    /** data:font/…;base64,… or an https: URL. Anything else is dropped. */
    src: string;
    format?: BrandFontFormat;
}
export interface BrandFont {
    family: string;
    faces: BrandFontFace[];
}
/**
 * A font `src` lands verbatim inside a generated CSS rule, so only two
 * shapes are ever allowed through: a base64 font data URI, or an https
 * URL. http: is refused too — it would break the page on any site served
 * over TLS.
 */
export declare function isSafeFontSrc(src: unknown): src is string;
/**
 * @font-face blocks for every valid face, as CSS lines. Faces with an
 * unusable src or an empty family are skipped rather than emitted
 * broken — generated CSS should never contain a rule that can't parse.
 */
export declare function brandFontFaceCss(brandFonts: readonly BrandFont[] | null | undefined): string[];
/** Family names the design defines itself — these must never be fetched remotely. */
export declare function brandFontFamilies(brandFonts: readonly BrandFont[] | null | undefined): string[];
/**
 * Idempotently sync the <style data-froam-brand-fonts> block so the editor
 * previews brand faces exactly as production will render them. Mirrors
 * ensureFontLinks: only touches the DOM when the CSS actually differs.
 */
export declare function ensureBrandFontStyle(brandFonts: readonly BrandFont[] | null | undefined): void;
/** First family name out of a CSS font-family value, unquoted. */
export declare function primaryFamily(fontFamilyValue: string | undefined): string | null;
/**
 * Stylesheet URLs that load the given families (unknown/system
 * families are skipped — they need no loading). Stable order so
 * callers can diff by URL.
 */
export declare function fontStylesheetUrls(families: Iterable<string | null | undefined>): string[];
/** Pull every font-family a draft store references (styles + injected HTML). */
export declare function collectStoreFontFamilies(store: Record<string, {
    text?: string;
    styles?: Record<string, string>;
} | undefined> | null | undefined): string[];
/**
 * Idempotently sync <link data-froam-fonts> tags in <head> so exactly
 * the given stylesheet URLs are loaded. Safe to call on every store
 * change — it only touches the DOM when the URL set actually differs.
 */
export declare function ensureFontLinks(families: Iterable<string | null | undefined>): void;
//# sourceMappingURL=fontSources.d.ts.map