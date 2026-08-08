import assert from 'node:assert/strict'
import { createFroamProjectSyncApi, mergeHostedProjectState } from '../lib/project-sync-store.mjs'
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

let passed = 0
for (const [name, fn] of tests) { await fn(); passed += 1; console.log(`  ok   ${name}`) }
console.log(`\n${passed}/${tests.length} project sync tests passed`)
