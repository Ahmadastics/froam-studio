/**
 * Froam Rooms — op log tests.
 *
 * Zero dependencies: plain node:assert against the built dist, so CI can run
 * it straight after `npm run build`.
 *
 *   npm run build && npm test
 */
import assert from 'node:assert/strict'

const {
  applyOp,
  buildRedo,
  buildUndo,
  canRedo,
  canUndo,
  compactLog,
  createClock,
  currentValue,
  deriveStore,
  diffDrafts,
  diffStores,
  makeEdit,
  undoCursor,
  undoLabel,
} = await import('../dist/collab/oplog.js')
const { scopeKey } = await import('../dist/collab/types.js')
const { createOpLogSession } = await import('../dist/collab/session.js')
const {
  FROAM_ROLE_RANK, outranks, canEdit, canComment, canRevert,
  createAuthorityComparator, rankLookup,
} = await import('../dist/collab/authority.js')

/** Minimal localStorage stand-in, with an optional byte ceiling to force quota errors. */
function fakeStorage(limitBytes = Infinity) {
  const map = new Map()
  return {
    get size() { return [...map.values()].reduce((n, v) => n + v.length, 0) },
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      const others = [...map.entries()].filter(([key]) => key !== k).reduce((n, [, v2]) => n + v2.length, 0)
      if (others + v.length > limitBytes) {
        const err = new Error('QuotaExceededError')
        err.name = 'QuotaExceededError'
        throw err
      }
      map.set(k, v)
    },
    removeItem: (k) => { map.delete(k) },
  }
}

function withStorage(store, fn) {
  const previous = globalThis.window
  globalThis.window = { localStorage: store }
  try { return fn() } finally { globalThis.window = previous }
}

const { loadOpLog, saveOpLog, clearOpLog, FROAM_OPLOG_KEY } = await import('../dist/collab/persist.js')
const { scoreFingerprint, ANCHOR_MATCH_THRESHOLD } = await import('../dist/collab/anchor.js')
const { tagOfPath } = await import('../dist/collab/paths.js')

const tests = []
const test = (name, fn) => tests.push([name, fn])

const ROUTE = '/'
const VIEW = 'desktop'
const SCOPE = scopeKey(ROUTE, VIEW)

/** Append an edit built against the log so far. */
function edit(log, actor, clock, path, field, value, extra = {}) {
  const op = makeEdit(deriveStore(log), {
    actor,
    clock,
    routeKey: ROUTE,
    viewport: VIEW,
    path,
    field,
    value,
    ...extra,
  })
  return op ? [...log, op] : log
}

/* ─── derivation ─── */

test('derives a store from ops', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'body>h1', 'text', 'Run’Am')
  log = edit(log, 'ahmad', 2, 'body>h1', 'style:color', '#12c877')
  const store = deriveStore(log)
  assert.equal(store[SCOPE]['body>h1'].text, 'Run’Am')
  assert.equal(store[SCOPE]['body>h1'].styles.color, '#12c877')
})

test('last write wins per (path, field)', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'body>h1', 'style:color', '#000')
  log = edit(log, 'ahmad', 2, 'body>h1', 'style:color', '#fff')
  assert.equal(deriveStore(log)[SCOPE]['body>h1'].styles.color, '#fff')
})

test('different fields on one element do not clobber each other', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'body>h1', 'style:color', '#000')
  log = edit(log, 'zainab', 1, 'body>h1', 'style:fontSize', '32px')
  const draft = deriveStore(log)[SCOPE]['body>h1']
  assert.equal(draft.styles.color, '#000')
  assert.equal(draft.styles.fontSize, '32px')
})

test('unsetting a value prunes the draft and the scope', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'body>h1', 'text', 'Hi')
  log = edit(log, 'ahmad', 2, 'body>h1', 'text', undefined)
  assert.deepEqual(deriveStore(log), {})
})

test('a no-op edit is not logged', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'body>h1', 'text', 'Hi')
  const before = log.length
  log = edit(log, 'ahmad', 2, 'body>h1', 'text', 'Hi')
  assert.equal(log.length, before)
})

/* ─── ordering: the clock-skew case ─── */

test('Lamport clock decides order, not arrival order', () => {
  const later = makeEdit({}, {
    actor: 'zainab', clock: 9, routeKey: ROUTE, viewport: VIEW,
    path: 'body>h1', field: 'style:color', value: '#zainab',
  })
  const earlier = makeEdit({}, {
    actor: 'ahmad', clock: 2, routeKey: ROUTE, viewport: VIEW,
    path: 'body>h1', field: 'style:color', value: '#ahmad',
  })
  // Arrives out of order; clock 9 must still win.
  const store = deriveStore([later, earlier])
  assert.equal(store[SCOPE]['body>h1'].styles.color, '#zainab')
})

