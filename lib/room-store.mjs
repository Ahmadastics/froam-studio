/**
 * Froam Studio — the room store.
 *
 * A room is who is allowed in a design and what they may do. Publishing needed
 * a place to put a design; a session needs a place to put people.
 *
 * Same shape as the publish path deliberately: a small HTTP contract, a
 * file-backed implementation `froam dev` mounts for free, and nothing stopping
 * a host from implementing the same four endpoints against a real database.
 * Froam still owns no accounts and runs no service.
 *
 *   POST /api/froam/rooms                  create a room        (authorized)
 *   GET  /api/froam/rooms/:id?token=…      the room, as you see it
 *   POST /api/froam/rooms/:id/join         { token, name } → become someone
 *   POST /api/froam/rooms/:id/presence     { token, actor, routeKey, … }
 *   POST /api/froam/rooms/:id/requests     a contributor submits changes for approval
 *   POST /api/froam/rooms/:id/requests/:rid/decision   the owner approves (publishes) or sends back
 *
 * The link is the credential. An invite token carries a role, so a client can
 * be let in without an account, a password, or an email — which is the whole
 * reason a client will actually open it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { normalizeRouteKey, VIEWPORTS } from './codegen.mjs'

const ROLES = new Set(['owner', 'editor', 'contributor', 'commenter', 'viewer'])
/**
 * Mirrors src/collab/authority.ts — the 60/40 ranks, server side.
 *
 * A contributor edits in their own browser and submits the result; nothing
 * they do reaches the shared design until the owner approves it. That is the
 * role a marketer, a copywriter or a client with changes of their own gets.
 */
const ROLE_RANK = { owner: 60, editor: 40, contributor: 20, commenter: 10, viewer: 0 }
const INVITE_ROLES = ['owner', 'editor', 'contributor', 'commenter', 'viewer']
const MAX_REQUESTS = 300
const MAX_REQUEST_PATHS = 400
const MAX_REQUEST_CHANGES = 200
const MAX_CHANGE_TEXT = 400
const MAX_TITLE_LENGTH = 120
const MAX_COMMENT_LENGTH = 4_000
const MAX_COMMENTS = 500
const MAX_BODY_BYTES = 200_000
const MAX_NAME_LENGTH = 60
const MAX_PROFILE_TITLE_LENGTH = 40
const MAX_PRESENCE_LABEL_LENGTH = 80
const MAX_AVATAR_LENGTH = 120_000
const MAX_MEMBERS = 50
const MAX_CHAT_MESSAGES = 500
const MAX_CHAT_LENGTH = 2_000
const MAX_OPS_PER_PUSH = 500
const MAX_ROOM_EVENTS = 20_000
const MAX_EVENT_PAGE = 500
const MAX_REQUEST_SCOPES = 24
const MAX_MENTIONS = 20
const MEMBER_COLORS = ['#5eead4', '#ff8a65', '#93c5fd', '#c4b5fd', '#f9a8d4', '#fde047', '#86efac', '#67e8f9']

/**
 * How long someone counts as "here" after their last heartbeat.
 *
 * Presence decides whether a review link follows the designer or just shows
 * the design, so this is a product decision as much as a technical one: long
 * enough to survive a tunnel or a lock screen, short enough that a closed
 * laptop stops driving someone else's phone.
 *
 * The floor is set by the browser, not by taste. Chrome throttles timers in an
 * unfocused tab to roughly one a minute, so anything at or under 60s drops a
 * presenter out of the room while their page is sitting open behind another
 * window — found exactly that way. 90s clears the throttle with room to spare
 * and still notices a genuinely closed laptop inside two minutes.
 */
const PRESENCE_TTL_MS = 90_000

function emptyRooms() {
  return { version: 1, rooms: {} }
}

function loadRooms(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.rooms && typeof parsed.rooms === 'object') {
      return parsed
    }
  } catch {
    /* fall through to empty */
  }
  return emptyRooms()
}

function saveRooms(file, rooms) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(rooms, null, 2) + '\n')
}

/**
 * Storage, as two functions.
 *
 * The rules about who may do what are the valuable part and there should only
 * ever be one copy of them, so the thing that varies is where a room is kept —
 * a JSON file next to the design under `froam dev`, a Postgres row on a host
 * that has one. Two implementations of the authorization would drift, and the
 * copy that drifted would be the one holding somebody's client work.
 *
 * Per room rather than per document: two rooms are never in each other's way,
 * and the read-modify-write window is one room wide instead of all of them.
 *
 * @typedef {{
 *   get: (roomId: string) => Promise<object|null> | object|null,
 *   put: (room: object) => Promise<void> | void,
 * }} FroamRoomStorage
 */
function fileStorage(file) {
  return {
    get(roomId) {
      return loadRooms(file).rooms[roomId] ?? null
    },
    put(room) {
      const all = loadRooms(file)
      all.rooms[room.id] = room
      saveRooms(file, all)
    },
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) reject(new Error('Payload too large'))
    })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

/** Opaque and unguessable. Not a JWT — no secret to manage, and revoking is a delete. */
function mintToken() {
  return randomBytes(18).toString('base64url')
}

function cleanName(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
  return trimmed || null
}

/** What someone does, as they put it: "Marketing", "Founder". Shown beside their name. */
function cleanTitle(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, MAX_PROFILE_TITLE_LENGTH)
  return trimmed || null
}

/** A person's own colour, from their profile. Only plain hex: it lands in style attributes. */
function cleanColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : null
}

/** The profile fields a person may set about themselves, on create and on join. */
function profileFrom(body, previous = {}) {
  return {
    avatarUrl: cleanAvatarUrl(body?.avatarUrl) ?? (body?.avatarUrl === null ? null : previous.avatarUrl ?? null),
    title: body && 'title' in body ? cleanTitle(body.title) : previous.title ?? null,
    color: cleanColor(body?.color) ?? previous.color ?? null,
  }
}

function cleanCursor(value) {
  if (!value || typeof value !== 'object') return null
  const x = Number(value.x)
  const y = Number(value.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x: Math.max(-10_000, Math.min(100_000, x)), y: Math.max(-10_000, Math.min(100_000, y)) }
}

function cleanNodeId(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trimmed) ? trimmed : null
}

function cleanPresenceLabel(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, MAX_PRESENCE_LABEL_LENGTH)
  return trimmed || null
}

function cleanAvatarUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_AVATAR_LENGTH) return null
  const trimmed = value.trim()
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed.slice(0, 2_000)
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) return trimmed
  return null
}

function colorForActor(actor) {
  let hash = 0
  for (let i = 0; i < actor.length; i += 1) hash = ((hash << 5) - hash + actor.charCodeAt(i)) | 0
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length]
}

function nextSequence(room) {
  room.sequence = Math.max(Number(room.sequence) || 0, ...((room.events ?? []).map((event) => Number(event.seq) || 0))) + 1
  return room.sequence
}

function appendEvent(room, event) {
  room.events = Array.isArray(room.events) ? room.events : []
  const complete = { seq: nextSequence(room), createdAt: Date.now(), ...event }
  room.events.push(complete)
  trimEvents(room)
  return complete
}

