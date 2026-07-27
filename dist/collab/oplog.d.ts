/**
 * Froam Rooms — the op log.
 *
 * ROADMAP.md Phase 0.2 / 0.2b. Pure and DOM-free on purpose: everything here
 * is a function of an op array, so it can be unit-tested, replayed on a
 * server, and shared between the editor and a room.
 *
 * The design store is *derived*, never mutated directly:
 *
 *     ops ──deriveStore──▶ EditorStore ──codegen──▶ froam.generated.css
 *
 * Undo is a per-actor cursor over the same log rather than a stack of store
 * snapshots. With one actor that behaves exactly like the old undo; with two
 * it is already correct, which is the whole point of building it now.
 */
import { type EditorStore, type ElementDraft, type FroamActorId, type FroamOp, type FroamOpField, type FroamViewport } from './types';
export declare function froamOpId(): string;
/**
 * Lamport clock. `observe` on every incoming remote op so our next local op
 * sorts after everything we've seen — that, not wall-clock time, is what makes
 * ordering agree across devices.
 */
export declare function createClock(start?: number): {
    readonly current: number;
    tick(): number;
    observe(remote: number): number;
};
export declare function highestClock(ops: readonly FroamOp[]): number;
/** Apply one op to a store, returning a new store. Last write wins. */
export declare function applyOp(store: EditorStore, op: FroamOp): EditorStore;
/**
 * Fold the whole log into a design store.
 *
 * Undo and redo ops carry real before/after values, so they fold in like any
 * other write — derivation never has to know what an undo *is*. That keeps
 * this function a plain reduce, which is why it can run on a server too.
 */
export declare function deriveStore(ops: readonly FroamOp[]): EditorStore;
/** Current value of one field, per the log. */
export declare function currentValue(store: EditorStore, op: Pick<FroamOp, 'routeKey' | 'viewport' | 'path' | 'field'>): string | undefined;
export type EditInput = {
    actor: FroamActorId;
    clock: number;
    routeKey: string;
    viewport: FroamViewport;
    path: string;
    field: FroamOpField;
    value: string | undefined;
    label?: string;
    batch?: string;
};
/**
 * Build an edit op against the current derived store, so `before` is what is
 * actually on screen rather than what the caller assumed.
 * Returns null when the value is unchanged — no-op ops would bloat the log and
 * add dead undo steps.
 */
export declare function makeEdit(store: EditorStore, input: EditInput): FroamOp | null;
export type FieldChange = {
    field: FroamOpField;
    value: string | undefined;
};
/**
 * Reduce a whole-draft change to the fields that actually moved.
 *
 * The editor thinks in drafts ("here is the new state of this element"), the
 * log thinks in fields ("colour became #fff"). This is the seam between them,
 * and it is what makes concurrent edits to one element merge instead of
 * clobber: two people restyling the same box only collide if they touch the
 * same property.
 */
export declare function diffDrafts(prev: ElementDraft | undefined, next: ElementDraft | undefined): FieldChange[];
type Action = {
    key: string;
    kind: FroamOp['kind'];
    ops: FroamOp[];
};
export type UndoCursor = {
    undoable: Action[];
    redoable: Action[];
};
/**
 * Replay this actor's actions to work out what *they* can undo.
 *
 * Other actors' ops are skipped entirely — that is the whole difference
 * between single-player and multiplayer undo. Ctrl+Z must never revert what
 * the person on the other side of the page just did.
 */
export declare function undoCursor(ops: readonly FroamOp[], actor: FroamActorId): UndoCursor;
export declare function canUndo(ops: readonly FroamOp[], actor: FroamActorId): boolean;
export declare function canRedo(ops: readonly FroamOp[], actor: FroamActorId): boolean;
export declare function undoLabel(ops: readonly FroamOp[], actor: FroamActorId): string | undefined;
/**
 * The ops to append for this actor's undo, or an empty array if there is
 * nothing to undo. Always returns at least one op when it returns any, so the
 * cursor stays in step even if every field was already at its old value.
 */
export declare function buildUndo(ops: readonly FroamOp[], actor: FroamActorId, clock: number): FroamOp[];
export declare function buildRedo(ops: readonly FroamOp[], actor: FroamActorId, clock: number): FroamOp[];
/**
 * Collapse the head of a log into a baseline of edit ops, one per live field.
 *
 * The log grows forever; localStorage does not. Compacting keeps the derived
 * store identical while dropping superseded writes and spent undo pairs.
 * Everything after `keepFrom` is preserved verbatim so recent undo history
 * survives.
 */
export declare function compactLog(ops: readonly FroamOp[], keepRecent?: number): FroamOp[];
export {};
//# sourceMappingURL=oplog.d.ts.map