test('a fast wall clock does not beat a higher Lamport clock', () => {
  const skewed = {
    ...makeEdit({}, {
      actor: 'ahmad', clock: 1, routeKey: ROUTE, viewport: VIEW,
      path: 'body>h1', field: 'text', value: 'from the fast phone',
    }),
    ts: Date.now() + 5 * 60_000, // phone clock five minutes ahead
  }
  const correct = makeEdit({}, {
    actor: 'zainab', clock: 2, routeKey: ROUTE, viewport: VIEW,
    path: 'body>h1', field: 'text', value: 'from the correct phone',
  })
  assert.equal(deriveStore([skewed, correct])[SCOPE]['body>h1'].text, 'from the correct phone')
})

test('equal clocks tiebreak deterministically on actor', () => {
  const a = makeEdit({}, {
    actor: 'ahmad', clock: 3, routeKey: ROUTE, viewport: VIEW,
    path: 'p', field: 'text', value: 'A',
  })
  const z = makeEdit({}, {
    actor: 'zainab', clock: 3, routeKey: ROUTE, viewport: VIEW,
    path: 'p', field: 'text', value: 'Z',
  })
  assert.equal(deriveStore([a, z])[SCOPE].p.text, deriveStore([z, a])[SCOPE].p.text)
})

test('clock.observe keeps us ahead of what we have seen', () => {
  const clock = createClock()
  clock.observe(41)
  assert.equal(clock.tick(), 42)
})

/* ─── undo ─── */

test('undo restores the previous value, redo reapplies it', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'body>h1', 'style:color', '#000')
  log = edit(log, 'ahmad', 2, 'body>h1', 'style:color', '#fff')

  log = [...log, ...buildUndo(log, 'ahmad', 3)]
  assert.equal(deriveStore(log)[SCOPE]['body>h1'].styles.color, '#000')

  log = [...log, ...buildRedo(log, 'ahmad', 4)]
  assert.equal(deriveStore(log)[SCOPE]['body>h1'].styles.color, '#fff')
})

test('undo walks all the way back to empty', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'p', 'text', 'one')
  log = edit(log, 'ahmad', 2, 'p', 'text', 'two')
  log = [...log, ...buildUndo(log, 'ahmad', 3)]
  log = [...log, ...buildUndo(log, 'ahmad', 4)]
  assert.deepEqual(deriveStore(log), {})
  assert.equal(canUndo(log, 'ahmad'), false)
})

test('a new edit clears the redo stack', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'p', 'text', 'one')
  log = [...log, ...buildUndo(log, 'ahmad', 2)]
  assert.equal(canRedo(log, 'ahmad'), true)
  log = edit(log, 'ahmad', 3, 'p', 'text', 'three')
  assert.equal(canRedo(log, 'ahmad'), false)
})

test('a batch undoes as one step', () => {
  let log = []
  const batch = 'drag-1'
  log = edit(log, 'ahmad', 1, 'p', 'style:color', '#111', { batch, label: 'Colour' })
  log = edit(log, 'ahmad', 2, 'p', 'style:backgroundColor', '#222', { batch, label: 'Colour' })
  log = edit(log, 'ahmad', 3, 'p', 'style:borderColor', '#333', { batch, label: 'Colour' })
  assert.equal(undoCursor(log, 'ahmad').undoable.length, 1)
  assert.equal(undoLabel(log, 'ahmad'), 'Colour')

  log = [...log, ...buildUndo(log, 'ahmad', 4)]
  assert.deepEqual(deriveStore(log), {})
})

test('a drag that rewrites one field many times undoes to before the drag', () => {
  // The colour-picker case: one batch, one field, five values. Reversing each
  // op in turn would land on the second-to-last value instead of the original.
  let log = []
  log = edit(log, 'ahmad', 1, 'hero', 'style:backgroundColor', '#start')
  const batch = 'drag-2'
  const drag = ['#111', '#222', '#333', '#444', '#555']
  drag.forEach((value, i) => {
    log = edit(log, 'ahmad', i + 2, 'hero', 'style:backgroundColor', value, { batch, label: 'Fill' })
  })
  assert.equal(deriveStore(log)[SCOPE].hero.styles.backgroundColor, '#555')

  log = [...log, ...buildUndo(log, 'ahmad', 20)]
  assert.equal(
    deriveStore(log)[SCOPE].hero.styles.backgroundColor,
    '#start',
    'one undo must jump past the whole drag',
  )

  log = [...log, ...buildRedo(log, 'ahmad', 21)]
  assert.equal(deriveStore(log)[SCOPE].hero.styles.backgroundColor, '#555', 'redo must restore the end of the drag')
})

test('a mixed batch collapses per field, not per op', () => {
  let log = []
  const batch = 'mixed'
  log = edit(log, 'ahmad', 1, 'hero', 'style:color', '#a', { batch })
  log = edit(log, 'ahmad', 2, 'hero', 'style:gap', '4px', { batch })
  log = edit(log, 'ahmad', 3, 'hero', 'style:color', '#b', { batch })
  log = edit(log, 'ahmad', 4, 'hero', 'style:color', '#c', { batch })

  log = [...log, ...buildUndo(log, 'ahmad', 5)]
  assert.deepEqual(deriveStore(log), {}, 'every field in the batch should be back to unset')
})

/* ─── the multiplayer cases ─── */

