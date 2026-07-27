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
  makeEdit,
  undoCursor,
  undoLabel,
} = await import('../dist/collab/oplog.js')
const { scopeKey } = await import('../dist/collab/types.js')

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
