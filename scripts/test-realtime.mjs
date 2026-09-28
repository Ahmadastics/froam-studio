/**
 * Realtime: tickets the room server signs and the relay trusts, the relay's
 * fan-out, and the room server's side (tickets on join, wake-ups after
 * changes, heartbeats that don't cost a write).
 */
import assert from 'node:assert/strict'
import os from 'node:os'
import fsp from 'node:fs/promises'
import nodePath from 'node:path'
import { createRealtimeRelayClient, signRealtimeTicket, verifyRealtimeTicket } from '../lib/realtime.mjs'
import { createFroamRoomApi } from '../lib/room-store.mjs'
import { cleanPresence, createRelay, sameSecret, verifyTicket } from '../templates/cloudflare-realtime/relay.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])
const SECRET = 'a-long-shared-secret-for-tests'

test('a ticket signed by the room server is trusted by the relay (WebCrypto)', async () => {
  const ticket = signRealtimeTicket(SECRET, { roomId: 'room-1', actor: 'a_maya' })
  assert.deepEqual(await verifyTicket(SECRET, ticket), { roomId: 'room-1', actor: 'a_maya' })
  assert.deepEqual(verifyRealtimeTicket(SECRET, ticket)?.actor, 'a_maya')
})

test('a forged, altered or expired ticket is refused', async () => {
  const ticket = signRealtimeTicket(SECRET, { roomId: 'room-1', actor: 'a_maya' })
  const [payload, signature] = ticket.split('.')
  const other = Buffer.from(JSON.stringify({ r: 'room-1', a: 'a_owner', exp: Date.now() + 1e6 })).toString('base64url')
  assert.equal(await verifyTicket(SECRET, `${other}.${signature}`), null)
  assert.equal(await verifyTicket('another-secret', ticket), null)
  assert.equal(await verifyTicket(SECRET, `${payload}.x${signature.slice(1)}`), null)
  const old = signRealtimeTicket(SECRET, { roomId: 'room-1', actor: 'a_maya', ttlMs: 1000, now: Date.now() - 5000 })
  assert.equal(await verifyTicket(SECRET, old), null)
  assert.equal(verifyRealtimeTicket(SECRET, old), null)
  assert.equal(await verifyTicket(SECRET, 'nonsense'), null)
})

test('the publish secret is compared whole', () => {
  assert.equal(sameSecret(SECRET, SECRET), true)
  assert.equal(sameSecret(SECRET, `${SECRET}x`), false)
  assert.equal(sameSecret(SECRET, undefined), false)
})

function fakeRoom() {
  const sockets = []
  const connect = (actor) => { const socket = { actor, sent: [] }; sockets.push(socket); return socket }
  const relay = createRelay({ sockets: () => sockets, actorOf: (socket) => socket.actor, send: (socket, text) => socket.sent.push(JSON.parse(text)) })
  return { sockets, connect, relay, close: (socket) => { relay.left(socket); sockets.splice(sockets.indexOf(socket), 1) } }
}

test('presence goes to everyone else in the room, cleaned, and not back to the sender', () => {
  const { connect, relay } = fakeRoom()
  const maya = connect('a_maya')
  const owner = connect('a_owner')
  relay.message(maya, JSON.stringify({ type: 'presence', presence: { cursor: { x: 10, y: 20 }, action: 'Typing a message', routeKey: '/', viewport: 'desktop', secret: 'nope' } }))
  assert.equal(maya.sent.length, 0)
  assert.equal(owner.sent[0].type, 'presence')
  assert.equal(owner.sent[0].actor, 'a_maya')
  assert.deepEqual(owner.sent[0].presence.cursor, { x: 10, y: 20 })
  assert.equal(owner.sent[0].presence.action, 'Typing a message')
  assert.equal(owner.sent[0].presence.secret, undefined)
})

test('a wake-up reaches everyone; junk and oversized frames are ignored', () => {
  const { connect, relay } = fakeRoom()
  const a = connect('a')
  const b = connect('b')
  relay.wake(42)
  assert.deepEqual(a.sent, [{ type: 'wake', sequence: 42 }])
  assert.deepEqual(b.sent, [{ type: 'wake', sequence: 42 }])
  relay.message(a, 'not json')
  relay.message(a, JSON.stringify({ type: 'presence', presence: { action: 'x'.repeat(5000) } }))
  relay.message(a, JSON.stringify({ type: 'ops', ops: [] }))
  assert.equal(b.sent.length, 1)
  relay.message(a, JSON.stringify({ type: 'ping' }))
  assert.deepEqual(a.sent.at(-1), { type: 'pong' })
})