test('undo is per actor: Ctrl+Z never reverts the other designer', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'hero', 'style:color', '#ahmad')
  log = edit(log, 'zainab', 2, 'footer', 'style:color', '#zainab')

  log = [...log, ...buildUndo(log, 'ahmad', 3)]

  const store = deriveStore(log)
  assert.equal(store[SCOPE]?.hero, undefined, 'ahmad’s own edit should be undone')
  assert.equal(store[SCOPE].footer.styles.color, '#zainab', 'zainab’s edit must survive')
})

test('an actor with no ops has nothing to undo', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'hero', 'text', 'Hi')
  assert.equal(canUndo(log, 'zainab'), false)
  assert.deepEqual(buildUndo(log, 'zainab', 2), [])
})

test('undo re-reads the live value instead of clobbering a newer edit', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'hero', 'style:color', '#ahmad')
  // Zainab overwrites the same field afterwards.
  log = edit(log, 'zainab', 2, 'hero', 'style:color', '#zainab')

  const undoOps = buildUndo(log, 'ahmad', 3)
  // Ahmad's undo must reverse from what is on screen now, not from his own
  // stale snapshot.
  assert.equal(undoOps[0].before, '#zainab')
  log = [...log, ...undoOps]
  assert.equal(currentValue(deriveStore(log), {
    routeKey: ROUTE, viewport: VIEW, path: 'hero', field: 'style:color',
  }), undefined)
})

test('two actors undo independently and interleaved', () => {
  let log = []
  log = edit(log, 'ahmad', 1, 'a', 'text', 'A1')
  log = edit(log, 'zainab', 2, 'z', 'text', 'Z1')
  log = edit(log, 'ahmad', 3, 'a', 'text', 'A2')

  log = [...log, ...buildUndo(log, 'zainab', 4)]   // zainab undoes hers
  log = [...log, ...buildUndo(log, 'ahmad', 5)]    // ahmad undoes his last

  const store = deriveStore(log)
  assert.equal(store[SCOPE].a.text, 'A1')
  assert.equal(store[SCOPE]?.z, undefined)
})

/* ─── seeding & reconciling ─── */

test('seeding brings the log up to a design that was loaded, not typed', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  const restored = { [SCOPE]: { hero: { text: 'Saved last week', styles: { color: '#000' } } } }
  session.seed(restored)
  assert.deepEqual(session.store(), restored, 'derived store must match what was loaded')
})

test('seeded design is not in anyone’s undo stack', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  session.seed({ [SCOPE]: { hero: { text: 'Saved last week' } } })
  assert.equal(session.canUndo(), false, 'Ctrl+Z must not peel away work from a previous session')

  record(session, 'hero', { text: 'Saved last week' }, { text: 'Edited today' })
  assert.equal(session.canUndo(), true)
  session.undo()
  assert.equal(session.store()[SCOPE].hero.text, 'Saved last week', 'undo stops at the baseline')
  assert.equal(session.canUndo(), false)
})

test('reconcile catches a store change nobody recorded', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  // Simulates an inline text edit or a drag-to-move writing straight to the store.
  session.reconcile({ [SCOPE]: { hero: { text: 'typed inline' } } })
  assert.equal(session.store()[SCOPE].hero.text, 'typed inline')
  assert.equal(session.canUndo(), true, 'an unrecorded edit is still the user’s to undo')
})

test('reconcile after an explicit record is a no-op', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#fff' } })
  const size = session.size()
  // The editor's store now holds exactly what the log already knows.
  assert.deepEqual(session.reconcile(session.store()), [])
  assert.equal(session.size(), size, 'double-recording would double every undo step')
})

test('reconcile records a deletion', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  session.seed({ [SCOPE]: { hero: { text: 'x', styles: { color: '#000' } } } })
  session.reconcile({})
  assert.deepEqual(session.store(), {})
  session.undo()
  assert.equal(session.store()[SCOPE].hero.text, 'x', 'clearing drafts must be undoable')
})

test('reconcile tags structural inserts, moves, wraps and deletes', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  const path = '__froam_injection__:node-1'
  const injected = (parentPath, order, html = '<section>New</section>') => JSON.stringify({ parentPath, order, html })

  const [insert] = session.reconcile({ [SCOPE]: { [path]: { text: injected('__froam_root__', 0) } } })
  assert.deepEqual(insert.structure, { kind: 'insert', nodeId: 'node-1', parentPath: '__froam_root__', index: 0 })

  const [move] = session.reconcile({ [SCOPE]: { [path]: { text: injected('main:nth-of-type(1)', 2) } } })
  assert.deepEqual(move.structure, { kind: 'move', nodeId: 'node-1', parentPath: 'main:nth-of-type(1)', index: 2 })

  const wrapPath = '__froam_injection__:wrapper-1'
  const [wrap] = session.reconcile({
    [SCOPE]: {
      [path]: { text: injected('main:nth-of-type(1)', 2) },
      [wrapPath]: { text: injected('__froam_root__', 1, '<div data-froam-wrapper="true"></div>') },
    },
  })
  assert.equal(wrap.structure?.kind, 'wrap')

  const [deleted] = session.reconcile({ [SCOPE]: { [wrapPath]: { text: injected('__froam_root__', 1, '<div data-froam-wrapper="true"></div>') } } })
  assert.equal(deleted.structure?.kind, 'delete')
})

