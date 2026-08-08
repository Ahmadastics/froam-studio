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
import type {
  FroamChatMessage,
  FroamOp,
  FroamRevertProposal,
  FroamRole,
  FroamRoomEvent,
  FroamViewport,
} from './types'

export type RoomMemberView = {
  actor: string
  name: string
  role: FroamRole
  color: string
  avatarUrl: string | null
  here: boolean
  routeKey: string | null
  viewport: FroamViewport | null
  selectedPath: string | null
  selectedNodeId: string | null
  lockedPath: string | null
  lockedNodeId: string | null
  cursor: { x: number; y: number } | null
  tool: string | null
  action: string | null
  seenAt: number | null
}

export type RoomView = {
  id: string
  routes: readonly string[] | '*'
  createdAt: number
  members: RoomMemberView[]
  presenter: string | null
  sequence: number
  you: { actor: string; role: FroamRole; name: string } | null
}

export type RoomIdentity = { actor: string; name: string; role: FroamRole; session: string }

export type RoomComment = {
  id: string
  actor: string
  name: string
  routeKey: string
  viewport: FroamViewport
  anchor: { nodeId?: string; path: string; fingerprint: { tag: string; text?: string; id?: string } }
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
  /** Optional push wake-up. The event log is still read through `get`. */
  subscribe?: (path: string, wake: () => void) => () => void
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

/* ─── the room you own ─── */

const OWNED_KEY = 'froam-room-owner:v1'

export type OwnedRoom = {
  roomId: string
  /** One token per role. The commenter one is what you send a client. */
  invites: Record<FroamRole, string>
  createdAt: number
}

/**
 * The designer should not have to paste their own invite into their own
 * browser. They made the room, so the browser remembers it and they are simply
 * in it — the link exists to be given away, not to be kept.
 */
export function readOwnedRoom(): OwnedRoom | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(OWNED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OwnedRoom
    return parsed?.roomId && parsed?.invites?.commenter ? parsed : null
  } catch {
    return null
  }
}

export function rememberOwnedRoom(room: OwnedRoom) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(OWNED_KEY, JSON.stringify(room))
  } catch { /* private mode */ }
}

export function rememberRoomIdentity(roomId: string, identity: RoomIdentity) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(`froam-room:${roomId}`, JSON.stringify(identity))
  } catch { /* private mode */ }
}

export function forgetOwnedRoom() {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(OWNED_KEY)
  } catch { /* nothing to do */ }
}

