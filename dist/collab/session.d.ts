import { type EditorStore, type ElementDraft, type FroamActorId, type FroamOp, type FroamViewport } from './types';
export type RecordInput = {
    routeKey: string;
    viewport: FroamViewport;
    path: string;
    prev: ElementDraft | undefined;
    next: ElementDraft | undefined;
    label?: string;
    /** Ops sharing a batch undo as one step. */
    batch?: string;
};
export type OpLogSession = ReturnType<typeof createOpLogSession>;
export declare function createOpLogSession(options?: {
    actor?: FroamActorId;
    ops?: readonly FroamOp[];
}): {
    readonly actor: string;
    /**
     * Adopt a real identity once the user signs in. Existing local ops keep
     * their old actor so history stays truthful about who did what.
     */
    setActor(next: FroamActorId): void;
    all(): readonly FroamOp[];
    /** The design, derived. Never mutate this — append an op instead. */
    store(): EditorStore;
    size(): number;
    load(ops: readonly FroamOp[]): void;
    /**
     * Turn a draft change into ops. Returns the ops appended, which is empty
     * when nothing actually moved — the editor repaints far more often than it
     * changes anything, and a log full of no-ops means an undo stack full of
     * steps that appear to do nothing.
     */
    record(input: RecordInput): FroamOp[];
    /**
     * Bring the log up to a design that arrived rather than was typed — drafts
     * restored from storage at boot, or a published design fetched from the
     * bridge.
     *
     * Recorded as the baseline actor, so the log is a complete account of the
     * design from the first frame without those entries showing up in anyone's
     * undo stack.
     */
    seed(next: EditorStore): FroamOp[];
    /**
     * Take in a design published from another device.
     *
     * The old rule was "if this device has any local drafts, ignore the
     * publish" — which is why a phone that had been opened in the editor once
     * would never show anything saved from a laptop again. That gate existed
     * to protect unsaved local work, and the protection is right; the
     * granularity was wrong. A whole route was refused because a single
     * unrelated element had been touched.
     *
     * Now it merges per field, using the only clock the two devices share: a
     * local edit made *after* the publish wins, anything older gives way. Wall
     * clock is unsafe for ordering two edits milliseconds apart, which is why
     * ops sort by Lamport counter — but across a sync boundary measured in
     * minutes it is the only shared reference there is, and it is the right
     * tool here.
     *
     * Adopted values are recorded as baseline: arriving design is not the
     * user's work, so it must not land in their undo stack.
     */
    adoptPublished(input: {
        routeKey: string;
        viewport: FroamViewport;
        store: Record<string, ElementDraft>;
        publishedAt: number;
    }): {
        adopted: number;
        kept: number;
        ops: FroamOp[];
    };
    /**
     * Catch up to a store change the editor made without telling us.
     *
     * The three main mutation paths record ops directly, with proper labels.
     * This is the safety net for everything else — inline text edits,
     * drag-to-move, and any mutation added later. Recording at the call site
     * gives better labels; recording from the state transition is what makes
     * the log *complete*, which is the property undo and rooms depend on.
     *
     * A no-op when the caller already recorded: the changes are in the derived
     * store, so the diff comes back empty.
     */
    reconcile(next: EditorStore, label?: string): FroamOp[];
    /** The history as a list of what people did, newest first. */
    changes(limit?: number): import("./oplog").FroamChange[];
    /**
     * Undo one specific change from anywhere in the history, as this actor.
     *
     * Distinct from `undo()`, which walks this actor's own stack. This is how
     * you take back the thing someone did to the footer twenty edits ago —
     * and, once rooms land, the single mechanism the 60/40 rule permits,
     * proposes or refuses. Undoing someone else's work stays an ordinary,
     * attributed, visible act rather than a special case.
     */
    revert(changeId: string): FroamOp[];
    canUndo(): boolean;
    canRedo(): boolean;
    undoLabel(): string | undefined;
    undo(): FroamOp[];
    redo(): FroamOp[];
    /**
     * Take in ops from someone else. Advancing our clock past theirs is what
     * keeps causality intact: our next edit is guaranteed to sort after
     * everything we have already seen.
     */
    observe(remote: readonly FroamOp[]): void;
    compact(keepRecent?: number): FroamOp[];
};
//# sourceMappingURL=session.d.ts.map