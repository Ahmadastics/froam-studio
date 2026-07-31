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

/* ── pluggable storage ────────────────────────────────────── */

test('a room can live anywhere that can get and put', async () => {
  // The contract a host implements against its own database. Everything about
  // who may do what stays in one place; only where the room is kept varies.
  const rows = new Map()
  const storage = {
    get: async (roomId) => (rows.has(roomId) ? JSON.parse(rows.get(roomId)) : null),
    put: async (room) => { rows.set(room.id, JSON.stringify(room)) },
  }
  const api = createFroamRoomApi({ storage, now })

  const created = await call(api, 'POST', '/api/froam/rooms', { name: 'Ahmad' })
  assert.equal(created.success, true)
  assert.equal(rows.size, 1, 'the room went to the custom storage, not a file')

  const guest = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter, name: 'Amina',
  })
  assert.equal(guest.you.role, 'commenter')

  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/comments`, {
    token: created.invites.commenter, actor: guest.you.actor,
    routeKey: '/', anchor: { path: 'h1:1', fingerprint: { tag: 'h1' } }, body: 'From Postgres, in spirit',
  })
  const seen = await call(api, 'GET', `/api/froam/rooms/${created.room.id}/comments?token=${created.invites.owner}&routeKey=%2F`)
  assert.deepEqual(seen.comments.map((c) => c.body), ['From Postgres, in spirit'])

  // And the refusals still hold, because they are the same code.
  const denied = await call(api, 'GET', `/api/froam/rooms/${created.room.id}?token=made-up`)
  assert.equal(denied.status, 403)
})

test('storage is required', () => {
  assert.throws(() => createFroamRoomApi({}), /file or a storage/)
})

/* ── comments ─────────────────────────────────────────────── */

async function roomWithGuest(role = 'commenter') {
  const { api } = await freshApi()
  const created = await open(api)
  const guest = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites[role], name: 'Amina',
  })
  return { api, created, guest, id: created.room.id, token: created.invites[role] }
}

const ANCHOR = { path: 'div:1/h1:1', fingerprint: { tag: 'h1', text: 'Rooms that hold a family.' } }

test('a client can leave a note on something', async () => {
  const { api, id, token, guest } = await roomWithGuest()
  const made = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/', viewport: 'mobile',
    anchor: ANCHOR, quoted: 'Rooms that hold a family.', body: 'Can we try the darker green here?',
  })
  assert.equal(made.success, true)
  assert.equal(made.comment.name, 'Amina')
  assert.equal(made.comment.body, 'Can we try the darker green here?')
  assert.equal(made.comment.resolved, false)
})

test('the note carries the fingerprint, not just the path', async () => {
  // Without it a note detaches the moment the page is rebuilt around it.
  const { api, id, token, guest } = await roomWithGuest()
  const made = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: 'Bigger please',
  })
  assert.equal(made.comment.anchor.fingerprint.tag, 'h1')
  assert.equal(made.comment.anchor.fingerprint.text, 'Rooms that hold a family.')
})

test('a viewer link is for looking', async () => {
  const { api, id, token, guest } = await roomWithGuest('viewer')
  const denied = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: 'Nope',
  })
  assert.equal(denied.status, 403)
})

test('a note must say something and point at something', async () => {
  const { api, id, token, guest } = await roomWithGuest()
  const empty = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: '   ',
  })
  assert.equal(empty.status, 400)
  const loose = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/', body: 'Floating note',
  })
  assert.equal(loose.status, 400)
})

test('notes come back for the page they were left on', async () => {
  const { api, id, token, guest } = await roomWithGuest()
  await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: 'On the home page',
  })
  await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/pricing', anchor: ANCHOR, body: 'On pricing',
  })
  const home = await call(api, 'GET', `/api/froam/rooms/${id}/comments?token=${token}&routeKey=%2F`)
  assert.deepEqual(home.comments.map((c) => c.body), ['On the home page'])
})

test('the designer resolves a note', async () => {
  const { api, created, id, guest } = await roomWithGuest()
  const made = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token: created.invites.commenter, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: 'Too tight',
  })
  const done = await call(api, 'POST', `/api/froam/rooms/${id}/comments/${made.comment.id}/resolve`, {
    token: created.invites.owner, actor: created.you.actor,
  })
  assert.equal(done.comment.resolved, true)
  assert.equal(done.comment.resolvedBy, 'Ahmad')
})

test('withdrawing your own note is not a privilege', async () => {
  const { api, id, token, guest } = await roomWithGuest()
  const made = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: 'Actually never mind',
  })
  const done = await call(api, 'POST', `/api/froam/rooms/${id}/comments/${made.comment.id}/resolve`, {
    token, actor: guest.you.actor,
  })
  assert.equal(done.comment.resolved, true)
})

test('a commenter cannot resolve somebody else’s note', async () => {
  const { api, created, id } = await roomWithGuest()
  const second = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter, name: 'Bola',
  })
  const mine = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token: created.invites.commenter, actor: second.you.actor, routeKey: '/', anchor: ANCHOR, body: 'Bola’s note',
  })
  const guest2 = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter, name: 'Chidi',
  })
  const denied = await call(api, 'POST', `/api/froam/rooms/${id}/comments/${mine.comment.id}/resolve`, {
    token: created.invites.commenter, actor: guest2.you.actor,
  })
  assert.equal(denied.status, 403)
})

test('a note can be replied to', async () => {
  const { api, created, id, guest } = await roomWithGuest()
  const made = await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token: created.invites.commenter, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: 'Darker green?',
  })
  const replied = await call(api, 'POST', `/api/froam/rooms/${id}/comments/${made.comment.id}/reply`, {
    token: created.invites.owner, actor: created.you.actor, body: 'Trying it now',
  })
  assert.equal(replied.comment.replies.length, 1)
  assert.equal(replied.comment.replies[0].name, 'Ahmad')
})

test('notes survive a restart', async () => {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-rooms-'))
  const file = nodePath.join(dir, 'rooms.json')
  const first = createFroamRoomApi({ file, now })
  const created = await call(first, 'POST', '/api/froam/rooms', { name: 'Ahmad' })
  const guest = await call(first, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter, name: 'Amina',
  })
  await call(first, 'POST', `/api/froam/rooms/${created.room.id}/comments`, {
    token: created.invites.commenter, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: 'Still here?',
  })

  const second = createFroamRoomApi({ file, now })
  const seen = await call(second, 'GET', `/api/froam/rooms/${created.room.id}/comments?token=${created.invites.owner}&routeKey=%2F`)
  assert.deepEqual(seen.comments.map((c) => c.body), ['Still here?'])
})

/* ── revisions & approval ─────────────────────────────────── */

const SNAPSHOT = { 'h1:1': { styles: { color: '#12c877' } } }

test('the designer sends a revision', async () => {
  const { api, created, id } = await roomWithGuest()
  const sent = await call(api, 'POST', `/api/froam/rooms/${id}/revisions`, {
    token: created.invites.owner, actor: created.you.actor,
    routeKey: '/', viewport: 'desktop', store: SNAPSHOT, note: 'Second pass on the hero',
  })
  assert.equal(sent.revision.status, 'sent')
  assert.equal(sent.revision.createdBy, 'Ahmad')
  assert.deepEqual(sent.revision.store, SNAPSHOT, 'a revision is the design as it stood')
})

test('a client cannot send a revision', async () => {
  const { api, id, token, guest } = await roomWithGuest()
  const denied = await call(api, 'POST', `/api/froam/rooms/${id}/revisions`, {
    token, actor: guest.you.actor, routeKey: '/', store: SNAPSHOT,
  })
  assert.equal(denied.status, 403)
})

test('the client approves it', async () => {
  const { api, created, id, token, guest } = await roomWithGuest()
  const sent = await call(api, 'POST', `/api/froam/rooms/${id}/revisions`, {
    token: created.invites.owner, actor: created.you.actor, routeKey: '/', store: SNAPSHOT,
  })
  const decided = await call(api, 'POST', `/api/froam/rooms/${id}/revisions/${sent.revision.id}/decision`, {
    token, actor: guest.you.actor, decision: 'approved',
  })
  assert.equal(decided.revision.status, 'approved')
  assert.equal(decided.revision.decidedBy, 'Amina')
})

test('“not yet” is a real answer, not a failure', async () => {
  const { api, created, id, token, guest } = await roomWithGuest()
  const sent = await call(api, 'POST', `/api/froam/rooms/${id}/revisions`, {
    token: created.invites.owner, actor: created.you.actor, routeKey: '/', store: SNAPSHOT,
  })
  const decided = await call(api, 'POST', `/api/froam/rooms/${id}/revisions/${sent.revision.id}/decision`, {
    token, actor: guest.you.actor, decision: 'changes-requested', note: 'Nearly — the green is still loud',
  })
  assert.equal(decided.revision.status, 'changes-requested')
  assert.equal(decided.revision.decisionNote, 'Nearly — the green is still loud')
})

test('approval is never blocked by open notes', async () => {
  // The rule fig. 0.4 settled: "approved, with two notes" is real information,
  // and a tool that refuses it teaches people to lie.
  const { api, created, id, token, guest } = await roomWithGuest()
  await call(api, 'POST', `/api/froam/rooms/${id}/comments`, {
    token, actor: guest.you.actor, routeKey: '/', anchor: ANCHOR, body: 'Still unhappy about this bit',
  })
  const sent = await call(api, 'POST', `/api/froam/rooms/${id}/revisions`, {
    token: created.invites.owner, actor: created.you.actor, routeKey: '/', store: SNAPSHOT,
  })
  const decided = await call(api, 'POST', `/api/froam/rooms/${id}/revisions/${sent.revision.id}/decision`, {
    token, actor: guest.you.actor, decision: 'approved',
  })
  assert.equal(decided.revision.status, 'approved')

  const notes = await call(api, 'GET', `/api/froam/rooms/${id}/comments?token=${token}&routeKey=%2F`)
  assert.equal(notes.comments.filter((c) => !c.resolved).length, 1, 'and the note is still open, not swept up')
})

test('a viewer cannot decide', async () => {
  const { api, created, id } = await roomWithGuest()
  const looker = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.viewer, name: 'Passer-by',
  })
  const sent = await call(api, 'POST', `/api/froam/rooms/${id}/revisions`, {
    token: created.invites.owner, actor: created.you.actor, routeKey: '/', store: SNAPSHOT,
  })
  const denied = await call(api, 'POST', `/api/froam/rooms/${id}/revisions/${sent.revision.id}/decision`, {
    token: created.invites.viewer, actor: looker.you.actor, decision: 'approved',
  })
  assert.equal(denied.status, 403)
})

test('a decision has to say what it is', async () => {
  const { api, created, id, token, guest } = await roomWithGuest()
  const sent = await call(api, 'POST', `/api/froam/rooms/${id}/revisions`, {
    token: created.invites.owner, actor: created.you.actor, routeKey: '/', store: SNAPSHOT,
  })
  const vague = await call(api, 'POST', `/api/froam/rooms/${id}/revisions/${sent.revision.id}/decision`, {
    token, actor: guest.you.actor, decision: 'maybe',
  })
  assert.equal(vague.status, 400)
})

test('revisions come back newest first, per page', async () => {
  const { api, created, id } = await roomWithGuest()
  const send = (routeKey) => call(api, 'POST', `/api/froam/rooms/${id}/revisions`, {
    token: created.invites.owner, actor: created.you.actor, routeKey, store: SNAPSHOT,
  })
  await send('/')
  tick(1000)
  await send('/')
  tick(1000)
  await send('/pricing')

  const home = await call(api, 'GET', `/api/froam/rooms/${id}/revisions?token=${created.invites.owner}&routeKey=%2F`)
  assert.equal(home.revisions.length, 2)
  assert.ok(home.revisions[0].createdAt > home.revisions[1].createdAt, 'the current question first')
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
