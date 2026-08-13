import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'

const {
  FROAM_INTELLIGENCE_MAX_REQUEST_BYTES,
  REMOTE_INTELLIGENCE_PRIVACY,
  validateIntelligencePlan,
  validateIntelligenceRequest,
  validateIntelligenceResponse,
  validatePlanRequest,
} = await import('../dist/project/intelligence-transport.js')
const { requestFroamIntelligence } = await import('../dist/project/bridge.js')
const { createProjectDocument, deriveBranchState } = await import('../dist/project/event-log.js')
const {
  adoptMutationChanges,
  compareMutationBranches,
  createMutationPrototype,
  createMutationPrototypeFromProposals,
  normalizeMutationConstraints,
} = await import('../dist/project/mutation.js')
const { createFroamIntelligenceApi, createOpenAICompatibleProvider } = await import('../lib/intelligence-store.mjs')
const { createBridgeServer } = await import('../lib/dev-server.mjs')

const tests = []
const test = (name, fn) => tests.push([name, fn])
const ids = (prefix) => { let i = 0; return () => `${prefix}-${++i}` }

function makeMutationRequest(overrides = {}) {
  return {
    schemaVersion: 1,
    purpose: 'mutate',
    intent: 'Make the hero more prominent',
    context: { projectId: 'project', activeBranchId: 'main', routeKey: '/', viewport: 'desktop' },
    constraints: normalizeMutationConstraints('safe'),
    scopeNodeIds: ['hero', 'cta'],
    ...overrides,
  }
}

function makeAnalysisRequest(purpose, overrides = {}) {
  return {
    schemaVersion: 1,
    purpose,
    intent: `Analyze this interface for ${purpose}`,
    context: { projectId: 'project', activeBranchId: 'main', routeKey: '/', viewport: 'mobile' },
    scopeNodeIds: ['hero'],
    ...overrides,
  }
}

function makeProposal(overrides = {}) {
  return {
    type: 'dna.captured',
    domain: 'visual',
    targetIds: ['hero'],
    confidence: 0.9,
    rationale: 'Increase visual weight',
    payload: { dna: { schemaVersion: 1, nodeId: 'hero', capturedAt: 1 } },
    ...overrides,
  }
}

function makePlan(proposals = [makeProposal()], overrides = {}) {
  return { purpose: 'mutate', proposals, rationale: 'Bounded native changes', confidence: 0.8, ...overrides }
}

function makeAnalysis(purpose, overrides = {}) {
  return {
    purpose,
    findings: [{ summary: 'One column is directly observed at 390px', origin: 'observed', confidence: 0.9, nodeIds: ['hero'] }],
    recommendations: ['Keep the hierarchy intact'],
    limitations: ['No source rules were inspected'],
    ...overrides,
  }
}

function makeProject(id = 'mutation-project') {
  const project = createProjectDocument({ id, name: id, actorId: 'tester', now: 1, idFactory: ids(`${id}-base`) })
  const state = project.checkpoints[project.branches.main.baseCheckpointId].state
  state.nodes.hero = { id: 'hero', kind: 'element', source: 'host-dom' }
  state.nodes.cta = { id: 'cta', kind: 'element', source: 'host-dom' }
  state.nodes.nav = { id: 'nav', kind: 'element', source: 'host-dom', metadata: { semanticRole: 'navigation' } }
  return project
}

async function callApi(handler, body, { method = 'POST', raw } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!(await handler(req, res))) { res.statusCode = 404; res.end('{"error":"not handled"}') }
      } catch (error) { reject(error); server.close() }
    })
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      const request = http.request({ hostname: '127.0.0.1', port, path: '/plan', method, headers: { 'Content-Type': 'application/json' } }, (response) => {
        let data = ''
        response.on('data', (chunk) => { data += chunk })
        response.on('end', () => {
          server.close()
          try { resolve({ status: response.statusCode, body: JSON.parse(data) }) } catch (error) { reject(error) }
        })
      })
      request.on('error', reject)
      if (method === 'POST') request.write(raw ?? JSON.stringify(body))
      request.end()
    })
  })
}

const localPrivacy = { execution: 'local', requiresConsent: false, sendsSourceCode: false, sendsCredentials: false, dataDescription: 'local test' }
const providerOf = (output, privacy = localPrivacy) => ({ id: 'test-provider', privacy, async plan() { return typeof output === 'function' ? output() : output } })

