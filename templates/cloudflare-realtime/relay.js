/**
 * The Froam realtime relay — the logic, independent of where it runs.
 *
 * One relay per room. Members connect with a ticket the room server signed;
 * the room server POSTs a wake-up after each change; members send presence
 * (cursor, selection, typing) and everyone else in the room gets it at once.
 * Nothing is stored: presence is gone the moment the socket closes.
 */

const enc = new TextEncoder()
const MAX_FRAME = 4_096

const fromB64url = (text) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** WebCrypto twin of lib/realtime.mjs's verifier: the claims, or null. */
export async function verifyTicket(secret, ticket, { now = Date.now() } = {}) {
  if (typeof ticket !== 'string' || !ticket.includes('.')) return null
  const [payload, signature] = ticket.split('.')
  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify('HMAC', key, fromB64url(signature), enc.encode(payload))
    if (!ok) return null
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload)))
    return claims && claims.exp > now ? { roomId: claims.r, actor: claims.a } : null
  } catch {
    return null
  }
}

/** Constant-time enough for a shared secret compared once per publish. */
export function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const label = (value, max = 80) => (typeof value === 'string' ? value.slice(0, max) : null)
const num = (value) => (Number.isFinite(value) ? Math.max(-10_000, Math.min(100_000, value)) : null)

/** Presence as the relay passes it on: known fields only, bounded. */
export function cleanPresence(value) {
  if (!value || typeof value !== 'object') return null
  const cursor = value.cursor && typeof value.cursor === 'object' ? { x: num(value.cursor.x), y: num(value.cursor.y) } : null
  return {
    routeKey: label(value.routeKey, 400),
    viewport: ['desktop', 'tablet', 'mobile'].includes(value.viewport) ? value.viewport : null,
    selectedPath: label(value.selectedPath, 400),
    selectedNodeId: label(value.selectedNodeId, 128),
    lockedPath: label(value.lockedPath, 400),
    lockedNodeId: label(value.lockedNodeId, 128),
    cursor: cursor && cursor.x !== null && cursor.y !== null ? cursor : null,
    tool: label(value.tool),
    action: label(value.action),
  }
}

/**
 * A relay over any set of sockets. `sockets()` lists the open ones, each with
 * the actor it was accepted for (`actorOf(socket)`); `send(socket, text)`
 * delivers, ignoring sockets that have gone.
 */
export function createRelay({ sockets, actorOf, send }) {
  const broadcast = (message, except = null) => {
    const text = JSON.stringify(message)
    for (const socket of sockets()) if (socket !== except) send(socket, text)
  }
  return {
    wake(sequence) {
      broadcast({ type: 'wake', sequence: Number(sequence) || 0 })
    },
    message(socket, raw) {
      if (typeof raw !== 'string' || raw.length > MAX_FRAME) return
      let frame
      try { frame = JSON.parse(raw) } catch { return }
      const actor = actorOf(socket)
      if (!actor) return
      if (frame?.type === 'presence') {
        const presence = cleanPresence(frame.presence)
        if (presence) broadcast({ type: 'presence', actor, presence, at: Date.now() }, socket)
      } else if (frame?.type === 'ping') {
        send(socket, JSON.stringify({ type: 'pong' }))
      }
    },
    left(socket) {
      const actor = actorOf(socket)
      if (actor && ![...sockets()].some((other) => other !== socket && actorOf(other) === actor)) broadcast({ type: 'leave', actor }, socket)
    },
  }
}
