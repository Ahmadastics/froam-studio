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
import { compareOps, scopeKey, } from './types.js';
/* ─── ids & clocks ─── */
export function froamOpId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function')
        return c.randomUUID();
    return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
/**
 * Lamport clock. `observe` on every incoming remote op so our next local op
 * sorts after everything we've seen — that, not wall-clock time, is what makes
 * ordering agree across devices.
 */
export function createClock(start = 0) {
    let value = start;
    return {
        get current() {
            return value;
        },
        tick() {
            value += 1;
            return value;
        },
        observe(remote) {
            if (remote > value)
                value = remote;
            return value;
        },
    };
}
export function highestClock(ops) {
    let max = 0;
    for (const op of ops)
        if (op.clock > max)
            max = op.clock;
    return max;
}
/* ─── deriving the store ─── */
function readField(draft, field) {
    if (!draft)
        return undefined;
    if (field === 'text')
        return draft.text;
    if (field === 'imageUrl')
        return draft.imageUrl;
    return draft.styles?.[field.slice(6)];
}
function writeField(draft, field, value) {
    const next = { ...draft };
    if (field === 'text' || field === 'imageUrl') {
        if (value === undefined)
            delete next[field];
        else
            next[field] = value;
        return next;
    }
    const prop = field.slice(6);
    const styles = { ...(next.styles ?? {}) };
    if (value === undefined)
        delete styles[prop];
    else
        styles[prop] = value;
    if (Object.keys(styles).length)
        next.styles = styles;
    else
        delete next.styles;
    return next;
}
function isEmptyDraft(draft) {
    return draft.text === undefined && draft.imageUrl === undefined && !draft.styles;
}
/** Apply one op to a store, returning a new store. Last write wins. */
export function applyOp(store, op) {
    const key = scopeKey(op.routeKey, op.viewport);
    const scope = store[key] ?? {};
    const nextDraft = writeField(scope[op.path] ?? {}, op.field, op.after);
    const nextScope = { ...scope };
    if (isEmptyDraft(nextDraft))
        delete nextScope[op.path];
    else
        nextScope[op.path] = nextDraft;
    const next = { ...store };
    if (Object.keys(nextScope).length)
        next[key] = nextScope;
    else
        delete next[key];
    return next;
}
/**
 * Fold the whole log into a design store.
 *
 * Undo and redo ops carry real before/after values, so they fold in like any
 * other write — derivation never has to know what an undo *is*. That keeps
 * this function a plain reduce, which is why it can run on a server too.
 */
export function deriveStore(ops) {
    const ordered = [...ops].sort(compareOps);
    let store = {};
    for (const op of ordered)
        store = applyOp(store, op);
    return store;
}
/** Current value of one field, per the log. */
export function currentValue(store, op) {
    return readField(store[scopeKey(op.routeKey, op.viewport)]?.[op.path], op.field);
}
/**
 * Build an edit op against the current derived store, so `before` is what is
 * actually on screen rather than what the caller assumed.
 * Returns null when the value is unchanged — no-op ops would bloat the log and
 * add dead undo steps.
 */
export function makeEdit(store, input) {
    const before = currentValue(store, input);
    if (before === input.value)
        return null;
    return {
        id: froamOpId(),
        kind: 'edit',
        actor: input.actor,
        clock: input.clock,
        ts: Date.now(),
        routeKey: input.routeKey,
        viewport: input.viewport,
        path: input.path,
        field: input.field,
        before,
        after: input.value,
        label: input.label,
        batch: input.batch,
    };
}
/**
 * Reduce a whole-draft change to the fields that actually moved.
 *
 * The editor thinks in drafts ("here is the new state of this element"), the
 * log thinks in fields ("colour became #fff"). This is the seam between them,
 * and it is what makes concurrent edits to one element merge instead of
 * clobber: two people restyling the same box only collide if they touch the
 * same property.
 */
export function diffDrafts(prev, next) {
    const changes = [];
    const before = prev ?? {};
    const after = next ?? {};
    if (before.text !== after.text)
        changes.push({ field: 'text', value: after.text });
    if (before.imageUrl !== after.imageUrl)
        changes.push({ field: 'imageUrl', value: after.imageUrl });
    const props = new Set([...Object.keys(before.styles ?? {}), ...Object.keys(after.styles ?? {})]);
    for (const prop of props) {
        const from = before.styles?.[prop];
        const to = after.styles?.[prop];
        if (from !== to)
            changes.push({ field: `style:${prop}`, value: to });
    }
    return changes;
}
/**
 * Group one actor's ops into undoable actions. Ops sharing a `batch` are one
 * action, which is what keeps a colour-picker drag to a single undo step.
 */
function actorActions(ops, actor) {
    const actions = [];
    const byKey = new Map();
    for (const op of [...ops].sort(compareOps)) {
        if (op.actor !== actor)
            continue;
        const key = `${op.kind}:${op.batch ?? op.id}`;
        const existing = byKey.get(key);
        if (existing) {
            existing.ops.push(op);
            continue;
        }
        const action = { key: op.batch ?? op.id, kind: op.kind, ops: [op] };
        byKey.set(key, action);
        actions.push(action);
    }
    return actions;
}
/**
 * Replay this actor's actions to work out what *they* can undo.
 *
 * Other actors' ops are skipped entirely — that is the whole difference
 * between single-player and multiplayer undo. Ctrl+Z must never revert what
 * the person on the other side of the page just did.
 */