// Transport request coverage.
test('accepts a valid mutation request', () => assert.equal(validatePlanRequest(makeMutationRequest()), true))
for (const purpose of ['understand', 'reference', 'responsive', 'evaluate']) {
  test(`accepts a valid ${purpose} request`, () => assert.equal(validateIntelligenceRequest(makeAnalysisRequest(purpose)).valid, true))
}
test('accepts bounded structured reference knowledge', () => {
  const request = makeAnalysisRequest('reference', { context: { projectId: 'project', activeBranchId: 'main', routeKey: '/', viewport: 'desktop', references: [{ id: 'ref-1', mediaReferenceId: 'opaque:1', viewportWidth: 1440, viewportHeight: 900, reconstructedRegions: [{ id: 'r', kind: 'container', x: 0, y: 0, width: 10, height: 10, origin: 'observed' }], knownLimitations: ['Pixels omitted'] }] } })
  assert.equal(validateIntelligenceRequest(request).valid, true)
})
test('rejects unsupported purpose distinctly', () => assert.equal(validateIntelligenceRequest(makeAnalysisRequest('invent')).code, 'unsupported_purpose'))
test('rejects empty intent', () => assert.equal(validateIntelligenceRequest(makeMutationRequest({ intent: '  ' })).valid, false))
test('rejects oversized request', () => assert.equal(validateIntelligenceRequest(makeMutationRequest({ intent: 'x'.repeat(FROAM_INTELLIGENCE_MAX_REQUEST_BYTES + 1) })).valid, false))
test('rejects raw pixel buffers', () => assert.equal(validateIntelligenceRequest(makeAnalysisRequest('reference', { context: { projectId: 'project', activeBranchId: 'main', routeKey: '/', viewport: 'desktop', pixels: new Uint8ClampedArray(8) } })).valid, false))
test('rejects ordinary raw pixel arrays hidden in a reference', () => assert.equal(validateIntelligenceRequest(makeAnalysisRequest('reference', { context: { projectId: 'project', activeBranchId: 'main', routeKey: '/', viewport: 'desktop', references: [{ id: 'ref', data: [0, 0, 0, 255] }] } })).valid, false))
test('rejects nested credential-shaped keys', () => assert.equal(validateIntelligenceRequest(makeAnalysisRequest('understand', { context: { projectId: 'project', activeBranchId: 'main', routeKey: '/', viewport: 'desktop', memory: { apiKey: 'secret' } } })).valid, false))
test('analysis requests cannot carry mutation constraints', () => assert.equal(validateIntelligenceRequest({ ...makeAnalysisRequest('evaluate'), constraints: normalizeMutationConstraints('safe') }).valid, false))

// Mutation response validation.
test('accepts a valid mutation plan', () => assert.equal(validateIntelligencePlan(makePlan(), makeMutationRequest()).valid, true))
test('rejects unknown event type', () => assert.equal(validateIntelligencePlan(makePlan([makeProposal({ type: 'shell.executed' })]), makeMutationRequest()).valid, false))
test('rejects forbidden domain', () => assert.equal(validateIntelligencePlan(makePlan([makeProposal({ domain: 'navigation' })]), makeMutationRequest()).valid, false))
test('rejects target outside scope', () => assert.equal(validateIntelligencePlan(makePlan([makeProposal({ targetIds: ['outside'], payload: { dna: { schemaVersion: 1, nodeId: 'outside', capturedAt: 1 } } })]), makeMutationRequest()).valid, false))
test('rejects a protected node', () => assert.equal(validateIntelligencePlan(makePlan(), makeMutationRequest({ protectedNodeIds: ['hero'] })).valid, false))
test('rejects invalid payload shape', () => assert.equal(validateIntelligencePlan(makePlan([makeProposal({ payload: { dna: { nodeId: 'hero' } } })]), makeMutationRequest()).valid, false))
test('rejects payload references outside scope', () => assert.equal(validateIntelligencePlan(makePlan([makeProposal({ type: 'relation.upserted', domain: 'visual', payload: { relation: { id: 'rel', kind: 'contains', from: 'hero', to: 'outside' } } })]), makeMutationRequest()).valid, false))
test('rejects more than 20 proposals', () => assert.equal(validateIntelligencePlan(makePlan(Array.from({ length: 21 }, () => makeProposal())), makeMutationRequest()).valid, false))
test('clamps high confidence', () => { const result = validateIntelligencePlan(makePlan([makeProposal({ confidence: 9 })]), makeMutationRequest()); assert.equal(result.valid && result.proposals[0].confidence, 1) })
test('clamps low confidence', () => { const result = validateIntelligencePlan(makePlan([makeProposal({ confidence: -3 })]), makeMutationRequest()); assert.equal(result.valid && result.proposals[0].confidence, 0) })
test('rejects non-finite confidence', () => assert.equal(validateIntelligencePlan(makePlan([makeProposal({ confidence: Infinity })]), makeMutationRequest()).valid, false))
test('analysis output cannot validate as a mutation plan', () => assert.equal(validateIntelligencePlan(makeAnalysis('understand'), makeAnalysisRequest('understand')).valid, false))
test('analysis response rejects an accidental proposals field', () => assert.equal(validateIntelligenceResponse({ ...makeAnalysis('understand'), proposals: [makeProposal()] }, makeAnalysisRequest('understand')).valid, false))

