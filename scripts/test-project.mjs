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
  emptyProjectState,
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
const { compactProjectForLocalStorage, packProjectOffThread, persistProjectToLocalStorage } = await import('../dist/project/local-project-store.js')
const { compactProjectHistory } = await import('../dist/project/history-compaction.js')
const { packProjectDocument, profileProjectSize, unpackProjectDocument } = await import('../dist/project/storage-codec.js')
const { aggregateIdentityDiagnostics, createIdentityTelemetry } = await import('../dist/project/identity-telemetry.js')
const { adoptMutationChanges, compareMutationBranches, createMutationPrototype, deterministicMutationProvider, normalizeMutationConstraints, previewMutation } = await import('../dist/project/mutation.js')
const { applyInteractionRecipe, deleteInteractionRecipe, duplicateInteractionRecipe, previewInteractionRecipe, renameInteractionRecipe, saveInteractionRecipe, searchInteractionLibrary, updateInteractionRecipe } = await import('../dist/project/interaction-library.js')
const { createSamplingSession, recordSamplingEvent, recordSamplingFrame, recordSamplingMutation, samplingSessionToRecipe, samplingTimeline, trimSamplingSession } = await import('../dist/project/ui-sampling.js')
const { externalObservationsToRecipe, isSensitiveSamplingElement, sanitizeExternalObservation, validateExternalSamplerMessage } = await import('../dist/project/external-sampling.js')
const { compilePhysicsRuntime, FROAM_PHYSICS_PRESETS, gravityForce, interactionWithGravity, interactionWithPhysics, physicsPreset, simulateThrow, stepSpring } = await import('../dist/project/physics.js')
const { createDefaultChaosScenarios, evaluateChaosSnapshot, runChaosTesting } = await import('../dist/project/chaos.js')
const { deterministicSyntheticUxProvider, runSyntheticUx, syntheticReplay } = await import('../dist/project/synthetic-ux.js')
const { attachHapticIntent, attachSoundToInteraction, importSoundAsset, removeSoundAsset, soundPreviewContract } = await import('../dist/project/sound.js')
const { createTrailerStoryboard, removeTrailerShot, reorderTrailerShot } = await import('../dist/project/trailer.js')
const { compareScreenshotStates, inferResponsiveScreenshotReferences } = await import('../dist/project/screenshot-state.js')
const { detectProbableScreenRegion, rectifyScreenRegion } = await import('../dist/project/reality.js')
const { evaluateScreenshotReconstruction } = await import('../dist/project/screenshot-evaluation.js')
const { factorComponentFamilies } = await import('../dist/project/structural-deduplication.js')

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

test('content-addressed project storage round-trips canonical history exactly', () => {
  const project = createProjectDocument({ id: 'packed', name: 'Packed', actorId: 'tester', idFactory: () => 'checkpoint' })
  project.metadata = { repeated: ['x'.repeat(800), 'x'.repeat(800)] }
  const packed = packProjectDocument(project, 64)
  assert.deepEqual(unpackProjectDocument(packed), project)
  assert.ok(Object.keys(packed.blobs).length > 0)
  const compacted = compactProjectHistory(project)
  assert.equal(compacted.report.canonicalEquivalent, true)
  assert.equal(compacted.report.eventIdsPreserved, true)
  assert.equal(compacted.report.checkpointIdsPreserved, true)
})

test('size profiler separates platform categories and duplicate strings', () => {
  const project = createProjectDocument({ id: 'profile', name: 'Profile', actorId: 'tester', idFactory: () => 'checkpoint' })
  project.metadata = { values: ['repeat-me', 'repeat-me', 'repeat-me'] }
  const profile = profileProjectSize(project)
  assert.ok(profile.totalBytes > 0)
  assert.ok(profile.categories.checkpoints > 0)
  assert.ok(profile.duplicateStringBytes > 0)
})

test('structural factoring requires confidence or explicit user intent', () => {
  const dna = Object.fromEntries(['a','b','c'].map((nodeId) => [nodeId, { schemaVersion: 1, nodeId, capturedAt: 1, visual: { color: 'red' }, layout: { order: nodeId } }]))
  assert.equal(factorComponentFamilies([{ id: 'weak', memberNodeIds: ['a','b','c'], signature: 'x', confidence: .6 }], dna).length, 0)
  const factored = factorComponentFamilies([{ id: 'strong', memberNodeIds: ['a','b','c'], signature: 'x', confidence: .9 }], dna)
  assert.equal(factored[0].sharedDna.visual.color, 'red')
  assert.equal(factored[0].instanceOverrides.a.layout.order, 'a')
})