export function undoCursor(ops, actor) {
    const undoable = [];
    const redoable = [];
    for (const action of actorActions(ops, actor)) {
        if (action.kind === 'edit') {
            undoable.push(action);
            redoable.length = 0;
        }
        else if (action.kind === 'undo') {
            const popped = undoable.pop();
            if (popped)
                redoable.push(popped);
        }
        else {
            const popped = redoable.pop();
            if (popped)
                undoable.push(popped);
        }
    }
    return { undoable, redoable };
}
export function canUndo(ops, actor) {
    return undoCursor(ops, actor).undoable.length > 0;
}
export function canRedo(ops, actor) {
    return undoCursor(ops, actor).redoable.length > 0;
}
export function undoLabel(ops, actor) {
    const top = undoCursor(ops, actor).undoable.at(-1);
    return top?.ops.find((op) => op.label)?.label;
}
/**
 * Collapse a batch to one op per field, keeping the *outermost* values.
 *
 * A colour-picker drag writes the same field over and over inside one batch:
 * #111, #222 … #555. Reversing each of those in turn would replay them
 * backwards and land on #444 — one undo appearing to do almost nothing.
 * Undo has to jump to the value from before the drag started, so for each
 * field we keep the first op's `before` and the last op's `after`.
 */
function collapseBatch(ops) {
    const byField = new Map();
    for (const op of ops) {
        const key = `${op.routeKey} ${op.viewport} ${op.path} ${op.field}`;
        const seen = byField.get(key);
        if (seen)
            seen.last = op;
        else
            byField.set(key, { first: op, last: op });
    }
    return [...byField.values()];
}
function reverse(store, action, kind, actor, clock) {
    const batch = froamOpId();
    const ts = Date.now();
    return collapseBatch(action.ops)
        .map(({ first, last }) => {
        const op = kind === 'undo' ? first : last;
        // Re-read the live value instead of trusting the original op: someone
        // else may have written this field since, and an undo that restores a
        // stale `before` would silently clobber their edit.
        const before = currentValue(store, op);
        const after = kind === 'undo' ? op.before : op.after;
        if (before === after)
            return null;
        return {
            id: froamOpId(),
            kind,
            actor,
            clock,
            ts,
            routeKey: op.routeKey,
            viewport: op.viewport,
            path: op.path,
            field: op.field,
            before,
            after,
            label: op.label,
            batch,
            targets: op.id,
        };
    })
        .filter((op) => op !== null);
}
/**
 * The ops to append for this actor's undo, or an empty array if there is
 * nothing to undo. Always returns at least one op when it returns any, so the
 * cursor stays in step even if every field was already at its old value.
 */
export function buildUndo(ops, actor, clock) {
    const action = undoCursor(ops, actor).undoable.at(-1);
    if (!action)
        return [];
    const reversed = reverse(deriveStore(ops), action, 'undo', actor, clock);
    return reversed.length ? reversed : markerOnly(action, 'undo', actor, clock);
}
export function buildRedo(ops, actor, clock) {
    const action = undoCursor(ops, actor).redoable.at(-1);
    if (!action)
        return [];
    const reversed = reverse(deriveStore(ops), action, 'redo', actor, clock);
    return reversed.length ? reversed : markerOnly(action, 'redo', actor, clock);
}
/**
 * A no-value undo still has to move the cursor, otherwise Ctrl+Z appears to do
 * nothing forever on an action that was already reverted by someone else.
 */
function markerOnly(action, kind, actor, clock) {
    const source = action.ops[0];
    const value = kind === 'undo' ? source.before : source.after;
    return [
        {
            id: froamOpId(),
            kind,
            actor,
            clock,
            ts: Date.now(),
            routeKey: source.routeKey,
            viewport: source.viewport,
            path: source.path,
            field: source.field,
            before: value,
            after: value,
            label: source.label,
            batch: froamOpId(),
            targets: source.id,
        },
    ];
}
/* ─── log maintenance ─── */
/**
 * Collapse the head of a log into a baseline of edit ops, one per live field.
 *
 * The log grows forever; localStorage does not. Compacting keeps the derived
 * store identical while dropping superseded writes and spent undo pairs.
 * Everything after `keepFrom` is preserved verbatim so recent undo history
 * survives.
 */
export function compactLog(ops, keepRecent = 200) {
    const ordered = [...ops].sort(compareOps);
    if (ordered.length <= keepRecent)
        return ordered;
    const head = ordered.slice(0, ordered.length - keepRecent);
    const tail = ordered.slice(ordered.length - keepRecent);
    const baselineStore = deriveStore(head);
    const clock = head.length ? head[head.length - 1].clock : 0;
    const baseline = [];
    for (const [key, scope] of Object.entries(baselineStore)) {
        const at = key.lastIndexOf('@@');
        const routeKey = key.slice(0, at);
        const viewport = key.slice(at + 2);
        for (const [path, draft] of Object.entries(scope)) {
            const fields = [
                ['text', draft.text],
                ['imageUrl', draft.imageUrl],
                ...Object.entries(draft.styles ?? {}).map(([prop, value]) => [`style:${prop}`, value]),
            ];
            for (const [field, value] of fields) {
                if (value === undefined)
                    continue;
                baseline.push({
                    id: froamOpId(),
                    kind: 'edit',
                    actor: 'baseline',
                    clock,
                    ts: Date.now(),
                    routeKey,
                    viewport,
                    path,
                    field,
                    before: undefined,
                    after: value,
                    label: 'Baseline',
                });
            }
        }
    }
    return [...baseline, ...tail];
}
//# sourceMappingURL=oplog.js.map