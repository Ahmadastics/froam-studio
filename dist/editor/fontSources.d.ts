/** Google Fonts families with the weights that exist for each. */
export declare const GOOGLE_FONTS: Record<string, string>;
/** Fontshare families (free ITF fonts) with their available weights. */
export declare const FONTSHARE_FONTS: Record<string, string>;
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