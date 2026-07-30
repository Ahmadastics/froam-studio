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
 *
 * The link is the credential. An invite token carries a role, so a client can
 * be let in without an account, a password, or an email — which is the whole
 * reason a client will actually open it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { normalizeRouteKey, VIEWPORTS } from './codegen.mjs'

const ROLES = new Set(['owner', 'editor', 'commenter', 'viewer'])
const MAX_BODY_BYTES = 200_000
const MAX_NAME_LENGTH = 60
const MAX_MEMBERS = 50

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
    here: isHere(member, now),
    routeKey: member.routeKey ?? null,
    viewport: member.viewport ?? null,
    selectedPath: member.selectedPath ?? null,
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
    you: you ?? null,
  }
}

/**
 * @param {{
 *   file: string,
 *   authorize?: (req: import('node:http').IncomingMessage) => boolean | Promise<boolean>,
 *   log?: (line: string) => void,
 *   now?: () => number,
 * }} options
 */
export function createFroamRoomApi({ file, authorize = null, log = () => {}, now = () => Date.now() }) {
  return async function handleRoomRequest(req, res) {
    const url = new URL(req.url ?? '/', 'http://froam.local')
    const match = url.pathname.match(/\/rooms(?:\/([A-Za-z0-9_-]+))?(?:\/(join|presence))?\/?$/)
    if (!match) return false

    const [, roomId, action] = match
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

      const id = randomUUID()
      const ownerActor = `a_${randomBytes(9).toString('base64url')}`
      const stamp = now()

      // One token per role, so an invite link decides what the person can do
      // and revoking a role is deleting a token rather than editing a list.
      const tokens = {}
      const invites = {}
      for (const role of ['owner', 'editor', 'commenter', 'viewer']) {
        const token = mintToken()
        tokens[token] = role
        invites[role] = token
      }

      const room = {
        id,
        createdAt: stamp,
        routes,
        ownerActor,
        tokens,
        members: {
          [ownerActor]: { actor: ownerActor, name: ownerName, role: 'owner', joinedAt: stamp, seenAt: stamp },
        },
      }

      const all = loadRooms(file)
      all.rooms[id] = room
      saveRooms(file, all)
      log(`room ${id} opened`)

      sendJson(res, 200, {
        success: true,
        room: publicRoom(room, stamp, { actor: ownerActor, role: 'owner', name: ownerName }),
        // Returned once, to whoever opened the room. Never in a GET.
        invites,
        you: { actor: ownerActor, role: 'owner', name: ownerName, token: invites.owner },
      })
      return true
    }

    if (!roomId) {
      sendJson(res, 405, { success: false, error: 'Method not allowed' })
      return true
    }

    const all = loadRooms(file)
    const room = all.rooms[roomId]
    if (!room) {
      sendJson(res, 404, { success: false, error: 'No such room' })
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

    /* ── read ───────────────────────────────────────────────── */
    if (!action && method === 'GET') {
      const actor = url.searchParams.get('actor')
      const you = actor && room.members[actor]
        ? { actor, role: room.members[actor].role, name: room.members[actor].name }
        : null
      sendJson(res, 200, { success: true, room: publicRoom(room, now(), you) })
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
      const returning = typeof body.actor === 'string' && room.members[body.actor]
      const actor = returning ? body.actor : `a_${randomBytes(9).toString('base64url')}`
      const stamp = now()

      room.members[actor] = {
        ...(room.members[actor] ?? {}),
        actor,
        name,
        // A token cannot promote you past what it grants, and rejoining on a
        // guest link must never quietly demote the owner.
        role: returning ? room.members[actor].role : role,
        joinedAt: room.members[actor]?.joinedAt ?? stamp,
        seenAt: stamp,
      }
      saveRooms(file, all)
      log(`${name} joined room ${roomId} as ${room.members[actor].role}`)

      sendJson(res, 200, {
        success: true,
        you: { actor, role: room.members[actor].role, name },
        room: publicRoom(room, stamp, { actor, role: room.members[actor].role, name }),
      })
      return true
    }

    /* ── presence ───────────────────────────────────────────── */
    if (action === 'presence' && method === 'POST') {
      const body = req.body ?? {}
      const member = typeof body.actor === 'string' ? room.members[body.actor] : null
      if (!member) {
        sendJson(res, 404, { success: false, error: 'Join the room first' })
        return true
      }
      const stamp = now()
      member.seenAt = stamp
      if (typeof body.routeKey === 'string') member.routeKey = normalizeRouteKey(body.routeKey)
      if (VIEWPORTS.includes(body.viewport)) member.viewport = body.viewport
      member.selectedPath = typeof body.selectedPath === 'string' ? body.selectedPath : null
      saveRooms(file, all)

      sendJson(res, 200, {
        success: true,
        room: publicRoom(room, stamp, { actor: member.actor, role: member.role, name: member.name }),
      })
      return true
    }

    sendJson(res, 405, { success: false, error: 'Method not allowed' })
    return true
  }
}

export { PRESENCE_TTL_MS }
