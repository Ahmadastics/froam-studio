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