function trimEvents(room) {
  // Operation events are the durable collaboration log. A reconnecting member
  // must always be able to rebuild the design, so only discard transient
  // notification events when the room reaches its soft event ceiling.
  while (room.events.length > MAX_ROOM_EVENTS) {
    const transient = room.events.findIndex((event) => event.type !== 'op')
    if (transient < 0) break
    room.events.splice(transient, 1)
  }
}

function appendOpEvent(room, raw, actor, stamp) {
  room.events = Array.isArray(room.events) ? room.events : []
  const seq = nextSequence(room)
  const op = canonicalOp(raw, actor, seq, stamp)
  const event = { seq, type: 'op', createdAt: stamp, actor, op }
  room.events.push(event)
  trimEvents(room)
  return event
}

function isSafeOp(value, actor) {
  if (!value || typeof value !== 'object') return false
  if (value.actor !== actor || typeof value.id !== 'string' || !value.id || value.id.length > 160) return false
  if (!['edit', 'undo', 'redo'].includes(value.kind)) return false
  if (typeof value.routeKey !== 'string' || typeof value.path !== 'string' || !value.path || value.path.length > 2_000) return false
  if (!VIEWPORTS.includes(value.viewport)) return false
  if (typeof value.field !== 'string' || !/^(text|imageUrl|media|style:[A-Za-z0-9_-]{1,100})$/.test(value.field)) return false
  if (value.before !== undefined && typeof value.before !== 'string') return false
  if (value.after !== undefined && typeof value.after !== 'string') return false
  if ((value.before?.length ?? 0) > 2_000_000 || (value.after?.length ?? 0) > 2_000_000) return false
  return true
}

function canonicalOp(value, actor, clock, stamp) {
  return {
    id: value.id,
    kind: value.kind,
    actor,
    clock,
    ts: Number.isFinite(value.ts) ? value.ts : stamp,
    routeKey: normalizeRouteKey(value.routeKey),
    viewport: value.viewport,
    path: value.path,
    nodeId: cleanNodeId(value.nodeId) ?? undefined,
    field: value.field,
    before: value.before,
    after: value.after,
    label: typeof value.label === 'string' ? value.label.slice(0, 120) : undefined,
    batch: typeof value.batch === 'string' ? value.batch.slice(0, 160) : undefined,
    targets: typeof value.targets === 'string' ? value.targets.slice(0, 160) : undefined,
    structure: value.structure && typeof value.structure === 'object' ? value.structure : undefined,
  }
}

function sameField(a, b) {
  return a.routeKey === b.routeKey && a.viewport === b.viewport && a.path === b.path && a.field === b.field
}

function memberFor(room, actor, session) {
  if (typeof actor !== 'string' || typeof session !== 'string') return null
  const member = room.members[actor]
  return member?.session === session ? member : null
}

function routeAllowed(room, routeKey) {
  const normalized = normalizeRouteKey(routeKey ?? '/')
  return room.routes === '*' || room.routes.includes(normalized)
}

function isHere(member, now) {
  return typeof member.seenAt === 'number' && now - member.seenAt < PRESENCE_TTL_MS
}

/**
 * What a member looks like to someone else in the room.
 *
 * Never the tokens. A commenter holding a view link must not be able to read
 * the owner's token out of a members list and promote themselves.
 */
function publicMember(member, now) {
  return {
    actor: member.actor,
    name: member.name,
    role: member.role,
    color: member.color ?? colorForActor(member.actor),
    avatarUrl: member.avatarUrl ?? null,
    title: member.title ?? null,
    joinedAt: member.joinedAt ?? null,
    here: isHere(member, now),
    routeKey: member.routeKey ?? null,
    viewport: member.viewport ?? null,
    selectedPath: member.selectedPath ?? null,
    selectedNodeId: member.selectedNodeId ?? null,
    lockedPath: member.lockedPath ?? null,
    lockedNodeId: member.lockedNodeId ?? null,
    cursor: member.cursor ?? null,
    tool: member.tool ?? null,
    action: member.action ?? null,
    seenAt: member.seenAt ?? null,
  }
}

function publicRoom(room, now, you) {
  const members = Object.values(room.members).map((m) => publicMember(m, now))
  return {
    id: room.id,
    routes: room.routes,
    createdAt: room.createdAt,
    members,
    /** Who is driving: the highest-ranked editor currently present. */
    presenter: members.find((m) => m.here && (m.role === 'owner' || m.role === 'editor'))?.actor ?? null,
    sequence: Number(room.sequence) || 0,
    /** When a host keeps rooms for a limited time (the public demo does). */
    expiresAt: Number(room.expiresAt) || null,
    you: you ?? null,
  }
}

/**
 * @param {{
 *   file?: string,
 *   storage?: FroamRoomStorage,
 *   authorize?: (req: import('node:http').IncomingMessage) => boolean | Promise<boolean>,
 *   log?: (line: string) => void,
 *   now?: () => number,
 * }} options — pass `file` for the built-in JSON storage, or `storage` for
 *   anything else (see runam's Prisma-backed adapter for a full example).
 */
/**
 * @param onApproveRequest  called when the owner approves a change request —
 *   the host's "make it live": `froam dev` writes the design files (as Save to
 *   Repo does); a hosted setup might store the publish and commit to GitHub.
 *   Resolves to `{ detail }` for the record; throwing leaves it pending.
 */
/**
 * @param onRevertRequest  called when the owner takes an approved request back,
 *   with the `undo` the approval returned. Resolves to `{ detail, link? }`.
 * @param notify  told about what people may want to hear about away from the
 *   editor — a request submitted or decided, a message that mentions someone.
 *   Failures are logged and never fail the request (see lib/notifier.mjs).
 * @param roomTtlMs  rooms end this long after they open (`expiresAt`).
 * @param realtime  a relay client (lib/realtime.mjs): members get a ticket to
 *   the room's socket, and the relay is woken after every change.
 * @param mintRoomId  chooses a new room's id — for hosts that route rooms by id
 *   (templates/cloudflare-rooms picks the Durable Object first).
 * @param presenceWriteMs  store a member's heartbeat at most this often unless
 *   what they're doing changed — for storage that charges per write. With a
 *   relay, cursors travel over the socket and don't need storing at all.
 */
