/**
 * Froam Rooms — keeping the op log across reloads.
 *
 * The design store is the thing that ships; the log is how it got there. That
 * makes the log *disposable under pressure* — if storage is full, the right
 * move is to compact or drop history, never to lose the design or take the
 * editor down.
 *
 * So writing is a ladder rather than a single attempt: keep as much recent
 * history as fits, and give up gracefully rather than throw.
 */
import { compactLog } from './oplog'
import { FROAM_VIEWPORTS, type FroamOp, type FroamViewport } from './types'

export const FROAM_OPLOG_KEY = 'froam-oplog-v1'

/** Comfortably under a 5 MB origin quota, and the design store comes first. */
const MAX_OPLOG_BYTES = 900_000

/** How much recent history to try to keep, most generous first. */
const KEEP_RECENT_LADDER = [600, 250, 100, 40, 0]

type Payload = { v: 1; ops: FroamOp[] }

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null // Safari private mode and friends
  }
}

const KINDS = new Set(['edit', 'undo', 'redo'])

/**
 * A persisted op is untrusted input — it may come from an older Froam, a
 * half-written record, or a user poking at devtools. One bad op would poison
 * the derived design, so anything that doesn't look right is dropped rather
 * than repaired.
 */
function isOp(value: unknown): value is FroamOp {
  if (!value || typeof value !== 'object') return false
  const op = value as Partial<FroamOp>
  return (
    typeof op.id === 'string'
    && typeof op.actor === 'string'
    && typeof op.clock === 'number'
    && Number.isFinite(op.clock)
    && typeof op.routeKey === 'string'
    && typeof op.path === 'string'
    && typeof op.field === 'string'
    && typeof op.kind === 'string'
    && KINDS.has(op.kind)
    && FROAM_VIEWPORTS.includes(op.viewport as FroamViewport)
    && (op.before === undefined || typeof op.before === 'string')
    && (op.after === undefined || typeof op.after === 'string')
  )
}

export function loadOpLog(): FroamOp[] {
  const store = storage()
  if (!store) return []
  try {
    const raw = store.getItem(FROAM_OPLOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Payload
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.ops)) return []
    return parsed.ops.filter(isOp)
  } catch {
    return []
  }
}

export function clearOpLog() {
  try {
    storage()?.removeItem(FROAM_OPLOG_KEY)
  } catch {
    /* nothing to do */
  }
}

/**
 * Persist the log, trading history for space as needed.
 *
 * Returns the ops that actually made it to storage. The caller should adopt
 * that list, so the in-memory log gets the same compaction and doesn't grow
 * forever in a long editing session.
 */
export function saveOpLog(ops: readonly FroamOp[]): FroamOp[] {
  const store = storage()
  if (!store) return [...ops]

  for (const keepRecent of KEEP_RECENT_LADDER) {
    const candidate = keepRecent === 0 ? compactLog(ops, 0) : compactLog(ops, keepRecent)
    const serialized = JSON.stringify({ v: 1, ops: candidate } satisfies Payload)
    if (serialized.length > MAX_OPLOG_BYTES) continue
    try {
      store.setItem(FROAM_OPLOG_KEY, serialized)
      return candidate
    } catch {
      // Quota — try again with less history.
    }
  }

  // Even the baseline won't fit. Drop the log rather than leave a stale one
  // that would contradict the design on the next boot.
  clearOpLog()
  return [...ops]
}