// Recursive pollution defenses.
test('rejects top-level request poison', () => { const request = JSON.parse(JSON.stringify(makeMutationRequest()).replace(/}$/, ',"__proto__":{"polluted":true}}')); assert.equal(validateIntelligenceRequest(request).valid, false) })
test('rejects proposal poison', () => { const proposal = JSON.parse('{"type":"dna.captured","domain":"visual","targetIds":["hero"],"confidence":1,"rationale":"x","payload":{"dna":{"schemaVersion":1,"nodeId":"hero","capturedAt":1}},"prototype":{}}'); assert.equal(validateIntelligencePlan(makePlan([proposal]), makeMutationRequest()).valid, false) })
test('rejects payload.node.__proto__', () => { const node = JSON.parse('{"id":"hero","kind":"element","source":"host-dom","__proto__":{}}'); assert.equal(validateIntelligencePlan(makePlan([makeProposal({ type: 'node.upserted', payload: { node } })]), makeMutationRequest()).valid, false) })
test('rejects payload.dna.visual.constructor', () => { const visual = JSON.parse('{"constructor":{}}'); assert.equal(validateIntelligencePlan(makePlan([makeProposal({ payload: { dna: { schemaVersion: 1, nodeId: 'hero', capturedAt: 1, visual } } })]), makeMutationRequest()).valid, false) })
test('rejects payload.node.metadata.prototype', () => assert.equal(validateIntelligencePlan(makePlan([makeProposal({ type: 'node.upserted', payload: { node: { id: 'hero', kind: 'element', source: 'host-dom', metadata: { prototype: {} } } } })]), makeMutationRequest()).valid, false))