test('identity telemetry is aggregate-only and maps recovery methods', () => {
  const aggregate = aggregateIdentityDiagnostics([{ type: 'stable-id-resolved', at: 1 }, { type: 'resolved-by-path', at: 2 }, { type: 'resolution-failed', at: 3 }])
  assert.equal(aggregate.counts['stable-id'], 1)
  assert.equal(aggregate.counts.path, 1)
  assert.equal(aggregate.counts.failed, 1)
  assert.equal(JSON.stringify(aggregate).includes('DOM secret'), false)
  const collector = createIdentityTelemetry(1); collector.record('duplicate-prevented', 2, 2); assert.equal(collector.snapshot().total, 2)
})

test('MUTATE creates an isolated branch with deterministic provenance', () => {
  const base = createProjectDocument({ id: 'mutate', name: 'Mutate', actorId: 'tester', idFactory: (() => { let i = 0; return () => `id-${++i}` })() })
  base.checkpoints[base.branches.main.baseCheckpointId].state.nodes.hero = { id: 'hero', kind: 'element', source: 'host-dom' }
  const before = JSON.stringify(base)
  const result = createMutationPrototype(base, { branchId: 'mutation-001', actorId: 'tester', level: 'safe', scopeNodeIds: ['hero'], seed: 1, now: 10, idFactory: (() => { let i = 10; return () => `id-${++i}` })() })
  assert.equal(JSON.stringify(base), before)
  assert.equal(result.project.activeBranchId, 'mutation-001')
  assert.equal(result.provenance.sourceBranchId, 'main')
  assert.ok(result.project.events.every((event) => event.branchId === 'mutation-001'))
  const request = { state: result.project.checkpoints[result.project.branches.main.baseCheckpointId].state, scopeNodeIds: ['hero'], level: 'safe', constraints: normalizeMutationConstraints('safe'), seed: 1, now: 10 }
  assert.deepEqual(deterministicMutationProvider.propose(request), deterministicMutationProvider.propose(request))
})

test('Interaction Library CRUD and semantic binding remain portable', () => {
  const recipe = { id: 'menu', name: 'Menu', interaction: { id: 'menu', name: 'Menu', sourceId: 'old-button', targetIds: ['old-panel'], trigger: 'click', timeline: [{ at: 0, values: { opacity: 0 } }, { at: 1, values: { opacity: 1 } }] }, bindings: { source: { role: 'trigger', required: true }, targets: [{ role: 'panel', required: true }] }, provenance: { kind: 'native', projectId: 'p', branchId: 'main', createdAt: 1 } }
  let library = saveInteractionRecipe({}, recipe); library = renameInteractionRecipe(library, 'menu', 'Reveal'); library = duplicateInteractionRecipe(library, 'menu', 'menu-copy')
  const applied = applyInteractionRecipe(library.menu, { sourceId: 'new-button', targetIds: { panel: 'new-panel' } })
  assert.equal(applied.sourceId, 'new-button'); assert.deepEqual(applied.targetIds, ['new-panel']); assert.equal(library['menu-copy'].name, 'Reveal copy')
  assert.equal(deleteInteractionRecipe(library, 'menu').menu, undefined)
})

test('native Sampling records observable frames and labels reconstruction provenance', () => {
  let session = createSamplingSession({ id: 'sample', trigger: 'click', sourceRole: 'trigger', startedAt: 1 })
  session = recordSamplingFrame(session, { atMs: 0, targetRole: 'panel', styles: { opacity: 0 } }); session = recordSamplingFrame(session, { atMs: 200, targetRole: 'panel', styles: { opacity: 1 } })
  const recipe = samplingSessionToRecipe(session, { recipeId: 'sampled', name: 'Sampled', projectId: 'p', branchId: 'main' })
  assert.equal(recipe.provenance.kind, 'sampled'); assert.equal(recipe.interaction.timeline.length, 2); assert.equal(recipe.interaction.metadata.reconstructedFromObservation, true)
})