test('diffStores sees adds, changes and removals across scopes', () => {
  const mobile = scopeKey(ROUTE, 'mobile')
  const changes = diffStores(
    { [SCOPE]: { a: { text: 'keep' }, b: { text: 'drop' } } },
    { [SCOPE]: { a: { text: 'keep' } }, [mobile]: { c: { text: 'new' } } },
  )
  const summary = changes.map((c) => `${c.viewport} ${c.path} ${c.field}=${c.value}`).sort()
  assert.deepEqual(summary, ['desktop b text=undefined', 'mobile c text=new'])
})

/* ─── compaction ─── */

test('compaction keeps the derived store identical', () => {
  let log = []
  for (let i = 0; i < 300; i += 1) {
    log = edit(log, 'ahmad', i + 1, `el-${i % 7}`, 'style:color', `#${(i % 9)}${(i % 9)}${(i % 9)}`)
  }
  const before = deriveStore(log)
  const compacted = compactLog(log, 50)
  assert.ok(compacted.length < log.length, 'compaction should shrink the log')
  assert.deepEqual(deriveStore(compacted), before)
})

test('compaction leaves recent undo history usable', () => {
  let log = []
  for (let i = 0; i < 300; i += 1) log = edit(log, 'ahmad', i + 1, 'p', 'text', `v${i}`)
  const compacted = compactLog(log, 50)
  assert.equal(canUndo(compacted, 'ahmad'), true)
  const undone = [...compacted, ...buildUndo(compacted, 'ahmad', 999)]
  assert.equal(deriveStore(undone)[SCOPE].p.text, 'v298')
})

/* ─── applyOp ─── */

test('applyOp does not mutate the input store', () => {
  const op = makeEdit({}, {
    actor: 'ahmad', clock: 1, routeKey: ROUTE, viewport: VIEW,
    path: 'p', field: 'text', value: 'Hi',
  })
  const store = {}
  const next = applyOp(store, op)
  assert.deepEqual(store, {})
  assert.equal(next[SCOPE].p.text, 'Hi')
})

/* ─── diffing drafts ─── */

test('diffDrafts reports only the fields that moved', () => {
  const changes = diffDrafts(
    { text: 'a', styles: { color: '#000', gap: '4px' } },
    { text: 'b', styles: { color: '#000', gap: '8px' } },
  )
  assert.deepEqual(changes.sort((x, y) => x.field.localeCompare(y.field)), [
    { field: 'style:gap', value: '8px' },
    { field: 'text', value: 'b' },
  ])
})

test('diffDrafts treats a removed style as an unset', () => {
  const changes = diffDrafts({ styles: { color: '#000' } }, { styles: {} })
  assert.deepEqual(changes, [{ field: 'style:color', value: undefined }])
})

test('diffDrafts on identical drafts is empty', () => {
  assert.deepEqual(diffDrafts({ text: 'a', styles: { color: '#000' } }, { text: 'a', styles: { color: '#000' } }), [])
})

/* ─── session ─── */

function record(session, path, prev, next, extra = {}) {
  return session.record({ routeKey: ROUTE, viewport: VIEW, path, prev, next, ...extra })
}

test('session records a draft change as ops', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { text: 'Run’Am', styles: { color: '#12c877' } })
  assert.equal(session.size(), 2)
  assert.equal(session.store()[SCOPE].hero.text, 'Run’Am')
  assert.equal(session.store()[SCOPE].hero.styles.color, '#12c877')
})

test('session records nothing when the draft did not move', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { text: 'Hi' })
  assert.deepEqual(record(session, 'hero', { text: 'Hi' }, { text: 'Hi' }), [])
  assert.equal(session.size(), 1)
})

test('one record call is one undo step, however many fields moved', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#111', gap: '8px', padding: '4px' } })
  assert.equal(session.size(), 3)
  session.undo()
  assert.deepEqual(session.store(), {})
  session.redo()
  assert.equal(session.store()[SCOPE].hero.styles.gap, '8px')
})

test('the incrementally derived store always equals a full re-fold', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  let prev = {}
  for (let i = 0; i < 60; i += 1) {
    const next = { text: `v${i}`, styles: { color: `#${i % 9}${i % 9}${i % 9}`, gap: `${i}px` } }
    record(session, `el-${i % 5}`, prev, next)
    prev = next
    if (i % 7 === 0) session.undo()
    if (i % 11 === 0) session.redo()
  }
  assert.deepEqual(session.store(), deriveStore(session.all()), 'incremental store drifted from the log')
})

test('session.observe folds in a remote actor and keeps our clock ahead', () => {
  const ahmad = createOpLogSession({ actor: 'ahmad' })
  record(ahmad, 'hero', {}, { styles: { color: '#ahmad' } })

  const zainab = createOpLogSession({ actor: 'zainab' })
  zainab.observe(ahmad.all())
  record(zainab, 'footer', {}, { styles: { color: '#zainab' } })

  // Zainab's later edit must sort after Ahmad's, not tie with it.
  const zainabOp = zainab.all().find((op) => op.actor === 'zainab')
  const ahmadOp = ahmad.all()[0]
  assert.ok(zainabOp.clock > ahmadOp.clock, 'clock did not advance past the observed op')

  ahmad.observe(zainab.all().filter((op) => op.actor === 'zainab'))
  assert.deepEqual(ahmad.store(), zainab.store(), 'the two sessions disagree about the design')
})

