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

const memberSessions = new Map()

async function call(api, method, url, body) {
  const r = res()
  const authenticatedBody = body?.actor && !body.session && memberSessions.has(body.actor)
    ? { ...body, session: memberSessions.get(body.actor) }
    : body
  const handled = await api({ method, url, body: authenticatedBody }, r)
  const payload = { handled, status: r.statusCode, ...JSON.parse(r.body || '{}') }
  if (payload.you?.actor && payload.you?.session) memberSessions.set(payload.you.actor, payload.you.session)
  return payload
}

const open = (api, name = 'Ahmad') => call(api, 'POST', '/api/froam/rooms', { name })

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('opening a room mints one invite per role', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  assert.equal(created.success, true)
  assert.deepEqual(Object.keys(created.invites).sort(), ['commenter', 'contributor', 'editor', 'owner', 'viewer'])
  assert.equal(created.you.role, 'owner')
  assert.equal(created.room.members.length, 1)
  // Distinct tokens, or a role boundary is decorative.
  assert.equal(new Set(Object.values(created.invites)).size, 5)
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

test('an actor id without its member session cannot impersonate the owner', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const joined = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter,
    name: 'Mallory',
    actor: created.you.actor,
    session: 'not-the-owner-session',
  })
  assert.notEqual(joined.you.actor, created.you.actor)
  assert.equal(joined.you.role, 'commenter')
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

test('member avatar is stored once and presence can carry stable node identity', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const guest = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.editor,
    name: 'Amina',
    avatarUrl: 'https://example.com/amina.png',
  })
  const beat = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/presence`, {
    token: created.invites.editor,
    actor: guest.you.actor,
    session: guest.you.session,
    routeKey: '/',
    viewport: 'desktop',
    selectedPath: 'main:1/h1:1',
    selectedNodeId: 'node.hero',
    lockedNodeId: 'node.hero',
    tool: 'move',
    action: 'Dragging hero',
  })
  const member = beat.room.members.find((candidate) => candidate.actor === guest.you.actor)
  assert.equal(member.avatarUrl, 'https://example.com/amina.png')
  assert.equal(member.selectedNodeId, 'node.hero')
  assert.equal(member.lockedNodeId, 'node.hero')
  assert.equal(member.tool, 'move')
  assert.equal(member.action, 'Dragging hero')
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

/* ── v6 ordered ops, authority, chat and replay ── */

function edit(actor, id, after, field = 'style:color') {
  return {
    id, kind: 'edit', actor, clock: 1, ts: now(), routeKey: '/', viewport: 'desktop',
    path: 'main:1/h1:1', field, before: undefined, after, label: 'Colour', batch: id,
  }
}

test('the room assigns a canonical order and replays it by cursor', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const first = edit(created.you.actor, 'owner-red', 'red')
  const pushed = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/ops`, {
    token: created.invites.owner, actor: created.you.actor, baseSeq: 0, ops: [first],
  })
  assert.equal(pushed.accepted[0].clock, 1, 'server sequence is the canonical Lamport clock')

  const replay = await call(api, 'GET', `/api/froam/rooms/${created.room.id}/events?token=${created.invites.viewer}&after=0`)
  assert.deepEqual(replay.events.map((event) => event.seq), [1])
  const caughtUp = await call(api, 'GET', `/api/froam/rooms/${created.room.id}/events?token=${created.invites.viewer}&after=${replay.cursor}`)
  assert.deepEqual(caughtUp.events, [])
})

test('the owner wins a genuinely concurrent field conflict, but not a later causal edit', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const guest = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.editor, name: 'Zainab',
  })
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/ops`, {
    token: created.invites.owner, actor: created.you.actor, baseSeq: 0,
    ops: [edit(created.you.actor, 'owner-green', 'green')],
  })
  const concurrent = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/ops`, {
    token: created.invites.editor, actor: guest.you.actor, baseSeq: 0,
    ops: [edit(guest.you.actor, 'guest-blue', 'blue')],
  })
  assert.deepEqual(concurrent.rejected.map((item) => item.reason), ['higher-authority-concurrent-write'])

  const later = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/ops`, {
    token: created.invites.editor, actor: guest.you.actor, baseSeq: 1,
    ops: [edit(guest.you.actor, 'guest-after-seeing', 'blue')],
  })
  assert.equal(later.accepted.length, 1, 'rank never beats a change made after seeing the owner write')
})

test('commenters cannot push design operations', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const guest = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter, name: 'Amina',
  })
  const denied = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/ops`, {
    token: created.invites.commenter, actor: guest.you.actor, baseSeq: 0,
    ops: [edit(guest.you.actor, 'commenter-edit', 'pink')],
  })
  assert.equal(denied.status, 403)
})

