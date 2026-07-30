/**
 * Froam Rooms — room store tests.
 *
 * A room decides who may touch a design, so the refusals matter at least as
 * much as the happy path. Half of what follows is checking that the wrong
 * link cannot do the right thing.
 */
import assert from 'node:assert/strict'
import os from 'node:os'
import fsp from 'node:fs/promises'
import nodePath from 'node:path'

const { createFroamRoomApi, PRESENCE_TTL_MS } = await import('../lib/room-store.mjs')

let clock = 1_700_000_000_000
const now = () => clock
const tick = (ms) => { clock += ms }

async function freshApi() {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-rooms-'))
  return {
    file: nodePath.join(dir, 'froam.rooms.json'),
    api: createFroamRoomApi({ file: nodePath.join(dir, 'froam.rooms.json'), now }),
  }
}

function res() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k] = v },
    end(text) { this.body = text },
  }
}

async function call(api, method, url, body) {
  const r = res()
  const handled = await api({ method, url, body }, r)
  return { handled, status: r.statusCode, ...JSON.parse(r.body || '{}') }
}

const open = (api, name = 'Ahmad') => call(api, 'POST', '/api/froam/rooms', { name })

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('opening a room mints one invite per role', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  assert.equal(created.success, true)
  assert.deepEqual(Object.keys(created.invites).sort(), ['commenter', 'editor', 'owner', 'viewer'])
  assert.equal(created.you.role, 'owner')
  assert.equal(created.room.members.length, 1)
  // Four distinct tokens, or a role boundary is decorative.
  assert.equal(new Set(Object.values(created.invites)).size, 4)
})

test('room creation can be gated', async () => {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-rooms-'))
  const api = createFroamRoomApi({ file: nodePath.join(dir, 'r.json'), authorize: async () => false, now })
  const denied = await call(api, 'POST', '/api/froam/rooms', { name: 'Nope' })
  assert.equal(denied.status, 403)
})

test('a commenter link gets you in as a commenter', async () => {
  const { api } = await freshApi()
  const { room, invites } = await open(api)
  const joined = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, { token: invites.commenter, name: 'Amina' })
  assert.equal(joined.you.role, 'commenter')
  assert.equal(joined.you.name, 'Amina')
})

test('a made-up token opens nothing', async () => {
  const { api } = await freshApi()
  const { room } = await open(api)
  const denied = await call(api, 'GET', `/api/froam/rooms/${room.id}?token=not-a-real-token`)
  assert.equal(denied.status, 403)
})

test('no token opens nothing either', async () => {
  const { api } = await freshApi()
  const { room } = await open(api)
  assert.equal((await call(api, 'GET', `/api/froam/rooms/${room.id}`)).status, 403)
})

test('tokens are never handed back in a read', async () => {
  // A viewer must not be able to read the owner's token out of the room and
  // promote themselves.
  const { api } = await freshApi()
  const { room, invites } = await open(api)
  const seen = await call(api, 'GET', `/api/froam/rooms/${room.id}?token=${invites.viewer}`)
  const serialized = JSON.stringify(seen)
  for (const token of Object.values(invites)) {
    assert.equal(serialized.includes(token), false, 'a token leaked into a room read')
  }
})

test('joining needs a name, because a comment needs an author', async () => {
  const { api } = await freshApi()
  const { room, invites } = await open(api)
  const nameless = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, { token: invites.editor, name: '   ' })
  assert.equal(nameless.status, 400)
})

test('rejoining keeps your identity instead of minting a stranger', async () => {
  const { api } = await freshApi()
  const { room, invites } = await open(api)
  const first = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, { token: invites.editor, name: 'Zainab' })
  const again = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, { token: invites.editor, name: 'Zainab', actor: first.you.actor })
  assert.equal(again.you.actor, first.you.actor, 'a refresh must not orphan your history')
  assert.equal(again.room.members.length, 2, 'and must not add a duplicate person')
})

test('a guest link cannot demote the owner on rejoin', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const { room, invites } = created
  const rejoined = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, {
    token: invites.viewer, name: 'Ahmad', actor: created.you.actor,
  })
  assert.equal(rejoined.you.role, 'owner', 'role comes from the membership, not the link you happened to click')
})

test('presence says who is here', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const { room, invites } = created
  const guest = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, { token: invites.commenter, name: 'Amina' })

  const beat = await call(api, 'POST', `/api/froam/rooms/${room.id}/presence`, {
    token: invites.commenter, actor: guest.you.actor, routeKey: '/pricing', viewport: 'mobile', selectedPath: 'h1:1',
  })
  const amina = beat.room.members.find((m) => m.actor === guest.you.actor)
  assert.equal(amina.here, true)
  assert.equal(amina.routeKey, '/pricing')
  assert.equal(amina.viewport, 'mobile')
})

test('presence lapses, so a closed laptop stops driving a phone', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  tick(PRESENCE_TTL_MS + 1_000)
  const seen = await call(api, 'GET', `/api/froam/rooms/${created.room.id}?token=${created.invites.owner}`)
  const owner = seen.room.members.find((m) => m.actor === created.you.actor)
  assert.equal(owner.here, false)
  assert.equal(seen.room.presenter, null, 'nobody present means nobody is presenting')
})

test('the presenter is the editor who is actually here', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const { room, invites } = created
  const guest = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, { token: invites.commenter, name: 'Amina' })

  // Owner heartbeat now; the commenter is here too but never presents.
  await call(api, 'POST', `/api/froam/rooms/${room.id}/presence`, { token: invites.owner, actor: created.you.actor })
  const beat = await call(api, 'POST', `/api/froam/rooms/${room.id}/presence`, { token: invites.commenter, actor: guest.you.actor })
  assert.equal(beat.room.presenter, created.you.actor)
})

test('presence for someone who never joined is refused', async () => {
  const { api } = await freshApi()
  const { room, invites } = await open(api)
  const orphan = await call(api, 'POST', `/api/froam/rooms/${room.id}/presence`, { token: invites.editor, actor: 'a_madeup' })
  assert.equal(orphan.status, 404)
})

test('an unknown room is a 404, not a crash', async () => {
  const { api } = await freshApi()
  assert.equal((await call(api, 'GET', '/api/froam/rooms/nope?token=x')).status, 404)
})

test('the handler ignores requests that are not its own', async () => {
  const { api } = await freshApi()
  const r = res()
  assert.equal(await api({ method: 'GET', url: '/api/froam/published' }, r), false)
})

test('a room survives a restart', async () => {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-rooms-'))
  const file = nodePath.join(dir, 'froam.rooms.json')
  const first = createFroamRoomApi({ file, now })
  const created = await call(first, 'POST', '/api/froam/rooms', { name: 'Ahmad' })

  // A second process, same file.
  const second = createFroamRoomApi({ file, now })
  const seen = await call(second, 'GET', `/api/froam/rooms/${created.room.id}?token=${created.invites.owner}`)
  assert.equal(seen.success, true)
  assert.equal(seen.room.id, created.room.id)
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}`)
    console.log(`       ${error.message.split('\n').join('\n       ')}`)
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`)
process.exit(failed ? 1 : 0)
