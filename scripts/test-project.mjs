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
    this.style = options.style ?? {}
    this.rect = options.rect ?? { x: 0, y: 0, left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40 }
    this.tabIndex = options.tabIndex ?? -1
    this.onclick = null
    this.scrollWidth = this.rect.width
    this.scrollHeight = this.rect.height
    this.clientWidth = this.rect.width
    this.clientHeight = this.rect.height
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
  hasAttribute(name) { return this.attributes.has(name) }
  getBoundingClientRect() { return this.rect }
  contains(candidate) {
    if (candidate === this) return true
    return this.children.some((child) => child.contains(candidate))
  }
  matches() { return false }
  closest(selector) {
    let current = this
    while (current) {
      if (selector === '[data-chef-editor-root]' && current.hasAttribute('data-chef-editor-root')) return current
      current = current.parentElement
    }
    return null
  }
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
  if (selector === '*') return true
  const attribute = selector.match(/^\[data-froam-id="(.+)"\]$/)
  if (attribute) return element.getAttribute('data-froam-id') === attribute[1]
  if (selector.startsWith('#')) return element.id === selector.slice(1)
  return element.tagName.toLowerCase() === selector.toLowerCase()
}

globalThis.HTMLElement = FakeElement
globalThis.CSS = { escape: (value) => String(value) }
const defaultStyle = {
  display: 'block', position: 'static', width: '100px', height: '40px', minWidth: '0px', maxWidth: 'none', minHeight: '0px', maxHeight: 'none',
  flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'normal', alignItems: 'normal', gridTemplateColumns: 'none', gridTemplateRows: 'none', gap: '0px',
  margin: '0px', padding: '0px', overflow: 'visible', overflowX: 'visible', overflowY: 'visible', color: 'rgb(0,0,0)', backgroundColor: 'rgba(0,0,0,0)',
  backgroundImage: 'none', fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', lineHeight: '24px', letterSpacing: '0px', border: '0px none',
  borderRadius: '0px', boxShadow: 'none', opacity: '1', transition: 'none', animation: 'none', visibility: 'visible', outline: 'none',
}
globalThis.window = { getComputedStyle: (element) => ({ ...defaultStyle, ...element.style }), innerHeight: 800 }
globalThis.getComputedStyle = globalThis.window.getComputedStyle

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
const { dnaFromScan, scanDomChanges } = await import('../dist/project/scan.js')
const { scanDomTree, detectComponentFamilies } = await import('../dist/project/scan.js')
const { compileInteractionToCss } = await import('../dist/project/interaction-runtime.js')
const { branchReplayEvents, checkpointAncestry, filterReplayEvents, replayCategory, replayStateAt } = await import('../dist/project/replay.js')
const { graphSelectionIndex, materializeGraphRows } = await import('../dist/project/graph-inspector.js')
const { interactionInspectorRecord, legacyAnimatorToInteraction } = await import('../dist/project/animator-adapter.js')
const { runSimulationScenario } = await import('../dist/project/simulation.js')
const { defaultFroamFeatureFlags, FROAM_ROADMAP_FEATURES } = await import('../dist/project/experiments.js')
const { isProjectFile, loadProjectFile, writeProjectFile } = await import('../lib/project-store.mjs')
const { createArchiveItem, recordArchiveUsage, similarArchiveItems, upsertArchive, removeFromArchive, reuseArchiveItem, searchArchive } = await import('../dist/project/archive.js')
const { archaeologyForNode } = await import('../dist/project/archaeology.js')
const { createFlowGraph } = await import('../dist/project/product-flow.js')
const { evaluateAttentionProvider, LOCAL_ATTENTION_PROVIDER, predictAttention } = await import('../dist/project/attention.js')
const { analyzeVisualRhythm } = await import('../dist/project/rhythm.js')
const { cinemaWidths, defaultResponsivePolicy, observeResponsiveState, responsiveSuggestions } = await import('../dist/project/responsive.js')
const { boundedGeometryCorrection, compareScreenshotPixels, createLocalScreenshotProvider, localScreenshotProvider, unavailableOcrProvider } = await import('../dist/project/screenshot-reconstruction.js')
const { LOCAL_HEURISTIC_PROVIDER, assertRemoteProviderConsent } = await import('../dist/project/intelligence-provider.js')
const { identityHealthReport } = await import('../dist/project/node-registry.js')
const { detectFrameworkHost } = await import('../dist/project/framework-identity.js')
const { profileIntelligence } = await import('../dist/project/performance.js')
const { compactProjectForLocalStorage, persistProjectToLocalStorage } = await import('../dist/project/local-project-store.js')

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('oversized project persistence recovers from localStorage quota without throwing', () => {
  const project = createProjectDocument({ id: 'quota-project', name: 'Quota', actorId: 'tester', idFactory: () => 'checkpoint' })
  project.events = [createProjectEvent({
    id: 'scan-event', projectId: project.id, branchId: 'main', actorId: 'tester', clock: 1, type: 'scan.captured',
    payload: { scan: { schemaVersion: 1, id: 'scan', node: { nodeId: 'node' }, capturedAt: 1, signals: [{ kind: 'appearance', origin: 'observed', source: 'dom', values: { payload: 'x'.repeat(20_000) } }], childNodeIds: [], siblingNodeIds: [] } },
  })]
  let value = ''
  const storage = {
    getItem: () => value || null,
    removeItem: () => { value = '' },
    setItem: (_key, next) => {
      if (next.length > 2_000) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
      value = next
    },
  }
  const result = persistProjectToLocalStorage(storage, 'project', project)
  assert.notEqual(result.mode, 'memory-only')
  assert.equal(result.quotaRecovered, true)
  assert.equal(JSON.parse(value).id, project.id)
  assert.equal(JSON.parse(value).events.length, 0)
})