export function createFroamRoomApi({ file, storage, authorize = null, onApproveRequest = null, onRevertRequest = null, notify = null, roomTtlMs = null, realtime = null, presenceWriteMs = 0, mintRoomId = () => randomUUID(), log = () => {}, now = () => Date.now() }) {
  // Checked here rather than at the first request: a misconfiguration should
  // fail where it was written, not later as a confusing filesystem error while
  // somebody is trying to open a room.
  if (!storage && !file) throw new Error('[froam] createFroamRoomApi needs a file or a storage')
  const store = storage ?? fileStorage(file)
  const writeRoom = store.put.bind(store)
  const subscribers = new Map()

  /** Hand an event to `notify` without making the person wait on, or fail with, it. */
  function tell(event) {
    if (!notify) return
    Promise.resolve()
      .then(() => notify({ ...event, room: { id: event.room.id }, actor: event.actor ? { actor: event.actor.actor, name: event.actor.name, role: event.actor.role, title: event.actor.title ?? null } : null }))
      .catch((error) => log(`notify failed: ${error instanceof Error ? error.message : error}`))
  }

  function signal(roomId, sequence) {
    const listeners = subscribers.get(roomId)
    if (!listeners) return
    const frame = `event: room\ndata: ${JSON.stringify({ sequence })}\n\n`
    for (const response of [...listeners]) {
      try { response.write(frame) } catch { listeners.delete(response) }
    }
    if (!listeners.size) subscribers.delete(roomId)
  }

  const published = new Map()

  async function persist(room) {
    await writeRoom(room)
    const sequence = Number(room.sequence) || 0
    signal(room.id, sequence)
    // The relay only needs to hear when there's something new to read.
    if (realtime && published.get(room.id) !== sequence) {
      published.set(room.id, sequence)
      Promise.resolve(realtime.publish(room.id, sequence)).catch((error) => log(`realtime publish failed: ${error instanceof Error ? error.message : error}`))
    }
  }

  /** A member's way onto the room's socket, when there is a relay. */
  const connectionFor = (roomId, actor) => (realtime && actor ? realtime.connection(roomId, actor) : null)

  /**
   * Whether an invite link still opens this room: the room is there, not ended
   * or expired, and the token is one of its invites or a member's session.
   */
  async function checkToken(roomId, token) {
    if (!roomId || !token || !/^[A-Za-z0-9_-]+$/.test(roomId)) return { ok: false, status: 400 }
    const room = await store.get(roomId)
    if (!room) return { ok: false, status: 404 }
    if (room.endedAt || (room.expiresAt && now() > room.expiresAt)) return { ok: false, status: 410 }
    const valid = Boolean(room.tokens?.[token]) || Object.values(room.members ?? {}).some((member) => member?.session === token)
    return valid ? { ok: true, status: 200, expiresAt: room.expiresAt ?? null } : { ok: false, status: 403 }
  }

  handleRoomRequest.checkToken = checkToken
  return handleRoomRequest

  async function handleRoomRequest(req, res) {
    const url = new URL(req.url ?? '/', 'http://froam.local')
    // Split rather than one growing regex: the shapes are
    // /rooms · /rooms/:id · /rooms/:id/join · /rooms/:id/comments ·
    // /rooms/:id/comments/:commentId/resolve
    const at = url.pathname.indexOf('/rooms')
    if (at < 0) return false
    const parts = url.pathname.slice(at + '/rooms'.length).replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
    if (parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return false

    const [roomId, action, commentId, commentAction] = parts
    const method = (req.method ?? 'GET').toUpperCase()

    /* ── create ─────────────────────────────────────────────── */
    if (!roomId && method === 'POST') {
      if (authorize && !(await authorize(req))) {
        sendJson(res, 403, { success: false, error: 'Not authorized to open a room' })
        return true
      }
      let body
      try { body = await readJsonBody(req) } catch {
        sendJson(res, 400, { success: false, error: 'Invalid JSON body' })
        return true
      }

      const ownerName = cleanName(body?.name) ?? 'Owner'
      const routes = Array.isArray(body?.routes) && body.routes.length
        ? body.routes.map((r) => normalizeRouteKey(r)).filter(Boolean)
        : '*'

      const id = mintRoomId()
      const ownerActor = `a_${randomBytes(9).toString('base64url')}`
      const stamp = now()

      // One token per role, so an invite link decides what the person can do
      // and revoking a role is deleting a token rather than editing a list.
      const tokens = {}
      const invites = {}
      for (const role of INVITE_ROLES) {
        const token = mintToken()
        tokens[token] = role
        invites[role] = token
      }

      const room = {
        id,
        createdAt: stamp,
        ...(roomTtlMs ? { expiresAt: stamp + roomTtlMs } : {}),
        routes,
        ownerActor,
        sequence: 0,
        events: [],
        chat: [],
        proposals: {},
        tokens,
        members: {
          [ownerActor]: (() => {
            const profile = profileFrom(body)
            return { actor: ownerActor, session: mintToken(), name: ownerName, role: 'owner', ...profile, color: profile.color ?? colorForActor(ownerActor), joinedAt: stamp, seenAt: stamp }
          })(),
        },
      }

      await persist(room)
      log(`room ${id} opened`)

      sendJson(res, 200, {
        success: true,
        room: publicRoom(room, stamp, { actor: ownerActor, role: 'owner', name: ownerName }),
        // Returned once, to whoever opened the room. Never in a GET.
        invites,
        you: { actor: ownerActor, role: 'owner', name: ownerName, session: room.members[ownerActor].session },
      })
      return true
    }

    if (!roomId) {
      sendJson(res, 405, { success: false, error: 'Method not allowed' })
      return true
    }

    const room = await store.get(roomId)
    if (!room) {
      sendJson(res, 404, { success: false, error: 'No such room' })
      return true
    }
    // The owner ended it: every link stops working, and says why.
    if (room.endedAt) {
      sendJson(res, 410, { success: false, ended: true, endedAt: room.endedAt, error: `${room.endedBy ?? 'The owner'} ended this session` })
      return true
    }

    /** A token is the credential; resolve it to a role or refuse. */
    const tokenFrom = async () => {
      if (method === 'GET') return url.searchParams.get('token')
      try {
        const body = await readJsonBody(req)
        req.body = body
        return body?.token ?? null
      } catch {
        return null
      }
    }

    const token = await tokenFrom()
    const role = token ? room.tokens[token] : null
    if (!role || !ROLES.has(role)) {
      sendJson(res, 403, { success: false, error: 'This link is not valid for that room' })
      return true
    }

    /* A tiny push signal. The durable event log remains the payload and the
       reconnect source; SSE only says "ask now" instead of waiting for poll. */
    if (action === 'stream' && method === 'GET') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()
      res.write?.(`event: ready\ndata: ${JSON.stringify({ sequence: Number(room.sequence) || 0 })}\n\n`)
      const listeners = subscribers.get(roomId) ?? new Set()
      listeners.add(res)
      subscribers.set(roomId, listeners)
      const keepAlive = setInterval(() => {
        try { res.write?.(': keepalive\n\n') } catch { /* close handler removes it */ }
      }, 25_000)
      const close = () => {
        clearInterval(keepAlive)
        listeners.delete(res)
        if (!listeners.size) subscribers.delete(roomId)
      }
      req.on?.('close', close)
      res.on?.('close', close)
      return true
    }

    /* ── read ───────────────────────────────────────────────── */
    if (!action && method === 'GET') {
      const actor = url.searchParams.get('actor')
      const member = memberFor(room, actor, url.searchParams.get('session'))
      const you = member
        ? { actor: member.actor, role: member.role, name: member.name }
        : null
      sendJson(res, 200, { success: true, room: publicRoom(room, now(), you), invite: role, realtime: connectionFor(room.id, member?.actor) })
      return true
    }

    /* ── join ───────────────────────────────────────────────── */
    if (action === 'join' && method === 'POST') {
      const body = req.body ?? {}
      const name = cleanName(body.name)
      if (!name) {
        sendJson(res, 400, { success: false, error: 'Tell us your name so people know who commented' })
        return true
      }
      if (Object.keys(room.members).length >= MAX_MEMBERS) {
        sendJson(res, 409, { success: false, error: 'This room is full' })
        return true
      }

      // Returning with the same actor keeps your history yours rather than
      // minting a stranger every refresh.
      const returning = typeof body.actor === 'string'
        && typeof body.session === 'string'
        && room.members[body.actor]
        && room.members[body.actor].session === body.session
      const actor = returning ? body.actor : `a_${randomBytes(9).toString('base64url')}`
      const stamp = now()

      room.members[actor] = {
        ...(room.members[actor] ?? {}),
        actor,
        session: returning ? room.members[actor].session : mintToken(),
        name,
        // A token cannot promote you past what it grants, and rejoining on a
        // guest link must never quietly demote the owner.
        role: returning ? room.members[actor].role : role,
        ...(() => {
          const profile = profileFrom(body, room.members[actor] ?? {})
          return { ...profile, color: profile.color ?? colorForActor(actor) }
        })(),
        joinedAt: room.members[actor]?.joinedAt ?? stamp,
        seenAt: stamp,
      }
      await persist(room)
      log(`${name} joined room ${roomId} as ${room.members[actor].role}`)

      sendJson(res, 200, {
        success: true,
        you: { actor, role: room.members[actor].role, name, session: room.members[actor].session },
        room: publicRoom(room, stamp, { actor, role: room.members[actor].role, name }),
        realtime: connectionFor(room.id, actor),
      })
      return true
    }

    /* ── end — the owner is done: links stop working for everyone ── */
    if (action === 'end' && method === 'POST') {
      const member = memberFor(room, req.body?.actor, req.body?.session)
      if (!member || member.role !== 'owner') {
        sendJson(res, 403, { success: false, error: 'Only the owner can end the session' })
        return true
      }
      const stamp = now()
      room.endedAt = stamp
      room.endedBy = member.name
      // Revoked, not just hidden: an ended room can't be reopened with an old link.
      room.tokens = {}
      appendEvent(room, { type: 'ended', createdAt: stamp, actor: member.actor })
      await persist(room)
      log(`${member.name} ended room ${roomId}`)
      sendJson(res, 200, { success: true, ended: true, endedAt: stamp })
      return true
    }

    /* ── presence ───────────────────────────────────────────── */
    if (action === 'presence' && method === 'POST') {
      const body = req.body ?? {}
      const member = memberFor(room, body.actor, body.session)
      if (!member) {
        sendJson(res, 404, { success: false, error: 'Join the room first' })
        return true
      }
      if (typeof body.routeKey === 'string' && !routeAllowed(room, body.routeKey)) {
        sendJson(res, 403, { success: false, error: 'That route is outside this room' })
        return true
      }
      const stamp = now()
      const doing = (m) => [m.routeKey, m.viewport, m.selectedPath, m.lockedPath, m.action].join('|')
      const was = doing(member)
      member.seenAt = stamp
      if (typeof body.routeKey === 'string') member.routeKey = normalizeRouteKey(body.routeKey)
      if (VIEWPORTS.includes(body.viewport)) member.viewport = body.viewport
      member.selectedPath = typeof body.selectedPath === 'string' ? body.selectedPath : null
      member.selectedNodeId = cleanNodeId(body.selectedNodeId)
      member.lockedPath = typeof body.lockedPath === 'string' ? body.lockedPath : null
      member.lockedNodeId = cleanNodeId(body.lockedNodeId)
      member.cursor = cleanCursor(body.cursor)
      member.tool = cleanPresenceLabel(body.tool)
      member.action = cleanPresenceLabel(body.action)
      // A heartbeat that changes nothing anyone acts on can wait (see presenceWriteMs).
      const quiet = presenceWriteMs > 0 && doing(member) === was && stamp - (member.presenceWrittenAt ?? 0) < presenceWriteMs
      if (!quiet) {
        member.presenceWrittenAt = stamp
        await persist(room)
      }

      sendJson(res, 200, {
        success: true,
        room: publicRoom(room, stamp, { actor: member.actor, role: member.role, name: member.name }),
      })
      return true
    }

    /* ── ordered collaboration stream ─────────────────────── */
    if (action === 'events' && method === 'GET') {
      const after = Math.max(0, Number.parseInt(url.searchParams.get('after') ?? '0', 10) || 0)
      const limit = Math.max(1, Math.min(MAX_EVENT_PAGE, Number.parseInt(url.searchParams.get('limit') ?? String(MAX_EVENT_PAGE), 10) || MAX_EVENT_PAGE))
      const all = Array.isArray(room.events) ? room.events : []
      const available = all.filter((event) => event.seq > after)
      const events = available.slice(0, limit)
      const cursor = events.length ? events[events.length - 1].seq : after
      const actor = url.searchParams.get('actor')
      const member = memberFor(room, actor, url.searchParams.get('session'))
      const you = member
        ? { actor: member.actor, role: member.role, name: member.name }
        : null
      sendJson(res, 200, {
        success: true,
        events,
        cursor,
        hasMore: available.length > events.length,
        room: publicRoom(room, now(), you),
      })
      return true
    }

    if (action === 'ops' && method === 'POST') {
      const body = req.body ?? {}
      const member = memberFor(room, body.actor, body.session)
      if (!member || ROLE_RANK[member.role] < ROLE_RANK.editor) {
        sendJson(res, 403, { success: false, error: 'Only an editor can change this room' })
        return true
      }
      if (!Array.isArray(body.ops) || body.ops.length === 0 || body.ops.length > MAX_OPS_PER_PUSH) {
        sendJson(res, 400, { success: false, error: `Send between 1 and ${MAX_OPS_PER_PUSH} operations` })
        return true
      }

      room.events = Array.isArray(room.events) ? room.events : []
      room.proposals = room.proposals && typeof room.proposals === 'object' ? room.proposals : {}
      const baseSeq = Math.max(0, Number(body.baseSeq) || 0)
      const existing = new Map(room.events.filter((event) => event.type === 'op').map((event) => [event.op.id, event]))
      const accepted = []
      const rejected = []
      const proposed = []
      const stamp = now()

      for (const raw of body.ops) {
        if (!isSafeOp(raw, member.actor)) {
          rejected.push({ id: typeof raw?.id === 'string' ? raw.id : null, reason: 'invalid-op' })
          continue
        }
        if (!routeAllowed(room, raw.routeKey)) {
          rejected.push({ id: raw.id, reason: 'route-outside-room' })
          continue
        }
        const duplicate = existing.get(raw.id)
        if (duplicate) {
          accepted.push(duplicate.op)
          continue
        }

        const target = raw.targets
          ? room.events.find((event) => event.type === 'op' && event.op.id === raw.targets)?.op
          : null
        if (target && target.actor !== member.actor && member.role !== 'owner') {
          proposed.push(raw)
          rejected.push({ id: raw.id, reason: 'owner-approval-required' })
          continue
        }

        // If this device had not seen a concurrent higher-ranked write to the
        // same field, the 60/40 rule keeps that write. Once it has seen it,
        // baseSeq moves past it and a later guest edit is an ordinary sequence.
        const blocked = room.events.some((event) => (
          event.type === 'op'
          && event.seq > baseSeq
          && event.actor !== member.actor
          && ROLE_RANK[room.members[event.actor]?.role ?? 'viewer'] > ROLE_RANK[member.role]
          && sameField(event.op, raw)
        ))
        if (blocked) {
          rejected.push({ id: raw.id, reason: 'higher-authority-concurrent-write' })
          continue
        }

        const event = appendOpEvent(room, raw, member.actor, stamp)
        existing.set(event.op.id, event)
        accepted.push(event.op)
      }

      if (proposed.length) {
        const proposal = {
          id: randomUUID(), actor: member.actor, name: member.name,
          ops: proposed, createdAt: stamp, status: 'pending', decidedBy: null, decidedAt: null,
        }
        room.proposals[proposal.id] = proposal
        appendEvent(room, { type: 'proposal', createdAt: stamp, actor: member.actor, proposal })
      }

      await persist(room)
      sendJson(res, 200, {
        success: true,
        accepted,
        rejected,
        cursor: Number(room.sequence) || 0,
        room: publicRoom(room, stamp, { actor: member.actor, role: member.role, name: member.name }),
      })
      return true
    }

    if (action === 'signal' && method === 'POST') {
      const body = req.body ?? {}
      const member = memberFor(room, body.actor, body.session)
      if (!member || ROLE_RANK[member.role] < ROLE_RANK.editor) {
        sendJson(res, 403, { success: false, error: 'Only an editor can publish to this room' })
        return true
      }
      if (!routeAllowed(room, body.routeKey) || !VIEWPORTS.includes(body.viewport)) {
        sendJson(res, 400, { success: false, error: 'Invalid room design scope' })
        return true
      }
      const stamp = now()
      appendEvent(room, {
        type: 'design', createdAt: stamp, actor: member.actor,
        routeKey: normalizeRouteKey(body.routeKey), viewport: body.viewport,
      })
      await persist(room)
      sendJson(res, 200, { success: true, cursor: Number(room.sequence) || 0 })
      return true
    }

    /* ── ephemeral room chat ──────────────────────────────── */
    if (action === 'chat') {
      room.chat = Array.isArray(room.chat) ? room.chat : []
      const member = method === 'GET'
        ? memberFor(room, url.searchParams.get('actor'), url.searchParams.get('session'))
        : memberFor(room, req.body?.actor, req.body?.session)

      if (method === 'GET') {
        if (!member) {
          sendJson(res, 404, { success: false, error: 'Join the room first' })
          return true
        }
        sendJson(res, 200, { success: true, messages: room.chat.slice(-MAX_CHAT_MESSAGES) })
        return true
      }
      if (method === 'POST') {
        if (!member) {
          sendJson(res, 404, { success: false, error: 'Join the room first' })
          return true
        }
        const body = typeof req.body.body === 'string' ? req.body.body.trim().slice(0, MAX_CHAT_LENGTH) : ''
        if (!body) {
          sendJson(res, 400, { success: false, error: 'Say something' })
          return true
        }
        // A message can be about a request: the conversation that settles it.
        const requestId = typeof req.body.requestId === 'string' && room.requests?.[req.body.requestId] ? req.body.requestId : null
        // …or pinned to something on the page: "make this shorter", on the thing.
        const anchor = cleanMessageAnchor(req.body.anchor, room)
        const mentions = mentionedIn(body, room, member.actor)
        const message = {
          id: randomUUID(), actor: member.actor, name: member.name, body, createdAt: now(),
          ...(requestId ? { requestId } : {}),
          ...(anchor ? { anchor } : {}),
          ...(mentions.length ? { mentions } : {}),
        }
        room.chat.push(message)
        if (room.chat.length > MAX_CHAT_MESSAGES) room.chat.splice(0, room.chat.length - MAX_CHAT_MESSAGES)
        appendEvent(room, { type: 'chat', createdAt: message.createdAt, actor: member.actor, message })
        await persist(room)
        if (mentions.length) {
          tell({
            type: 'chat.mention', room, message, actor: member,
            mentioned: mentions.map((actor) => room.members[actor]).filter(Boolean).map((m) => ({ actor: m.actor, name: m.name, role: m.role })),
          })
        }
        sendJson(res, 200, { success: true, message })
        return true
      }
    }

    /* ── guest-editor revert proposals ────────────────────── */
    if (action === 'proposals') {
      room.proposals = room.proposals && typeof room.proposals === 'object' ? room.proposals : {}
      const member = method === 'GET'
        ? memberFor(room, url.searchParams.get('actor'), url.searchParams.get('session'))
        : memberFor(room, req.body?.actor, req.body?.session)
      if (!member || ROLE_RANK[member.role] < ROLE_RANK.editor) {
        sendJson(res, 403, { success: false, error: 'Only editors can see revert proposals' })
        return true
      }
      if (!commentId && method === 'GET') {
        sendJson(res, 200, { success: true, proposals: Object.values(room.proposals).sort((a, b) => b.createdAt - a.createdAt) })
        return true
      }
      const proposal = commentId ? room.proposals[commentId] : null
      if (!proposal) {
        sendJson(res, 404, { success: false, error: 'No such proposal' })
        return true
      }
      if (commentAction === 'decision' && method === 'POST') {
        if (member.role !== 'owner') {
          sendJson(res, 403, { success: false, error: 'Only the owner can decide that' })
          return true
        }
        const decision = req.body.decision
        if (decision !== 'approved' && decision !== 'declined') {
          sendJson(res, 400, { success: false, error: 'Say approved or declined' })
          return true
        }
        proposal.status = decision
        proposal.decidedBy = member.name
        proposal.decidedAt = now()
        const accepted = []
        if (decision === 'approved') {
          for (const requested of proposal.ops) {
            if (!isSafeOp({ ...requested, actor: member.actor }, member.actor)) continue
            accepted.push(appendOpEvent(room, { ...requested, id: randomUUID(), actor: member.actor }, member.actor, proposal.decidedAt).op)
          }
        }
        appendEvent(room, { type: 'proposal', createdAt: proposal.decidedAt, actor: member.actor, proposal })
        await persist(room)
        sendJson(res, 200, { success: true, proposal, accepted, cursor: Number(room.sequence) || 0 })
        return true
      }
    }

    /* ── comments ───────────────────────────────────────────── */
    if (action === 'comments') {
      room.comments = room.comments ?? {}
      const member = method === 'GET'
        ? memberFor(room, url.searchParams.get('actor'), url.searchParams.get('session'))
        : memberFor(room, req.body?.actor, req.body?.session)

      /* list — anyone with a link may read the conversation */
      if (!commentId && method === 'GET') {
        const routeKey = normalizeRouteKey(url.searchParams.get('routeKey') ?? '/')
        // Notes belong to a page, not to a screen size. The client leaves one
        // on a phone and the designer is on a desktop — filtering by viewport
        // would hide it from the only person who can act on it. Which viewport
        // it came from travels on the note as context instead.
        const list = Object.values(room.comments)
          .filter((c) => c.routeKey === routeKey)
          .sort((a, b) => a.createdAt - b.createdAt)
        sendJson(res, 200, { success: true, comments: list })
        return true
      }

      /* create */
      if (!commentId && method === 'POST') {
        if (!member) {
          sendJson(res, 404, { success: false, error: 'Join the room first' })
          return true
        }
        // A viewer link is for looking. Leaving notes is what a commenter is.
        if (ROLE_RANK[member.role] < ROLE_RANK.commenter) {
          sendJson(res, 403, { success: false, error: 'This link is read-only' })
          return true
        }
        const body = req.body ?? {}
        const text = typeof body.body === 'string' ? body.body.trim().slice(0, MAX_COMMENT_LENGTH) : ''
        const anchor = body.anchor
        if (!text) {
          sendJson(res, 400, { success: false, error: 'Say what you would like changed' })
          return true
        }
        if (!anchor || typeof anchor.path !== 'string' || !anchor.path) {
          sendJson(res, 400, { success: false, error: 'A note has to be attached to something' })
          return true
        }
        if (!routeAllowed(room, body.routeKey)) {
          sendJson(res, 403, { success: false, error: 'That route is outside this room' })
          return true
        }
        if (Object.keys(room.comments).length >= MAX_COMMENTS) {
          sendJson(res, 409, { success: false, error: 'That is a lot of notes — resolve some first' })
          return true
        }

        const comment = {
          id: randomUUID(),
          actor: member.actor,
          name: member.name,
          routeKey: normalizeRouteKey(body.routeKey ?? '/'),
          viewport: VIEWPORTS.includes(body.viewport) ? body.viewport : 'desktop',
          // The fingerprint travels with the note so it can still be found
          // after the page it points at has been rebuilt around it.
          anchor: { nodeId: cleanNodeId(anchor.nodeId) ?? undefined, path: anchor.path, fingerprint: anchor.fingerprint ?? { tag: '' } },
          quoted: typeof body.quoted === 'string' ? body.quoted.slice(0, 200) : null,
          body: text,
          createdAt: now(),
          resolved: false,
          replies: [],
        }
        room.comments[comment.id] = comment
        appendEvent(room, { type: 'comment', createdAt: comment.createdAt, actor: member.actor, commentId: comment.id })
        await persist(room)
        log(`${member.name} left a note on ${comment.routeKey}`)
        sendJson(res, 200, { success: true, comment })
        return true
      }

      const comment = commentId ? room.comments[commentId] : null
      if (!comment) {
        sendJson(res, 404, { success: false, error: 'No such note' })
        return true
      }
      if (!member) {
        sendJson(res, 404, { success: false, error: 'Join the room first' })
        return true
      }

      /* resolve — the owner or an editor calls it done, and so may whoever
         raised it, since withdrawing your own note is not a privilege */
      if (commentAction === 'resolve' && method === 'POST') {
        const mayResolve = ROLE_RANK[member.role] >= ROLE_RANK.editor || comment.actor === member.actor
        if (!mayResolve) {
          sendJson(res, 403, { success: false, error: 'Only the designer can resolve that' })
          return true
        }
        comment.resolved = (req.body ?? {}).resolved !== false
        comment.resolvedBy = comment.resolved ? member.name : null
        appendEvent(room, { type: 'comment', createdAt: now(), actor: member.actor, commentId: comment.id })
        await persist(room)
        sendJson(res, 200, { success: true, comment })
        return true
      }

      /* reply */
      if (commentAction === 'reply' && method === 'POST') {
        const text = typeof (req.body ?? {}).body === 'string' ? req.body.body.trim().slice(0, MAX_COMMENT_LENGTH) : ''
        if (!text) {
          sendJson(res, 400, { success: false, error: 'Say something' })
          return true
        }
        comment.replies.push({
          id: randomUUID(), actor: member.actor, name: member.name, body: text, createdAt: now(),
        })
        appendEvent(room, { type: 'comment', createdAt: now(), actor: member.actor, commentId: comment.id })
        await persist(room)
        sendJson(res, 200, { success: true, comment })
        return true
      }
    }

    /* ── revisions ──────────────────────────────────────────── */
    if (action === 'revisions') {
      room.revisions = room.revisions ?? {}
      const member = method === 'GET'
        ? memberFor(room, url.searchParams.get('actor'), url.searchParams.get('session'))
        : memberFor(room, req.body?.actor, req.body?.session)

      /* list — newest first, because the current one is the question */
      if (!commentId && method === 'GET') {
        const routeKey = url.searchParams.get('routeKey')
        const list = Object.values(room.revisions)
          .filter((r) => !routeKey || r.routeKey === normalizeRouteKey(routeKey))
          .sort((a, b) => b.createdAt - a.createdAt)
        sendJson(res, 200, { success: true, revisions: list })
        return true
      }

      /* send for review — only someone who can edit has something to send */
      if (!commentId && method === 'POST') {
        if (!member || ROLE_RANK[member.role] < ROLE_RANK.editor) {
          sendJson(res, 403, { success: false, error: 'Only the designer can send a revision' })
          return true
        }
        const body = req.body ?? {}
        if (!routeAllowed(room, body.routeKey)) {
          sendJson(res, 403, { success: false, error: 'That route is outside this room' })
          return true
        }
        const revision = {
          id: randomUUID(),
          routeKey: normalizeRouteKey(body.routeKey ?? '/'),
          viewport: VIEWPORTS.includes(body.viewport) ? body.viewport : 'desktop',
          // The design as it stood when it was sent, so "approved" means
          // something specific rather than "approved whatever it is now".
          store: body.store && typeof body.store === 'object' ? body.store : {},
          note: typeof body.note === 'string' ? body.note.trim().slice(0, MAX_COMMENT_LENGTH) : null,
          createdAt: now(),
          createdBy: member.name,
          status: 'sent',
          decidedBy: null,
          decidedAt: null,
          decisionNote: null,
        }
        room.revisions[revision.id] = revision
        appendEvent(room, { type: 'revision', createdAt: revision.createdAt, actor: member.actor, revisionId: revision.id })
        await persist(room)
        log(`${member.name} sent ${revision.routeKey} for review`)
        sendJson(res, 200, { success: true, revision })
        return true
      }

      const revision = commentId ? room.revisions[commentId] : null
      if (!revision) {
        sendJson(res, 404, { success: false, error: 'No such revision' })
        return true
      }

      /* decide */
      if (commentAction === 'decision' && method === 'POST') {
        if (!member || ROLE_RANK[member.role] < ROLE_RANK.commenter) {
          sendJson(res, 403, { success: false, error: 'This link is read-only' })
          return true
        }
        const decision = (req.body ?? {}).decision
        if (decision !== 'approved' && decision !== 'changes-requested') {
          sendJson(res, 400, { success: false, error: 'Say approved or changes-requested' })
          return true
        }

        // Deliberately no check on open notes. Blocking approval until every
        // note is resolved is how you end up with a client who cannot say yes
        // to a design they like — "approved, with two notes" is real
        // information and the most common honest answer.
        revision.status = decision
        revision.decidedBy = member.name
        revision.decidedAt = now()
        revision.decisionNote = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, MAX_COMMENT_LENGTH) : null
        appendEvent(room, { type: 'revision', createdAt: revision.decidedAt, actor: member.actor, revisionId: revision.id })
        await persist(room)
        log(`${member.name} marked ${revision.routeKey} ${decision}`)
        sendJson(res, 200, { success: true, revision })
        return true
      }
    }

    /* ── change requests: submit → owner approves → published ─ */
    if (action === 'requests') {
      room.requests = room.requests && typeof room.requests === 'object' ? room.requests : {}
      const member = method === 'GET'
        ? memberFor(room, url.searchParams.get('actor'), url.searchParams.get('session'))
        : memberFor(room, req.body?.actor, req.body?.session)
      if (!member || ROLE_RANK[member.role] < ROLE_RANK.contributor) {
        sendJson(res, 403, { success: false, error: 'This link cannot submit changes' })
        return true
      }
      const isReviewer = ROLE_RANK[member.role] >= ROLE_RANK.editor

      /* list — a contributor sees their own; the team sees all */
      if (!commentId && method === 'GET') {
        const list = Object.values(room.requests)
          .filter((request) => isReviewer || request.actor === member.actor)
          .sort((a, b) => b.createdAt - a.createdAt)
        sendJson(res, 200, { success: true, requests: list })
        return true
      }

      /* submit */
      if (!commentId && method === 'POST') {
        const body = req.body ?? {}
        // One request may span pages and screen sizes; older clients send one.
        const scopes = cleanRequestScopes(body)
        if (scopes.some((scope) => !routeAllowed(room, scope.routeKey))) {
          sendJson(res, 403, { success: false, error: 'That page is outside this room' })
          return true
        }
        if (!scopes.length) {
          sendJson(res, 400, { success: false, error: 'There are no changes to submit' })
          return true
        }
        const [{ store, removed }] = scopes
        if (Object.keys(room.requests).length >= MAX_REQUESTS) {
          sendJson(res, 409, { success: false, error: 'This room has too many requests — ask the owner to open a new one' })
          return true
        }
        const request = {
          id: randomUUID(),
          routeKey: scopes[0].routeKey,
          viewport: scopes[0].viewport,
          scopes,
          title: cleanText(body.title, MAX_TITLE_LENGTH) || 'Changes',
          note: cleanText(body.note, MAX_COMMENT_LENGTH),
          store,
          removed,
          changes: cleanChanges(body.changes),
          textEdits: cleanTextEdits(body.textEdits),
          styleEdits: cleanStyleEdits(body.styleEdits),
          actor: member.actor,
          createdBy: member.name,
          createdAt: now(),
          status: 'pending',
          decidedBy: null,
          decidedAt: null,
          decisionNote: null,
          published: null,
          undo: null,
          reverted: null,
        }
        room.requests[request.id] = request
        appendEvent(room, { type: 'request', createdAt: request.createdAt, actor: member.actor, requestId: request.id })
        await persist(room)
        tell({ type: 'request.submitted', room, request, actor: member })
        log(`${member.name} submitted "${request.title}" on ${request.routeKey} for approval`)
        sendJson(res, 200, { success: true, request })
        return true
      }

      const request = commentId ? room.requests[commentId] : null
      if (!request || (!isReviewer && request.actor !== member.actor)) {
        sendJson(res, 404, { success: false, error: 'No such request' })
        return true
      }

      /* withdraw — the author changes their mind while it is still pending */
      if (commentAction === 'withdraw' && method === 'POST') {
        if (request.actor !== member.actor || request.status !== 'pending') {
          sendJson(res, 409, { success: false, error: 'Only a pending request of your own can be withdrawn' })
          return true
        }
        request.status = 'withdrawn'
        request.decidedAt = now()
        appendEvent(room, { type: 'request', createdAt: request.decidedAt, actor: member.actor, requestId: request.id })
        await persist(room)
        sendJson(res, 200, { success: true, request })
        return true
      }

      /* decide — the owner's call, and approving is what publishes */
      if (commentAction === 'decision' && method === 'POST') {
        if (member.role !== 'owner') {
          sendJson(res, 403, { success: false, error: 'Only the owner can approve or send back changes' })
          return true
        }
        if (request.status !== 'pending') {
          sendJson(res, 409, { success: false, error: `This request is already ${request.status}` })
          return true
        }
        const decision = req.body?.decision
        if (decision !== 'approved' && decision !== 'changes-requested') {
          sendJson(res, 400, { success: false, error: 'Say approved or changes-requested' })
          return true
        }
        if (decision === 'approved') {
          try {
            const result = onApproveRequest ? await onApproveRequest({ room, request }) : null
            request.published = {
              ok: Boolean(onApproveRequest),
              detail: result?.detail ?? (onApproveRequest ? 'Published' : 'Approved — applied in the owner’s editor'),
              link: typeof result?.link === 'string' ? result.link : null,
              number: Number.isFinite(result?.number) ? result.number : null,
              branch: typeof result?.branch === 'string' ? result.branch : null,
            }
            request.undo = result?.undo ?? null
          } catch (error) {
            sendJson(res, 502, { success: false, error: `Could not publish: ${error instanceof Error ? error.message : 'unknown error'}` })
            return true
          }
        }
        request.status = decision
        request.decidedBy = member.name
        request.decidedAt = now()
        request.decisionNote = cleanText(req.body?.note, MAX_COMMENT_LENGTH)
        appendEvent(room, { type: 'request', createdAt: request.decidedAt, actor: member.actor, requestId: request.id })
        await persist(room)
        log(`${member.name} ${decision === 'approved' ? 'approved and published' : 'sent back'} "${request.title}"`)
        tell({ type: 'request.decided', room, request, actor: member })
        sendJson(res, 200, { success: true, request })
        return true
      }

      /* revert — the owner takes an approved change back */
      if (commentAction === 'revert' && method === 'POST') {
        if (member.role !== 'owner') {
          sendJson(res, 403, { success: false, error: 'Only the owner can revert a change' })
          return true
        }
        if (request.status !== 'approved') {
          sendJson(res, 409, { success: false, error: 'Only an approved change can be reverted' })
          return true
        }
        if (!onRevertRequest) {
          sendJson(res, 501, { success: false, error: 'This room can’t revert changes' })
          return true
        }
        let result
        try {
          result = await onRevertRequest({ room, request, undo: request.undo })
        } catch (error) {
          sendJson(res, 502, { success: false, error: `Could not revert: ${error instanceof Error ? error.message : 'unknown error'}` })
          return true
        }
        request.status = 'reverted'
        request.reverted = {
          by: member.name,
          at: now(),
          detail: result?.detail ?? 'Reverted',
          link: typeof result?.link === 'string' ? result.link : null,
          skipped: Array.isArray(result?.skipped) ? result.skipped.length : 0,
          note: cleanText(req.body?.note, MAX_COMMENT_LENGTH),
        }
        appendEvent(room, { type: 'request', createdAt: request.reverted.at, actor: member.actor, requestId: request.id })
        await persist(room)
        log(`${member.name} reverted "${request.title}"`)
        tell({ type: 'request.reverted', room, request, actor: member })
        sendJson(res, 200, { success: true, request })
        return true
      }
    }

    sendJson(res, 405, { success: false, error: 'Method not allowed' })
    return true
  }
}

