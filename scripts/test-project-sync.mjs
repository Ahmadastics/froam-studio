import assert from 'node:assert/strict'
import { createFroamProjectSyncApi, mergeHostedProjectState } from '../lib/project-sync-store.mjs'
import { createMemoryProjectDocumentStore, FroamStaleRevisionError } from '../lib/project-document-store.mjs'
import { createProjectDocument, createProjectEvent } from '../dist/project/event-log.js'
import { mergeProjectSyncDelta, projectSyncPush } from '../dist/project/project-sync.js'

const tests = []; const test = (name, fn) => tests.push([name, fn])
function response() { return { statusCode: 0, headers: {}, body: '', setHeader(key, value) { this.headers[key] = value }, end(value) { this.body = value } } }
async function call(api, method, url, body) { const res = response(); const handled = await api({ method, url, body }, res); return { handled, status: res.statusCode, ...JSON.parse(res.body || '{}') } }
function event(projectId, branchId, id, clock = 1) { return createProjectEvent({ projectId, branchId, actorId: 'ahmad', clock, type: 'analysis.upserted', payload: { analysis: { schemaVersion: 1, id, kind: 'predicted-attention', targetIds: [], createdAt: clock, provider: 'fixture', local: true, result: {} } }, idFactory: () => id, now: clock }) }

test('hosted project sync is idempotent across reconnect pushes', () => {
  const push = { projectId: 'p', branchId: 'main', events: [{ event: event('p', 'main', 'e1') }], checkpoints: [], branches: [] }
  const first = mergeHostedProjectState(null, push); const second = mergeHostedProjectState(first, push)
  assert.equal(first.events.length, 1); assert.equal(second.events.length, 1); assert.equal(second.sequence, 1)
})
test('hosted project sync refuses branch contamination', () => {
  assert.throws(() => mergeHostedProjectState(null, { projectId: 'p', branchId: 'main', events: [{ event: event('p', 'prototype', 'bad') }], checkpoints: [], branches: [] }), /cross-branch/)
  assert.throws(() => mergeHostedProjectState(null, { projectId: 'p', branchId: 'main', events: [], checkpoints: [], branches: [{ id: 'other', parentBranchId: null }] }), /Unrelated branch/)
})
test('design operations cannot bypass canonical room ordering', () => {
  const op = createProjectEvent({ projectId: 'p', branchId: 'main', actorId: 'a', clock: 1, type: 'design.op.appended', payload: { op: { id: 'op', actor: 'a', clock: 1, ts: 1, routeKey: '/', viewport: 'desktop', path: 'main:1', field: 'text', before: '', after: 'x' } }, idFactory: () => 'design', now: 1 })
  assert.throws(() => mergeHostedProjectState(null, { projectId: 'p', branchId: 'main', events: [{ event: op }], checkpoints: [], branches: [] }), /room sequence/)
  const stored = mergeHostedProjectState(null, { projectId: 'p', branchId: 'main', events: [{ event: op, roomSequence: 12 }], checkpoints: [], branches: [] }); assert.equal(stored.events[0].roomSequence, 12)
})
test('client delta merge is branch-isolated and duplicate-safe', () => {
  const document = createProjectDocument({ id: 'p', name: 'P', actorId: 'a', now: 1, idFactory: () => 'base' }); const synced = event('p', 'main', 'e1')
  const delta = { projectId: 'p', branchId: 'main', cursor: 1, events: [{ seq: 1, event: synced }], checkpoints: [], branches: [] }
  const once = mergeProjectSyncDelta(document, delta); const twice = mergeProjectSyncDelta(once, delta); assert.equal(twice.events.filter((item) => item.id === 'e1').length, 1)
  assert.throws(() => mergeProjectSyncDelta(document, { ...delta, events: [{ seq: 1, event: event('p', 'other', 'e2') }] }), /contamination/)
})
test('sync push emits one branch and its checkpoint context', () => {
  const document = createProjectDocument({ id: 'p', name: 'P', actorId: 'a', now: 1, idFactory: () => 'base' }); const push = projectSyncPush(document)
  assert.equal(push.branchId, 'main'); assert.equal(push.checkpoints.length, 1); assert.equal(push.checkpoints[0].branchId, 'main')
})
test('hosted HTTP contract authorizes, persists and reconnects by cursor', async () => {
  let stored = null; const api = createFroamProjectSyncApi({ storage: { get: () => stored, put: (value) => { stored = value } }, authorize: (_req, input) => input.actor === 'ahmad' })
  const denied = await call(api, 'GET', '/api/froam/projects/p/sync?branchId=main&actor=stranger'); assert.equal(denied.status, 403)
  const pushed = await call(api, 'POST', '/api/froam/projects/p/sync', { actor: 'ahmad', branchId: 'main', cursor: 0, events: [{ event: event('p', 'main', 'e-http') }], checkpoints: [], branches: [] }); assert.equal(pushed.status, 200); assert.equal(pushed.events.length, 1)
  const reconnect = await call(api, 'GET', '/api/froam/projects/p/sync?branchId=main&actor=ahmad&cursor=1'); assert.equal(reconnect.status, 200); assert.equal(reconnect.events.length, 0); assert.equal(reconnect.cursor, 1)
})