test('Design Physics serializes and produces deterministic compiler/runtime output', () => {
  const interaction = interactionWithPhysics({ id: 'spring', name: 'Spring', sourceId: 'a', targetIds: ['a'], trigger: 'drag', timeline: [] }, { stiffness: 120, damping: 18, mass: 2 })
  const compiled = compilePhysicsRuntime(JSON.parse(JSON.stringify(interaction)))
  assert.equal(compiled.physics.stiffness, 120); assert.equal(compiled.deterministicStep, 'semi-implicit-euler')
  assert.deepEqual(stepSpring({ position: 0, velocity: 0 }, 1, compiled.physics, .016), stepSpring({ position: 0, velocity: 0 }, 1, compiled.physics, .016))
})

test('screenshot corpus metrics keep text geometry structure and pixels separate', () => {
  const reconstruction = { regions: [{ id: 'r', nodeId: 'n', kind: 'text', x: 10, y: 10, width: 100, height: 20, confidence: .8, averageColor: '#fff' }], ocr: [{ provider: 'fixture', available: true, warnings: [], lines: [{ id: 'l', text: 'Hello world', bounds: { x: 10, y: 10, width: 100, height: 20 }, confidence: .9 }] }], analysis: {}, nodes: [], relations: [], dna: [], rootNodeId: 'root', references: [], correctionPasses: [] }
  const metrics = evaluateScreenshotReconstruction({ id: 'case', reference: { width: 100, height: 100, data: new Uint8ClampedArray(40000), mimeType: 'image/png' }, viewport: { width: 100, height: 100 }, expectedText: ['Hello'], expectedRegions: [{ kind: 'text', x: 10, y: 10, width: 100, height: 20 }], expectedStructure: { groups: 0 }, tags: ['gradient', 'overlap', 'transparency', 'large-type', 'icon-only', 'card-grid', 'nested-cards', 'navigation', 'modal', 'dark-mode', 'light-mode', 'unusual-font', 'image-heavy', 'small-text', 'low-contrast', 'responsive'] }, reconstruction, { timingMs: 12 })
  assert.equal(metrics.text.accuracy, 1); assert.equal(metrics.geometry.meanIoU, 1); assert.equal(metrics.structure.observedGroups, 0); assert.equal(metrics.visual.typographyApproximation, 'not-measured')
  assert.ok(metrics.limitations.some((item) => item.includes('z-order'))); assert.ok(metrics.limitations.some((item) => item.includes('responsive behavior')))
})

test('MUTATE levels, protections, comparison and safe selective adoption share branch history', () => {
  const base = createProjectDocument({ id: 'mutation-v8', name: 'Mutation v8', actorId: 'a', now: 1, idFactory: (() => { let i=0; return () => `m${++i}` })() })
  const state = base.checkpoints[base.branches.main.baseCheckpointId].state; state.nodes.nav = { id: 'nav', kind: 'element', name: 'Navigation', source: 'host-dom' }; state.dna.nav = { schemaVersion: 1, nodeId: 'nav', capturedAt: 1, semantics: { role: 'navigation', text: 'Keep me' }, visual: { color: 'brand' } }
  const protectedPreview = previewMutation(deterministicMutationProvider, { state, scopeNodeIds: ['nav'], level: 'unhinged', constraints: normalizeMutationConstraints('unhinged', { protect: ['navigation','copy','brand-colors'] }), now: 2 })
  assert.equal(protectedPreview.proposals.length, 0)
  const result = createMutationPrototype(base, { branchId: 'mutation-001', actorId: 'a', level: 'unhinged', scopeNodeIds: ['nav'], constraints: { protect: ['copy'], allow: ['visual','navigation','interactions','composition'] }, now: 3, idFactory: (() => { let i=20; return () => `m${++i}` })() })
  const comparison = compareMutationBranches(result.project, 'main', 'mutation-001'); assert.ok(comparison.structural > 0); assert.ok(comparison.interactions > 0)
  const adopted = adoptMutationChanges(result.project, { mutationBranchId: 'mutation-001', targetBranchId: 'main', eventIds: comparison.eventIds, actorId: 'a', now: 20, idFactory: (() => { let i=50; return () => `m${++i}` })() })
  assert.equal(adopted.status, 'adopted'); assert.ok(adopted.adoptedEventIds.length > 0); assert.equal(result.project.events.filter((event) => event.branchId === 'main').length, 0)
  const changedMain = appendProjectEvents(result.project, [createProjectEvent({ id: 'main-change', projectId: base.id, branchId: 'main', actorId: 'b', clock: 99, createdAt: 21, type: 'node.upserted', targetIds: ['nav'], payload: { node: { ...state.nodes.nav, name: 'Changed concurrently' } } })])
  assert.equal(adoptMutationChanges(changedMain, { mutationBranchId: 'mutation-001', targetBranchId: 'main', eventIds: comparison.eventIds, actorId: 'a' }).status, 'refused')
})

