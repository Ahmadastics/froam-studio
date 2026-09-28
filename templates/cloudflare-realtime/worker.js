/**
 * Froam realtime relay on Cloudflare — one Durable Object per room.
 *
 *   GET  /rooms/:id?ticket=…      WebSocket for a member (ticket from the room server)
 *   POST /rooms/:id/publish       the room server says "something changed" (Bearer secret)
 *
 * Deploy (free tier is plenty):
 *   npx wrangler deploy
 *   npx wrangler secret put FROAM_REALTIME_SECRET
 * then give the room server the same secret and this worker's URL
 * (createRealtimeRelayClient({ url, secret })).
 *
 * Uses the WebSocket Hibernation API: an idle room costs nothing while its
 * members sit with the page open.
 */
import { createRelay, sameSecret, verifyTicket } from './relay.js'

const ROOM_PATH = /^\/rooms\/([A-Za-z0-9_-]{1,80})(\/publish)?$/

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const match = ROOM_PATH.exec(url.pathname)
    if (!match) return new Response('Froam realtime relay', { status: url.pathname === '/' ? 200 : 404 })
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]))
    return room.fetch(request)
  },
}

export class RoomRelay {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.relay = createRelay({
      sockets: () => this.state.getWebSockets(),
      actorOf: (socket) => socket.deserializeAttachment()?.actor ?? null,
      send: (socket, text) => { try { socket.send(text) } catch { /* closed */ } },
    })
  }

  async fetch(request) {
    const url = new URL(request.url)
    const [, roomId, publish] = ROOM_PATH.exec(url.pathname) ?? []
    const secret = this.env.FROAM_REALTIME_SECRET
    if (!secret) return new Response('FROAM_REALTIME_SECRET is not set', { status: 500 })

    if (publish) {
      if (request.method !== 'POST') return new Response('POST only', { status: 405 })
      const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (!sameSecret(bearer, secret)) return new Response('Forbidden', { status: 403 })
      const body = await request.json().catch(() => ({}))
      this.relay.wake(body?.sequence)
      return new Response(null, { status: 204 })
    }

    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const claims = await verifyTicket(secret, url.searchParams.get('ticket'))
    if (!claims || claims.roomId !== roomId) return new Response('Forbidden', { status: 403 })
    const [client, server] = Object.values(new WebSocketPair())
    this.state.acceptWebSocket(server)
    server.serializeAttachment({ actor: claims.actor })
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(socket, message) {
    this.relay.message(socket, typeof message === 'string' ? message : new TextDecoder().decode(message))
  }

  webSocketClose(socket) {
    this.relay.left(socket)
  }

  webSocketError(socket) {
    this.relay.left(socket)
  }
}