test('local recovery compaction does not mutate the complete project document', () => {
  const project = createProjectDocument({ id: 'compact-project', name: 'Compact', actorId: 'tester', idFactory: () => 'checkpoint' })
  const checkpoint = project.checkpoints.checkpoint
  checkpoint.state.scans.node = { schemaVersion: 1, id: 'scan', node: { nodeId: 'node' }, capturedAt: 1, signals: [], childNodeIds: [], siblingNodeIds: [] }
  const compact = compactProjectForLocalStorage(project)
  assert.ok(project.checkpoints.checkpoint.state.scans.node)
  assert.deepEqual(compact.checkpoints.checkpoint.state.scans, {})
  assert.equal(compact.metadata.localPersistence.fullDocument, 'indexeddb')
})

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
  assert.equal(parsed.file.project.schemaVersion, 2)
})

test('v6 project schema migrates to v7 without changing event ids or legacy design', () => {
  const current = createProjectFileFromLegacyDesign(legacy, { projectId: 'v6-project', actorId: 'ahmad', now: 10, idFactory: () => 'v6-base' })
  const v1 = JSON.parse(JSON.stringify(current))
  v1.schemaVersion = 1
  v1.project.schemaVersion = 1
  for (const event of v1.project.events) event.schemaVersion = 1
  for (const checkpoint of Object.values(v1.project.checkpoints)) {
    delete checkpoint.state.scans; delete checkpoint.state.archive; delete checkpoint.state.analyses; delete checkpoint.state.responsive
  }
  for (const branch of Object.values(v1.project.branches)) delete branch.rootCheckpointId
  const migrated = parseFroamProjectFile(v1, { projectId: 'unused', actorId: 'unused' })
  assert.equal(migrated.migrated, true)
  assert.equal(migrated.file.schemaVersion, 2)
  assert.deepEqual(migrated.file.design, legacy)
  assert.deepEqual(migrated.file.project.checkpoints['v6-base'].state.archive, {})
  assert.equal(migrated.file.project.branches.main.rootCheckpointId, 'v6-base')
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
  assert.equal(replayStateAt(project, 0).legacyStore['/@@desktop'], undefined)
  assert.equal(replayStateAt(project, 1).legacyStore['/@@desktop']['p:1'].text, 'One')
  assert.equal(replayStateAt(project, 2).legacyStore['/@@desktop']['p:1'].text, 'Two')
})

