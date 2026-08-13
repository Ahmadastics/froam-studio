import assert from 'node:assert/strict'

const { scopeKey } = await import('../dist/collab/types.js')
const { appendProjectEvents, createProjectDocument, createProjectEvent, deriveBranchState, emptyProjectState, switchProjectBranch } = await import('../dist/project/event-log.js')
const { assembleFroamIntelligenceRequest, looksLikeNaturalLanguageIntent } = await import('../dist/project/intelligence-context.js')
const { requestFroamIntelligence } = await import('../dist/project/bridge.js')
const { adoptMutationChanges, compareMutationBranches, createMutationPrototypeFromProposals, normalizeMutationConstraints } = await import('../dist/project/mutation.js')
const { FROAM_INTENT_MAX_ATTEMPTS, froamIntentPreferences, froamIntentPrototypeName, froamIntentReducer, froamIntentRetryFeedback, initialFroamIntentState, shouldOfferAskFroam } = await import('../dist/editor/froam-intent-model.js')
const { FROAM_INTELLIGENCE_CONSENT_KEY, readFroamIntelligenceConsent, writeFroamIntelligenceConsent } = await import('../dist/editor/intelligence-consent.js')

const tests = []
const test = (name, fn) => tests.push([name, fn])
const ids = (prefix) => { let index = 0; return () => `${prefix}-${++index}` }
const viewportKey = scopeKey('/', 'desktop')

function fixtureProject() {
  const state = emptyProjectState()
  state.legacyStore = { [viewportKey]: { 'section.hero/button.cta': { styles: { boxShadow: 'none', backgroundColor: 'rgb(20, 20, 20)' } } } }
  state.nodes.hero = { id: 'hero', kind: 'element', name: 'hero', source: 'host-dom', locator: { path: 'section.hero', routeKey: '/', viewport: 'desktop' } }
  state.nodes.cta = { id: 'cta', kind: 'element', name: 'cta', parentId: 'hero', source: 'host-dom', locator: { path: 'section.hero/button.cta', routeKey: '/', viewport: 'desktop' }, metadata: { semanticRole: 'cta' } }
  state.nodes.copy = { id: 'copy', kind: 'element', name: 'paragraph', parentId: 'hero', source: 'host-dom', locator: { path: 'section.hero/p', routeKey: '/', viewport: 'desktop' } }
  state.relations['contains:hero:cta'] = { id: 'contains:hero:cta', kind: 'contains', from: 'hero', to: 'cta' }
  state.scans.cta = { schemaVersion: 1, id: 'scan:cta', node: { nodeId: 'cta', path: 'section.hero/button.cta', routeKey: '/', viewport: 'desktop' }, capturedAt: 1, signals: [], childNodeIds: [], siblingNodeIds: ['copy'] }
  state.scans.copy = { schemaVersion: 1, id: 'scan:copy', node: { nodeId: 'copy', path: 'section.hero/p', routeKey: '/', viewport: 'desktop' }, capturedAt: 1, signals: [], childNodeIds: [], siblingNodeIds: ['cta'] }
  state.dna.cta = { schemaVersion: 1, nodeId: 'cta', capturedAt: 1, visual: { boxShadow: 'none', backgroundColor: 'rgb(20, 20, 20)', fontSize: '16px' }, layout: { width: '180px', height: '48px', padding: '12px 18px' }, semantics: { role: 'cta' } }
  state.dna.copy = { schemaVersion: 1, nodeId: 'copy', capturedAt: 1, semantics: { role: 'paragraph' } }
  state.responsive.cta = { schemaVersion: 1, nodeId: 'cta', priority: 'high', canHide: false, canCollapse: false, canWrap: true, canTruncate: false, canCrop: false, canReposition: true, updatedAt: 1, updatedBy: 'tester' }
  return createProjectDocument({ id: 'intent-project', name: 'Intent fixture', actorId: 'tester', initialState: state, now: 1, idFactory: ids('project') })
}