/** The link you actually send someone, for a given role and page. */
export function inviteLink(room: OwnedRoom, role: FroamRole = 'commenter', href?: string) {
  const url = new URL(href ?? (typeof window === 'undefined' ? 'http://localhost/' : window.location.href))
  url.searchParams.set(ROOM_PARAM, room.roomId)
  url.searchParams.set(TOKEN_PARAM, room.invites[role])
  return url.toString()
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
  let liveTimer: ReturnType<typeof setInterval> | null = null
  let liveUnsubscribe: (() => void) | null = null
  let cursor = 0
  let polling = false
  const listeners = new Set<(room: RoomView | null) => void>()
  const eventListeners = new Set<(events: readonly FroamRoomEvent[]) => void>()

  function readIdentity(): RoomIdentity | null {
    const raw = storage.read(key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as RoomIdentity
      return parsed?.actor && parsed?.name && parsed?.session ? parsed : null
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

  function announceEvents(events: readonly FroamRoomEvent[]) {
    if (!events.length) return
    for (const listener of eventListeners) listener(events)
    if (typeof window !== 'undefined') {
      for (const event of events) {
        if (event.type === 'design') window.dispatchEvent(new CustomEvent('froam:design-published', { detail: event }))
      }
    }
  }

  function identityQuery() {
    if (!identity) return ''
    return `&actor=${encodeURIComponent(identity.actor)}&session=${encodeURIComponent(identity.session)}`
  }

  function credentials() {
    if (!identity) throw new Error('Join the room first')
    return { actor: identity.actor, session: identity.session }
  }

  async function post(path: string, body: unknown) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await transport.post(path, body)
      } catch (error) {
        if (Number((error as { status?: number })?.status) !== 409 || attempt === 2) throw error
        await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)))
      }
    }
    throw new Error('Could not update the room')
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
    get cursor() { return cursor },

    /** Have we already been someone in this room? Decides whether to ask for a name. */
    get joined() { return identity !== null },

    on(listener: (room: RoomView | null) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    onEvents(listener: (events: readonly FroamRoomEvent[]) => void) {
      eventListeners.add(listener)
      return () => eventListeners.delete(listener)
    },

    /**
     * Become somebody. Reuses the actor from a previous visit when there is
     * one, so a refresh keeps your comments yours instead of minting a
     * stranger who happens to have the same name.
     */
    async join(name: string, profile: { avatarUrl?: string | null } = {}) {
      const payload = await post(`/api/froam/rooms/${roomId}/join`, {
        token,
        name,
        actor: identity?.actor,
        session: identity?.session,
        avatarUrl: profile.avatarUrl,
      }) as { you?: RoomIdentity }
      if (!payload?.you?.actor) throw new Error('Could not join the room')
      remember(payload.you)
      adopt(payload)
      return payload.you
    },

    /** Read the room without changing anything. */
    async refresh() {
      return adopt(await transport.get(`/api/froam/rooms/${roomId}?token=${encodeURIComponent(token)}${identityQuery()}`))
    },

    /**
     * Say you are still here, and where.
     *
     * Skipped while the tab is hidden — presence should mean "someone is
     * looking", and a heartbeat from a buried tab would keep a phone following
     * a laptop nobody is sitting at.
     */
    async beat(where: {
      routeKey?: string
      viewport?: FroamViewport
      selectedPath?: string | null
      selectedNodeId?: string | null
      lockedPath?: string | null
      lockedNodeId?: string | null
      cursor?: { x: number; y: number } | null
      tool?: string | null
      action?: string | null
    } = {}) {
      if (!identity || isHidden()) return room
      try {
        return adopt(await post(`/api/froam/rooms/${roomId}/presence`, {
          token,
          ...credentials(),
          ...where,
        }))
      } catch {
        // A dropped beat is not an error worth surfacing; the next one carries
        // the same information and presence lapses on its own if it doesn't.
        return room
      }
    },

    start(where: () => { routeKey?: string; viewport?: FroamViewport; selectedPath?: string | null; selectedNodeId?: string | null; lockedPath?: string | null; lockedNodeId?: string | null; cursor?: { x: number; y: number } | null; tool?: string | null; action?: string | null }, everyMs = ROOM_BEAT_MS) {
      this.stop()
      void this.beat(where())
      timer = setInterval(() => { void this.beat(where()) }, everyMs)
      return () => this.stop()
    },

    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },

    async pollEvents() {
      if (polling) return []
      polling = true
      try {
        const payload = await transport.get(`/api/froam/rooms/${roomId}/events?token=${encodeURIComponent(token)}&after=${cursor}${identityQuery()}`) as {
          events?: FroamRoomEvent[]
          cursor?: number
          hasMore?: boolean
          room?: RoomView
        }
        adopt(payload)
        const events = Array.isArray(payload.events) ? payload.events : []
        if (Number.isFinite(payload.cursor)) cursor = Math.max(cursor, Number(payload.cursor))
        announceEvents(events)
        if (payload.hasMore) queueMicrotask(() => { void this.pollEvents() })
        return events
      } finally {
        polling = false
      }
    },

    startLive(everyMs = 4_000) {
      this.stopLive()
      void this.pollEvents()
      if (transport.subscribe) {
        const path = `/api/froam/rooms/${roomId}/stream?token=${encodeURIComponent(token)}${identityQuery()}`
        liveUnsubscribe = transport.subscribe(path, () => { if (!isHidden()) void this.pollEvents() })
      }
      liveTimer = setInterval(() => { if (!isHidden()) void this.pollEvents() }, everyMs)
      return () => this.stopLive()
    },

    stopLive() {
      if (liveTimer) clearInterval(liveTimer)
      liveTimer = null
      liveUnsubscribe?.()
      liveUnsubscribe = null
    },

    async pushOps(ops: readonly FroamOp[]) {
      const pending = ops.filter((op) => op.actor === identity?.actor)
      if (!pending.length) return { accepted: [] as FroamOp[], rejected: [] as Array<{ id: string | null; reason: string }> }
      const payload = await post(`/api/froam/rooms/${roomId}/ops`, {
        token, ...credentials(), baseSeq: cursor, ops: pending,
      }) as { accepted?: FroamOp[]; rejected?: Array<{ id: string | null; reason: string }>; cursor?: number; room?: RoomView }
      adopt(payload)
      return { accepted: payload.accepted ?? [], rejected: payload.rejected ?? [] }
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
      if (identity) {
        params.set('actor', identity.actor)
        params.set('session', identity.session)
      }
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
      const payload = await post(`/api/froam/rooms/${roomId}/comments`, {
        token, ...credentials(), ...input,
      }) as { comment?: RoomComment }
      return payload?.comment ?? null
    },

    /* ─── revisions ─── */

    async revisions(routeKey: string) {
      const params = new URLSearchParams({ token, routeKey })
      if (identity) {
        params.set('actor', identity.actor)
        params.set('session', identity.session)
      }
      const payload = await transport.get(`/api/froam/rooms/${roomId}/revisions?${params}`) as { revisions?: RoomRevision[] }
      return payload?.revisions ?? []
    },

    async sendRevision(input: { routeKey: string; viewport: FroamViewport; store: unknown; note?: string }) {
      if (!identity) throw new Error('Join the room first')
      const payload = await post(`/api/froam/rooms/${roomId}/revisions`, {
        token, ...credentials(), ...input,
      }) as { revision?: RoomRevision }
      return payload?.revision ?? null
    },

    async decide(revisionId: string, decision: 'approved' | 'changes-requested', note?: string) {
      if (!identity) throw new Error('Join the room first')
      const payload = await post(`/api/froam/rooms/${roomId}/revisions/${revisionId}/decision`, {
        token, ...credentials(), decision, note,
      }) as { revision?: RoomRevision }
      return payload?.revision ?? null
    },

    async resolveComment(commentId: string, resolved = true) {
      if (!identity) throw new Error('Join the room first')
      const payload = await post(`/api/froam/rooms/${roomId}/comments/${commentId}/resolve`, {
        token, ...credentials(), resolved,
      }) as { comment?: RoomComment }
      return payload?.comment ?? null
    },

    async chat() {
      if (!identity) return []
      const params = new URLSearchParams({ token, actor: identity.actor, session: identity.session })
      const payload = await transport.get(`/api/froam/rooms/${roomId}/chat?${params}`) as { messages?: FroamChatMessage[] }
      return payload.messages ?? []
    },

    async sendChat(body: string) {
      const payload = await post(`/api/froam/rooms/${roomId}/chat`, {
        token, ...credentials(), body,
      }) as { message?: FroamChatMessage }
      return payload.message ?? null
    },

    async signalDesign(routeKey: string, viewport: FroamViewport) {
      await post(`/api/froam/rooms/${roomId}/signal`, {
        token, ...credentials(), routeKey, viewport,
      })
    },

    async proposals() {
      if (!identity) return []
      const params = new URLSearchParams({ token, actor: identity.actor, session: identity.session })
      const payload = await transport.get(`/api/froam/rooms/${roomId}/proposals?${params}`) as { proposals?: FroamRevertProposal[] }
      return payload.proposals ?? []
    },

    async decideProposal(proposalId: string, decision: 'approved' | 'declined') {
      const payload = await post(`/api/froam/rooms/${roomId}/proposals/${proposalId}/decision`, {
        token, ...credentials(), decision,
      }) as { proposal?: FroamRevertProposal; accepted?: FroamOp[]; cursor?: number }
      return payload
    },
  }
}

export type RoomClient = ReturnType<typeof createRoomClient>
