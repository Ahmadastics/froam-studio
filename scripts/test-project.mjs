/** Connected Canvas foundation tests. Runs against built public modules. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

class FakeElement {
  constructor(tag, options = {}) {
    this.tagName = tag.toUpperCase()
    this.id = options.id ?? ''
    this.textContent = options.text ?? ''
    this.className = options.className ?? ''
    this.parentElement = null
    this.children = []
    this.dataset = {}
    this.attributes = new Map()
  }
  append(...children) {
    for (const child of children) {
      child.parentElement = this
      this.children.push(child)
    }
  }
  setAttribute(name, value) {
    const text = String(value)
    this.attributes.set(name, text)
    if (name === 'data-froam-id') this.dataset.froamId = text
    if (name === 'data-froam-injected') this.dataset.froamInjected = text
  }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector) {
    const all = []
    const visit = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) all.push(child)
        visit(child)
      }
    }
    visit(this)
    return all
  }
}

function matches(element, selector) {
  const attribute = selector.match(/^\[data-froam-id="(.+)"\]$/)
  if (attribute) return element.getAttribute('data-froam-id') === attribute[1]
  if (selector.startsWith('#')) return element.id === selector.slice(1)
  return element.tagName.toLowerCase() === selector.toLowerCase()
}

globalThis.HTMLElement = FakeElement
globalThis.CSS = { escape: (value) => String(value) }

const {
  captureNodeRef,
  resolveNodeRef,
} = await import('../dist/project/node-registry.js')
const {
  createProjectFileFromLegacyDesign,
  parseFroamProjectFile,
  serializeFroamProjectFile,
  unwrapLegacyDesign,
} = await import('../dist/project/serialization.js')
const { getElementPath, findElementByPath } = await import('../dist/collab/paths.js')
const {
  appendProjectEvents,
  checkpointBranch,
  createProjectBranch,
  createProjectDocument,
  createProjectEvent,
  deleteProjectBranch,
  deriveBranchState,
  renameProjectBranch,
  switchProjectBranch,
} = await import('../dist/project/event-log.js')
const { legacyOpsToProjectEvents, nodeRegistryGraphRecords, sitePlanGraphRecords } = await import('../dist/project/adapters.js')
const { makeEdit } = await import('../dist/collab/oplog.js')
const { componentCatalogGraphRecords } = await import('../dist/project/component-adapter.js')
const { dnaFromScan } = await import('../dist/project/scan.js')
const { compileInteractionToCss } = await import('../dist/project/interaction-runtime.js')
const { branchReplayEvents, filterReplayEvents, replayCategory, replayStateAt } = await import('../dist/project/replay.js')
const { graphSelectionIndex, materializeGraphRows } = await import('../dist/project/graph-inspector.js')
const { interactionInspectorRecord, legacyAnimatorToInteraction } = await import('../dist/project/animator-adapter.js')
const { runSimulationScenario } = await import('../dist/project/simulation.js')
const { defaultFroamFeatureFlags } = await import('../dist/project/experiments.js')
const { isProjectFile, loadProjectFile, writeProjectFile } = await import('../lib/project-store.mjs')

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('stable identity survives DOM reordering', () => {
  const root = new FakeElement('main')
  const first = new FakeElement('p', { text: 'First' })
  const target = new FakeElement('p', { text: 'Stable target' })
  root.append(first, target)
  const captured = captureNodeRef(target, root, {}, { idFactory: () => 'node-stable', now: 1 })
  root.children = [target, first]
  const resolved = resolveNodeRef(captured.ref, root, captured.registry)
  assert.equal(resolved.status, 'exact')
  assert.equal(resolved.element, target)
  assert.equal(resolved.ref.nodeId, 'node-stable')
  assert.equal(resolved.ref.path, 'p:1')
})

test('stale path recovers through fingerprint and updates the registry', () => {
  const root = new FakeElement('main')
  const target = new FakeElement('p', { text: 'Remember this paragraph' })
  const other = new FakeElement('p', { text: 'Different paragraph' })
  root.append(target, other)
  const captured = captureNodeRef(target, root, {}, { idFactory: () => 'node-recover', attach: false, now: 1 })
  root.children = [other, target]
  const resolved = resolveNodeRef(captured.ref, root, captured.registry)
  assert.equal(resolved.status, 'recovered')
  assert.equal(resolved.element, target)
  assert.equal(resolved.ref.path, 'p:2')
  assert.equal(resolved.registry['node-recover'].path, 'p:2')
  assert.equal(target.getAttribute('data-froam-id'), 'node-recover')
})

test('identity loss after a host rerender recovers through the verified path with diagnostics', () => {
  const root = new FakeElement('main')
  const original = new FakeElement('button', { text: 'Continue' })
  root.append(original)
  const captured = captureNodeRef(original, root, {}, { idFactory: () => 'rerendered-button', now: 1 })
  const replacement = new FakeElement('button', { text: 'Continue' })
  root.children = [replacement]
  replacement.parentElement = root
  const diagnostics = []
  const resolved = resolveNodeRef(captured.ref, root, captured.registry, { now: 2, onDiagnostic: (event) => diagnostics.push(event) })
  assert.equal(resolved.status, 'recovered')
  assert.equal(resolved.resolvedBy, 'path')
  assert.equal(replacement.getAttribute('data-froam-id'), 'rerendered-button')
  assert.ok(diagnostics.some((event) => event.type === 'identity-attribute-lost'))
  assert.ok(diagnostics.some((event) => event.type === 'resolved-by-path'))
})

test('ambiguous fingerprint recovery stays orphaned and reports the ambiguity', () => {
  const root = new FakeElement('main')
  const first = new FakeElement('p', { text: 'Repeated copy' })
  const second = new FakeElement('p', { text: 'Repeated copy' })
  root.append(first, second)
  const captured = captureNodeRef(first, root, {}, { idFactory: () => 'ambiguous-node', attach: false, now: 1 })
  const ref = { ...captured.ref, path: 'p:9' }
  const diagnostics = []
  const resolved = resolveNodeRef(ref, root, captured.registry, { ambiguityDelta: 0.4, onDiagnostic: (event) => diagnostics.push(event) })
  assert.equal(resolved.status, 'orphaned')
  assert.equal(resolved.registry['ambiguous-node'].lastResolution, 'ambiguous')
  assert.ok(diagnostics.some((event) => event.type === 'ambiguous-match'))
})

test('keeps an injected Froam component identity', () => {
  const root = new FakeElement('main')
  const injected = new FakeElement('section', { text: 'Hero' })
  injected.setAttribute('data-froam-id', 'injected-hero')
  injected.setAttribute('data-froam-injected', 'true')
  root.append(injected)
  const captured = captureNodeRef(injected, root, {}, { idFactory: () => 'wrong-id', now: 1 })
  assert.equal(captured.ref.nodeId, 'injected-hero')
  assert.equal(captured.registry['injected-hero'].source, 'froam')
})

test('allocates and attaches identity to a native host element', () => {
  const root = new FakeElement('main')
  const native = new FakeElement('button', { id: 'checkout', text: 'Buy' })
  root.append(native)
  const captured = captureNodeRef(native, root, {}, { idFactory: () => 'native-checkout', now: 1 })
  assert.equal(captured.ref.nodeId, 'native-checkout')
  assert.equal(native.getAttribute('data-froam-id'), 'native-checkout')
  assert.equal(captured.registry['native-checkout'].source, 'host-dom')
})

test('prevents duplicate data-froam-id identities', () => {
  const root = new FakeElement('main')
  const original = new FakeElement('section', { text: 'Original' })
  const duplicate = new FakeElement('section', { text: 'Copy' })
  original.setAttribute('data-froam-id', 'same-id')
  duplicate.setAttribute('data-froam-id', 'same-id')
  root.append(original, duplicate)
  const first = captureNodeRef(original, root, {}, { idFactory: () => 'unused', now: 1 })
  const second = captureNodeRef(duplicate, root, first.registry, { idFactory: () => 'copy-id', now: 2 })
  assert.equal(first.ref.nodeId, 'same-id')
  assert.equal(second.ref.nodeId, 'copy-id')
  assert.equal(duplicate.getAttribute('data-froam-id'), 'copy-id')
})

const legacy = {
  version: 3,
  updatedAt: '2026-08-08T00:00:00.000Z',
  meta: { name: 'Compatibility' },
  routes: { '/': { desktop: { 'main:1/h1:1': { text: 'Hello' } } } },
}

test('project envelope serializes and deserializes without losing the legacy design', () => {
  const file = createProjectFileFromLegacyDesign(legacy, {
    projectId: 'project-1', actorId: 'ahmad', now: 10, idFactory: () => 'checkpoint-1',
  })
  const parsed = parseFroamProjectFile(serializeFroamProjectFile(file), {
    projectId: 'unused', actorId: 'unused',
  })
  assert.equal(parsed.migrated, false)
  assert.deepEqual(unwrapLegacyDesign(parsed.file), legacy)
  assert.equal(parsed.file.project.schemaVersion, 1)
})

test('project sidecar store persists only valid envelopes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-project-'))
  const target = path.join(directory, 'froam.project.json')
  const file = createProjectFileFromLegacyDesign(legacy, {
    projectId: 'sidecar', actorId: 'ahmad', now: 10, idFactory: () => 'sidecar-checkpoint',
  })
  assert.equal(isProjectFile(file), true)
  writeProjectFile(target, file)
  assert.deepEqual(loadProjectFile(target), file)
  assert.throws(() => writeProjectFile(target, legacy), /Invalid Froam project/)
})

test('old persisted designs migrate additively and remain directly unwrap-able', () => {
  const parsed = parseFroamProjectFile(JSON.stringify(legacy), {
    projectId: 'legacy-project', actorId: 'baseline', now: 20, idFactory: () => 'legacy-checkpoint',
  })
  assert.equal(parsed.migrated, true)
  assert.deepEqual(unwrapLegacyDesign(parsed.file), legacy)
  const checkpoint = parsed.file.project.checkpoints['legacy-checkpoint']
  assert.equal(checkpoint.state.legacyStore['/@@desktop']['main:1/h1:1'].text, 'Hello')
})

test('legacy path addressing behavior remains unchanged', () => {
  const root = new FakeElement('main')
  const section = new FakeElement('section')
  const heading = new FakeElement('h1', { text: 'Path contract' })
  section.append(heading)
  root.append(section)
  const path = getElementPath(heading, root)
  assert.equal(path, 'section:1/h1:1')
  assert.equal(findElementByPath(root, path), heading)
})

test('project history replays deterministically regardless of arrival order', () => {
  const project = createProjectDocument({
    id: 'history-project', name: 'History', actorId: 'ahmad', now: 1, idFactory: () => 'history-base',
  })
  const early = createProjectEvent({
    id: 'event-1', projectId: project.id, branchId: 'main', actorId: 'ahmad', clock: 1,
    createdAt: 2, type: 'node.upserted', targetIds: ['hero'],
    payload: { node: { id: 'hero', kind: 'element', source: 'host-dom', name: 'Early' } },
  })
  const late = createProjectEvent({
    id: 'event-2', projectId: project.id, branchId: 'main', actorId: 'ahmad', clock: 2,
    createdAt: 3, type: 'node.upserted', targetIds: ['hero'],
    payload: { node: { id: 'hero', kind: 'element', source: 'host-dom', name: 'Late' } },
  })
  const forward = appendProjectEvents(project, [early, late])
  const reverse = appendProjectEvents(project, [late, early])
  assert.deepEqual(deriveBranchState(forward), deriveBranchState(reverse))
  assert.equal(deriveBranchState(forward).nodes.hero.name, 'Late')
})

test('existing collaboration ops project into branch history without changing their fold', () => {
  const project = createProjectDocument({
    id: 'op-project', name: 'Ops', actorId: 'ahmad', now: 1, idFactory: () => 'op-base',
  })
  const op = makeEdit({}, {
    actor: 'ahmad', clock: 1, routeKey: '/', viewport: 'desktop', path: 'main:1/h1:1',
    field: 'text', value: 'Connected Canvas', label: 'Headline',
  })
  op.nodeId = 'headline-node'
  const next = appendProjectEvents(project, legacyOpsToProjectEvents([op], { projectId: project.id, branchId: 'main' }))
  assert.equal(deriveBranchState(next).legacyStore['/@@desktop']['main:1/h1:1'].text, 'Connected Canvas')
  assert.deepEqual(next.events[0].targetIds, ['headline-node'])
})

test('a checkpoint folds known events but still replays a late unseen event', () => {
  let ids = 0
  let project = createProjectDocument({
    id: 'checkpoint-project', name: 'Checkpoint', actorId: 'ahmad', now: 1, idFactory: () => `cp-${++ids}`,
  })
  const known = createProjectEvent({
    id: 'known', projectId: project.id, branchId: 'main', actorId: 'ahmad', clock: 2,
    createdAt: 2, type: 'node.upserted', targetIds: ['known'],
    payload: { node: { id: 'known', kind: 'element', source: 'host-dom' } },
  })
  project = appendProjectEvents(project, [known])
  project = checkpointBranch(project, { actorId: 'ahmad', now: 3, idFactory: () => `cp-${++ids}` })
  const lateArrival = createProjectEvent({
    id: 'late-arrival', projectId: project.id, branchId: 'main', actorId: 'zainab', clock: 1,
    createdAt: 4, type: 'node.upserted', targetIds: ['late'],
    payload: { node: { id: 'late', kind: 'element', source: 'host-dom' } },
  })
  project = appendProjectEvents(project, [lateArrival])
  assert.deepEqual(Object.keys(deriveBranchState(project).nodes).sort(), ['known', 'late'])
})

test('branches fork the materialized state and remain isolated', () => {
  let project = createProjectDocument({
    id: 'branch-project', name: 'Branches', actorId: 'ahmad', now: 1, idFactory: () => 'branch-base',
  })
  project = appendProjectEvents(project, [createProjectEvent({
    id: 'main-node', projectId: project.id, branchId: 'main', actorId: 'ahmad', clock: 1,
    type: 'node.upserted', targetIds: ['shared'],
    payload: { node: { id: 'shared', kind: 'element', source: 'host-dom', name: 'Shared' } },
  })])
  project = createProjectBranch(project, {
    id: 'experiment', name: 'Experiment', actorId: 'ahmad', now: 2, idFactory: () => 'experiment-base',
  })
  project = appendProjectEvents(project, [createProjectEvent({
    id: 'experiment-node', projectId: project.id, branchId: 'experiment', actorId: 'ahmad', clock: 2,
    type: 'node.upserted', targetIds: ['only-experiment'],
    payload: { node: { id: 'only-experiment', kind: 'element', source: 'froam' } },
  })])
  assert.equal(deriveBranchState(project, 'main').nodes['only-experiment'], undefined)
  assert.ok(deriveBranchState(project, 'experiment').nodes.shared)
  assert.ok(deriveBranchState(project, 'experiment').nodes['only-experiment'])
  assert.equal(switchProjectBranch(project, 'main').activeBranchId, 'main')
})

test('prototype rename, switching, persistence and deletion safeguards are deterministic', () => {
  let project = createProjectDocument({ id: 'prototype-project', name: 'Prototype', actorId: 'ahmad', now: 1, idFactory: () => 'prototype-base' })
  project = createProjectBranch(project, { id: 'mobile', name: 'Mobile', actorId: 'ahmad', now: 2, idFactory: () => 'mobile-base' })
  project = renameProjectBranch(project, 'mobile', 'Mobile Concept', 3)
  assert.equal(project.branches.mobile.name, 'Mobile Concept')
  assert.equal(switchProjectBranch(project, 'main').activeBranchId, 'main')
  assert.throws(() => deleteProjectBranch(project, 'main'), /cannot be deleted/)
  const serialized = JSON.parse(JSON.stringify(project))
  assert.equal(serialized.branches.mobile.parentBranchId, 'main')
  const deleted = deleteProjectBranch(project, 'mobile', 4)
  assert.equal(deleted.branches.mobile, undefined)
  assert.equal(deleted.activeBranchId, 'main')
})

test('a parent prototype with a child cannot be deleted out from under it', () => {
  let project = createProjectDocument({ id: 'branch-tree', name: 'Tree', actorId: 'ahmad', now: 1, idFactory: () => 'tree-base' })
  project = createProjectBranch(project, { id: 'parent', name: 'Parent', actorId: 'ahmad', now: 2, idFactory: () => 'parent-base' })
  project = createProjectBranch(project, { id: 'child', name: 'Child', actorId: 'ahmad', now: 3, idFactory: () => 'child-base' })
  assert.throws(() => deleteProjectBranch(project, 'parent'), /child prototypes/)
})

test('Replay orders deterministically and filters by actor and semantic category', () => {
  let project = createProjectDocument({ id: 'replay-project', name: 'Replay', actorId: 'ahmad', now: 1, idFactory: () => 'replay-base' })
  const textOp = makeEdit({}, { actor: 'ahmad', clock: 2, routeKey: '/', viewport: 'desktop', path: 'h1:1', field: 'text', value: 'Hello', label: 'Text' })
  const styleOp = makeEdit({}, { actor: 'musa', clock: 1, routeKey: '/', viewport: 'desktop', path: 'h1:1', field: 'style:color', value: 'red', label: 'Color' })
  project = appendProjectEvents(project, legacyOpsToProjectEvents([textOp, styleOp], { projectId: project.id, branchId: 'main' }).reverse())
  const events = branchReplayEvents(project)
  assert.deepEqual(events.map((event) => event.actorId), ['musa', 'ahmad'])
  assert.equal(replayCategory(events[0]), 'styling')
  assert.deepEqual(filterReplayEvents(events, { actorId: 'ahmad' }).map((event) => event.id), [textOp.id])
  assert.equal(replayStateAt(project, 1).legacyStore['/@@desktop']['h1:1'].styles.color, 'red')
  assert.equal(replayStateAt(project, 2).legacyStore['/@@desktop']['h1:1'].text, 'Hello')
})

test('Replay continues from a checkpoint without replaying folded events twice', () => {
  let counter = 0
  let project = createProjectDocument({ id: 'replay-checkpoint', name: 'Replay CP', actorId: 'ahmad', now: 1, idFactory: () => `replay-cp-${++counter}` })
  const first = makeEdit({}, { actor: 'ahmad', clock: 1, routeKey: '/', viewport: 'desktop', path: 'p:1', field: 'text', value: 'One' })
  project = appendProjectEvents(project, legacyOpsToProjectEvents([first], { projectId: project.id, branchId: 'main' }))
  project = checkpointBranch(project, { actorId: 'ahmad', now: 2, idFactory: () => `replay-cp-${++counter}` })
  const second = makeEdit(deriveBranchState(project).legacyStore, { actor: 'ahmad', clock: 2, routeKey: '/', viewport: 'desktop', path: 'p:1', field: 'text', value: 'Two' })
  project = appendProjectEvents(project, legacyOpsToProjectEvents([second], { projectId: project.id, branchId: 'main' }))
  assert.equal(replayStateAt(project, 0).legacyStore['/@@desktop']['p:1'].text, 'One')
  assert.equal(replayStateAt(project, 1).legacyStore['/@@desktop']['p:1'].text, 'Two')
})

test('Site Planner records project cleanly into shared graph nodes and relations', () => {
  const graph = sitePlanGraphRecords([{
    id: 'home', name: 'Home', path: '/', parentId: null, status: 'ready',
    sections: [{
      id: 'hero-section', componentId: 'hero-01', name: 'Hero',
      frame: { preset: 'responsive', width: 1200, height: 720, background: '#fff' },
    }],
  }])
  assert.equal(graph.nodes.length, 2)
  assert.ok(graph.relations.some((relation) => relation.kind === 'contains'))
  assert.ok(graph.relations.some((relation) => relation.kind === 'instance-of'))
})

test('component catalog projects into the same graph vocabulary', () => {
  const graph = componentCatalogGraphRecords([{ id: 'hero-01', title: 'Hero', category: 'hero', anatomy: ['heading'] }])
  assert.equal(graph.nodes[0].kind, 'component-definition')
  assert.equal(graph.nodes[0].metadata.category, 'hero')
})

test('registry nodes materialize into graph rows with two-way selection mapping', () => {
  const graph = nodeRegistryGraphRecords({ hero: { nodeId: 'hero', source: 'host-dom', updatedAt: 1, path: 'section:1', routeKey: '/', viewport: 'desktop', fingerprint: { tag: 'section', text: 'Hero' } } })
  const state = { legacyStore: {}, nodes: Object.fromEntries(graph.nodes.map((node) => [node.id, node])), relations: Object.fromEntries(graph.relations.map((relation) => [relation.id, relation])), flows: {}, interactions: {}, dna: {}, assets: {} }
  const rows = materializeGraphRows(state)
  const index = graphSelectionIndex(state)
  assert.ok(rows.some((row) => row.node.id === 'hero' && row.depth === 1))
  assert.equal(index.byNodeId.get('hero').locator.path, 'section:1')
  assert.equal(index.byPath.get('section:1').id, 'hero')
})

test('Scan signals become DNA without inventing observations', () => {
  const dna = dnaFromScan({
    node: { nodeId: 'hero', path: 'section:1' }, capturedAt: 10,
    signals: [
      { kind: 'layout', source: 'computed-style', values: { display: 'grid' } },
      { kind: 'accessibility', source: 'dom', values: { role: 'region' }, confidence: 0.9 },
    ],
  })
  assert.equal(dna.nodeId, 'hero')
  assert.equal(dna.layout.display, 'grid')
  assert.equal(dna.accessibility.role, 'region')
})

test('interaction model compiles through an explicit CSS adapter', () => {
  const compiled = compileInteractionToCss({
    id: 'fade in', name: 'Fade', sourceId: 'hero', targetIds: ['hero'], trigger: 'scroll',
    durationMs: 500, timeline: [{ at: 0, values: { opacity: 0 } }, { at: 1, values: { opacity: 1 } }],
  })
  assert.match(compiled.css, /@keyframes froam-fade-in/)
  assert.equal(compiled.requiresRuntime, true)
})

test('legacy Animator adapts and serializes through the shared interaction model', () => {
  const interaction = legacyAnimatorToInteraction({
    name: 'fade', duration: 500, delay: 20, iterations: 1, direction: 'normal', easing: 'ease-out', trigger: 'hover', fillMode: 'both',
    keyframes: [{ id: 'a', offset: 100, properties: { opacity: '1' } }, { id: 'b', offset: 0, properties: { opacity: '0' } }],
  }, { id: 'interaction-1', sourceId: 'hero' })
  const inspected = interactionInspectorRecord(JSON.parse(JSON.stringify(interaction)))
  assert.deepEqual(interaction.timeline.map((frame) => frame.at), [0, 1])
  assert.equal(inspected.trigger, 'hover')
  assert.equal(inspected.compilerTarget, 'css-keyframes')
  assert.match(compileInteractionToCss(interaction).animation, /500ms/)
})

test('simulation scenarios execute deterministically through adapters', async () => {
  const seen = []
  const result = await runSimulationScenario({
    id: 'offline-checkout', name: 'Offline checkout', events: [
      { atMs: 20, type: 'network', state: 'offline' },
      { atMs: 10, type: 'data', state: 'partial' },
    ],
  }, { apply: (event) => { seen.push(event.type) } })
  assert.deepEqual(seen, ['data', 'network'])
  assert.equal(result.applied, 2)
})

test('research-heavy roadmap features are disabled by default', () => {
  assert.ok(Object.values(defaultFroamFeatureFlags()).every((enabled) => enabled === false))
})

let passed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    passed += 1
    console.log(`âœ“ ${name}`)
  } catch (error) {
    console.error(`âœ— ${name}`)
    throw error
  }
}
console.log(`\n${passed}/${tests.length} project foundation tests passed`)