test('room chat is ephemeral conversation on the same event stream', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const guest = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter, name: 'Amina',
  })
  const sent = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/chat`, {
    token: created.invites.commenter, actor: guest.you.actor, body: 'Try the quieter green',
  })
  assert.equal(sent.message.name, 'Amina')
  const messages = await call(api, 'GET', `/api/froam/rooms/${created.room.id}/chat?token=${created.invites.commenter}&actor=${guest.you.actor}&session=${guest.you.session}`)
  assert.deepEqual(messages.messages.map((message) => message.body), ['Try the quieter green'])
  const events = await call(api, 'GET', `/api/froam/rooms/${created.room.id}/events?token=${created.invites.viewer}&after=0`)
  assert.equal(events.events.at(-1).type, 'chat')
})

test('the live stream wakes a connected room without carrying mutable state itself', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const frames = []
  let closeStream = () => {}
  const request = {
    method: 'GET',
    url: `/api/froam/rooms/${created.room.id}/stream?token=${created.invites.viewer}`,
    on(event, listener) { if (event === 'close') closeStream = listener },
  }
  const response = {
    statusCode: 0,
    setHeader() {},
    flushHeaders() {},
    write(frame) { frames.push(frame) },
    on() {},
  }
  assert.equal(await api(request, response), true)

  const guest = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter, name: 'Amina',
  })
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/chat`, {
    token: created.invites.commenter, actor: guest.you.actor, body: 'Wake the room',
  })
  assert.ok(frames.some((frame) => frame.includes('event: room')))
  assert.ok(frames.every((frame) => !frame.includes('Wake the room')), 'the durable event endpoint remains the source of truth')
  closeStream()
})

test('a guest-editor cross-user undo becomes a proposal the owner decides', async () => {
  const { api } = await freshApi()
  const created = await open(api)
  const guest = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.editor, name: 'Zainab',
  })
  const ownerEdit = edit(created.you.actor, 'owner-radius', '20px', 'style:borderRadius')
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/ops`, {
    token: created.invites.owner, actor: created.you.actor, baseSeq: 0, ops: [ownerEdit],
  })
  const requested = {
    ...ownerEdit, id: 'guest-undo-owner', kind: 'undo', actor: guest.you.actor,
    before: '20px', after: undefined, targets: ownerEdit.id,
  }
  const proposed = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/ops`, {
    token: created.invites.editor, actor: guest.you.actor, baseSeq: 1, ops: [requested],
  })
  assert.deepEqual(proposed.rejected.map((item) => item.reason), ['owner-approval-required'])

  const listed = await call(api, 'GET', `/api/froam/rooms/${created.room.id}/proposals?token=${created.invites.owner}&actor=${created.you.actor}&session=${created.you.session}`)
  assert.equal(listed.proposals[0].status, 'pending')
  const decided = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/proposals/${listed.proposals[0].id}/decision`, {
    token: created.invites.owner, actor: created.you.actor, decision: 'approved',
  })
  assert.equal(decided.proposal.status, 'approved')
  assert.equal(decided.accepted[0].actor, created.you.actor, 'the enactment belongs to the owner who allowed it')
})

/* ─── change requests: a contributor submits, the owner publishes ─── */

async function requestRoom(options = {}) {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-rooms-'))
  const published = []
  const api = createFroamRoomApi({
    file: nodePath.join(dir, 'froam.rooms.json'),
    now,
    onApproveRequest: options.onApproveRequest ?? (async ({ request }) => { published.push(request); return { detail: 'Published to test' } }),
  })
  const created = await open(api)
  const contributor = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, { token: created.invites.contributor, name: 'Maya' })
  const owner = { token: created.invites.owner, actor: created.you.actor, session: created.you.session }
  const maya = { token: created.invites.contributor, actor: contributor.you.actor, session: contributor.you.session }
  const base = `/api/froam/rooms/${created.room.id}/requests`
  const submit = (who, extra = {}) => call(api, 'POST', base, {
    ...who, routeKey: '/', viewport: 'desktop', title: 'New hero copy',
    store: { 'main:1/h1:1': { text: 'Plan your escape' } },
    changes: [{ label: 'Headline', before: 'Plan a trip', after: 'Plan your escape' }],
    textEdits: [{ from: 'Plan a trip', to: 'Plan your escape' }],
    note: 'For the spring campaign', ...extra,
  })
  const list = (who) => call(api, 'GET', `${base}?token=${who.token}&actor=${who.actor}&session=${who.session}`)
  return { api, created, owner, maya, base, submit, list, published }
}

test('a contributor link joins as a contributor, and cannot push live edits', async () => {
  const { api, created, maya } = await requestRoom()
  const joined = await call(api, 'GET', `/api/froam/rooms/${created.room.id}?token=${maya.token}&actor=${maya.actor}&session=${maya.session}`)
  assert.equal(joined.room.you.role, 'contributor')
  const pushed = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/ops`, {
    ...maya, baseSeq: 0, ops: [edit(maya.actor, 'live-try', 'red', 'style:color')],
  })
  assert.equal(pushed.status, 403, 'a contributor edited the shared design live')
})

