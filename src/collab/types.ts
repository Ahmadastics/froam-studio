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

/* ═══════════════════════════════════════════════════════════════
   Layer 2 — the design
   ═══════════════════════════════════════════════════════════════ */

export type FroamViewport = 'desktop' | 'tablet' | 'mobile'

export const FROAM_VIEWPORTS: readonly FroamViewport[] = ['desktop', 'tablet', 'mobile']

/** What Froam stores about one element: a diff, never the element itself. */
export type ElementDraft = {
  text?: string
  imageUrl?: string
  styles?: Record<string, string>
}

/**
 * `${routeKey}@@${viewport}` -> DOM path -> draft.
 * Matches the on-disk shape of froam.design.json and the wire shape of the
 * publish contract, so a log can always be collapsed back to a plain design.
 */
export type EditorStore = Record<string, Record<string, ElementDraft>>

/** The one place the scope key is spelled. */
export function scopeKey(routeKey: string, viewport: FroamViewport) {
  return `${routeKey}@@${viewport}`
}

export function parseScopeKey(key: string): { routeKey: string; viewport: FroamViewport } | null {
  const at = key.lastIndexOf('@@')
  if (at < 0) return null
  const viewport = key.slice(at + 2) as FroamViewport
  if (!FROAM_VIEWPORTS.includes(viewport)) return null
  return { routeKey: key.slice(0, at), viewport }
}

/* ═══════════════════════════════════════════════════════════════
   Layer 3a — operations
   ═══════════════════════════════════════════════════════════════ */

export type FroamActorId = string

/** The local, not-yet-signed-in actor. Every op has an actor from day one. */
export const LOCAL_ACTOR: FroamActorId = 'local'

/**
 * The synthetic actor for design that was loaded rather than typed: drafts
 * restored from storage, a published design fetched at boot, the baseline a
 * compaction leaves behind.
 *
 * It exists so the log can be a complete account of the design without those
 * ops landing in a person's undo stack — nobody expects Ctrl+Z to peel away
 * work they did last week.
 */
export const BASELINE_ACTOR: FroamActorId = 'baseline'

/**
 * The addressable unit of an edit. One op changes exactly one field of one
 * element, which is what makes last-write-wins per (path, field) honest:
 * two people restyling the same element don't clobber each other unless they
 * touch the same property.
 */
export type FroamOpField = 'text' | 'imageUrl' | `style:${string}`

export type FroamOpKind = 'edit' | 'undo' | 'redo'

export type FroamOp = {
  id: string
  kind: FroamOpKind

  /** Who. Required from day one — an op log without actors can't be shared. */
  actor: FroamActorId

  /**
   * Lamport counter — the ordering authority.
   *
   * NOT wall-clock. Two devices on mobile data disagree about the time,
   * sometimes by minutes, and ordering by `ts` would mean the device with the
   * fast clock silently wins every conflict forever. Order by `clock`,
   * tiebreak on `actor` so the result is total and identical everywhere.
   */
  clock: number

  /** Wall clock. Display only — "3 minutes ago". Never used for ordering. */
  ts: number

  routeKey: string
  viewport: FroamViewport
  path: string
  field: FroamOpField

  /** `undefined` means the field was unset. Needed to invert cleanly. */
  before: string | undefined
  after: string | undefined

  /** Human label for the history panel, e.g. "Background". */
  label?: string

  /**
   * Coalescing key. Ops sharing a batch undo and redo as one step — a colour
   * picker drag is fifty ops and one undo.
   */
  batch?: string

  /** For kind 'undo' | 'redo': the id of the edit op this action acts on. */
  targets?: string

  /** Present when this field edit represents a tree mutation. */
  structure?: FroamStructuralChange
}

