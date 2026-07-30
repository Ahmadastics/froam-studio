/**
 * Froam Rooms — client tests.
 *
 * Driven against the real room store rather than a mock of it, so the two
 * halves are checked against each other and not against my assumptions about
 * each. The only fakes are the browser: storage, the hidden-tab check, and a
 * transport that calls the handler directly.
 */
import assert from 'node:assert/strict'
import os from 'node:os'
import fsp from 'node:fs/promises'
import nodePath from 'node:path'

const { createFroamRoomApi } = await import('../lib/room-store.mjs')
const { createRoomClient, readRoomFromLocation, ROOM_PARAM, TOKEN_PARAM } =
  await import('../dist/collab/room.js')

let clock = 1_700_000_000_000
const now = () => clock

function fakeStorage() {
  const map = new Map()
  return {
    read: (k) => (map.has(k) ? map.get(k) : null),
    write: (k, v) => map.set(k, v),
    dump: () => Object.fromEntries(map),
  }
}

/** A transport that speaks to the real handler in-process. */
function transportFor(api) {
  const run = async (method, path, body) => {
    const res = {
      statusCode: 0, body: '',
      setHeader() {},
      end(text) { this.body = text },
    }
    await api({ method, url: path, body }, res)
    const parsed = JSON.parse(res.body || '{}')
    if (res.statusCode >= 400) throw new Error(parsed.error || `HTTP ${res.statusCode}`)
    return parsed
  }
  return {
    get: (path) => run('GET', path),
    post: (path, body) => run('POST', path, body),
    raw: run,
  }
}

async function openRoom() {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-roomclient-'))
  const api = createFroamRoomApi({ file: nodePath.join(dir, 'rooms.json'), now })
  const t = transportFor(api)
  const created = await t.post('/api/froam/rooms', { name: 'Ahmad' })
  return { api, transport: t, created }
}

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('an invite is read out of the link', () => {
  const href = `https://ile.example/pricing?${ROOM_PARAM}=r123&${TOKEN_PARAM}=tok456`
  assert.deepEqual(readRoomFromLocation(href), { roomId: 'r123', token: 'tok456' })
})

test('a link without an invite is not a room', () => {
  assert.equal(readRoomFromLocation('https://ile.example/pricing'), null)
  assert.equal(readRoomFromLocation(`https://ile.example/?${ROOM_PARAM}=r123`), null, 'a room with no token is not enough')
  assert.equal(readRoomFromLocation('not a url'), null)
})

test('joining gives you an identity and remembers it', async () => {
  const { transport, created } = await openRoom()
  const storage = fakeStorage()
  const client = createRoomClient({
    roomId: created.room.id, token: created.invites.commenter, transport, storage, isHidden: () => false, now,
  })

  assert.equal(client.joined, false, 'nobody yet')
  const you = await client.join('Amina')
  assert.equal(you.role, 'commenter')
  assert.equal(client.joined, true)
  assert.match(JSON.stringify(storage.dump()), /Amina/, 'identity should survive a refresh')
})

test('a refresh keeps your comments yours', async () => {
  const { transport, created } = await openRoom()
  const storage = fakeStorage()
  const mk = () => createRoomClient({
    roomId: created.room.id, token: created.invites.editor, transport, storage, isHidden: () => false, now,
  })

  const first = mk()
  const before = await first.join('Zainab')

  // New page, same browser.
  const second = mk()
  assert.equal(second.joined, true, 'the identity was picked back up')
  const after = await second.join('Zainab')
  assert.equal(after.actor, before.actor, 'same person, not a stranger with the same name')
})

test('a heartbeat says where you are', async () => {
  const { transport, created } = await openRoom()
  const client = createRoomClient({
    roomId: created.room.id, token: created.invites.commenter, transport, storage: fakeStorage(), isHidden: () => false, now,
  })
  const you = await client.join('Amina')
  await client.beat({ routeKey: '/pricing', viewport: 'mobile', selectedPath: 'h1:1' })

  const me = client.room.members.find((m) => m.actor === you.actor)
  assert.equal(me.here, true)
  assert.equal(me.routeKey, '/pricing')
  assert.equal(me.viewport, 'mobile')
})