test('a contributor submits changes; the owner sees them with what changed', async () => {
  const { owner, maya, submit, list } = await requestRoom()
  const submitted = await submit(maya)
  assert.equal(submitted.success, true)
  assert.equal(submitted.request.status, 'pending')
  assert.equal(submitted.request.createdBy, 'Maya')
  const seen = await list(owner)
  assert.equal(seen.requests.length, 1)
  assert.deepEqual(seen.requests[0].changes[0], { label: 'Headline', before: 'Plan a trip', after: 'Plan your escape' })
})

test('approving publishes through the host, once', async () => {
  const { api, base, owner, maya, submit, published } = await requestRoom()
  const { request } = await submit(maya)
  const approved = await call(api, 'POST', `${base}/${request.id}/decision`, { ...owner, decision: 'approved', note: 'Looks great' })
  assert.equal(approved.request.status, 'approved')
  assert.equal(approved.request.decisionNote, 'Looks great')
  assert.deepEqual(approved.request.published, { ok: true, detail: 'Published to test' })
  assert.equal(published.length, 1)
  assert.equal(published[0].store['main:1/h1:1'].text, 'Plan your escape')
  const again = await call(api, 'POST', `${base}/${request.id}/decision`, { ...owner, decision: 'approved' })
  assert.notEqual(again.status, 200, 'a decided request was decided again')
  assert.equal(published.length, 1, 'published twice')
})

test('sending back records the note and publishes nothing', async () => {
  const { api, base, owner, maya, submit, list, published } = await requestRoom()
  const { request } = await submit(maya)
  const back = await call(api, 'POST', `${base}/${request.id}/decision`, { ...owner, decision: 'changes-requested', note: 'Shorter, please' })
  assert.equal(back.request.status, 'changes-requested')
  assert.equal(published.length, 0)
  const mine = await list(maya)
  assert.equal(mine.requests[0].decisionNote, 'Shorter, please', 'the contributor cannot see why')
})

test('only the owner decides; contributors see only their own requests', async () => {
  const { api, created, base, owner, maya, submit, list } = await requestRoom()
  const { request } = await submit(maya)
  const selfApprove = await call(api, 'POST', `${base}/${request.id}/decision`, { ...maya, decision: 'approved' })
  assert.equal(selfApprove.status, 403)
  const editor = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, { token: created.invites.editor, name: 'Ade' })
  const ade = { token: created.invites.editor, actor: editor.you.actor, session: editor.you.session }
  const editorApprove = await call(api, 'POST', `${base}/${request.id}/decision`, { ...ade, decision: 'approved' })
  assert.equal(editorApprove.status, 403, 'an editor published without the owner')
  const other = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, { token: created.invites.contributor, name: 'Sam' })
  const sam = { token: created.invites.contributor, actor: other.you.actor, session: other.you.session }
  assert.equal((await list(sam)).requests.length, 0, 'a contributor saw someone else\'s request')
  assert.equal((await list(owner)).requests.length, 1)
})

test('commenters and viewers cannot submit changes', async () => {
  const { api, created, base } = await requestRoom()
  const client = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, { token: created.invites.commenter, name: 'Client' })
  const res = await call(api, 'POST', base, {
    token: created.invites.commenter, actor: client.you.actor, session: client.you.session,
    routeKey: '/', viewport: 'desktop', store: { 'main:1/h1:1': { text: 'x' } },
  })
  assert.equal(res.status, 403)
})

test('an empty or malformed submission is refused', async () => {
  const { maya, submit } = await requestRoom()
  assert.equal((await submit(maya, { store: {} })).status, 400)
  const odd = await submit(maya, { store: { '<script>': { text: 'x' }, 'no-colon': { text: 'y' } } })
  assert.equal(odd.status, 400, 'odd keys were accepted as changes')
})

test('the author can withdraw a pending request; nobody else can', async () => {
  const { api, base, owner, maya, submit } = await requestRoom()
  const { request } = await submit(maya)
  const byOwner = await call(api, 'POST', `${base}/${request.id}/withdraw`, { ...owner })
  assert.notEqual(byOwner.status, 200)
  const byMaya = await call(api, 'POST', `${base}/${request.id}/withdraw`, { ...maya })
  assert.equal(byMaya.request.status, 'withdrawn')
})