const snapshot = {
  node: { id: 'cta', kind: 'element', name: 'cta', parentId: 'hero', source: 'host-dom', locator: { path: 'section.hero/button.cta', routeKey: '/', viewport: 'desktop' }, metadata: { semanticRole: 'cta' } },
  scan: { schemaVersion: 1, id: 'scan:cta:fresh', node: { nodeId: 'cta', path: 'section.hero/button.cta', routeKey: '/', viewport: 'desktop' }, capturedAt: 2, signals: [], childNodeIds: [], siblingNodeIds: ['copy'] },
  dna: { schemaVersion: 1, nodeId: 'cta', capturedAt: 2, visual: { boxShadow: 'none', backgroundColor: 'rgb(20, 20, 20)', fontSize: '16px' }, layout: { width: '180px', height: '48px', padding: '12px 18px' }, semantics: { role: 'cta' } },
  relationships: [{ id: 'contains:hero:cta', kind: 'contains', from: 'hero', to: 'cta' }],
  routeKey: '/', viewport: 'desktop', path: 'section.hero/button.cta',
}

const proposal = (shadow = '0 14px 36px rgba(0,0,0,.34)') => ({ type: 'dna.captured', domain: 'visual', targetIds: ['cta'], confidence: .9, rationale: `Use ${shadow}`, payload: { dna: { ...snapshot.dna, capturedAt: 3, visual: { ...snapshot.dna.visual, boxShadow: shadow } } } })
const contextRequest = (overrides = {}) => assembleFroamIntelligenceRequest({ project: fixtureProject(), intent: 'Make this more premium without changing its size', scope: { selectedNodeId: 'cta', selectedDomPath: snapshot.path, routeKey: '/', viewport: 'desktop' }, consent: true, selectionEvidence: snapshot, ...overrides })
const session = (attempt = 1) => ({ id: 'intent-1', origin: 'command-palette', intent: 'Make this premium', selectedNodeId: 'cta', selectedPath: snapshot.path, sourceBranchId: 'main', attempt, maxAttempts: FROAM_INTENT_MAX_ATTEMPTS })

test('known commands remain first-class', () => assert.equal(shouldOfferAskFroam('Blueprint', 1), false))
test('unmatched language produces Ask Froam', () => assert.equal(shouldOfferAskFroam('Make this button stronger', 0), true))
test('blank input never produces Ask Froam', () => { assert.equal(shouldOfferAskFroam('', 0), false); assert.equal(shouldOfferAskFroam('   ', 0), false) })
test('short non-language input stays a normal empty result', () => assert.equal(looksLikeNaturalLanguageIntent('x'), false))

test('context requires a selected stable node', () => assert.equal(assembleFroamIntelligenceRequest({ project: fixtureProject(), intent: 'Make this better', scope: { selectedNodeId: null, selectedDomPath: null, routeKey: '/', viewport: 'desktop' }, consent: true }), null))
test('stable id is primary and path secondary', () => { const request = contextRequest(); assert.equal(request.context.selectedNodeId, 'cta'); assert.equal(request.context.selectedPath, snapshot.path); assert.deepEqual(request.scopeNodeIds, ['cta']) })
test('nearby evidence cannot expand mutation scope', () => { const request = contextRequest(); assert.ok(request.context.scanRecords.some((record) => record.node.nodeId === 'copy')); assert.deepEqual(request.scopeNodeIds, ['cta']) })
test('native evidence is bounded', () => { const request = contextRequest(); assert.ok(request.context.scanRecords.length <= 12); assert.ok(Object.keys(request.context.dna).length <= 8); assert.ok(request.context.relationships.length <= 16); assert.ok(request.context.responsivePolicies.length <= 8); assert.ok(request.context.memory) })
test('context excludes ambient browser and source data', () => { const serialized = JSON.stringify(contextRequest()).toLowerCase(); for (const value of ['cookie', 'localstorage', 'apikey', 'api_key', 'authorization', 'sourcecode', 'outerhtml']) assert.equal(serialized.includes(value), false) })
test('context is below the transport maximum', () => assert.ok(Buffer.byteLength(JSON.stringify(contextRequest())) < 64_000))
test('retry feedback is bounded and intent canonical', () => { const request = contextRequest({ priorAttemptFeedback: 'Different direction'.repeat(200) }); assert.equal(request.intent, 'Make this more premium without changing its size'); assert.ok(request.priorAttemptFeedback.length <= 1000) })