test('an out-of-order remote op still converges', () => {
  const a = createOpLogSession({ actor: 'ahmad' })
  record(a, 'hero', {}, { text: 'first' })
  record(a, 'hero', { text: 'first' }, { text: 'second' })

  const late = {
    id: 'late-op', kind: 'edit', actor: 'zainab', clock: 1, ts: Date.now(),
    routeKey: ROUTE, viewport: VIEW, path: 'hero', field: 'text',
    before: undefined, after: 'late arrival',
  }
  a.observe([late])
  // It sorts before Ahmad's second edit, so it must not win.
  assert.equal(a.store()[SCOPE].hero.text, 'second')
  assert.deepEqual(a.store(), deriveStore(a.all()))
})

test('undo in a room reverts only my own work', () => {
  const ahmad = createOpLogSession({ actor: 'ahmad' })
  record(ahmad, 'hero', {}, { styles: { color: '#ahmad' } })
  ahmad.observe([{
    id: 'z1', kind: 'edit', actor: 'zainab', clock: 50, ts: Date.now(),
    routeKey: ROUTE, viewport: VIEW, path: 'footer', field: 'style:color',
    before: undefined, after: '#zainab',
  }])

  ahmad.undo()
  assert.equal(ahmad.store()[SCOPE]?.hero, undefined)
  assert.equal(ahmad.store()[SCOPE].footer.styles.color, '#zainab')
})

/* ─── authority: the 60/40 rule ─── */

test('the ranks are the rule as agreed', () => {
  assert.equal(FROAM_ROLE_RANK.owner, 60)
  assert.equal(FROAM_ROLE_RANK.editor, 40)
  assert.equal(outranks('owner', 'editor'), true)
  assert.equal(outranks('editor', 'owner'), false)
})

test('who can do what', () => {
  assert.equal(canEdit('owner'), true)
  assert.equal(canEdit('editor'), true)
  assert.equal(canEdit('commenter'), false)
  assert.equal(canComment('commenter'), true)
  assert.equal(canComment('viewer'), false)
})

test('undoing your own work is always yours to do', () => {
  assert.equal(canRevert({ role: 'editor', ownWork: true }), 'allowed')
  assert.equal(canRevert({ role: 'owner', ownWork: true }), 'allowed')
})

test('an owner enacts an undo, a guest editor proposes one', () => {
  assert.equal(canRevert({ role: 'owner', ownWork: false }), 'allowed')
  assert.equal(canRevert({ role: 'editor', ownWork: false }), 'propose')
  assert.equal(canRevert({ role: 'commenter', ownWork: false }), 'denied')
})

test('a genuine conflict resolves in the owner’s favour', () => {
  const rankOf = rankLookup([
    { actor: 'ahmad', role: 'owner' },
    { actor: 'zainab', role: 'editor' },
  ])
  const compare = createAuthorityComparator(rankOf)
  // Same clock: neither saw the other. That is the only real conflict.
  const owner = { id: 'a', clock: 5, actor: 'ahmad', kind: 'edit', ts: 1, routeKey: ROUTE, viewport: VIEW, path: 'hero', field: 'style:color', before: undefined, after: '#owner' }
  const guest = { id: 'b', clock: 5, actor: 'zainab', kind: 'edit', ts: 1, routeKey: ROUTE, viewport: VIEW, path: 'hero', field: 'style:color', before: undefined, after: '#guest' }
  const settled = [guest, owner].sort(compare)
  assert.equal(settled.at(-1).after, '#owner', 'the owner’s value lands last and wins')
  assert.deepEqual([owner, guest].sort(compare).at(-1).after, '#owner', 'and the input order does not matter')
})

test('rank never beats the clock — that would be a read-only account', () => {
  const rankOf = rankLookup([
    { actor: 'ahmad', role: 'owner' },
    { actor: 'zainab', role: 'editor' },
  ])
  const compare = createAuthorityComparator(rankOf)
  const ownerEarlier = { id: 'a', clock: 2, actor: 'ahmad', kind: 'edit', ts: 1, routeKey: ROUTE, viewport: VIEW, path: 'hero', field: 'style:color', before: undefined, after: '#owner' }
  const guestLater = { id: 'b', clock: 9, actor: 'zainab', kind: 'edit', ts: 1, routeKey: ROUTE, viewport: VIEW, path: 'hero', field: 'style:color', before: undefined, after: '#guest' }
  assert.equal(
    [ownerEarlier, guestLater].sort(compare).at(-1).after,
    '#guest',
    'an edit that demonstrably came later is a sequence, not a conflict',
  )
})