test('someone leaves when their last tab closes, not their first', () => {
  const { connect, close } = fakeRoom()
  const tab1 = connect('a_maya')
  const tab2 = connect('a_maya')
  const owner = connect('a_owner')
  close(tab1)
  assert.equal(owner.sent.length, 0)
  close(tab2)
  assert.deepEqual(owner.sent, [{ type: 'leave', actor: 'a_maya' }])
})

test('presence cleaning keeps only what presence is', () => {
  assert.equal(cleanPresence(null), null)
  assert.deepEqual(cleanPresence({ cursor: { x: 'a', y: 2 }, viewport: 'watch' }), {
    routeKey: null, viewport: null, selectedPath: null, selectedNodeId: null, lockedPath: null, lockedNodeId: null, cursor: null, tool: null, action: null,
  })
})

/* ── the room server's side ── */

function res() {
  return { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v }, end(text) { this.body = text } }
}
async function call(api, method, url, body) {
  const r = res()
  await api({ method, url, body }, r)
  return { status: r.statusCode, ...JSON.parse(r.body || '{}') }
}

async function relayRoom(options = {}) {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-rt-'))
  const published = []
  const writes = { count: 0 }
  const rooms = new Map()
  const storage = { get: (id) => (rooms.has(id) ? JSON.parse(rooms.get(id)) : null), put: (room) => { writes.count += 1; rooms.set(room.id, JSON.stringify(room)) } }
  const realtime = createRealtimeRelayClient({ url: 'https://relay.test', secret: SECRET, fetchImpl: async (url, init) => { published.push({ url, init, body: JSON.parse(init.body) }); return { ok: true } } })
  const api = createFroamRoomApi({ storage, realtime, presenceWriteMs: options.presenceWriteMs ?? 0, now: () => Date.now() })
  const created = await call(api, 'POST', '/api/froam/rooms', { name: 'Ahmad' })
  void dir
  return { api, created, published, writes }
}

test('joining hands a member a ticket to their own room’s socket', async () => {
  const { api, created } = await relayRoom()
  const joined = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, { token: created.invites.contributor, name: 'Maya' })
  assert.equal(joined.realtime.url, `wss://relay.test/rooms/${created.room.id}`)
  const claims = await verifyTicket(SECRET, joined.realtime.ticket)
  assert.deepEqual(claims, { roomId: created.room.id, actor: joined.you.actor })
  const read = await call(api, 'GET', `/api/froam/rooms/${created.room.id}?token=${created.invites.contributor}&actor=${joined.you.actor}&session=${joined.you.session}`)
  assert.equal((await verifyTicket(SECRET, read.realtime.ticket)).actor, joined.you.actor)
  const stranger = await call(api, 'GET', `/api/froam/rooms/${created.room.id}?token=${created.invites.viewer}`)
  assert.equal(stranger.realtime, null, 'a ticket went to someone who hasn’t joined')
})

test('the relay is woken when there is something new, not on every heartbeat', async () => {
  const { api, created, published } = await relayRoom()
  const joined = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, { token: created.invites.contributor, name: 'Maya' })
  const before = published.length
  const who = { token: created.invites.contributor, actor: joined.you.actor, session: joined.you.session }
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/presence`, { ...who, routeKey: '/' })
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/presence`, { ...who, routeKey: '/' })
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(published.length, before, 'heartbeats woke the relay')
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/chat`, { ...who, body: 'Hi' })
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(published.length, before + 1)
  const wake = published.at(-1)
  assert.equal(wake.url, `https://relay.test/rooms/${created.room.id}/publish`)
  assert.equal(wake.init.headers.Authorization, `Bearer ${SECRET}`)
  assert.equal(wake.body.type, 'wake')
})

test('with presenceWriteMs, an unchanged heartbeat isn’t stored; a change is', async () => {
  const { api, created, writes } = await relayRoom({ presenceWriteMs: 60_000 })
  const joined = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, { token: created.invites.editor, name: 'Sam' })
  const who = { token: created.invites.editor, actor: joined.you.actor, session: joined.you.session }
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/presence`, { ...who, routeKey: '/', viewport: 'desktop' })
  const afterFirst = writes.count
  for (let i = 0; i < 5; i += 1) await call(api, 'POST', `/api/froam/rooms/${created.room.id}/presence`, { ...who, routeKey: '/', viewport: 'desktop', cursor: { x: i, y: i } })
  assert.equal(writes.count, afterFirst, 'cursor-only heartbeats were stored')
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/presence`, { ...who, routeKey: '/', viewport: 'desktop', selectedPath: 'main:1/h1:1' })
  assert.equal(writes.count, afterFirst + 1, 'a new selection was not stored')
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}`)
    console.log(`       ${String(error?.stack ?? error).split('\n').slice(0, 5).join('\n       ')}`)
  }
}
console.log(`\nrealtime: ${tests.length - failed}/${tests.length} passed`)
process.exit(failed ? 1 : 0)
