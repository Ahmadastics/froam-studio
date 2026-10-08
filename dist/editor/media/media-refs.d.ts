/**
 * How a design refers to a placed picture or video: `froam-media:<name>`,
 * where the name is the file's content hash (lib/media-store.mjs). The same
 * reference works everywhere because it is resolved late:
 *
 *   the editor        → the bridge, `/__froam/media/<name>`
 *   generated CSS     → `media/<name>` beside the stylesheet (lib/codegen.mjs)
 *   runtime script    → `media/<name>` beside the script
 *   React runtime     → `mediaBaseUrl`, or the bridge in froam dev, or /froam/media/
 *
 * The editor only ever shows bridge URLs (never blob: URLs), so a URL read
 * back from the page maps to its reference by pattern, with nothing to
 * remember — nothing session-only can leak into a saved design.
 */
export declare const MEDIA_REF_PREFIX = "froam-media:";
export type MediaContext = 'editor' | 'runtime';
export declare function isMediaRef(value: unknown): value is string;
export declare function mediaRefName(ref: string): string | null;
export declare function hasMediaRef(value: unknown): boolean;
/** Where media files are fetched from in this context. Ends with a slash. */
export declare function mediaBase(context?: MediaContext): string;
/** Every reference in `value` (a src, a srcset, a CSS value, HTML) as a URL. */
export declare function resolveMediaRefs(value: string, context?: MediaContext): string;
/** The reverse, for anything read back off the page: a media URL becomes its reference again. */
export declare function mediaRefsFromUrls(value: string): string;
/** The reference a single URL stands for, if it is one of ours. */
export declare function mediaRefForUrl(url: string): string | null;
//# sourceMappingURL=media-refs.d.ts.map