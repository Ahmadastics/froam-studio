/**
 * Froam rooms on Cloudflare — the whole room server in one Worker.
 *
 * Each room is a Durable Object: its state lives in the object's own storage,
 * every request for the room runs inside it one at a time (so there are no
 * write races to retry), and it holds the room's WebSockets — the realtime
 * relay and the room are the same thing, so "something changed" and presence
 * never leave the object. A room deletes itself when its time is up.
 *
 *   /api/froam/rooms                 POST  open a room
 *   /api/froam/rooms/:id/...         the room API (lib/room-store.mjs)
 *   /api/froam/rooms/:id/socket      WebSocket, with a ticket from the room API
 *
 * Point your site at it with a rewrite (Vercel, Netlify, Next…) so the
 * browser talks to your own origin, and the socket goes straight here.
 *
 * Imports are relative so this file works from the package and from a
 * project that links it.
 */
import { createFroamRoomApi } from '../../lib/room-store.mjs'
import { signRealtimeTicket } from '../../lib/realtime.mjs'
import { createRelay, verifyTicket } from '../cloudflare-realtime/relay.js'

const ROOM_PATH = /^\/api\/froam\/rooms(?:\/([A-Za-z0-9_-]{1,80})(\/.*)?)?$/
/** A room is stored in pieces: a single Durable Object value tops out below a busy room. */
const CHUNK = 1_000_000

/** A Node-style request and response around a Worker Request, for the shared room API. */
async function runNodeHandler(handler, request) {
  const url = new URL(request.url)
  let body
  if (request.method === 'POST') {
    try { body = await request.json() } catch { body = {} }
  }
  const req = { method: request.method, url: url.pathname + url.search, headers: Object.fromEntries(request.headers), body }
  const headers = new Headers()
  let text = ''
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(name, value) { headers.set(name, String(value)) },
    write(chunk) { text += chunk },
    flushHeaders() {},
    end(chunk) { if (chunk) text += chunk; this.headersSent = true },
  }
  const handled = await handler(req, res)
  if (!handled) return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  return new Response(text, { status: res.statusCode, headers })
}

const json = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * @param {(env: Record<string, unknown>) => {
 *   roomTtlMs?: number,
 *   createsPerWindow?: number,
 *   onApproveRequest?: Function,
 *   onRevertRequest?: Function,
 *   notify?: Function | null,
 * }} configure  per-deployment options; `env` holds the Worker's vars and secrets.
 */
export function createFroamRoomsWorker(configure = () => ({})) {
  const recentCreates = new Map()
  function allowCreate(ip, limit) {
    const now = Date.now()
    const times = (recentCreates.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000)
    if (times.length >= limit) return false
    times.push(now)
    recentCreates.set(ip, times)
    return true
  }

  const worker = {
    async fetch(request, env) {
      const url = new URL(request.url)
      const match = ROOM_PATH.exec(url.pathname)
      if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
      if (!match) return new Response(url.pathname === '/' ? 'Froam rooms' : 'Not found', { status: url.pathname === '/' ? 200 : 404 })
      const [, roomId] = match
      if (!roomId) {
        if (request.method !== 'POST') return json(405, { success: false, error: 'Method not allowed' })
        const config = configure(env)
        const ip = (request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? 'unknown').split(',')[0].trim()
        if (!allowCreate(ip, config.createsPerWindow ?? 20)) return json(403, { success: false, error: 'Too many rooms opened from here — try again in a few minutes' })
        // The room's id decides which object holds it, so the id is chosen first.
        const id = crypto.randomUUID()
        const forwarded = new Request(request, { headers: new Headers([...request.headers, ['x-froam-new-room', id]]) })
        return env.ROOMS.get(env.ROOMS.idFromName(id)).fetch(forwarded)
      }
      return env.ROOMS.get(env.ROOMS.idFromName(roomId)).fetch(request)
    },
  }

  class FroamRoom {
    constructor(state, env) {
      this.state = state
      this.env = env
      this.config = configure(env)
      this.secret = String(env.FROAM_REALTIME_SECRET ?? '')
      this.origin = null
      this.newRoomId = null
      this.relay = createRelay({
        sockets: () => this.state.getWebSockets(),
        actorOf: (socket) => socket.deserializeAttachment()?.actor ?? null,
        send: (socket, text) => { try { socket.send(text) } catch { /* closed */ } },
      })
      const store = this.state.storage
      this.api = createFroamRoomApi({
        storage: {
          get: async () => {
            const count = await store.get('room/count')
            if (!count) return null
            const parts = await store.get(Array.from({ length: count }, (_, i) => `room/${i}`))
            return JSON.parse(Array.from({ length: count }, (_, i) => parts.get(`room/${i}`) ?? '').join(''))
          },
          put: async (room) => {
            const text = JSON.stringify(room)
            const count = Math.max(1, Math.ceil(text.length / CHUNK))
            const entries = {}
            for (let i = 0; i < count; i += 1) entries[`room/${i}`] = text.slice(i * CHUNK, (i + 1) * CHUNK)
            entries['room/count'] = count
            await store.put(entries)
            if (room.expiresAt && !(await store.getAlarm())) await store.setAlarm(room.expiresAt)
          },
        },
        realtime: this.secret ? {
          connection: (id, actor) => ({
            url: `${(this.env.FROAM_PUBLIC_URL ?? this.origin ?? '').replace(/^http/, 'ws')}/api/froam/rooms/${id}/socket`,
            ticket: signRealtimeTicket(this.secret, { roomId: id, actor }),
          }),
          publish: (_id, sequence) => this.relay.wake(sequence),
        } : null,
        mintRoomId: () => this.newRoomId ?? crypto.randomUUID(),
        roomTtlMs: this.config.roomTtlMs ?? null,
        presenceWriteMs: this.config.presenceWriteMs ?? 30_000,
        onApproveRequest: this.config.onApproveRequest ?? null,
        onRevertRequest: this.config.onRevertRequest ?? null,
        notify: this.config.notify ?? null,
      })
    }

    async fetch(request) {
      const url = new URL(request.url)
      this.origin = this.origin ?? url.origin
      const [, roomId, rest = ''] = ROOM_PATH.exec(url.pathname) ?? []

      if (rest === '/socket') {
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
        const claims = this.secret ? await verifyTicket(this.secret, url.searchParams.get('ticket')) : null
        if (!claims || claims.roomId !== roomId) return new Response('Forbidden', { status: 403 })
        const [client, server] = Object.values(new WebSocketPair())
        this.state.acceptWebSocket(server)
        server.serializeAttachment({ actor: claims.actor })
        return new Response(null, { status: 101, webSocket: client })
      }
      // The socket replaces the event stream; the stream answers "use polling".
      if (rest === '/stream') return new Response(null, { status: 204 })

      this.newRoomId = request.headers.get('x-froam-new-room')
      try {
        return await runNodeHandler(this.api, request)
      } catch (error) {
        console.error('[froam-rooms]', error)
        return json(500, { success: false, error: 'The room server hit a problem' })
      } finally {
        this.newRoomId = null
      }
    }

    webSocketMessage(socket, message) {
      this.relay.message(socket, typeof message === 'string' ? message : new TextDecoder().decode(message))
    }

    webSocketClose(socket) { this.relay.left(socket) }
    webSocketError(socket) { this.relay.left(socket) }

    /** The room's time is up: close the sockets and forget it. */
    async alarm() {
      for (const socket of this.state.getWebSockets()) { try { socket.close(1000, 'This room has ended') } catch { /* gone */ } }
      await this.state.storage.deleteAll()
    }
  }

  return { worker, FroamRoom }
}