test('a buried tab stops counting as present', async () => {
  const { transport, created } = await openRoom()
  let hidden = false
  const client = createRoomClient({
    roomId: created.room.id, token: created.invites.commenter, transport, storage: fakeStorage(),
    isHidden: () => hidden, now,
  })
  await client.join('Amina')
  await client.beat({ routeKey: '/' })
  const beatsWhileVisible = client.room.members.find((m) => m.name === 'Amina').seenAt

  hidden = true
  clock += 10_000
  await client.beat({ routeKey: '/other' })
  const after = client.room.members.find((m) => m.name === 'Amina')
  assert.equal(after.seenAt, beatsWhileVisible, 'a hidden tab must not keep a phone following an empty chair')
  assert.equal(after.routeKey, '/', 'and must not report a route nobody is looking at')
})

test('a dropped beat is not an error worth surfacing', async () => {
  const { transport, created } = await openRoom()
  const client = createRoomClient({
    roomId: created.room.id, token: created.invites.editor, transport, storage: fakeStorage(), isHidden: () => false, now,
  })
  await client.join('Zainab')
  const lastKnown = client.room

  const broken = createRoomClient({
    roomId: created.room.id, token: created.invites.editor, isHidden: () => false, now,
    storage: fakeStorage(),
    transport: { get: async () => { throw new Error('offline') }, post: async () => { throw new Error('offline') } },
  })
  // Give it an identity without the network.
  await assert.doesNotReject(() => broken.beat({ routeKey: '/' }))
  assert.ok(lastKnown, 'the last known room stays usable')
})

test('you can see who else is here, and who is driving', async () => {
  const { transport, created } = await openRoom()
  const storage = fakeStorage()
  const guest = createRoomClient({
    roomId: created.room.id, token: created.invites.commenter, transport, storage, isHidden: () => false, now,
  })
  await guest.join('Amina')

  // The owner is present and is the only editor here.
  await transport.post(`/api/froam/rooms/${created.room.id}/presence`, {
    token: created.invites.owner, actor: created.you.actor, routeKey: '/pricing',
  })
  await guest.beat({ routeKey: '/' })

  assert.deepEqual(guest.others().map((m) => m.name), ['Ahmad'])
  assert.equal(guest.presenter()?.name, 'Ahmad')
  assert.equal(guest.someoneElseIsPresenting(), true, 'this is the question follow mode turns on')
  assert.equal(guest.role(), 'commenter')
})

test('you are not presenting to yourself', async () => {
  const { transport, created } = await openRoom()
  const owner = createRoomClient({
    roomId: created.room.id, token: created.invites.owner, transport, storage: fakeStorage(), isHidden: () => false, now,
  })
  // Rejoin as the existing owner actor.
  const storage = fakeStorage()
  storage.write(`froam-room:${created.room.id}`, JSON.stringify(created.you))
  const asOwner = createRoomClient({
    roomId: created.room.id, token: created.invites.owner, transport, storage, isHidden: () => false, now,
  })
  await asOwner.beat({ routeKey: '/' })
  assert.equal(asOwner.presenter()?.actor, created.you.actor)
  assert.equal(asOwner.someoneElseIsPresenting(), false)
  void owner
})

test('listeners hear about the room', async () => {
  const { transport, created } = await openRoom()
  const client = createRoomClient({
    roomId: created.room.id, token: created.invites.commenter, transport, storage: fakeStorage(), isHidden: () => false, now,
  })
  const seen = []
  const off = client.on((room) => seen.push(room?.members.length ?? 0))
  await client.join('Amina')
  off()
  await client.beat({ routeKey: '/' })
  assert.equal(seen.length, 1, 'one update while listening, none after unsubscribing')
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