test('the rule reaches the merge, not just the comparator', () => {
  // Folding order is the merge, so this is the end-to-end proof.
  const compare = createAuthorityComparator(rankLookup([
    { actor: 'ahmad', role: 'owner' },
    { actor: 'zainab', role: 'editor' },
  ]))
  const conflict = [
    { id: 'z', clock: 5, actor: 'zainab', kind: 'edit', ts: 1, routeKey: ROUTE, viewport: VIEW, path: 'hero', field: 'style:color', before: undefined, after: '#guest' },
    { id: 'a', clock: 5, actor: 'ahmad', kind: 'edit', ts: 1, routeKey: ROUTE, viewport: VIEW, path: 'hero', field: 'style:color', before: undefined, after: '#owner' },
  ]
  assert.equal(deriveStore(conflict, compare)[SCOPE].hero.styles.color, '#owner')
  // Without the rule, the same two ops tie on actor id and the guest wins.
  assert.equal(deriveStore(conflict)[SCOPE].hero.styles.color, '#guest')
})

test('unknown actors rank as viewers rather than crashing', () => {
  const rankOf = rankLookup([{ actor: 'ahmad', role: 'owner' }])
  assert.equal(rankOf('someone-else'), 0)
})

/* ─── the change log ─── */

test('the log reads back as a list of what people did', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  session.seed({ [SCOPE]: { hero: { text: 'Loaded last week' } } })
  record(session, 'hero', {}, { styles: { color: '#111', gap: '4px' } }, { label: 'Fill' })
  record(session, 'footer', {}, { text: 'Call us' }, { label: 'Text' })

  const changes = session.changes()
  assert.equal(changes.length, 2, 'loaded design is not something anyone did')
  assert.equal(changes[0].label, 'Text', 'newest first')
  assert.deepEqual(changes[1].paths, ['hero'])
  assert.equal(changes[1].fields.length, 2, 'one row per action, not per field')
})

test('a drag is one row, not fifty', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  const batch = 'drag'
  for (const v of ['#1', '#2', '#3', '#4', '#5']) {
    record(session, 'hero', { styles: { color: 'x' } }, { styles: { color: v } }, { batch, label: 'Fill' })
  }
  assert.equal(session.changes().length, 1)
})

test('two people show up as two rows, each attributed', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#a' } }, { label: 'Fill' })
  session.observe([{
    id: 'z1', kind: 'edit', actor: 'zainab', clock: 99, ts: Date.now(),
    routeKey: ROUTE, viewport: VIEW, path: 'footer', field: 'style:color',
    before: undefined, after: '#z', label: 'Fill', batch: 'zb',
  }])
  const changes = session.changes()
  assert.deepEqual(changes.map((c) => c.actor), ['zainab', 'ahmad'])
})

test('reverting a change from the middle of history', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#first' } }, { label: 'Fill' })
  const target = session.changes()[0].id
  record(session, 'footer', {}, { styles: { color: '#unrelated' } }, { label: 'Footer' })

  session.revert(target)
  const store = session.store()[SCOPE]
  assert.equal(store?.hero, undefined, 'the reverted change is gone')
  assert.equal(store.footer.styles.color, '#unrelated', 'later work is untouched')
})

test('a revert is a new entry, not a hole in the history', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#a' } }, { label: 'Fill' })
  const target = session.changes()[0].id
  session.revert(target)

  const changes = session.changes()
  assert.equal(changes.length, 2, 'the original stays visible')
  assert.equal(changes[0].kind, 'undo')
  assert.match(changes[0].label, /Undid/)
})

test('reverting someone else’s change is attributed to whoever reverted it', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  session.observe([{
    id: 'z1', kind: 'edit', actor: 'zainab', clock: 50, ts: Date.now(),
    routeKey: ROUTE, viewport: VIEW, path: 'footer', field: 'style:color',
    before: undefined, after: '#zainab', label: 'Fill', batch: 'zb',
  }])
  session.revert('zb')

  const [newest] = session.changes()
  assert.equal(newest.actor, 'ahmad', 'the record must show who took it back')
  assert.equal(session.store()[SCOPE]?.footer, undefined)
})

test('reverting a change a later edit overwrote restores the older value', () => {
  // The case a rewind would get wrong: the field moved on after the change.
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#one' } }, { label: 'A' })
  const first = session.changes()[0].id
  record(session, 'hero', { styles: { color: '#one' } }, { styles: { color: '#two' } }, { label: 'B' })

  session.revert(first)
  assert.equal(
    session.store()[SCOPE]?.hero,
    undefined,
    'reverting the change that introduced the field removes it, whatever came after',
  )
})

test('reverting twice does nothing the second time', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#a' } }, { label: 'Fill' })
  const target = session.changes()[0].id
  session.revert(target)
  const size = session.size()
  assert.deepEqual(session.revert(target), [], 'already undone')
  assert.equal(session.size(), size, 'no dead entry in the list')
})

test('reverting an unknown change is a no-op, not a throw', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  assert.deepEqual(session.revert('does-not-exist'), [])
})

/* ─── receiving a design from another device ─── */

function publish(session, store, publishedAt) {
  return session.adoptPublished({ routeKey: ROUTE, viewport: VIEW, store, publishedAt })
}