/* ── change-request validation ───────────────────────────── */

function cleanText(value, max) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

/** A draft key a request may carry: an element path or a Froam key, never anything odd. */
function isRequestPath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 400 && value.includes(':') && !/[<>]/.test(value)
}

function cleanRequestStore(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out = {}
  for (const [key, draft] of Object.entries(value).slice(0, MAX_REQUEST_PATHS)) {
    if (!isRequestPath(key) || !draft || typeof draft !== 'object' || Array.isArray(draft)) continue
    out[key] = draft
  }
  return out
}

function cleanRequestScopes(body) {
  const raw = Array.isArray(body?.scopes) && body.scopes.length
    ? body.scopes.slice(0, MAX_REQUEST_SCOPES)
    : [{ routeKey: body?.routeKey, viewport: body?.viewport, store: body?.store, removed: body?.removed }]
  const scopes = []
  const seen = new Set()
  for (const scope of raw) {
    const store = cleanRequestStore(scope?.store) ?? {}
    const removed = Array.isArray(scope?.removed) ? scope.removed.filter(isRequestPath).slice(0, MAX_REQUEST_PATHS) : []
    if (!Object.keys(store).length && !removed.length) continue
    const routeKey = normalizeRouteKey(scope?.routeKey ?? '/')
    const viewport = VIEWPORTS.includes(scope?.viewport) ? scope.viewport : 'desktop'
    const key = `${routeKey}@@${viewport}`
    if (seen.has(key)) continue
    seen.add(key)
    scopes.push({ routeKey, viewport, store, removed })
  }
  return scopes
}

