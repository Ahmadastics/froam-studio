/**
 * Froam Rooms — who outranks whom.
 *
 * Two people in a design are not equal peers, and pretending otherwise just
 * means the hierarchy gets discovered during an argument instead of being
 * written down. The owner of the work outranks someone they invited into it.
 *
 * The ranks are literally 60 and 40. That is the shape of the rule as it was
 * described, and keeping the numbers means the model can be read back in the
 * same words it was agreed in.
 *
 * Everything here is pure. Rooms need a server; deciding who may do what does
 * not, so it can be settled and tested before any of that exists.
 */
import type { FroamActorId, FroamOp, FroamRole } from './types'

/**
 * Weight, not a ladder position — an owner is not "one better" than an editor,
 * they carry more of the decision.
 */
export const FROAM_ROLE_RANK: Record<FroamRole, number> = {
  owner: 60,
  editor: 40,
  commenter: 10,
  viewer: 0,
}

export function outranks(a: FroamRole, b: FroamRole) {
  return FROAM_ROLE_RANK[a] > FROAM_ROLE_RANK[b]
}

export function canEdit(role: FroamRole) {
  return FROAM_ROLE_RANK[role] >= FROAM_ROLE_RANK.editor
}

export function canComment(role: FroamRole) {
  return FROAM_ROLE_RANK[role] >= FROAM_ROLE_RANK.commenter
}

/**
 * What happens when someone reaches for the undo on a change that is not
 * theirs.
 *
 * Undoing your own work is always yours to do. Undoing someone else's is the
 * owner's to enact and everyone else's to *ask* for — which is why revert was
 * built as an ordinary attributed op rather than a rewrite of history. A
 * proposal and an enactment are the same operation with different permission.
 */
export type RevertVerdict = 'allowed' | 'propose' | 'denied'

export function canRevert(input: {
  role: FroamRole
  /** Was the change being undone made by this same person? */
  ownWork: boolean
}): RevertVerdict {
  if (!canEdit(input.role)) return 'denied'
  if (input.ownWork) return 'allowed'
  return input.role === 'owner' ? 'allowed' : 'propose'
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
export function createAuthorityComparator(rankOf: (actor: FroamActorId) => number) {
  return function compare(a: FroamOp, b: FroamOp) {
    if (a.clock !== b.clock) return a.clock - b.clock
    const rankA = rankOf(a.actor)
    const rankB = rankOf(b.actor)
    // Higher rank sorts later, so it lands last and wins last-write-wins.
    if (rankA !== rankB) return rankA - rankB
    if (a.actor !== b.actor) return a.actor < b.actor ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
}

/** Rank lookup from a member list, defaulting anyone unknown to a viewer. */
export function rankLookup(members: ReadonlyArray<{ actor: FroamActorId; role: FroamRole }>) {
  const ranks = new Map(members.map((m) => [m.actor, FROAM_ROLE_RANK[m.role]]))
  return (actor: FroamActorId) => ranks.get(actor) ?? FROAM_ROLE_RANK.viewer
}