test('durable store serializes concurrent writers without losing either branch', async () => {
  const storage = createMemoryProjectDocumentStore()
  await Promise.all([
    storage.transaction('p', undefined, (current) => mergeHostedProjectState(current, { projectId: 'p', branchId: 'main', events: [{ event: event('p', 'main', 'main-1') }], checkpoints: [], branches: [] })),
    storage.transaction('p', undefined, (current) => mergeHostedProjectState(current, { projectId: 'p', branchId: 'prototype', events: [{ event: event('p', 'prototype', 'prototype-1') }], checkpoints: [], branches: [] })),
  ])
  const stored = await storage.read('p')
  assert.deepEqual(new Set(stored.events.map((item) => item.event.id)), new Set(['main-1', 'prototype-1']))
  assert.equal(stored.revision, 2)
})

test('durable store rejects stale compare-and-swap revisions', async () => {
  const storage = createMemoryProjectDocumentStore(); await storage.transaction('p', 0, (current) => current)
  await assert.rejects(() => storage.transaction('p', 0, (current) => current), FroamStaleRevisionError)
})

test('legacy hosted records migrate during reconnect before the next atomic write', async () => {
  const storage = createMemoryProjectDocumentStore()
  await storage.compareAndSwap('p', 0, { version: 1, id: 'p', sequence: 4, events: [], checkpoints: {}, branches: {} })
  const migrated = await storage.read('p')
  assert.equal(migrated.version, 2); assert.equal(migrated.revision, 1); assert.equal(migrated.sequence, 4)
  const updated = await storage.transaction('p', 1, (current) => ({ ...current, sequence: 5 }))
  assert.equal(updated.revision, 2); assert.equal(updated.sequence, 5)
})

test('HTTP sync returns conflict for stale revision and remains idempotent on retry', async () => {
  const storage = createMemoryProjectDocumentStore(); const api = createFroamProjectSyncApi({ storage })
  const body = { branchId: 'main', expectedRevision: 0, cursor: 0, events: [{ event: event('p', 'main', 'retry') }], checkpoints: [], branches: [] }
  const first = await call(api, 'POST', '/api/froam/projects/p/sync', body); assert.equal(first.status, 200); assert.equal(first.revision, 1)
  const stale = await call(api, 'POST', '/api/froam/projects/p/sync', body); assert.equal(stale.status, 409); assert.equal(stale.stale, true)
  const retry = await call(api, 'POST', '/api/froam/projects/p/sync', { ...body, expectedRevision: 1 }); assert.equal(retry.status, 200)
  assert.equal((await storage.read('p')).events.length, 1)
})

test('stale reconnect cursor resets safely within the requested branch', async () => {
  const storage = createMemoryProjectDocumentStore(); const api = createFroamProjectSyncApi({ storage })
  await call(api, 'POST', '/api/froam/projects/p/sync', { branchId: 'main', events: [{ event: event('p', 'main', 'cursor-event') }], checkpoints: [], branches: [] })
  const reconnect = await call(api, 'GET', '/api/froam/projects/p/sync?branchId=main&cursor=999')
  assert.equal(reconnect.cursorReset, true); assert.equal(reconnect.events.length, 1); assert.ok(reconnect.events.every((item) => item.event.branchId === 'main'))
})

test('checkpoint integrity rejects unknown event and missing parent references', () => {
  const checkpoint = { id: 'cp', projectId: 'p', branchId: 'main', createdAt: 1, createdBy: 'a', eventIds: ['missing'], state: {} }
  assert.throws(() => mergeHostedProjectState(null, { projectId: 'p', branchId: 'main', events: [], checkpoints: [checkpoint], branches: [] }), /unknown events/)
  assert.throws(() => mergeHostedProjectState(null, { projectId: 'p', branchId: 'main', events: [], checkpoints: [{ ...checkpoint, eventIds: [], parentCheckpointId: 'absent' }], branches: [] }), /parent is missing/)
})

let passed = 0
for (const [name, fn] of tests) { await fn(); passed += 1; console.log(`  ok   ${name}`) }
console.log(`\n${passed}/${tests.length} project sync tests passed`)