test('Froam Scan extracts identity, structure, styles and conservative semantics locally', () => {
  const root = new FakeElement('main', { rect: { x: 0, y: 0, left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 } })
  const nav = new FakeElement('nav', { style: { display: 'flex', gap: '16px' } })
  const unknown = new FakeElement('div', { text: 'Unclassified' })
  const button = new FakeElement('button', { text: 'Continue', rect: { x: 0, y: 0, left: 0, top: 0, width: 120, height: 44, right: 120, bottom: 44 } })
  root.append(nav, unknown); nav.append(button)
  let id = 0
  const bundle = scanDomTree(root, {}, { routeKey: '/', viewport: 'desktop', now: 50, maxNodes: 10, selectedRoot: root })
  assert.equal(bundle.records.length, 4)
  const navRecord = bundle.records.find((record) => record.node.nodeId === nav.dataset.froamId)
  assert.equal(navRecord.signals.find((signal) => signal.kind === 'layout').values.display, 'flex')
  assert.equal(navRecord.signals.find((signal) => signal.kind === 'semantics').values.role, 'navigation')
  const unknownSemantic = bundle.records.find((record) => record.node.nodeId === unknown.dataset.froamId).signals.find((signal) => signal.kind === 'semantics')
  assert.equal(unknownSemantic.values.role, 'unknown')
  assert.equal(unknownSemantic.confidence, 0)
  assert.ok(bundle.relations.some((relation) => relation.from === nav.dataset.froamId && relation.to === button.dataset.froamId))
  void id
})

test('Component DNA is versioned, serializable and preserves observed versus inferred knowledge', () => {
  const record = { schemaVersion: 1, id: 'scan-dna', node: { nodeId: 'hero', path: 'section:1' }, capturedAt: 60, childNodeIds: [], siblingNodeIds: [], signals: [
    { kind: 'layout', origin: 'observed', source: 'computed-style', values: { display: 'grid' } },
    { kind: 'semantics', origin: 'inferred', source: 'heuristic', confidence: .7, values: { role: 'hero' } },
  ] }
  const dna = dnaFromScan(record)
  const roundTrip = JSON.parse(JSON.stringify(dna))
  assert.equal(roundTrip.schemaVersion, 1)
  assert.equal(roundTrip.layout.display, 'grid')
  assert.equal(roundTrip.knowledge['semantics.role'].origin, 'inferred')
  assert.equal(roundTrip.behavior, undefined)
})

test('Component families require repeated structure and refuse unrelated semantics', () => {
  const make = (id, signature, role) => ({ schemaVersion: 1, id: `scan-${id}`, node: { nodeId: id }, capturedAt: 1, childNodeIds: [], siblingNodeIds: [], signals: [
    { kind: 'structure', origin: 'observed', source: 'dom', values: { signature } }, { kind: 'semantics', origin: 'inferred', source: 'heuristic', values: { role } },
  ] })
  const families = detectComponentFamilies([make('a', 'article|card|block|h2,p', 'card'), make('b', 'article|card|block|h2,p', 'card'), make('c', 'nav|navigation|flex|a', 'navigation')])
  assert.deepEqual(families[0].memberNodeIds, ['a', 'b'])
  assert.equal(families.length, 1)
})

test('Archive add, persistence, search, reuse, removal and provenance share stable identity', () => {
  const dna = { schemaVersion: 1, nodeId: 'card', capturedAt: 1, semantics: { role: 'card' } }
  const item = createArchiveItem({ id: 'archive-card', nodeId: 'card', name: 'Pricing Card', actorId: 'ahmad', projectId: 'p', branchId: 'main', dna, html: '<article>Card</article>', legacyPath: 'article:1', now: 2 })
  let archive = upsertArchive({}, item)
  assert.equal(searchArchive(archive, 'pricing')[0].provenance.sourceNodeId, 'card')
  const instance = reuseArchiveItem(item, { nodeId: 'card-copy', routeKey: '/pricing' })
  assert.equal(instance.componentId, 'archive-card')
  assert.equal(instance.metadata.derivedFrom, 'card')
  archive = removeFromArchive(archive, item.id)
  assert.deepEqual(archive, {})
})

