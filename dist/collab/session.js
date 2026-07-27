/**
 * Froam Rooms — the editor's handle on the op log.
 *
 * `oplog.ts` is pure functions over an op array. This is the small piece of
 * state that owns *one* actor's log: the ops, the derived store, and the
 * Lamport clock. Deliberately not a React hook — the editor holds it in a ref,
 * a room server can hold the same thing, and the tests hold it directly.
 *
 * The derived store is maintained incrementally (one applyOp per op) rather
 * than re-folded on every keystroke, so recording an edit stays O(1) no matter
 * how long the log gets.
 */
import { applyOp, buildRedo, buildUndo, canRedo, canUndo, compactLog, createClock, deriveStore, diffDrafts, diffStores, highestClock, makeEdit, undoLabel, } from './oplog.js';
import { BASELINE_ACTOR, compareOps, LOCAL_ACTOR, } from './types.js';
export function createOpLogSession(options = {}) {
    let actor = options.actor ?? LOCAL_ACTOR;
    let log = options.ops ? [...options.ops].sort(compareOps) : [];
    let store = log.length ? deriveStore(log) : {};
    const clock = createClock(highestClock(log));
    function append(ops) {
        for (const op of ops) {
            log.push(op);
            store = applyOp(store, op);
        }
        return ops;
    }
    /** Turn a set of field changes into one batch of ops by one actor. */
    function emit(changes, as, label, batchId) {
        if (!changes.length)
            return [];
        const tick = clock.tick();
        const batch = batchId ?? `b_${tick}`;
        const ops = [];
        for (const change of changes) {
            const op = makeEdit(store, {
                actor: as,
                clock: tick,
                routeKey: change.routeKey,
                viewport: change.viewport,
                path: change.path,
                field: change.field,
                value: change.value,
                label,
                batch,
            });
            if (op) {
                ops.push(op);
                store = applyOp(store, op);
                log.push(op);
            }
        }
        return ops;
    }
    return {
        get actor() {
            return actor;
        },
        /**
         * Adopt a real identity once the user signs in. Existing local ops keep
         * their old actor so history stays truthful about who did what.
         */
        setActor(next) {
            actor = next;
        },
        all() {
            return log;
        },
        /** The design, derived. Never mutate this — append an op instead. */
        store() {
            return store;
        },
        size() {
            return log.length;
        },
        load(ops) {
            log = [...ops].sort(compareOps);
            store = deriveStore(log);
            clock.observe(highestClock(log));
        },
        /**
         * Turn a draft change into ops. Returns the ops appended, which is empty
         * when nothing actually moved — the editor repaints far more often than it
         * changes anything, and a log full of no-ops means an undo stack full of
         * steps that appear to do nothing.
         */
        record(input) {
            const changes = diffDrafts(input.prev, input.next).map((change) => ({
                routeKey: input.routeKey,
                viewport: input.viewport,
                path: input.path,
                field: change.field,
                value: change.value,
            }));
            return emit(changes, actor, input.label ?? 'Edit', input.batch);
        },
        /**
         * Bring the log up to a design that arrived rather than was typed — drafts
         * restored from storage at boot, or a published design fetched from the
         * bridge.
         *
         * Recorded as the baseline actor, so the log is a complete account of the
         * design from the first frame without those entries showing up in anyone's
         * undo stack.
         */
        seed(next) {
            return emit(diffStores(store, next), BASELINE_ACTOR, 'Loaded');
        },
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
        reconcile(next, label = 'Edit') {
            return emit(diffStores(store, next), actor, label);
        },
        canUndo() {
            return canUndo(log, actor);
        },
        canRedo() {
            return canRedo(log, actor);
        },
        undoLabel() {
            return undoLabel(log, actor);
        },
        undo() {
            return [...append(buildUndo(log, actor, clock.tick()))];
        },
        redo() {
            return [...append(buildRedo(log, actor, clock.tick()))];
        },
        /**
         * Take in ops from someone else. Advancing our clock past theirs is what
         * keeps causality intact: our next edit is guaranteed to sort after
         * everything we have already seen.
         */
        observe(remote) {
            if (!remote.length)
                return;
            const top = highestClock(log);
            clock.observe(highestClock(remote));
            const inOrder = remote.every((op) => op.clock >= top);
            if (inOrder) {
                append([...remote].sort(compareOps));
                return;
            }
            // An op arrived that belongs earlier in the order — re-fold rather than
            // guess, so the result matches every other device exactly.
            log = [...log, ...remote].sort(compareOps);
            store = deriveStore(log);
        },
        compact(keepRecent) {
            log = compactLog(log, keepRecent);
            store = deriveStore(log);
            return log;
        },
    };
}
//# sourceMappingURL=session.js.map