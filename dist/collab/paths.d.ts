/**
 * Froam Rooms — the path format.
 *
 * A path is `tag:n/tag:n/...` from the froam root down, where `n` is the
 * element's 1-based position among its same-tag siblings. Every draft, op,
 * comment and lock is keyed by one, so this is a contract, not an
 * implementation detail — it appears in froam.design.json, in the generated
 * CSS scope, and (from v5) on the wire between a designer and a client.
 *
 * Extracted from the editor so the format has one definition that the log,
 * the anchor resolver and a room server can all agree on.
 */
export declare function isSafeDraftPath(path: string): boolean;
export declare function getElementPath(element: HTMLElement, root: HTMLElement): string;
export declare function findElementByPath(root: HTMLElement, path: string): HTMLElement | null;
/** The tag a path points at, without touching the DOM. */
export declare function tagOfPath(path: string): string;
//# sourceMappingURL=paths.d.ts.map