test('Archaeology reports recorded lineage and never invents rationale', () => {
  let project = createProjectDocument({ id: 'archaeology', name: 'Origins', actorId: 'ahmad', now: 1, idFactory: () => 'arch-base' })
  project = appendProjectEvents(project, [createProjectEvent({ id: 'create-card', projectId: project.id, branchId: 'main', actorId: 'ahmad', clock: 1, createdAt: 2, type: 'node.upserted', targetIds: ['card'], payload: { node: { id: 'card', kind: 'element', source: 'froam' } } }), createProjectEvent({ id: 'edit-card', projectId: project.id, branchId: 'main', actorId: 'musa', clock: 2, createdAt: 3, type: 'dna.captured', targetIds: ['card'], payload: { dna: { schemaVersion: 1, nodeId: 'card', capturedAt: 3 } }, label: 'Spacing update' })])
  const origin = archaeologyForNode(project, 'card')
  assert.equal(origin.creation.actorId, 'ahmad')
  assert.deepEqual(origin.authors, ['ahmad', 'musa'])
  assert.equal(origin.edits[1].rationale, undefined)
})

test('Product Flow uses graph nodes and persisted transition relations', () => {
  const graph = createFlowGraph('Checkout', [{ id: 'cart', name: 'Cart', routeKey: '/cart' }, { id: 'success', name: 'Success', stateType: 'success' }], [{ id: 'pay', from: 'cart', to: 'success', name: 'Pay', condition: 'payment accepted' }])
  assert.deepEqual(graph.flow.nodeIds, ['cart', 'success'])
  assert.equal(graph.relations[0].kind, 'transitions-to')
  assert.equal(graph.relations[0].condition, 'payment accepted')
})

test('Product Flow distinguishes a route page, screen and multiple states', () => {
  const graph = createFlowGraph('Checkout states', [
    { id: 'page-checkout', name: 'Checkout page', kind: 'page', routeKey: '/checkout' },
    { id: 'screen-checkout', name: 'Checkout screen', kind: 'screen', pageId: 'page-checkout', routeKey: '/checkout' },
    { id: 'state-error', name: 'Payment error', kind: 'state', screenId: 'screen-checkout', stateType: 'error', routeKey: '/checkout' },
    { id: 'state-success', name: 'Payment success', kind: 'state', screenId: 'screen-checkout', stateType: 'success', routeKey: '/checkout' },
  ], [{ id: 'retry', from: 'state-error', to: 'screen-checkout', name: 'Retry' }])
  assert.equal(graph.nodes.filter((node) => node.locator.routeKey === '/checkout').length, 4)
  assert.equal(graph.nodes.find((node) => node.id === 'state-error').parentId, 'screen-checkout')
  assert.equal(graph.nodes.find((node) => node.id === 'state-success').metadata.stateType, 'success')
})

test('Predicted Attention is explicit local heuristic analysis mapped to node ids', () => {
  const record = (id, role, width, height, y, fontSize = '16px') => ({ schemaVersion: 1, id: `scan-${id}`, node: { nodeId: id }, capturedAt: 1, childNodeIds: [], siblingNodeIds: [], signals: [
    { kind: 'layout', origin: 'observed', source: 'computed-style', values: { rect: { width, height, y } } },
    { kind: 'appearance', origin: 'observed', source: 'computed-style', values: { fontSize } },
    { kind: 'semantics', origin: 'observed', source: 'dom', values: { role } },
  ] })
  const analysis = predictAttention([record('image', 'media', 900, 500, 0), record('cta', 'cta', 120, 44, 500)], 10)
  assert.equal(analysis.local, true)
  assert.match(analysis.result.disclaimer, /not eye-tracking/)
  assert.deepEqual(analysis.targetIds.sort(), ['cta', 'image'])
})

test('Visual Rhythm reports repeated composition without subjective claims', () => {
  const records = Array.from({ length: 5 }, (_, index) => ({ schemaVersion: 1, id: `s${index}`, node: { nodeId: `n${index}` }, capturedAt: 1, childNodeIds: [], siblingNodeIds: [], signals: [
    { kind: 'layout', origin: 'observed', source: 'computed-style', values: { rect: { y: index * 400, height: 400, width: 1000 }, padding: '24px', gap: '16px' } },
    { kind: 'semantics', origin: 'inferred', source: 'heuristic', values: { role: 'card' } },
  ] }))
  const analysis = analyzeVisualRhythm(records, 800, 20)
  assert.equal(analysis.result.longestRepeatedRun, 5)
  assert.match(analysis.result.warnings[0], /identical layout rhythm/)
})

