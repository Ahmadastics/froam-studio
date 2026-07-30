/**
 * Weight, not a ladder position — an owner is not "one better" than an editor,
 * they carry more of the decision.
 */
export const FROAM_ROLE_RANK = {
    owner: 60,
    editor: 40,
    commenter: 10,
    viewer: 0,
};
export function outranks(a, b) {
    return FROAM_ROLE_RANK[a] > FROAM_ROLE_RANK[b];
}
export function canEdit(role) {
    return FROAM_ROLE_RANK[role] >= FROAM_ROLE_RANK.editor;
}
export function canComment(role) {
    return FROAM_ROLE_RANK[role] >= FROAM_ROLE_RANK.commenter;
}
export function canRevert(input) {
    if (!canEdit(input.role))
        return 'denied';
    if (input.ownWork)
        return 'allowed';
    return input.role === 'owner' ? 'allowed' : 'propose';
}
/* ─── ordering ─── */
/**
 * A comparator that settles genuine conflicts in the owner's favour.
 *
 * Ordering is still the Lamport clock first — an edit that demonstrably came
 * after another still wins, whoever made it, because that is not a conflict,
 * it is a sequence. Rank only decides a *tie*: two ops at the same clock
 * neither of which saw the other. That is the only case where "concurrent"
 * is real, and the only case the 60/40 rule should touch.
 *
 * Getting this backwards — letting rank beat the clock outright — would mean a
 * guest could never change anything the owner had ever touched, which is not
 * seniority, it is a read-only account with extra steps.
 */
export function createAuthorityComparator(rankOf) {
    return function compare(a, b) {
        if (a.clock !== b.clock)
            return a.clock - b.clock;
        const rankA = rankOf(a.actor);
        const rankB = rankOf(b.actor);
        // Higher rank sorts later, so it lands last and wins last-write-wins.
        if (rankA !== rankB)
            return rankA - rankB;
        if (a.actor !== b.actor)
            return a.actor < b.actor ? -1 : 1;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    };
}
/** Rank lookup from a member list, defaulting anyone unknown to a viewer. */
export function rankLookup(members) {
    const ranks = new Map(members.map((m) => [m.actor, FROAM_ROLE_RANK[m.role]]));
    return (actor) => ranks.get(actor) ?? FROAM_ROLE_RANK.viewer;
}
//# sourceMappingURL=authority.js.map