test('Interaction Library searches edits previews and rebinds without original IDs', () => {
  const recipe = { id: 'drawer', name: 'Elastic Drawer', category: 'Navigation', tags: ['spring','panel'], description: 'Reveal a navigation panel', interaction: { id: 'drawer', name: 'Drawer', sourceId: 'old', targetIds: ['panel'], trigger: 'click', durationMs: 300, timeline: [{ at: 0, values: { opacity: 0, x: -20 } }, { at: 1, values: { opacity: 1, x: 0 } }] }, bindings: { source: { role: 'menu-control', required: true }, targets: [{ role: 'menu-panel', required: true }] }, provenance: { kind: 'native', source: 'froam', projectId: 'p', branchId: 'main', createdAt: 1, originalImplementation: 'froam' } }
  let library = saveInteractionRecipe({}, recipe); library = updateInteractionRecipe(library, 'drawer', { category: 'Reveal', interaction: { durationMs: 420 } })
  assert.equal(searchInteractionLibrary(library, { query: 'spring' })[0].id, 'drawer'); assert.equal(previewInteractionRecipe(library.drawer, { samples: 6 }).length, 7)
  const applied = applyInteractionRecipe(library.drawer, { sourceId: 'new-button', targetIds: { 'menu-panel': 'new-panel' } }); assert.equal(applied.sourceId, 'new-button'); assert.deepEqual(applied.targetIds, ['new-panel'])
})

test('Native Sampling records events mutations timing and editable reconstruction provenance', () => {
  let session = createSamplingSession({ id: 'capture', trigger: 'click', sourceRole: 'trigger', startedAt: 100 })
  session = recordSamplingEvent(session, { atMs: 0, targetRole: 'trigger', event: 'click' }); session = recordSamplingMutation(session, { atMs: 20, targetRole: 'panel', kind: 'attributes', attributeName: 'class' }); session = recordSamplingFrame(session, { atMs: 20, targetRole: 'panel', styles: { opacity: 0, transform: 'translateX(-20px)' }, visible: true }); session = recordSamplingFrame(session, { atMs: 430, targetRole: 'panel', styles: { opacity: 1, transform: 'none' }, visible: true })
  const trimmed = trimSamplingSession(session, 10, 430); const recipe = samplingSessionToRecipe(trimmed, { recipeId: 'captured', name: 'Captured', projectId: 'p', branchId: 'main' })
  assert.equal(samplingTimeline(session)[0].label, 'click trigger'); assert.equal(recipe.provenance.originalImplementation, 'unknown'); assert.equal(recipe.interaction.durationMs, 420); assert.ok(recipe.provenance.confidence > .5)
})

