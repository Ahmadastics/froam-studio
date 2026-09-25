import type { FroamOp } from '../../collab/types';
import type { PendingChange } from './FroamCollaborate';
type Draft = {
    text?: string;
    imageUrl?: string;
    styles?: Record<string, string>;
    [key: string]: unknown;
};
export type BuiltRequest = {
    /** The ops this request is made of — so a sent-back request's edits count again. */
    opIds: string[];
    store: Record<string, Draft>;
    removed: string[];
    changes: PendingChange[];
    textEdits: Array<{
        from: string;
        to: string;
    }>;
};
/** "Heading “Plan a trip”" — what a person would call the element. */
export declare function elementLabel(path: string, root: HTMLElement | null): string;
/**
 * A contributor's changes on one page and viewport, from the ops they made
 * themselves — never from diffing the page, which would sweep in whatever the
 * owner changed live in the meantime. Each touched field reads from its first
 * `before` to its value now; a field edited back to where it started is not
 * a change.
 */
export declare function buildChangeRequest(input: {
    ops: readonly FroamOp[];
    isMine: (actor: string) => boolean;
    routeKey: string;
    viewport: string;
    drafts: Record<string, Draft>;
    root: HTMLElement | null;
    /** Ops already in a pending or approved request. */
    excludedOpIds: ReadonlySet<string>;
    /**
     * The page's own words at a path, before anyone edited it. An op's `before`
     * is the previous draft, and the first edit has none — but the source still
     * says the original, and that's what copy write-back searches for.
     */
    originalText?: (path: string) => string | undefined;
}): BuiltRequest;
export {};
//# sourceMappingURL=request-builder.d.ts.map