/**
 * Froam — edits from more than one device, merged instead of overwritten.
 *
 * A page's saved edits used to be one blob per route and size, and every save
 * replaced the blob. Two devices open at once — a laptop and a phone, two
 * tabs, two teammates — meant the second save erased whatever the first had
 * saved, silently.
 *
 * Now each device remembers what it last synced, as a signature: a short hash
 * per field (and per style property), never the values themselves, so a
 * picture inlined as a data URI isn't kept twice. With that, a three-way merge
 * can tell "this device changed it" from "this device just never saw the
 * other one's change": a field the device left alone takes the other side's
 * value; a field it changed keeps its own. Two devices changing the very same
 * property is the only real conflict, and `ours` wins it — the newer save on
 * the computer, the unsaved edit in an open editor.
 *
 * KEEP IN SYNC with lib/draft-merge.mjs (the bridge's copy). Dependency-free.
 */
export type DraftLike = {
    styles?: Record<string, string>;
    fingerprint?: unknown;
    [field: string]: unknown;
};
/** Field → hash, with `styles` as property → hash. Bookkeeping (`fingerprint`) is left out. */
export type DraftSignature = {
    [field: string]: string | Record<string, string>;
};
/** Path → signature: what a device last synced for one route at one size. */
export type SyncBase = Record<string, DraftSignature>;
/** cyrb53: 53 bits, so two different values sharing a hash is not a real-world worry. */
export declare function hashValue(value: unknown): string;
export declare function signDraft(draft: DraftLike | undefined): DraftSignature | undefined;
export declare function signDrafts(drafts: Record<string, DraftLike> | null | undefined): SyncBase;
/**
 * Three-way merge of one route's drafts at one size.
 *
 * `base` is what the `ours` side last synced. `conflicts` lists the paths
 * where both sides changed the same field and `ours` was kept.
 */
export declare function mergeDrafts<D extends DraftLike>(input: {
    base: SyncBase;
    ours: Record<string, D>;
    theirs: Record<string, D>;
}): {
    drafts: Record<string, D>;
    conflicts: string[];
    changed: boolean;
};
//# sourceMappingURL=draft-merge.d.ts.map