test('External Sampling enforces explicit permission and strips sensitive or unsupported fields', () => {
  const permission = { origin: 'https://example.com', grantedAt: 1, activeTab: true, userInitiated: true }
  assert.throws(() => validateExternalSamplerMessage({ version: 1, sessionId: 'x', type: 'session-start', origin: 'https://evil.example', elapsedMs: 0 }, permission), /permission/)
  assert.throws(() => validateExternalSamplerMessage({ version: 1, sessionId: 'x', type: 'session-start', origin: 'javascript:alert(1)', elapsedMs: 0 }, { ...permission, origin: 'null' }), /HTTP/)
  assert.equal(isSensitiveSamplingElement({ tagName: 'input', type: 'password' }), true)
  assert.deepEqual(sanitizeExternalObservation({ elapsedMs: 1, type: 'frame', role: 'panel', styles: { opacity: '1', secretValue: 'nope' } }).styles, { opacity: '1' })
  const recipe = externalObservationsToRecipe({ sessionId: 'external', origin: 'https://example.com/path?secret=x', startedAt: 1, observations: [{ elapsedMs: 0, type: 'event', role: 'button', event: 'click' }, { elapsedMs: 20, type: 'frame', role: 'panel', styles: { opacity: 0 } }, { elapsedMs: 200, type: 'frame', role: 'panel', styles: { opacity: 1 } }], limitations: ['cross-origin-iframe'], recipeId: 'external-recipe', name: 'External menu', projectId: 'p', branchId: 'main' })
  assert.equal(recipe.provenance.source, 'external'); assert.equal(recipe.metadata.sourceOrigin, 'https://example.com'); assert.equal(recipe.metadata.sensitiveValuesCaptured, false)
})

test('Physics presets differ materially and Gravity remains deterministic and bounded', () => {
  assert.equal(new Set(Object.values(FROAM_PHYSICS_PRESETS).map((value) => JSON.stringify(value))).size, 8)
  const elastic = physicsPreset('Elastic'); const a = simulateThrow({ velocity: 12, target: 1, physics: elastic, frames: 20 }); const b = simulateThrow({ velocity: 12, target: 1, physics: elastic, frames: 20 }); assert.deepEqual(a,b)
  assert.deepEqual(gravityForce({ mode: 'attract', strength: 10, radius: 100 }, { x: 0, y: 0 }, { x: 50, y: 0 }), { x: 5, y: 0 })
  assert.throws(() => interactionWithGravity({ id:'i',name:'i',sourceId:'a',targetIds:['a'],trigger:'drag',timeline:[] }, { mode:'group',strength:1,radius:10 }), /Lab-only/)
})

test('Chaos Testing isolates scenarios and elevates hidden critical responsive failures', async () => {
  const scenario = createDefaultChaosScenarios()[0]; const state = { responsive: { cta: { schemaVersion: 1, nodeId: 'cta', priority: 'critical', canHide: false, canCollapse: false, canWrap: true, canTruncate: false, canCrop: false, canReposition: true, updatedAt: 1, updatedBy: 'a' } } }; let restored = 0
  const report = await runChaosTesting({ scenarios: [scenario], state, now: 1, adapter: { apply() {}, capture: () => ({ viewport: { width: 320, height: 720 }, nodes: [{ nodeId: 'cta', rect: { x: 0, y: 0, width: 100, height: 40 }, visible: false }] }), restore: () => { restored += 1 } } })
  assert.equal(report.failed, 1); assert.equal(report.scenarios[0].failures[0].kind, 'hidden-critical'); assert.equal(report.scenarios[0].failures[0].severity, 'critical'); assert.equal(restored, 1)
  const adapterFailure = await runChaosTesting({ scenarios: [scenario, createDefaultChaosScenarios()[1]], state, now: 2, adapter: { apply() { throw new Error('fixture failure') }, capture: () => ({ viewport: { width: 0, height: 0 }, nodes: [] }), restore: () => { restored += 1 } } })
  assert.equal(adapterFailure.total, 2); assert.equal(adapterFailure.failed, 2); assert.ok(adapterFailure.scenarios.every((item) => item.failures[0].kind === 'invalid-state')); assert.equal(restored, 3)
  assert.equal(evaluateChaosSnapshot(scenario, { viewport: { width: 320, height: 720 }, nodes: [] }, state).length, 0)
})

test('Synthetic UX executes Product Flow goals and produces Replay-compatible steps', async () => {
  const graph = createFlowGraph('Checkout', [{ id:'start',name:'Start' },{ id:'cart',name:'Cart' },{ id:'done',name:'Done' }],[{id:'a',from:'start',to:'cart'},{id:'b',from:'cart',to:'done'}]); const state = emptyProjectState(); state.flows[graph.flow.id] = graph.flow; graph.nodes.forEach((node) => state.nodes[node.id] = node); graph.relations.forEach((relation) => state.relations[relation.id] = relation)
  const run = await runSyntheticUx({ id:'checkout',goal:'Complete checkout',startNodeId:'start',successNodeIds:['done'] }, { flow: graph.flow, state, now: 10 })
  assert.equal(run.success,true); assert.equal(run.steps.length,2); assert.deepEqual(syntheticReplay(run).map((step) => step.nodeId),['cart','done']); assert.equal(deterministicSyntheticUxProvider.local,true)
})