test('controller reaches preview only through legal stages', () => { let state = froamIntentReducer(initialFroamIntentState, { type: 'submit', session: session() }); for (const action of [{ type: 'request' }, { type: 'plan-ready' }, { type: 'create-prototype' }, { type: 'preview', prototypeBranchId: 'p1', prototypeName: 'Froam Premium', changeCount: 1, changeSummaries: ['Depth'] }]) state = froamIntentReducer(state, action); assert.equal(state.phase, 'previewing') })
test('controller adopts then completes', () => { let state = { phase: 'previewing', session: { ...session(), prototypeBranchId: 'p1' }, message: null }; state = froamIntentReducer(state, { type: 'adopt' }); state = froamIntentReducer(state, { type: 'complete', message: 'Applied' }); assert.equal(state.phase, 'completed') })
test('retry preserves original intent and scope', () => { const start = { phase: 'previewing', session: { ...session(), prototypeBranchId: 'p1', changeSummaries: ['First'] }, message: null }; const state = froamIntentReducer(start, { type: 'retry' }); assert.equal(state.phase, 'retrying'); assert.equal(state.session.intent, start.session.intent); assert.equal(state.session.selectedNodeId, 'cta'); assert.equal(state.session.attempt, 2) })
test('cancel returns requesting and previewing to idle', () => { for (const phase of ['requesting', 'previewing']) assert.equal(froamIntentReducer({ phase, session: session(), message: null }, { type: 'cancel' }).phase, 'idle') })
test('expected failures use safe error state', () => assert.equal(froamIntentReducer({ phase: 'requesting', session: session(), message: null }, { type: 'fail', message: 'Safe message' }).phase, 'error'))
test('impossible idle adoption is ignored', () => assert.deepEqual(froamIntentReducer(initialFroamIntentState, { type: 'adopt' }), initialFroamIntentState))
test('retry limit is three attempts', () => assert.equal(froamIntentReducer({ phase: 'previewing', session: session(3), message: null }, { type: 'retry' }).phase, 'previewing'))
test('retry feedback contains summaries only', () => { const feedback = froamIntentRetryFeedback({ phase: 'previewing', session: { ...session(), changeSummaries: ['Increase contrast'] }, message: null }); assert.match(feedback, /Increase contrast/); assert.ok(feedback.length <= 1000) })
test('dimension preference is deterministic', () => assert.equal(froamIntentPreferences('Make this premium without changing its size').preserveDimensions, true))
test('prototype labels are provider-neutral', () => { const name = froamIntentPrototypeName('Make this CTA feel more premium'); assert.match(name, /^Froam/); assert.doesNotMatch(name, /GPT|AI|OpenAI/i) })

function createExperiment(project = fixtureProject(), plan = proposal(), preserveDimensions = true) {
  return createMutationPrototypeFromProposals(project, { branchId: `intent-branch-${Date.now()}-${Math.random()}`, name: 'Froam Premium CTA', actorId: 'tester', level: 'safe', scopeNodeIds: ['cta'], proposals: [plan], constraints: normalizeMutationConstraints('safe', { protect: ['navigation', 'logo', 'brand-colors'] }), provider: 'fixture-provider', selectionSnapshot: snapshot, preserveDimensions, now: 10, idFactory: ids('intent-event') })
}

