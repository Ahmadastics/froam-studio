/**
 * The site's own look, read off the live page, so a pattern from the Library
 * arrives looking like it was always part of the site: its fonts, its ink and
 * paper, its brand colour, its corner radius, its name and its navigation.
 *
 * Everything becomes a CSS custom property on the inserted section (see
 * themeVariables). The values travel inside the section's own style, so the
 * look survives saving, the op log and the production runtime unchanged.
 */
export type SiteTheme = {
    fontBody: string;
    fontHeading: string;
    /** Main text colour. */
    ink: string;
    /** Secondary text. */
    muted: string;
    /** Page background. */
    paper: string;
    /** Cards and raised panels. */
    surface: string;
    /** A soft wash of the brand colour. */
    tint: string;
    /** Hairlines and borders. */
    line: string;
    /** The brand colour: primary buttons, eyebrows, highlights. */
    accent: string;
    /** Text that sits on the brand colour. */
    accentInk: string;
    radius: string;
    buttonRadius: string;
    /** Width the site's content column keeps to. */
    maxWidth: string;
    brandName: string;
    navLinks: string[];
};
export declare const DEFAULT_SITE_THEME: SiteTheme;
type Rgba = {
    r: number;
    g: number;
    b: number;
    a: number;
};
export declare function parseColor(value: string | null | undefined): Rgba | null;
export declare function toHex({ r, g, b }: Rgba): string;
/** WCAG relative luminance. */
export declare function luminance({ r, g, b }: Rgba): number;
export declare function contrast(a: Rgba, b: Rgba): number;
/** Reads the live page. Anything it can't find falls back to a calm default. */
export declare function sampleSiteTheme(scope?: HTMLElement): SiteTheme;
/** The theme as the custom properties the Library's patterns are written against. */
export declare function themeVariables(theme: SiteTheme): Record<string, string>;
export {};
//# sourceMappingURL=site-theme.d.ts.map