test('a published design reaches a device that already has drafts', () => {
  // The exact bug: a phone opened in the editor once would refuse every
  // publish from the laptop, forever.
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'footer', {}, { styles: { color: '#old' } })

  const result = publish(session, { hero: { styles: { color: '#fromLaptop' } } }, Date.now() + 60_000)
  assert.equal(session.store()[SCOPE].hero.styles.color, '#fromLaptop', 'the laptop’s design must land')
})

test('a field missing from the publish is a deletion, not an omission', () => {
  // The publish payload is the whole route, so absence is meaningful —
  // without this, a style removed on the laptop could never disappear
  // anywhere else.
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'footer', {}, { styles: { color: '#old' } })

  publish(session, { hero: { styles: { color: '#fromLaptop' } } }, Date.now() + 60_000)
  assert.equal(session.store()[SCOPE].footer, undefined, 'the stale draft should be gone')
})

test('a local edit made after the publish is kept', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#mineJustNow' } })

  // Publish is older than the local edit.
  const result = publish(session, { hero: { styles: { color: '#stale' } } }, Date.now() - 60_000)
  assert.equal(result.kept, 1)
  assert.equal(result.adopted, 0)
  assert.equal(session.store()[SCOPE].hero.styles.color, '#mineJustNow', 'unsaved work must not be overwritten')
})

test('the merge is per field, not per route', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  record(session, 'hero', {}, { styles: { color: '#mine' } })

  const result = publish(session, {
    hero: { styles: { color: '#theirs', backgroundColor: '#theirBg' } },
    footer: { styles: { color: '#theirFooter' } },
  }, Date.now() - 60_000)

  const store = session.store()[SCOPE]
  assert.equal(store.hero.styles.color, '#mine', 'my newer edit survives')
  assert.equal(store.hero.styles.backgroundColor, '#theirBg', 'a field I never touched still arrives')
  assert.equal(store.footer.styles.color, '#theirFooter', 'so does an element I never touched')
  assert.equal(result.kept, 1)
})

test('an arriving design is not the user’s work to undo', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  publish(session, { hero: { styles: { color: '#fromLaptop' } } }, Date.now())
  assert.equal(session.canUndo(), false, 'Ctrl+Z must not peel away a teammate’s published design')
})

test('baseline drafts give way to a publish', () => {
  // Drafts restored from storage are baseline, not local work — a publish
  // should replace them without argument.
  const session = createOpLogSession({ actor: 'ahmad' })
  session.seed({ [SCOPE]: { hero: { styles: { color: '#restored' } } } })
  const result = publish(session, { hero: { styles: { color: '#published' } } }, Date.now() - 60_000)
  assert.equal(result.adopted, 1)
  assert.equal(session.store()[SCOPE].hero.styles.color, '#published')
})

test('republishing the same design changes nothing', () => {
  const session = createOpLogSession({ actor: 'ahmad' })
  const design = { hero: { styles: { color: '#same' } } }
  publish(session, design, Date.now())
  const size = session.size()
  const again = publish(session, design, Date.now())
  assert.equal(again.adopted, 0)
  assert.equal(session.size(), size, 'a poll loop must not grow the log')
})

/* ─── anchors ─── */

const HERO = {
  tag: 'h1',
  text: 'Run’Am — get anything moved',
  className: 'hero__title display',
  anchorId: 'hero',
  anchorPath: 'h1:1',
  ordinal: 1,
}

test('an identical element scores a perfect match', () => {
  assert.equal(scoreFingerprint(HERO, { ...HERO }), 1)
})

test('a different tag is never a match, however much else agrees', () => {
  assert.equal(scoreFingerprint(HERO, { ...HERO, tag: 'h2' }), 0)
})

test('the same element, moved: path and ordinal change, identity does not', () => {
  const moved = { ...HERO, anchorPath: 'div:2/h1:1', ordinal: 3 }
  assert.ok(scoreFingerprint(HERO, moved) >= ANCHOR_MATCH_THRESHOLD, 'a wrapped section must not orphan its own headline')
})

test('an id outweighs everything around it', () => {
  const want = { ...HERO, id: 'page-title' }
  const movedAndRestyled = { tag: 'h1', id: 'page-title', text: 'A totally rewritten headline', className: 'other' }
  assert.ok(scoreFingerprint(want, movedAndRestyled) >= ANCHOR_MATCH_THRESHOLD)
})

test('a different element in the same slot is rejected', () => {
  // The dangerous case: the path still resolves, but to a stranger.
  const stranger = { tag: 'h1', text: 'Pricing', className: 'pricing__title', anchorId: 'pricing', anchorPath: 'h1:1', ordinal: 1 }
  assert.ok(scoreFingerprint(HERO, stranger) < ANCHOR_MATCH_THRESHOLD, 'this is exactly the silent-detach bug')
})

test('an element with nothing distinctive cannot match on tag alone', () => {
  assert.equal(scoreFingerprint({ tag: 'div' }, { tag: 'div' }), 0)
})

test('edited copy still matches when the rest holds', () => {
  const lightlyEdited = { ...HERO, text: 'Run’Am — get anything moved today' }
  assert.ok(scoreFingerprint(HERO, lightlyEdited) >= ANCHOR_MATCH_THRESHOLD)
})