test('Responsive priority serializes survival constraints and produces designer-controlled suggestions', () => {
  const policy = { ...defaultResponsivePolicy('decoration', 'ahmad', 1), priority: 'decorative', canHide: true, minimumUsefulWidth: 700 }
  const record = { schemaVersion: 1, id: 'scan-decoration', node: { nodeId: 'decoration' }, capturedAt: 1, childNodeIds: [], siblingNodeIds: [], signals: [{ kind: 'layout', origin: 'observed', source: 'computed-style', values: { rect: { width: 500 } } }] }
  const suggestions = responsiveSuggestions([record], { decoration: policy }, 410)
  assert.ok(suggestions.some((item) => item.action === 'hide'))
  assert.deepEqual(JSON.parse(JSON.stringify(policy)), policy)
  assert.deepEqual(cinemaWidths(320, 352, 16), [320, 336, 352])
})

test('Breakpoint observations conservatively detect overflow, collision, clipping, touch and hidden critical nodes', () => {
  const root = new FakeElement('main', { rect: { x: 0, y: 0, left: 0, top: 0, width: 320, height: 400, right: 320, bottom: 400 } })
  root.scrollWidth = 500
  const first = new FakeElement('button', { rect: { x: 0, y: 0, left: 0, top: 0, width: 20, height: 20, right: 20, bottom: 20 } })
  const second = new FakeElement('div', { rect: { x: 10, y: 10, left: 10, top: 10, width: 30, height: 30, right: 40, bottom: 40 }, style: { overflowX: 'hidden' } })
  second.scrollWidth = 60
  const critical = new FakeElement('button', { style: { display: 'none' } })
  first.setAttribute('data-froam-id', 'first'); second.setAttribute('data-froam-id', 'second'); critical.setAttribute('data-froam-id', 'critical')
  root.append(first, second, critical)
  const observation = observeResponsiveState(root, { first: { nodeId: 'first' }, second: { nodeId: 'second' }, critical: { nodeId: 'critical' } }, {
    critical: { ...defaultResponsivePolicy('critical', 'ahmad', 1), priority: 'critical' },
  }, 320)
  assert.equal(observation.overflowX, true)
  assert.deepEqual(observation.collisions, [['first', 'second']])
  assert.deepEqual(observation.hiddenCritical, ['critical'])
  assert.deepEqual(observation.clipped, ['second'])
  assert.deepEqual(observation.touchTargets, ['first'])
})

test('Screenshot reconstruction creates normal graph nodes and DNA and rejects unsupported input', async () => {
  const width = 32; const height = 32; const data = new Uint8ClampedArray(width * height * 4).fill(255)
  const result = await localScreenshotProvider.reconstruct({ width, height, data, mimeType: 'image/png', name: 'Reference' })
  assert.ok(result.nodes.some((node) => node.kind === 'frame'))
  assert.ok(result.relations.every((relation) => relation.kind === 'contains'))
  assert.ok(result.dna.every((dna) => dna.schemaVersion === 1 && dna.provenance.source === 'screenshot'))
  await assert.rejects(() => localScreenshotProvider.reconstruct({ width, height, data, mimeType: 'image/gif' }), /Unsupported/)
  await assert.rejects(() => localScreenshotProvider.reconstruct({ width, height, data: new Uint8ClampedArray(4), mimeType: 'image/png' }), /Invalid/)
})

test('Screenshot OCR maps confident text and preserves uncertainty without fabrication', async () => {
  const pixels = { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4).fill(240), mimeType: 'image/png', referenceId: 'desktop', metadata: { viewportWidth: 1440, state: 'open' } }
  const ocr = { id: 'fixture-ocr', local: true, available: () => true, async recognize() { return { provider: 'fixture-ocr', available: true, warnings: [], lines: [{ id: 'headline', text: 'Welcome', bounds: { x: 4, y: 4, width: 50, height: 32 }, confidence: .91 }, { id: 'action', text: 'Start now', bounds: { x: 4, y: 42, width: 52, height: 24 }, confidence: .82 }] } } }
  const result = await createLocalScreenshotProvider(ocr).reconstruct({ references: [pixels, { ...pixels, referenceId: 'mobile', metadata: { viewportWidth: 375 } }], primaryReferenceId: 'desktop' })
  assert.equal(result.references.length, 2)
  assert.ok(result.regions.some((region) => region.text === 'Welcome' && region.semanticRole === 'heading'))
  assert.ok(result.regions.some((region) => region.text === 'Start now' && region.semanticRole === 'button'))
  assert.ok(result.nodes.some((node) => node.id === result.regions[0].nodeId))
  const unavailable = await createLocalScreenshotProvider(unavailableOcrProvider).reconstruct(pixels)
  assert.ok(unavailable.ocr[0].warnings[0].includes('no text was fabricated'))
  assert.ok(unavailable.regions.every((region) => region.text === undefined))
})