/** Where a message is pinned: a page, a screen size and an element on it. */
function cleanMessageAnchor(value, room) {
  if (!value || typeof value !== 'object' || typeof value.path !== 'string' || !value.path || value.path.length > 400 || /[<>]/.test(value.path)) return null
  const routeKey = normalizeRouteKey(value.routeKey ?? '/')
  if (!routeAllowed(room, routeKey)) return null
  const fingerprint = value.fingerprint && typeof value.fingerprint === 'object' ? value.fingerprint : {}
  return {
    path: value.path,
    nodeId: cleanNodeId(value.nodeId) ?? undefined,
    routeKey,
    viewport: VIEWPORTS.includes(value.viewport) ? value.viewport : 'desktop',
    // Enough of what the element was to find it again after the page changes.
    fingerprint: {
      tag: typeof fingerprint.tag === 'string' ? fingerprint.tag.slice(0, 40) : '',
      ...(typeof fingerprint.text === 'string' ? { text: fingerprint.text.slice(0, 120) } : {}),
      ...(typeof fingerprint.id === 'string' ? { id: fingerprint.id.slice(0, 120) } : {}),
      ...(typeof fingerprint.anchorId === 'string' ? { anchorId: fingerprint.anchorId.slice(0, 120) } : {}),
      ...(typeof fingerprint.anchorPath === 'string' && !/[<>]/.test(fingerprint.anchorPath) ? { anchorPath: fingerprint.anchorPath.slice(0, 400) } : {}),
      ...(Number.isInteger(fingerprint.ordinal) && fingerprint.ordinal >= 0 ? { ordinal: Math.min(fingerprint.ordinal, 10_000) } : {}),
      ...(typeof fingerprint.className === 'string' ? { className: fingerprint.className.slice(0, 300) } : {}),
    },
    label: cleanText(value.label, 120),
  }
}