test('rewritten copy on an anonymous element does orphan', () => {
  const textOnly = { tag: 'p', text: 'The quick brown fox jumps over the lazy dog' }
  const rewritten = { tag: 'p', text: 'Entirely unrelated sentence about shipping rates' }
  assert.ok(scoreFingerprint(textOnly, rewritten) < ANCHOR_MATCH_THRESHOLD, 'better an honest orphan than a wrong re-attach')
})

test('scoring is scale-free: absent signals are not counted against a candidate', () => {
  const sparse = { tag: 'button', text: 'Post a task' }
  assert.equal(scoreFingerprint(sparse, { tag: 'button', text: 'Post a task', className: 'btn btn--primary' }), 1)
})

test('tagOfPath reads the leaf tag without a DOM', () => {
  assert.equal(tagOfPath('div:1/section:2/h1:1'), 'h1')
  assert.equal(tagOfPath(''), '')
})

/* ─── persistence ─── */

function busyLog(edits) {
  let log = []
  for (let i = 0; i < edits; i += 1) {
    log = edit(log, 'ahmad', i + 1, `el-${i % 12}`, 'style:color', `#${i % 9}${i % 9}${i % 9}`)
  }
  return log
}

test('undo history survives a reload', () => {
  const disk = fakeStorage()
  let log = []
  log = edit(log, 'ahmad', 1, 'hero', 'text', 'first')
  log = edit(log, 'ahmad', 2, 'hero', 'text', 'second')
  withStorage(disk, () => saveOpLog(log))

  // New page, new session — as if the browser had been closed.
  const revived = createOpLogSession({ actor: 'ahmad', ops: withStorage(disk, () => loadOpLog()) })
  assert.equal(revived.store()[SCOPE].hero.text, 'second')
  assert.equal(revived.canUndo(), true, 'yesterday’s work should still be undoable')
  revived.undo()
  assert.equal(revived.store()[SCOPE].hero.text, 'first')
})

test('a reload with no stored log starts clean', () => {
  assert.deepEqual(withStorage(fakeStorage(), () => loadOpLog()), [])
})

test('corrupt or foreign ops are dropped, not trusted', () => {
  const disk = fakeStorage()
  withStorage(disk, () => {
    disk.setItem(FROAM_OPLOG_KEY, JSON.stringify({
      v: 1,
      ops: [
        { id: 'ok', kind: 'edit', actor: 'a', clock: 1, ts: 1, routeKey: '/', viewport: 'desktop', path: 'p', field: 'text', before: undefined, after: 'fine' },
        { id: 'bad-viewport', kind: 'edit', actor: 'a', clock: 2, ts: 1, routeKey: '/', viewport: 'watch', path: 'p', field: 'text', after: 'nope' },
        { id: 'bad-kind', kind: 'delete', actor: 'a', clock: 3, ts: 1, routeKey: '/', viewport: 'desktop', path: 'p', field: 'text', after: 'nope' },
        { id: 'bad-clock', kind: 'edit', actor: 'a', clock: 'soon', ts: 1, routeKey: '/', viewport: 'desktop', path: 'p', field: 'text', after: 'nope' },
        null,
      ],
    }))
    const ops = loadOpLog()
    assert.equal(ops.length, 1)
    assert.equal(ops[0].id, 'ok')
  })
})

test('a payload from a future version is ignored rather than misread', () => {
  const disk = fakeStorage()
  withStorage(disk, () => {
    disk.setItem(FROAM_OPLOG_KEY, JSON.stringify({ v: 99, ops: [{ id: 'x' }] }))
    assert.deepEqual(loadOpLog(), [])
  })
})

test('under storage pressure the log sheds history but keeps the design', () => {
  const log = busyLog(900)
  const before = deriveStore(log)
  const disk = fakeStorage(6_000) // tiny quota, forces the ladder down

  const stored = withStorage(disk, () => saveOpLog(log))
  assert.ok(stored.length < log.length, 'should have compacted')
  assert.deepEqual(deriveStore(stored), before, 'the design must survive intact')

  const revived = withStorage(disk, () => loadOpLog())
  assert.deepEqual(deriveStore(revived), before, 'and must still be intact after a reload')
})

test('an impossible quota drops the log instead of throwing', () => {
  const disk = fakeStorage(10)
  const log = busyLog(50)
  const stored = withStorage(disk, () => saveOpLog(log))
  assert.ok(Array.isArray(stored), 'save must not throw')
  assert.deepEqual(withStorage(disk, () => loadOpLog()), [], 'a log that cannot be trusted is not left behind')
})

test('saving without a window is a no-op, not a crash', () => {
  const previous = globalThis.window
  globalThis.window = undefined
  try {
    assert.deepEqual(loadOpLog(), [])
    assert.ok(Array.isArray(saveOpLog(busyLog(3))))
    clearOpLog()
  } finally {
    globalThis.window = previous
  }
})

/* ─── runner ─── */

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}`)
    console.log(`       ${error.message.split('\n').join('\n       ')}`)
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`)
process.exit(failed ? 1 : 0)