test('Visual diff uses transparent RGB error and correction is strictly bounded', () => {
  const reference = { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4), mimeType: 'image/png' }
  const candidate = { ...reference, data: new Uint8ClampedArray(reference.data) }; candidate.data[0] = 255
  const diff = compareScreenshotPixels(reference, candidate, 8)
  assert.equal(diff.comparable, true); assert.ok(diff.pixelSimilarity < 1 && diff.pixelSimilarity > .99); assert.equal(diff.metric, 'normalized-rgb-mae-v1')
  const corrected = boundedGeometryCorrection([{ id: 'a', nodeId: 'a', x: 0, y: 0, width: 10, height: 10, kind: 'container', confidence: .5 }], [{ id: 'a', x: 16, y: 8, width: 20, height: 20 }], 99)
  assert.equal(corrected.passes.length, 4); assert.ok(corrected.regions[0].x < 16)
})

test('Incremental Scan invalidates only changed regions', () => {
  const root = new FakeElement('main'); const left = new FakeElement('section'); const right = new FakeElement('section'); left.append(new FakeElement('p', { text: 'Changed' })); right.append(new FakeElement('p', { text: 'Untouched' })); root.append(left, right)
  const initial = scanDomTree(root, {}, { routeKey: '/', viewport: 'desktop', now: 1 })
  const rightId = initial.records.find((record) => record.node.path?.includes('section:2'))?.node.nodeId
  const incremental = scanDomChanges(root, [left, left.children[0]], initial.registry, { routeKey: '/', viewport: 'desktop', now: 2 })
  assert.ok(incremental.invalidatedNodeIds.length === 2)
  assert.ok(!incremental.invalidatedNodeIds.includes(rightId))
})

test('Identity health survives repeated public-DOM rerenders and reports recovery honestly', () => {
  const root = new FakeElement('main'); const button = new FakeElement('button', { text: 'Save' }); root.append(button)
  let captured = captureNodeRef(button, root, {}, { idFactory: () => 'save', now: 1 }); let registry = captured.registry
  for (let pass = 0; pass < 3; pass += 1) { button.attributes.delete('data-froam-id'); delete button.dataset.froamId; const resolved = resolveNodeRef(captured.ref, root, registry, { now: pass + 2 }); assert.notEqual(resolved.status, 'orphaned'); registry = resolved.registry }
  const health = identityHealthReport(registry); assert.equal(health.failed, 0); assert.equal(health.ambiguous, 0); assert.equal(health.counts.path, 1)
  root.setAttribute('data-reactroot', ''); assert.equal(detectFrameworkHost(root).framework, 'react'); assert.equal(detectFrameworkHost(root).privateInternalsUsed, false)
})

test('Attention provider evaluation exposes fixture agreement rather than scientific claims', () => {
  const make = (id, role, width, height) => ({ schemaVersion: 1, id: `s:${id}`, node: { nodeId: id }, capturedAt: 1, childNodeIds: [], siblingNodeIds: [], signals: [{ kind: 'layout', origin: 'observed', source: 'computed-style', values: { rect: { width, height, y: 0 } } }, { kind: 'semantics', origin: 'observed', source: 'dom', values: { role } }] })
  const records = [make('hero', 'media', 900, 500), make('cta', 'cta', 180, 48)]
  const evaluation = evaluateAttentionProvider(LOCAL_ATTENTION_PROVIDER, [{ id: 'hero-layout', records, expectedTopNodeIds: ['hero', 'cta'], note: 'fixture expectation only' }])
  assert.equal(evaluation.fixtures, 1); assert.equal(evaluation.topChoiceAgreement, 1); assert.equal(evaluation.meanTopThreeRecall, 1)
})

