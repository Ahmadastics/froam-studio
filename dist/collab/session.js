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
import { applyOp, buildRedo, buildUndo, canRedo, canUndo, compactLog, createClock, deriveStore, diffDrafts, highestClock, makeEdit, undoLabel, } from './oplog.js';
import { compareOps, LOCAL_ACTOR, } from './types.js';
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
            const changes = diffDrafts(input.prev, input.next);
            if (!changes.length)
                return [];
            const tick = clock.tick();
            const batch = input.batch ?? `b_${tick}`;
            const ops = [];
            for (const change of changes) {
                const op = makeEdit(store, {
                    actor,
                    clock: tick,
                    routeKey: input.routeKey,
                    viewport: input.viewport,
                    path: input.path,
                    field: change.field,
                    value: change.value,
                    label: input.label,
                    batch,
                });
                if (op) {
                    ops.push(op);
                    store = applyOp(store, op);
                    log.push(op);
                }
            }
            return ops;
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