/**
 * Froam Rooms — the client half.
 *
 * The server half decides who may do what; this is the part that lives in a
 * page: read the invite out of the URL, become somebody, say you are still
 * here, and know who else is.
 *
 * No ops and no editing yet — that is v5.1. What this establishes is identity
 * and presence, which is what a review session needs before it can decide
 * whether the client follows the designer or just browses the design.
 *
 * Transport and storage are injected so the whole thing can be tested without
 * a browser; the defaults are the ones a page actually wants.
 */
import type { FroamRole, FroamViewport } from './types'

export type RoomMemberView = {
  actor: string
  name: string
  role: FroamRole
  here: boolean
  routeKey: string | null
  viewport: FroamViewport | null
  selectedPath: string | null
  seenAt: number | null
}

export type RoomView = {
  id: string
  routes: readonly string[] | '*'
  createdAt: number
  members: RoomMemberView[]
  presenter: string | null
  you: { actor: string; role: FroamRole; name: string } | null
}

export type RoomIdentity = { actor: string; name: string; role: FroamRole }

export type RoomComment = {
  id: string
  actor: string
  name: string
  routeKey: string
  viewport: FroamViewport
  anchor: { path: string; fingerprint: { tag: string; text?: string; id?: string } }
  quoted: string | null
  body: string
  createdAt: number
  resolved: boolean
  resolvedBy?: string | null
  replies: Array<{ id: string; actor: string; name: string; body: string; createdAt: number }>
}

export type RoomRevision = {
  id: string
  routeKey: string
  viewport: FroamViewport
  store: Record<string, unknown>
  note: string | null
  createdAt: number
  createdBy: string
  status: 'sent' | 'approved' | 'changes-requested'
  decidedBy: string | null
  decidedAt: number | null
  decisionNote: string | null
}

export type RoomTransport = {
  get: (path: string) => Promise<unknown>
  post: (path: string, body: unknown) => Promise<unknown>
}

export type RoomStorage = {
  read: (key: string) => string | null
  write: (key: string, value: string) => void
}

/** Heartbeat well inside the server's 45s window, so one dropped beat is survivable. */
export const ROOM_BEAT_MS = 15_000

/* ─── the invite in the URL ─── */

export const ROOM_PARAM = 'froam-room'
export const TOKEN_PARAM = 'froam-token'

/**
 * An invite is a link, so the link is where the room comes from.
 *
 * The token is a bearer credential sitting in a URL — which is the deliberate
 * trade that makes "tap this and you're in" possible at all. It is scoped to
 * one room and revocable by deleting it, and it is why nothing sensitive
 * beyond that design should ever live behind one.
 */
export function readRoomFromLocation(href?: string): { roomId: string; token: string } | null {
  try {
    const url = new URL(href ?? (typeof window === 'undefined' ? '' : window.location.href))
    const roomId = url.searchParams.get(ROOM_PARAM)
    const token = url.searchParams.get(TOKEN_PARAM)
    return roomId && token ? { roomId, token } : null
  } catch {
    return null
  }
}

/* ─── defaults ─── */

function browserStorage(): RoomStorage {
  return {
    read(key) {
      try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key) } catch { return null }
    },
    write(key, value) {
      try { if (typeof window !== 'undefined') window.localStorage.setItem(key, value) } catch { /* private mode */ }
    },
  }
}

/* ─── the client ─── */

