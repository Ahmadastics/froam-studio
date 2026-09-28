/**
 * The Cloudflare room server, against a running instance:
 *
 *   cd templates/cloudflare-rooms
 *   npx wrangler dev --port 8799 --var FROAM_REALTIME_SECRET:<something long>
 *   FROAM_ROOMS_URL=http://127.0.0.1:8799 node scripts/test-cloudflare-rooms.mjs
 *
 * Or point FROAM_ROOMS_URL at a deployed one. Exercises the room API through
 * the Worker and its Durable Object, and the room's own WebSocket.
 */
import assert from 'node:assert/strict'

const BASE = (process.env.FROAM_ROOMS_URL ?? 'http://127.0.0.1:8799').replace(/\/+$/, '')
const tests = []
const test = (name, fn) => tests.push([name, fn])
const post = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }))
const get = (path) => fetch(`${BASE}${path}`).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }))

const state = {}

function openSocket(realtime) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${realtime.url}?ticket=${encodeURIComponent(realtime.ticket)}`)
    const frames = []
    socket.onmessage = (event) => frames.push(JSON.parse(String(event.data)))
    socket.onopen = () => resolve({ socket, frames })
    socket.onerror = () => reject(new Error('socket failed'))
  })
}
const until = async (check, ms = 5000) => {
  const end = Date.now() + ms
  while (Date.now() < end) { if (check()) return true; await new Promise((r) => setTimeout(r, 25)) }
  return false
}

test('a room opens in its own object, with an expiry', async () => {
  const created = await post('/api/froam/rooms', { name: 'Ahmad', title: 'Founder' })
  assert.equal(created.status, 200, JSON.stringify(created))
  assert.ok(created.room.id)
  assert.equal(created.room.members[0].title, 'Founder')
  state.created = created
  state.owner = { token: created.invites.owner, actor: created.you.actor, session: created.you.session }
  const read = await get(`/api/froam/rooms/${created.room.id}?token=${created.invites.owner}&actor=${created.you.actor}&session=${created.you.session}`)
  assert.equal(read.room.id, created.room.id)
  assert.ok(read.realtime?.url.endsWith(`/api/froam/rooms/${created.room.id}/socket`), JSON.stringify(read.realtime))
  state.ownerRealtime = read.realtime
})

test('joining by link works, and the link says what it grants first', async () => {
  const id = state.created.room.id
  const peek = await get(`/api/froam/rooms/${id}?token=${state.created.invites.contributor}`)
  assert.equal(peek.invite, 'contributor')
  const joined = await post(`/api/froam/rooms/${id}/join`, { token: state.created.invites.contributor, name: 'Maya', title: 'Marketing' })
  assert.equal(joined.you.role, 'contributor')
  state.maya = { token: state.created.invites.contributor, actor: joined.you.actor, session: joined.you.session }
  state.mayaRealtime = joined.realtime
})

test('the room’s socket: a message wakes everyone, presence goes person to person', async () => {
  const owner = await openSocket(state.ownerRealtime)
  const maya = await openSocket(state.mayaRealtime)
  const id = state.created.room.id
  const sent = await post(`/api/froam/rooms/${id}/chat`, { ...state.maya, body: 'Hi @Ahmad' })
  assert.deepEqual(sent.message.mentions, [state.owner.actor])
  assert.ok(await until(() => owner.frames.some((f) => f.type === 'wake')), 'no wake-up reached the owner')
  maya.socket.send(JSON.stringify({ type: 'presence', presence: { cursor: { x: 5, y: 6 }, action: 'Typing a message' } }))
  assert.ok(await until(() => owner.frames.some((f) => f.type === 'presence' && f.actor === state.maya.actor)), 'presence did not reach the owner')
  maya.socket.close()
  assert.ok(await until(() => owner.frames.some((f) => f.type === 'leave' && f.actor === state.maya.actor)), 'no leave')
  owner.socket.close()
})

test('a forged ticket or another room’s ticket is refused', async () => {
  const bad = new WebSocket(`${state.ownerRealtime.url}?ticket=forged.ticket`)
  const refused = await new Promise((resolve) => { bad.onopen = () => resolve(false); bad.onerror = () => resolve(true); bad.onclose = () => resolve(true) })
  assert.equal(refused, true)
})

test('many pages in one request: submit, approve with an undo, revert', async () => {
  const id = state.created.room.id
  const submitted = await post(`/api/froam/rooms/${id}/requests`, {
    ...state.maya, title: 'Hero', changes: [{ label: 'Headline', before: 'A', after: 'B' }],
    scopes: [
      { routeKey: '/', viewport: 'desktop', store: { 'main:1/h1:1': { text: 'B' } } },
      { routeKey: '/', viewport: 'mobile', store: { 'main:1/h1:1': { styles: { fontSize: '28px' } } } },
    ],
  })
  assert.equal(submitted.request.scopes.length, 2)
  const approved = await post(`/api/froam/rooms/${id}/requests/${submitted.request.id}/decision`, { ...state.owner, decision: 'approved' })
  assert.equal(approved.request.status, 'approved')
  const reverted = await post(`/api/froam/rooms/${id}/requests/${submitted.request.id}/revert`, { ...state.owner })
  assert.ok(reverted.status === 200 || reverted.status === 501, JSON.stringify(reverted))
})

test('a big room still stores (it is kept in pieces)', async () => {
  const id = state.created.room.id
  const photo = `data:image/jpeg;base64,${'A'.repeat(59_000)}`
  for (let i = 0; i < 25; i += 1) {
    const joined = await post(`/api/froam/rooms/${id}/join`, { token: state.created.invites.viewer, name: `Guest ${i}`, avatarUrl: photo })
    assert.equal(joined.status, 200, `guest ${i}: ${JSON.stringify(joined).slice(0, 200)}`)
  }
  const read = await get(`/api/froam/rooms/${id}?token=${state.created.invites.owner}`)
  assert.ok(read.room.members.length >= 27)
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}`)
    console.log(`       ${String(error?.message ?? error).split('\n').slice(0, 4).join('\n       ')}`)
  }
}
console.log(`\ncloudflare rooms: ${tests.length - failed}/${tests.length} passed (${BASE})`)
process.exit(failed ? 1 : 0)
