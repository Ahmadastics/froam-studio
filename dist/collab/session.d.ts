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