export function createRoomClient(options: {
  roomId: string
  token: string
  transport: RoomTransport
  storage?: RoomStorage
  /** Defaults to document.hidden — a background tab should stop counting as present. */
  isHidden?: () => boolean
  now?: () => number
}) {
  const { roomId, token, transport } = options
  const storage = options.storage ?? browserStorage()
  const isHidden = options.isHidden ?? (() => typeof document !== 'undefined' && document.hidden)

  const key = `froam-room:${roomId}`
  let identity: RoomIdentity | null = readIdentity()
  let room: RoomView | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<(room: RoomView | null) => void>()

  function readIdentity(): RoomIdentity | null {
    const raw = storage.read(key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as RoomIdentity
      return parsed?.actor && parsed?.name ? parsed : null
    } catch {
      return null
    }
  }

  function remember(next: RoomIdentity) {
    identity = next
    storage.write(key, JSON.stringify(next))
  }

  function announce() {
    for (const listener of listeners) listener(room)
  }

  function adopt(payload: unknown) {
    const next = (payload as { room?: RoomView } | null)?.room
    if (next && Array.isArray(next.members)) {
      room = next
      announce()
    }
    return room
  }

  return {
    get roomId() { return roomId },
    get identity() { return identity },
    get room() { return room },

    /** Have we already been someone in this room? Decides whether to ask for a name. */
    get joined() { return identity !== null },

    on(listener: (room: RoomView | null) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /**
     * Become somebody. Reuses the actor from a previous visit when there is
     * one, so a refresh keeps your comments yours instead of minting a
     * stranger who happens to have the same name.
     */
    async join(name: string) {
      const payload = await transport.post(`/api/froam/rooms/${roomId}/join`, {
        token,
        name,
        actor: identity?.actor,
      }) as { you?: RoomIdentity }
      if (!payload?.you?.actor) throw new Error('Could not join the room')
      remember(payload.you)
      adopt(payload)
      return payload.you
    },

    /** Read the room without changing anything. */
    async refresh() {
      const query = identity ? `&actor=${encodeURIComponent(identity.actor)}` : ''
      return adopt(await transport.get(`/api/froam/rooms/${roomId}?token=${encodeURIComponent(token)}${query}`))
    },

    /**
     * Say you are still here, and where.
     *
     * Skipped while the tab is hidden — presence should mean "someone is
     * looking", and a heartbeat from a buried tab would keep a phone following
     * a laptop nobody is sitting at.
     */
    async beat(where: { routeKey?: string; viewport?: FroamViewport; selectedPath?: string | null } = {}) {
      if (!identity || isHidden()) return room
      try {
        return adopt(await transport.post(`/api/froam/rooms/${roomId}/presence`, {
          token,
          actor: identity.actor,
          ...where,
        }))
      } catch {
        // A dropped beat is not an error worth surfacing; the next one carries
        // the same information and presence lapses on its own if it doesn't.
        return room
      }
    },

    start(where: () => { routeKey?: string; viewport?: FroamViewport; selectedPath?: string | null }, everyMs = ROOM_BEAT_MS) {
      this.stop()
      void this.beat(where())
      timer = setInterval(() => { void this.beat(where()) }, everyMs)
      return () => this.stop()
    },

    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },

    /* ─── derived ─── */

    /** Everyone but you. */
    others() {
      if (!room) return []
      return room.members.filter((m) => m.actor !== identity?.actor)
    },

    /** Everyone but you, who is actually here. */
    present() {
      return this.others().filter((m) => m.here)
    },

    presenter() {
      if (!room?.presenter) return null
      return room.members.find((m) => m.actor === room?.presenter) ?? null
    },

    /** Is someone else driving? The question v5.1's follow mode turns on. */
    someoneElseIsPresenting() {
      const driver = this.presenter()
      return Boolean(driver && driver.actor !== identity?.actor)
    },

    role(): FroamRole | null {
      return identity?.role ?? null
    },

    /* ─── notes ─── */

    async comments(routeKey: string) {
      const params = new URLSearchParams({ token, routeKey })
      if (identity) params.set('actor', identity.actor)
      const payload = await transport.get(`/api/froam/rooms/${roomId}/comments?${params}`) as { comments?: RoomComment[] }
      return payload?.comments ?? []
    },

    async comment(input: {
      routeKey: string
      viewport: FroamViewport
      anchor: { path: string; fingerprint: unknown }
      quoted?: string | null
      body: string
    }) {
      if (!identity) throw new Error('Join the room first')
      const payload = await transport.post(`/api/froam/rooms/${roomId}/comments`, {
        token, actor: identity.actor, ...input,
      }) as { comment?: RoomComment }
      return payload?.comment ?? null
    },

    /* ─── revisions ─── */

    async revisions(routeKey: string) {
      const params = new URLSearchParams({ token, routeKey })
      if (identity) params.set('actor', identity.actor)
      const payload = await transport.get(`/api/froam/rooms/${roomId}/revisions?${params}`) as { revisions?: RoomRevision[] }
      return payload?.revisions ?? []
    },

    async sendRevision(input: { routeKey: string; viewport: FroamViewport; store: unknown; note?: string }) {
      if (!identity) throw new Error('Join the room first')
      const payload = await transport.post(`/api/froam/rooms/${roomId}/revisions`, {
        token, actor: identity.actor, ...input,
      }) as { revision?: RoomRevision }
      return payload?.revision ?? null
    },

    async decide(revisionId: string, decision: 'approved' | 'changes-requested', note?: string) {
      if (!identity) throw new Error('Join the room first')
      const payload = await transport.post(`/api/froam/rooms/${roomId}/revisions/${revisionId}/decision`, {
        token, actor: identity.actor, decision, note,
      }) as { revision?: RoomRevision }
      return payload?.revision ?? null
    },

    async resolveComment(commentId: string, resolved = true) {
      if (!identity) throw new Error('Join the room first')
      const payload = await transport.post(`/api/froam/rooms/${roomId}/comments/${commentId}/resolve`, {
        token, actor: identity.actor, resolved,
      }) as { comment?: RoomComment }
      return payload?.comment ?? null
    },
  }
}

export type RoomClient = ReturnType<typeof createRoomClient>