test('valid plan creates an isolated live-design branch', () => { const project = fixtureProject(); const before = JSON.stringify(deriveBranchState(project, 'main')); const result = createExperiment(project); assert.notEqual(result.project.activeBranchId, 'main'); assert.equal(JSON.stringify(deriveBranchState(result.project, 'main')), before); assert.equal(result.compiledDesignOperationCount, 1); assert.notEqual(deriveBranchState(result.project).legacyStore[viewportKey][snapshot.path].styles.boxShadow, 'none') })
test('prototype has lineage and provider provenance', () => { const result = createExperiment(); assert.equal(result.provenance.sourceBranchId, 'main'); assert.equal(result.provenance.provider, 'fixture-provider'); assert.deepEqual(result.provenance.targetScope, ['cta']); assert.ok(result.provenance.operationIds.length >= 3) })
test('dimension preservation suppresses size styles', () => { const plan = { ...proposal(), domain: 'spacing', payload: { dna: { ...snapshot.dna, capturedAt: 3, layout: { ...snapshot.dna.layout, padding: '24px' } } } }; assert.equal(createExperiment(fixtureProject(), plan, true).compiledDesignOperationCount, 0) })
test('scope expansion is rejected by native mutation', () => { const bad = { ...proposal(), targetIds: ['copy'], payload: { dna: { ...snapshot.dna, nodeId: 'copy' } } }; assert.throws(() => createExperiment(fixtureProject(), bad), /No safe mutation proposals/) })
test('unsafe CSS never compiles onto live design', () => assert.equal(createExperiment(fixtureProject(), proposal('url(https://tracker.invalid/pixel)')).compiledDesignOperationCount, 0))
test('Keep uses canonical adoption', () => { const result = createExperiment(); const branch = result.project.activeBranchId; const comparison = compareMutationBranches(result.project, 'main', branch); const adopted = adoptMutationChanges(result.project, { mutationBranchId: branch, targetBranchId: 'main', eventIds: comparison.eventIds, actorId: 'tester', now: 20, idFactory: ids('adopted') }); assert.equal(adopted.status, 'adopted'); assert.notEqual(deriveBranchState(switchProjectBranch(adopted.project, 'main'), 'main').legacyStore[viewportKey][snapshot.path].styles.boxShadow, 'none') })
test('adoption refuses a newer source conflict', () => { const result = createExperiment(); const branch = result.project.activeBranchId; const op = { id: 'newer-source', kind: 'edit', actor: 'other', clock: 100, ts: 100, routeKey: '/', viewport: 'desktop', path: snapshot.path, nodeId: 'cta', field: 'style:boxShadow', before: 'none', after: '0 0 2px red' }; const changed = appendProjectEvents(result.project, [createProjectEvent({ projectId: result.project.id, branchId: 'main', actorId: 'other', clock: 100, createdAt: 100, type: 'design.op.appended', payload: { op }, targetIds: ['cta'], idFactory: ids('source-change') })]); const comparison = compareMutationBranches(changed, 'main', branch); const adopted = adoptMutationChanges(changed, { mutationBranchId: branch, targetBranchId: 'main', eventIds: comparison.eventIds, actorId: 'tester' }); assert.equal(adopted.status, 'refused'); assert.equal(deriveBranchState(adopted.project, 'main').legacyStore[viewportKey][snapshot.path].styles.boxShadow, '0 0 2px red') })
test('Cancel semantics leave source unchanged', () => { const project = fixtureProject(); const before = JSON.stringify(deriveBranchState(project, 'main')); const source = switchProjectBranch(createExperiment(project).project, 'main'); assert.equal(JSON.stringify(deriveBranchState(source, 'main')), before) })

test('consent uses one versioned preference', () => { const values = new Map(); const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; assert.equal(readFroamIntelligenceConsent(storage), 'unknown'); assert.equal(writeFroamIntelligenceConsent(storage, 'allowed'), true); assert.equal(readFroamIntelligenceConsent(storage), 'allowed'); assert.equal(FROAM_INTELLIGENCE_CONSENT_KEY, 'froam-intelligence-consent-v1'); assert.deepEqual([...values.keys()], [FROAM_INTELLIGENCE_CONSENT_KEY]) })
test('transport propagates AbortSignal', async () => {
  const controller = new AbortController()
  let received
  const promise = requestFroamIntelligence(contextRequest(), (_url, init) => {
    received = init.signal
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
  }, controller.signal)
  controller.abort()
  await assert.rejects(promise, /Aborted/)
  assert.equal(received, controller.signal)
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`) }
  catch (error) { console.error(`FAIL ${name}`); throw error }
}
console.log(`froam intent tests: ${passed}/${tests.length} passed`)
console.log(`froam intent context bytes: ${Buffer.byteLength(JSON.stringify(contextRequest()))}`)
