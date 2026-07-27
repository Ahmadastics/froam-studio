/**
 * Froam Rooms — the collaboration schema.
 *
 * This file is the schema page from ROADMAP.md Phase 0.1, written as types
 * instead of prose so it can't drift from the code.
 *
 * Three layers, one line between them:
 *
 *   1. The page      — the host's website. Froam never owns or syncs it.
 *   2. The design    — EditorStore: a thin per-element diff. Syncs. Kilobytes.
 *   3. Collaboration — ops, rooms, comments, presence. Syncs. Tiny.
 *
 * Everything below is layer 2 and 3. Layer 1 has no types here on purpose.
 */
export const FROAM_VIEWPORTS = ['desktop', 'tablet', 'mobile'];
/** The one place the scope key is spelled. */
export function scopeKey(routeKey, viewport) {
    return `${routeKey}@@${viewport}`;
}
export function parseScopeKey(key) {
    const at = key.lastIndexOf('@@');
    if (at < 0)
        return null;
    const viewport = key.slice(at + 2);
    if (!FROAM_VIEWPORTS.includes(viewport))
        return null;
    return { routeKey: key.slice(0, at), viewport };
}
/** The local, not-yet-signed-in actor. Every op has an actor from day one. */
export const LOCAL_ACTOR = 'local';
/** Total order across actors. Same result on every device. */
export function compareOps(a, b) {
    if (a.clock !== b.clock)
        return a.clock - b.clock;
    if (a.actor !== b.actor)
        return a.actor < b.actor ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
export const FROAM_ROLE_CAN_EDIT = {
    owner: true,
    editor: true,
    commenter: false,
    viewer: false,
};
export const FROAM_ROLE_CAN_COMMENT = {
    owner: true,
    editor: true,
    commenter: true,
    viewer: false,
};
//# sourceMappingURL=types.js.map