/** Total order across actors. Same result on every device. */
export function compareOps(a: FroamOp, b: FroamOp) {
  if (a.clock !== b.clock) return a.clock - b.clock
  if (a.actor !== b.actor) return a.actor < b.actor ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/* ═══════════════════════════════════════════════════════════════
   Layer 3b — rooms
   ═══════════════════════════════════════════════════════════════ */

/**
 * Review and Studio are the same record with a different role mix.
 * A room whose members contain exactly one `editor` is a review; two or more
 * makes it a studio. There is no `mode` field on purpose — the roles are the
 * mode, so a room can be upgraded by inviting someone.
 */
export type FroamRole = 'owner' | 'editor' | 'commenter' | 'viewer'

export const FROAM_ROLE_CAN_EDIT: Record<FroamRole, boolean> = {
  owner: true,
  editor: true,
  commenter: false,
  viewer: false,
}

export const FROAM_ROLE_CAN_COMMENT: Record<FroamRole, boolean> = {
  owner: true,
  editor: true,
  commenter: true,
  viewer: false,
}

export type FroamMember = {
  actor: FroamActorId
  email?: string | null
  name?: string | null
  role: FroamRole
  /** Stable per-actor colour for cursors, selection halos and comment pins. */
  color: string
}

export type FroamRoom = {
  id: string
  /** Which routes this room covers. `'*'` is the whole site. */
  routes: readonly string[] | '*'
  members: readonly FroamMember[]
  createdAt: number
}

/* ═══════════════════════════════════════════════════════════════
   Layer 3c — anchors
   ═══════════════════════════════════════════════════════════════ */

/**
 * A DOM path alone is a fragile anchor: restructure the page and every comment
 * and lock pointing at it dangles. The fingerprint is the fallback — enough
 * signal to re-find the element, cheap enough to store on every anchor.
 */
export type FroamAnchorFingerprint = {
  tag: string
  /** The element's own id. The strongest signal there is, when it exists. */
  id?: string
  /** First ~80 chars of trimmed text content. */
  text?: string
  /** Id of the nearest ancestor that has one — survives edits above the element. */
  anchorId?: string
  /** Path from that ancestor down, or from the root when there isn't one. */
  anchorPath?: string
  /** Index among siblings of the same tag. */
  ordinal?: number
  /** Class list at capture time, for scoring. */
  className?: string
}

export type FroamAnchor = {
  path: string
  fingerprint: FroamAnchorFingerprint
}

export type FroamAnchorResolution =
  /** Path hit — the element is exactly where it was. */
  | { status: 'exact'; element: HTMLElement; path: string }
  /** Path missed, fingerprint found it somewhere else. Rewrite the anchor. */
  | { status: 'recovered'; element: HTMLElement; path: string; score: number }
  /** Gone. Surface it in a list; never drop it silently. */
  | { status: 'orphaned' }

/* ═══════════════════════════════════════════════════════════════
   Layer 3d — comments (v5.2) and presence (v6.0)
   ═══════════════════════════════════════════════════════════════ */

export type FroamComment = {
  id: string
  threadId: string
  actor: FroamActorId
  body: string
  ts: number
}

export type FroamThread = {
  id: string
  routeKey: string
  viewport: FroamViewport
  anchor: FroamAnchor
  resolved: boolean
  comments: readonly FroamComment[]
}

/** Ephemeral. Never written to froam.design.json. */
export type FroamPresence = {
  actor: FroamActorId
  routeKey: string
  viewport: FroamViewport
  selectedPath?: string
  /** Element the actor is actively dragging — soft-locked for everyone else. */
  lockedPath?: string
  cursor?: { x: number; y: number }
  seenAt: number
}

/**
 * A durable item on the room's ordered collaboration stream.
 *
 * `seq` belongs to the room server, not a device clock. Clients use it as a
 * reconnect cursor and may therefore replay safely after going offline.
 */
export type FroamRoomEvent =
  | { seq: number; type: 'op'; createdAt: number; actor: FroamActorId; op: FroamOp }
  | { seq: number; type: 'chat'; createdAt: number; actor: FroamActorId; message: FroamChatMessage }
  | { seq: number; type: 'comment'; createdAt: number; actor: FroamActorId; commentId: string }
  | { seq: number; type: 'revision'; createdAt: number; actor: FroamActorId; revisionId: string }
  | { seq: number; type: 'proposal'; createdAt: number; actor: FroamActorId; proposal: FroamRevertProposal }
  | { seq: number; type: 'design'; createdAt: number; actor: FroamActorId; routeKey: string; viewport: FroamViewport }

/** Session talk. Unlike an anchored comment it has no design lifecycle. */
export type FroamChatMessage = {
  id: string
  actor: FroamActorId
  name: string
  body: string
  createdAt: number
}

export type FroamRevertProposal = {
  id: string
  actor: FroamActorId
  name: string
  ops: readonly FroamOp[]
  createdAt: number
  status: 'pending' | 'approved' | 'declined'
  decidedBy?: string | null
  decidedAt?: number | null
}

/**
 * Optional semantic detail for an edit that changes the document tree.
 *
 * The value still travels as an ordinary field op so old clients degrade to
 * the resulting serialised injection draft. New clients can use this metadata
 * to narrate and animate inserts, moves, deletes and wraps.
 */
export type FroamStructuralChange = {
  kind: 'insert' | 'move' | 'delete' | 'wrap'
  nodeId: string
  parentPath?: string
  index?: number
}