/**
 * Who a message names with @: a full name or a first name, any case, as long
 * as it points at exactly one other person in the room.
 */
function mentionedIn(body, room, from) {
  if (!body.includes('@')) return []
  const members = Object.values(room.members).filter((m) => m.actor !== from && m.name)
  const lower = body.toLowerCase()
  const found = new Set()
  for (const member of members) {
    const full = member.name.toLowerCase()
    const first = full.split(/\s+/)[0]
    const sharesFirst = members.filter((m) => m.name.toLowerCase().split(/\s+/)[0] === first).length > 1
    const candidates = sharesFirst ? [full] : [full, first]
    for (const name of candidates) {
      const at = lower.indexOf(`@${name}`)
      if (at === -1) continue
      const next = lower[at + name.length + 1]
      if (next === undefined || !/[\p{L}\p{N}_]/u.test(next)) { found.add(member.actor); break }
    }
    if (found.size >= MAX_MENTIONS) break
  }
  return [...found]
}

function cleanChanges(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_REQUEST_CHANGES).map((change) => ({
    label: cleanText(change?.label, MAX_CHANGE_TEXT) ?? 'Change',
    before: cleanText(change?.before, MAX_CHANGE_TEXT),
    after: cleanText(change?.after, MAX_CHANGE_TEXT),
    ...(typeof change?.routeKey === 'string' ? { routeKey: normalizeRouteKey(change.routeKey) } : {}),
    ...(VIEWPORTS.includes(change?.viewport) ? { viewport: change.viewport } : {}),
  }))
}

/** Base style edits a Tailwind project may take into class lists (lib/style-writeback.mjs). */
function cleanStyleEdits(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const edit of value.slice(0, MAX_REQUEST_PATHS)) {
    if (!edit || !isRequestPath(edit.path) || typeof edit.className !== 'string' || /[<>{}`\\]/.test(edit.className)) continue
    if (typeof edit.tag !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/i.test(edit.tag)) continue
    const styles = {}
    for (const [property, raw] of Object.entries(edit.styles ?? {}).slice(0, 40)) {
      if (/^[a-zA-Z-]{1,40}$/.test(property) && typeof raw === 'string' && raw.length <= 200) styles[property] = raw
    }
    if (!Object.keys(styles).length) continue
    out.push({ routeKey: normalizeRouteKey(edit.routeKey ?? '/'), viewport: 'desktop', path: edit.path, tag: edit.tag, className: edit.className.slice(0, 1000), styles })
  }
  return out
}

function cleanTextEdits(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_REQUEST_PATHS)
    .filter((edit) => typeof edit?.from === 'string' && typeof edit?.to === 'string')
    .map((edit) => ({ from: edit.from.slice(0, 4000), to: edit.to.slice(0, 4000) }))
}

export { PRESENCE_TTL_MS }
