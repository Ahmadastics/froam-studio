/**
 * Froam — how screen sizes inherit.
 *
 * Desktop is the base and flows down: a desktop edit shows at every width,
 * tablet edits lay over it at 1024px and below, mobile edits over both at
 * 640px and below. It's the cascade Webflow and Framer use, and the one the
 * generated stylesheet, both runtimes and the editor's own previews share —
 * so what the Mobile preview shows is what a phone visitor gets.
 *
 * Per element, a narrower draft's fields replace the wider ones' and its
 * styles merge over theirs. KEEP IN SYNC with layeredStore in lib/codegen.mjs
 * (and the copy in the vanilla runtime there).
 *
 * Dependency-free on purpose: the production React runtime imports it.
 */
export declare const SIZE_ORDER: readonly ["desktop", "tablet", "mobile"];
export type SizeMode = (typeof SIZE_ORDER)[number];
type DraftLike = {
    styles?: Record<string, string>;
    text?: string;
    [field: string]: unknown;
};
/**
 * Everything that applies at `size`: each wider size's drafts, then this one's.
 *
 * When only one size has anything — always so at desktop — that size's own
 * object comes back, not a copy. Callers key effects on it, and a fresh object
 * on every call made them repaint the page on every render.
 */
export declare function layeredDrafts<D extends DraftLike>(bySize: Partial<Record<SizeMode, Record<string, D> | null | undefined>>, size: SizeMode): Record<string, D>;
/** What `size` inherits: the layered drafts of the wider sizes only (empty for desktop). */
export declare function inheritedDrafts<D extends DraftLike>(bySize: Partial<Record<SizeMode, Record<string, D> | null | undefined>>, size: SizeMode): Record<string, D>;
/** The editor keeps one store keyed `route@@size`; this reads one route's sizes out of it. */
export declare function routeSizes<D extends DraftLike>(store: Record<string, Record<string, D>>, routeKey: string): Partial<Record<SizeMode, Record<string, D>>>;
/**
 * A narrower size's draft, minus what it only repeats of the sizes above.
 *
 * Saving reads styles and words back off the live element, and in the Tablet
 * or Mobile preview the live element is showing the desktop edits underneath.
 * Kept as they are, those copies would freeze: change the desktop colour
 * later and phones would keep the old one. A value this size never set
 * itself (`before`), that only matches what it inherits — or, for words, the
 * page's own — is dropped.
 */
export declare function withoutInherited<D extends DraftLike>(draft: D, before: D | undefined, inherited: D | undefined, pageText?: string): D;
export {};
//# sourceMappingURL=cascade.d.ts.map