test('UI Sound persists optional timing and haptic intent with autoplay safeguards', () => {
  const sounds = importSoundAsset({}, { id:'click',name:'Click',url:'data:audio/wav;base64,AA==',mimeType:'audio/wav' }); const base = { id:'i',name:'Click',sourceId:'a',targetIds:['a'],trigger:'click',timeline:[] }; const attached = attachHapticIntent(attachSoundToInteraction(base,{assetId:'click',offsetMs:20,volume:.5},sounds),'light')
  assert.equal(attached.feedback.soundOffsetMs,20); assert.equal(attached.feedback.haptic,'light'); assert.throws(() => soundPreviewContract(sounds.click,{userGesture:false}),/user gesture/); assert.throws(() => removeSoundAsset(sounds,'click',[attached]),/Detach/)
})

test('Trailer storyboard uses real project nodes and remains editable', () => {
  const state = emptyProjectState(); state.nodes.hero = { id:'hero',kind:'screen',name:'Hero',source:'froam' }; state.flows.flow = { id:'flow',name:'Flow',nodeIds:['hero'],edgeIds:[],entryNodeId:'hero' }; const trailer = createTrailerStoryboard({ state, branchId:'main', durationSeconds:10, now:1 }); assert.equal(trailer.source.realProjectState,true); assert.ok(trailer.shots.some((shot) => shot.nodeId === 'hero')); const reordered = reorderTrailerShot(trailer,'brand-end',0); assert.equal(reordered.shots[0].id,'brand-end'); assert.equal(removeTrailerShot(reordered,'brand-end').shots.some((shot) => shot.id === 'brand-end'),false)
})

test('Screenshot state bridge reports hypotheses without claiming recovered interaction source', () => {
  const reconstruction = (id, regions, width=100) => ({ references:[{id,width,height:100}],regions,ocr:[],analysis:{},nodes:[],relations:[],dna:[],rootNodeId:'root',correctionPasses:[] }); const closed = reconstruction('closed',[{id:'a',nodeId:'a',kind:'container',semanticRole:'menu',x:0,y:0,width:100,height:20,confidence:.5,averageColor:'black'}]); const open = reconstruction('open',[{id:'b',nodeId:'b',kind:'container',semanticRole:'menu',x:0,y:0,width:100,height:20,confidence:.5,averageColor:'black'},{id:'panel',nodeId:'panel',kind:'container',semanticRole:'unknown',x:0,y:20,width:100,height:80,confidence:.5,averageColor:'white'}]); const difference = compareScreenshotStates(closed,open); assert.ok(difference.interactionHypotheses.some((item) => item.kind === 'reveal')); assert.ok(difference.limitations.some((item) => item.includes('No Interaction Recipe'))); assert.equal(inferResponsiveScreenshotReferences([open,closed]).observations.length,1)
})

test('asynchronous project packing preserves exact canonical state', async () => {
  const project = createProjectDocument({ id:'async-pack',name:'Async',actorId:'a',idFactory:()=> 'cp' }); project.metadata = { repeated:['large'.repeat(300),'large'.repeat(300)] }; assert.deepEqual(unpackProjectDocument(await packProjectOffThread(project)),project)
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

test('Reality research detects only probable screens and requires an explicit rectification target', () => {
  const width = 64; const height = 64; const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 12; y < 52; y += 1) for (let x = 10; x < 54; x += 1) { const at = (y * width + x) * 4; data[at] = 240; data[at + 1] = 240; data[at + 2] = 240; data[at + 3] = 255 }
  const photo = { width, height, data, mimeType: 'image/jpeg' }
  const probable = detectProbableScreenRegion(photo)
  assert.ok(probable && probable.confidence <= .55)
  const rectified = rectifyScreenRegion(photo, probable, 32, 24)
  assert.equal(rectified.width, 32); assert.equal(rectified.height, 24)
  assert.equal(rectified.metadata.realityResearch, true)
  assert.ok(rectified.metadata.limitations.some((item) => item.includes('manual confirmation')))
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