test('Archive hardening tracks reuse and similarity confidence without merging', () => {
  const dna = { schemaVersion: 1, nodeId: 'card', capturedAt: 1, structure: { componentFamilyId: 'cards', childNodeIds: ['a'] }, layout: { display: 'grid' }, semantics: { role: 'card' } }
  const first = createArchiveItem({ id: 'one', nodeId: 'card-1', name: 'Card one', actorId: 'a', projectId: 'p', branchId: 'main', dna })
  const second = createArchiveItem({ id: 'two', nodeId: 'card-2', name: 'Card two', actorId: 'a', projectId: 'p', branchId: 'main', dna: { ...dna, nodeId: 'card-2' }, variantOf: 'one' })
  assert.deepEqual(recordArchiveUsage(first, 'instance-1').usageNodeIds, ['instance-1'])
  assert.ok(similarArchiveItems({ one: first, two: second })[0].confidence >= .9); assert.equal(second.variantOf, 'one')
})

test('Checkpoint ancestry crosses a prototype fork lazily', () => {
  let ids = 0; let project = createProjectDocument({ id: 'ancestry', name: 'Ancestry', actorId: 'a', now: 1, idFactory: () => `a-${++ids}` })
  project = checkpointBranch(project, { actorId: 'a', now: 2, idFactory: () => `a-${++ids}` })
  project = createProjectBranch(project, { id: 'prototype', name: 'Prototype', actorId: 'a', now: 3, idFactory: () => `a-${++ids}` })
  const lineage = checkpointAncestry(project, project.branches.prototype.baseCheckpointId)
  assert.equal(lineage[0].branchId, 'prototype'); assert.equal(lineage[1].branchId, 'main')
})

test('Large intelligence fixture stays serializable and reports measured stages', () => {
  const records = Array.from({ length: 500 }, (_, index) => ({ schemaVersion: 1, id: `perf-${index}`, node: { nodeId: `n-${index}` }, capturedAt: 1, childNodeIds: [], siblingNodeIds: [], signals: [{ kind: 'layout', origin: 'observed', source: 'computed-style', values: { rect: { width: 100, height: 120, y: index * 120 } } }] }))
  const nodes = Object.fromEntries(records.map((record) => [record.node.nodeId, { id: record.node.nodeId, kind: 'element', source: 'host-dom' }]))
  const profile = profileIntelligence({ records, state: { legacyStore: {}, nodes, relations: {}, flows: {}, interactions: {}, dna: {}, assets: {}, scans: {}, archive: {}, analyses: {}, responsive: {} } })
  assert.equal(profile.nodeCount, 500); assert.ok(profile.serializedBytes > 0); assert.ok(profile.graphMs >= 0)
})

test('intelligence providers disclose privacy and remote providers require consent', () => {
  assert.equal(LOCAL_HEURISTIC_PROVIDER.privacy.execution, 'local')
  assert.equal(LOCAL_HEURISTIC_PROVIDER.privacy.sendsSourceCode, false)
  assert.throws(() => assertRemoteProviderConsent({ id: 'remote', privacy: { execution: 'remote', sendsSourceCode: false, sendsCredentials: false, dataDescription: 'pixels' } }, false), /explicit consent/)
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
  const state = { legacyStore: {}, nodes: Object.fromEntries(graph.nodes.map((node) => [node.id, node])), relations: Object.fromEntries(graph.relations.map((relation) => [relation.id, relation])), flows: {}, interactions: {}, dna: {}, assets: {}, scans: {}, archive: {}, analyses: {}, responsive: {} }
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
  const flags = defaultFroamFeatureFlags()
  const unavailable = FROAM_ROADMAP_FEATURES.filter((feature) => feature.maturity === 'research-only' || feature.maturity === 'architecture-only')
  assert.ok(unavailable.every((feature) => flags[feature.id] === false))
  assert.ok(FROAM_ROADMAP_FEATURES.filter((feature) => feature.maturity === 'beta').every((feature) => flags[feature.id] === true))
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
