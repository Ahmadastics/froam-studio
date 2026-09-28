/**
 * Froam realtime — the part of a room that shouldn't wait for a poll.
 *
 * A room's durable state (ops, messages, requests) lives wherever the host
 * keeps rooms, and clients read it over plain HTTP. What needs to be instant
 * is smaller: "something changed, read now", and presence — cursors,
 * selections, who is typing — which is never worth storing at all.
 *
 * On `froam dev` that already works (server-sent events from the bridge). A
 * serverless host can't hold connections open, so this adds a relay: a tiny
 * WebSocket fan-out per room (templates/cloudflare-realtime is one, on
 * Cloudflare's free tier). The room server hands each member a signed ticket
 * for their room, and tells the relay when something changed; members send
 * presence straight through it to each other.
 *
 * Tickets are HMAC-SHA256 over { room, actor, exp } with a secret only the
 * room server and the relay know — the relay never sees a room token and
 * can't be used to reach a room you weren't let into.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const TICKET_TTL_MS = 12 * 60 * 60 * 1000

const b64url = (buffer) => Buffer.from(buffer).toString('base64url')

/** A ticket for one member of one room. */
export function signRealtimeTicket(secret, { roomId, actor, ttlMs = TICKET_TTL_MS, now = Date.now() }) {
  const payload = b64url(JSON.stringify({ r: roomId, a: actor, exp: now + ttlMs }))
  const signature = b64url(createHmac('sha256', secret).update(payload).digest())
  return `${payload}.${signature}`
}

/** The ticket's claims when it is genuine and current; null otherwise. (The relay has its own WebCrypto copy.) */
export function verifyRealtimeTicket(secret, ticket, { now = Date.now() } = {}) {
  if (typeof ticket !== 'string' || !ticket.includes('.')) return null
  const [payload, signature] = ticket.split('.')
  const expected = createHmac('sha256', secret).update(payload).digest()
  const given = Buffer.from(signature ?? '', 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return claims && claims.exp > now ? { roomId: claims.r, actor: claims.a, exp: claims.exp } : null
  } catch {
    return null
  }
}

/**
 * The room server's side: tickets for members, and a wake-up to the relay
 * after each change. Pass the result to createFroamRoomApi as `realtime`.
 *
 * @param {{ url: string, secret: string, fetchImpl?: typeof fetch }} options
 *   `url` is the relay's base (https://…); clients connect to its wss:// twin.
 */
export function createRealtimeRelayClient({ url, secret, fetchImpl = globalThis.fetch }) {
  if (!url || !secret) throw new Error('[froam] realtime needs the relay url and its shared secret')
  const base = url.replace(/\/+$/, '')
  const socketBase = base.replace(/^http/, 'ws')
  return {
    /** What a member needs to connect: the socket URL for their room and a ticket. */
    connection(roomId, actor) {
      return { url: `${socketBase}/rooms/${encodeURIComponent(roomId)}`, ticket: signRealtimeTicket(secret, { roomId, actor }) }
    },
    /** Tell everyone in the room to read now. Best effort: polling still catches up. */
    async publish(roomId, sequence) {
      await fetchImpl(`${base}/rooms/${encodeURIComponent(roomId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ type: 'wake', sequence }),
      })
    },
  }
}