test('if publishing fails, the request stays pending and says why', async () => {
  const { api, base, owner, maya, submit, list } = await requestRoom({ onApproveRequest: async () => { throw new Error('disk full') } })
  const { request } = await submit(maya)
  const failed = await call(api, 'POST', `${base}/${request.id}/decision`, { ...owner, decision: 'approved' })
  assert.equal(failed.status, 502)
  assert.match(failed.error, /disk full/)
  assert.equal((await list(owner)).requests[0].status, 'pending')
})

/* ── profiles and request conversations (8.7) ── */

const PHOTO = 'data:image/png;base64,iVBORw0KGgo='

test('joining carries a profile: photo, what you do, your colour', async () => {
  const { api } = await freshApi()
  const { room, invites } = await open(api)
  const joined = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, {
    token: invites.contributor, name: 'Maya', avatarUrl: PHOTO, title: '  Marketing   lead ', color: '#A78BFA',
  })
  const maya = joined.room.members.find((m) => m.actor === joined.you.actor)
  assert.equal(maya.avatarUrl, PHOTO)
  assert.equal(maya.title, 'Marketing lead')
  assert.equal(maya.color, '#a78bfa')
  assert.equal(typeof maya.joinedAt, 'number')
})

test('the owner’s profile is set when the room opens', async () => {
  const { api } = await freshApi()
  const created = await call(api, 'POST', '/api/froam/rooms', { name: 'Ahmad', avatarUrl: PHOTO, title: 'Founder' })
  const owner = created.room.members[0]
  assert.equal(owner.avatarUrl, PHOTO)
  assert.equal(owner.title, 'Founder')
})

test('a profile colour must be plain hex — it lands in style attributes', async () => {
  const { api } = await freshApi()
  const { room, invites } = await open(api)
  const joined = await call(api, 'POST', `/api/froam/rooms/${room.id}/join`, {
    token: invites.commenter, name: 'Eve', color: 'red;background:url(x)', title: 'x'.repeat(200),
  })
  const eve = joined.room.members.find((m) => m.actor === joined.you.actor)
  assert.match(eve.color, /^#[0-9a-f]{6}$/)
  assert.equal(eve.title.length, 40)
})

test('rejoining updates your profile, keeps your role, and can clear the photo', async () => {
  const { api } = await freshApi()
  const created = await call(api, 'POST', '/api/froam/rooms', { name: 'Ahmad', avatarUrl: PHOTO, title: 'Founder' })
  const again = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.commenter, name: 'Ahmad M', actor: created.you.actor, session: created.you.session, avatarUrl: null, title: 'CEO',
  })
  assert.equal(again.you.role, 'owner')
  const me = again.room.members.find((m) => m.actor === created.you.actor)
  assert.equal(me.name, 'Ahmad M')
  assert.equal(me.avatarUrl, null)
  assert.equal(me.title, 'CEO')
})

test('rejoining without profile fields keeps the ones you had', async () => {
  const { api } = await freshApi()
  const created = await call(api, 'POST', '/api/froam/rooms', { name: 'Ahmad', avatarUrl: PHOTO, title: 'Founder', color: '#ff6c4f' })
  const again = await call(api, 'POST', `/api/froam/rooms/${created.room.id}/join`, {
    token: created.invites.owner, name: 'Ahmad', actor: created.you.actor, session: created.you.session,
  })
  const me = again.room.members.find((m) => m.actor === created.you.actor)
  assert.equal(me.avatarUrl, PHOTO)
  assert.equal(me.title, 'Founder')
  assert.equal(me.color, '#ff6c4f')
})

test('a message can be about a request, and only a real one', async () => {
  const { api, created, owner, maya, submit } = await requestRoom()
  const { request } = await submit(maya)
  const chat = `/api/froam/rooms/${created.room.id}/chat`
  const about = await call(api, 'POST', chat, { ...owner, body: 'Can the headline be shorter?', requestId: request.id })
  assert.equal(about.message.requestId, request.id)
  const stray = await call(api, 'POST', chat, { ...maya, body: 'Sure', requestId: 'not-a-request' })
  assert.equal(stray.status, 200)
  assert.equal(stray.message.requestId, undefined)
  const read = await call(api, 'GET', `${chat}?token=${maya.token}&actor=${maya.actor}&session=${maya.session}`)
  assert.deepEqual(read.messages.map((m) => m.body), ['Can the headline be shorter?', 'Sure'])
})

test('chat events carry the message, so clients need no extra read', async () => {
  const { api, created, owner, maya } = await requestRoom()
  await call(api, 'POST', `/api/froam/rooms/${created.room.id}/chat`, { ...maya, body: 'Hi!' })
  const events = await call(api, 'GET', `/api/froam/rooms/${created.room.id}/events?token=${owner.token}&after=0&actor=${owner.actor}&session=${owner.session}`)
  const chat = events.events.find((event) => event.type === 'chat')
  assert.equal(chat.message.body, 'Hi!')
  assert.equal(chat.message.name, 'Maya')
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