// HTTP API, normalization, consent, and safe errors.
test('remote consent refusal happens before provider call', async () => {
  let calls = 0
  const provider = { id: 'remote', privacy: REMOTE_INTELLIGENCE_PRIVACY, async plan() { calls++; return makePlan() } }
  const result = await callApi(createFroamIntelligenceApi({ provider }), makeMutationRequest())
  assert.equal(result.status, 403); assert.equal(result.body.error.code, 'consent_required'); assert.equal(calls, 0)
})
test('remote provider runs with explicit consent', async () => { const result = await callApi(createFroamIntelligenceApi({ provider: providerOf(makePlan(), REMOTE_INTELLIGENCE_PRIVACY) }), { ...makeMutationRequest(), consent: true }); assert.equal(result.status, 200); assert.equal(result.body.purpose, 'mutate') })
test('local provider does not require remote consent', async () => { const result = await callApi(createFroamIntelligenceApi({ provider: providerOf(makePlan()) }), makeMutationRequest()); assert.equal(result.status, 200) })
test('unconfigured intelligence is a structured non-failure', async () => { const result = await callApi(createFroamIntelligenceApi(), makeAnalysisRequest('understand')); assert.equal(result.status, 200); assert.equal(result.body.configured, false); assert.equal(result.body.error.code, 'not_configured') })
test('the shared intelligence route works in bridge, app-proxy, and static-serve modes', async () => {
  const prior = { key: process.env.FROAM_AI_API_KEY, model: process.env.FROAM_AI_MODEL, base: process.env.FROAM_AI_BASE_URL }
  delete process.env.FROAM_AI_API_KEY; delete process.env.FROAM_AI_MODEL; delete process.env.FROAM_AI_BASE_URL
  const root = mkdtempSync(join(tmpdir(), 'froam-intelligence-'))
  try {
    for (const options of [{}, { app: 'http://127.0.0.1:65530' }, { serveDir: root }]) {
      const { server } = createBridgeServer({ froamDir: root, ...options })
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      const port = server.address().port
      const response = await fetch(`http://127.0.0.1:${port}/__froam/intelligence/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makeAnalysisRequest('understand')) })
      const body = await response.json()
      await new Promise((resolve) => server.close(resolve))
      assert.equal(response.status, 200); assert.equal(body.error.code, 'not_configured')
    }
  } finally {
    if (prior.key === undefined) delete process.env.FROAM_AI_API_KEY; else process.env.FROAM_AI_API_KEY = prior.key
    if (prior.model === undefined) delete process.env.FROAM_AI_MODEL; else process.env.FROAM_AI_MODEL = prior.model
    if (prior.base === undefined) delete process.env.FROAM_AI_BASE_URL; else process.env.FROAM_AI_BASE_URL = prior.base
    rmSync(root, { recursive: true, force: true })
  }
})
test('invalid request maps safely', async () => { const result = await callApi(createFroamIntelligenceApi({ provider: providerOf(makePlan()) }), { bad: true }); assert.equal(result.status, 400); assert.equal(result.body.error.code, 'invalid_request') })
test('oversized HTTP request is refused before provider', async () => { let calls = 0; const provider = { id: 'local', privacy: localPrivacy, async plan() { calls++; return makePlan() } }; const raw = JSON.stringify(makeMutationRequest({ intent: 'x'.repeat(FROAM_INTELLIGENCE_MAX_REQUEST_BYTES + 100) })); const result = await callApi(createFroamIntelligenceApi({ provider }), null, { raw }); assert.equal(result.status, 400); assert.equal(calls, 0) })
test('object provider output crosses a JSON normalization boundary', async () => { const result = await callApi(createFroamIntelligenceApi({ provider: providerOf(makePlan()) }), makeMutationRequest()); assert.equal(result.status, 200) })
test('unusual object prototype is stripped at provider boundary', async () => { const output = Object.assign(Object.create({ constructor: { polluted: true } }), makePlan()); const result = await callApi(createFroamIntelligenceApi({ provider: providerOf(output) }), makeMutationRequest()); assert.equal(result.status, 200); assert.equal({}.polluted, undefined) })
test('oversized provider response is mapped safely', async () => { const result = await callApi(createFroamIntelligenceApi({ provider: providerOf(JSON.stringify({ ...makePlan(), rationale: 'x'.repeat(300_000) })) }), makeMutationRequest()); assert.equal(result.status, 502); assert.equal(result.body.error.code, 'provider_invalid_response') })
test('provider exception cannot leak secrets or paths', async () => { const result = await callApi(createFroamIntelligenceApi({ provider: providerOf(() => { throw new Error('sk-secret C:\\private\\key') }) }), makeMutationRequest()); const serialized = JSON.stringify(result.body); assert.equal(result.status, 502); assert.equal(result.body.error.code, 'provider_unavailable'); assert.ok(!serialized.includes('sk-secret')); assert.ok(!serialized.includes('private')) })
test('no valid proposals has its own safe error', async () => { const result = await callApi(createFroamIntelligenceApi({ provider: providerOf(makePlan([makeProposal({ targetIds: ['outside'] })])) }), makeMutationRequest()); assert.equal(result.status, 422); assert.equal(result.body.error.code, 'no_valid_proposals') })

for (const purpose of ['understand', 'reference', 'responsive', 'evaluate']) {
  test(`${purpose} analysis stays non-executing`, async () => {
    const before = makeProject(`analysis-${purpose}`)
    const validation = validateIntelligenceResponse(makeAnalysis(purpose), makeAnalysisRequest(purpose), 'local')
    assert.equal(validation.valid, true)
    assert.equal(validation.valid && validation.response.purpose, purpose)
    assert.ok(validation.valid && !('proposals' in validation.response))
    assert.equal(before.branches.main.id, 'main'); assert.equal(Object.keys(before.branches).length, 1)
  })
}
test('responsive hypotheses must remain explicitly inferred', () => { const raw = makeAnalysis('responsive', { breakpointHypotheses: [{ summary: 'Switch near 700px', origin: 'observed', confidence: 0.5 }] }); const result = validateIntelligenceResponse(raw, makeAnalysisRequest('responsive'), 'local'); assert.equal(result.valid && result.response.purpose === 'responsive' && result.response.breakpointHypotheses.length, 0) })

// Compatible provider behavior.
function compatibleFetch(envelope, status = 200, inspect = () => {}) {
  return async (url, init) => { inspect(url, init); return new Response(typeof envelope === 'string' ? envelope : JSON.stringify(envelope), { status, headers: { 'Content-Type': 'application/json' } }) }
}
test('compatible provider sends a bounded generic chat request', async () => {
  let captured
  const provider = createOpenAICompatibleProvider({ baseUrl: 'https://compatible.test/v1', apiKey: 'server-key', model: 'model-x', fetchImpl: compatibleFetch({ choices: [{ message: { content: JSON.stringify(makePlan()) } }] }, 200, (url, init) => { captured = { url, init } }) })
  const output = await provider.plan({ ...makeMutationRequest(), consent: true })
  const sent = JSON.parse(captured.init.body)
  assert.equal(captured.url, 'https://compatible.test/v1/chat/completions'); assert.equal(captured.init.headers.Authorization, 'Bearer server-key'); assert.ok(!sent.messages[1].content.includes('server-key')); assert.ok(!sent.messages[1].content.includes('consent')); assert.equal(typeof output, 'string')
})
test('compatible provider rejects non-2xx without exposing body', async () => { const provider = createOpenAICompatibleProvider({ baseUrl: 'https://compatible.test', apiKey: 'key', model: 'm', fetchImpl: compatibleFetch('sk-leak', 500) }); await assert.rejects(provider.plan(makeMutationRequest()), (error) => error.message === 'http_status' && !error.message.includes('sk-leak')) })
test('compatible provider maps network failure', async () => { const provider = createOpenAICompatibleProvider({ baseUrl: 'https://compatible.test', apiKey: 'key', model: 'm', fetchImpl: async () => { throw new Error('network secret') } }); await assert.rejects(provider.plan(makeMutationRequest()), (error) => error.message === 'network') })
test('compatible provider rejects invalid JSON envelope', async () => { const provider = createOpenAICompatibleProvider({ baseUrl: 'https://compatible.test', apiKey: 'key', model: 'm', fetchImpl: compatibleFetch('{bad') }); await assert.rejects(provider.plan(makeMutationRequest()), (error) => error.message === 'invalid_envelope') })
test('compatible provider rejects array envelope', async () => { const provider = createOpenAICompatibleProvider({ baseUrl: 'https://compatible.test', apiKey: 'key', model: 'm', fetchImpl: compatibleFetch([]) }); await assert.rejects(provider.plan(makeMutationRequest()), (error) => error.message === 'invalid_envelope') })
test('compatible provider accepts object message content', async () => { const content = makePlan(); const provider = createOpenAICompatibleProvider({ baseUrl: 'https://compatible.test', apiKey: 'key', model: 'm', fetchImpl: compatibleFetch({ choices: [{ message: { content } }] }) }); assert.deepEqual(await provider.plan(makeMutationRequest()), content) })
test('compatible provider rejects oversized envelope', async () => { const provider = createOpenAICompatibleProvider({ baseUrl: 'https://compatible.test', apiKey: 'key', model: 'm', fetchImpl: compatibleFetch(JSON.stringify({ pad: 'x'.repeat(600_000) })) }); await assert.rejects(provider.plan(makeMutationRequest()), (error) => error.message === 'oversized_envelope') })

// Native mutation integration and defense in depth.
test('deterministic MUTATE still creates an isolated native branch', () => { const base = makeProject('det'); const before = JSON.stringify(deriveBranchState(base, 'main')); const result = createMutationPrototype(base, { branchId: 'det-branch', actorId: 'tester', level: 'safe', scopeNodeIds: ['hero'], seed: 1, now: 10, idFactory: ids('det-event') }); assert.equal(result.project.activeBranchId, 'det-branch'); assert.equal(JSON.stringify(deriveBranchState(result.project, 'main')), before) })
test('AI MUTATE creates an isolated branch with complete provenance', () => { const base = makeProject('ai'); const before = JSON.stringify(deriveBranchState(base, 'main')); const result = createMutationPrototypeFromProposals(base, { branchId: 'ai-branch', actorId: 'tester', level: 'safe', scopeNodeIds: ['hero'], proposals: [makeProposal()], constraints: normalizeMutationConstraints('safe'), provider: 'test-provider', now: 20, idFactory: ids('ai-event') }); assert.equal(result.project.activeBranchId, 'ai-branch'); assert.equal(JSON.stringify(deriveBranchState(result.project, 'main')), before); assert.equal(result.provenance.sourceBranchId, 'main'); assert.equal(result.provenance.targetScope[0], 'hero'); assert.equal(result.provenance.operationIds.length, 2); assert.deepEqual(result.project.metadata.mutations.at(-1), result.provenance) })
test('AI and deterministic mutation emit equivalent lineage metadata', () => { const base = makeProject('lineage'); const ai = createMutationPrototypeFromProposals(base, { branchId: 'ai-lineage', actorId: 'tester', level: 'safe', scopeNodeIds: ['hero'], proposals: [makeProposal()], constraints: normalizeMutationConstraints('safe'), provider: 'remote', now: 20, idFactory: ids('ai-lineage-event') }); const det = createMutationPrototype(base, { branchId: 'det-lineage', actorId: 'tester', level: 'safe', scopeNodeIds: ['hero'], now: 10, seed: 1, idFactory: ids('det-lineage-event') }); for (const result of [ai, det]) { const event = result.project.events.find((item) => item.label === 'Mutation lineage'); assert.equal(event.payload.relation.kind, 'derived-from'); assert.ok(event.payload.relation.metadata.sourceBranchId); assert.ok(event.payload.relation.metadata.sourceCheckpointId); assert.ok(event.payload.relation.metadata.provider) } })
test('native mutation helper cannot expand the caller scope', () => { const base = makeProject('scope'); assert.throws(() => createMutationPrototypeFromProposals(base, { branchId: 'bad-scope', actorId: 'tester', level: 'safe', scopeNodeIds: ['cta'], proposals: [makeProposal()], constraints: normalizeMutationConstraints('safe'), provider: 'remote' }), /No safe mutation proposals/); assert.equal(Object.keys(base.branches).length, 1) })
test('native mutation helper re-enforces protected nodes', () => { const base = makeProject('protected'); assert.throws(() => createMutationPrototypeFromProposals(base, { branchId: 'bad-protected', actorId: 'tester', level: 'safe', scopeNodeIds: ['nav'], proposals: [makeProposal({ targetIds: ['nav'], payload: { dna: { schemaVersion: 1, nodeId: 'nav', capturedAt: 1 } } })], constraints: normalizeMutationConstraints('safe', { protect: ['navigation'] }), provider: 'remote' }), /No safe mutation proposals/); assert.equal(Object.keys(base.branches).length, 1) })
test('conflict-safe adoption remains intact', () => { const base = makeProject('adopt'); const mutation = createMutationPrototypeFromProposals(base, { branchId: 'ai-adopt', actorId: 'tester', level: 'safe', scopeNodeIds: ['hero'], proposals: [makeProposal()], constraints: normalizeMutationConstraints('safe'), provider: 'remote', now: 10, idFactory: ids('adopt-event') }); const comparison = compareMutationBranches(mutation.project, 'main', 'ai-adopt'); const adopted = adoptMutationChanges(mutation.project, { mutationBranchId: 'ai-adopt', targetBranchId: 'main', eventIds: comparison.eventIds, actorId: 'tester', now: 20, idFactory: ids('accepted') }); assert.equal(adopted.status, 'adopted'); assert.ok(adopted.adoptedEventIds.length > 0) })

// Packaging/security compatibility.
test('browser client is provider-neutral and injectable', async () => { let request; const response = await requestFroamIntelligence(makeAnalysisRequest('understand'), async (url, init) => { request = { url, init }; return new Response(JSON.stringify({ schemaVersion: 1, purpose: 'understand', provider: 'local', findings: [] }), { status: 200 }) }); assert.equal(request.url, '/__froam/intelligence/plan'); assert.ok(!request.init.body.includes('apiKey')); assert.equal(response.purpose, 'understand') })
test('project schema version remains 2', async () => { const { FROAM_PROJECT_SCHEMA_VERSION } = await import('../dist/project/types.js'); assert.equal(FROAM_PROJECT_SCHEMA_VERSION, 2) })
test('server implementation and environment secret names are absent from browser bundle', () => { const bundle = readFileSync(new URL('../dist/standalone/froam-editor.js', import.meta.url), 'utf8'); for (const forbidden of ['FROAM_AI_API_KEY', 'FROAM_AI_MODEL', 'FROAM_AI_BASE_URL', '/chat/completions', 'Authorization: `Bearer']) assert.ok(!bundle.includes(forbidden), `browser bundle contains ${forbidden}`) })

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed++; console.log(`✓ ${name}`) }
  catch (error) { console.error(`✗ ${name}`); throw error }
}
console.log(`\n${passed}/${tests.length} intelligence transport tests passed`)
