import type { FroamOp } from '../../collab/types';
import type { RoomRequestScope, RoomStyleEdit } from '../../collab/room';
import type { PendingChange } from './FroamCollaborate';
type Draft = {
    text?: string;
    imageUrl?: string;
    media?: string;
    styles?: Record<string, string>;
    fingerprint?: {
        text?: string;
        className?: string;
    };
    [key: string]: unknown;
};
export type BuiltRequest = {
    /** The ops this request is made of — so a sent-back request's edits count again. */
    opIds: string[];
    /** Every page and screen size touched, the one on screen first. */
    scopes: RoomRequestScope[];
    /** The first scope, for rooms that predate multi-page requests. */
    store: Record<string, Draft>;
    removed: string[];
    changes: PendingChange[];
    textEdits: Array<{
        from: string;
        to: string;
    }>;
    /** Base style edits a Tailwind project can write into class lists. */
    styleEdits: RoomStyleEdit[];
};
/**
 * "Heading “Plan a trip”" — what a person would call the element. On another
 * page the element isn't in the DOM, so the fingerprint's words stand in.
 */
export declare function elementLabel(path: string, root: HTMLElement | null, fallbackText?: string): string;
/** The element's classes as its source writes them — never the editor's own markers. */
export declare function sourceClasses(className: unknown): string;
/**
 * A contributor's changes, from the ops they made themselves — never from
 * diffing the page, which would sweep in whatever the owner changed live in
 * the meantime. Each touched field reads from its first `before` to its value
 * now; a field edited back to where it started is not a change.
 *
 * Every page and screen size they touched goes in one request: fixing the
 * headline on desktop and on mobile is one change to a person, not two.
 */
export declare function buildChangeRequest(input: {
    ops: readonly FroamOp[];
    isMine: (actor: string) => boolean;
    /** The page and screen size on screen now: listed first, labelled from the DOM. */
    current: {
        routeKey: string;
        viewport: string;
        root: HTMLElement | null;
    };
    /** The drafts for any page and screen size. */
    draftsFor: (routeKey: string, viewport: string) => Record<string, Draft>;
    /** Ops already in a pending or approved request. */
    excludedOpIds: ReadonlySet<string>;
    /**
     * The page's own words at a path, before anyone edited it. An op's `before`
     * is the previous draft, and the first edit has none — but the source still
     * says the original, and that's what copy write-back searches for.
     */
    originalText?: (routeKey: string, viewport: string, path: string) => string | undefined;
}): BuiltRequest;
export {};
//# sourceMappingURL=request-builder.d.ts.map