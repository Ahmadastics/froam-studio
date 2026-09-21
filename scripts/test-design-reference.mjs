import assert from 'node:assert/strict'
import { attachDesignReference, buildDesignReference, formatDesignBrief, referenceCostComparison } from '../dist/project/intelligence-reference.js'
import { inducePriors } from '../dist/project/judge-priors.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

function profile(overrides = {}) {
  const base = {
    schemaVersion: 1,
    origin: 'https://runam.space',
    routeKey: '/',
    capturedAt: 1,
    viewport: 'desktop',
    color: {
      palette: [
        { oklch: { l: 0.96, c: 0.01, h: 80 }, hex: '#f4f1ea', areaShare: 0.6, role: 'surface', appearsOn: ['unknown'], channel: 'background', nodeCount: 6 },
        { oklch: { l: 0.99, c: 0, h: 0 }, hex: '#fffdfa', areaShare: 0.15, role: 'raised', appearsOn: ['card'], channel: 'background', nodeCount: 8 },
        { oklch: { l: 0.15, c: 0, h: 0 }, hex: '#0c0c0b', areaShare: 0.12, role: 'ink', appearsOn: ['paragraph'], channel: 'text', nodeCount: 40 },
        { oklch: { l: 0.5, c: 0, h: 0 }, hex: '#6b6b6b', areaShare: 0.05, role: 'muted', appearsOn: ['paragraph'], channel: 'text', nodeCount: 12 },
        { oklch: { l: 0.62, c: 0.21, h: 28 }, hex: '#ff4138', areaShare: 0.03, role: 'accent', appearsOn: ['cta'], channel: 'background', nodeCount: 3 },
      ],
      accentDiscipline: 1,
      contrastFloor: 8.2,
      contrastFailures: [],
      contrastSamples: 40,
      contrastUnmeasurable: 2,
      modeSignal: 'light',
    },
    type: {
      families: [{ stack: 'Satoshi', role: 'display', areaShare: 0.6 }, { stack: 'Inter', role: 'body', areaShare: 0.4 }],
      scale: [16, 20, 25, 31].map((px) => ({ px, weight: 400, lineHeight: px * 1.5, usedBy: ['paragraph'], count: 6 })),
      ratio: 1.25,
      ratioSpread: 0.02,
      measureCh: 68,
    },
    space: { base: 8, scale: [8, 16, 24, 32, 48], adherence: 0.94, sectionGapPx: [64, 64], density: 'balanced' },
    surface: { radii: [8, 16], shadowTiers: 2, borderWeights: [1] },
    interaction: { targetSamples: 12, undersizedTargets: [], smallestTargetPx: 44, exemptInlineTargets: 3, exemptSpacedTargets: 1 },
    flow: { sections: [], signature: 'hero>proof>feature-grid:3>cta>footer' },
    components: [],
    quality: { tokenDrift: 0.02, spacingDrift: 0.06, accessibilityWarnings: 0, uniqueColors: 7, uniqueSizes: 4 },
    provenance: { derivedOnly: true, sourceCaptured: false, copyCaptured: false, assetsCaptured: false, nodesObserved: 620, nodesRendered: 585, coverage: 0.944 },
  }
  return structuredClone({ ...base, ...overrides })
}

test('a reference states the measured tokens rather than inventing any', () => {
  const reference = buildDesignReference({ profile: profile() })
  assert.equal(reference.kind, 'reference-only')
  assert.equal(reference.tokens.accent, '#ff4138')
  assert.equal(reference.tokens.surface, '#f4f1ea')
  assert.equal(reference.space.base, 8)
  assert.deepEqual(reference.type.steps, [16, 20, 25, 31])
})

test('the brief tells a model what to reuse, in plain language', () => {
  const brief = formatDesignBrief(profile())
  assert.ok(brief.includes('#ff4138'), 'the accent must be named')
  assert.ok(brief.includes('8px grid'), 'the grid must be named')
  assert.ok(brief.includes('reserved for actions'), 'accent discipline must be stated')
  assert.ok(brief.includes('4.5:1'), 'the contrast floor to hold must be stated')
  assert.ok(!brief.includes('undefined') && !brief.includes('null'), `brief leaked a placeholder:\n${brief}`)
})

test('an unmeasurable property is omitted, never defaulted', () => {
  const noRatio = profile()
  noRatio.type.ratio = null
  noRatio.space.adherence = 0.2
  const brief = formatDesignBrief(noRatio)
  assert.ok(!brief.includes('ratio 0'), 'a missing ratio must not become a number')
  assert.ok(brief.includes('no consistent ratio holds'))
  assert.ok(brief.includes('No spacing grid holds'), 'a grid that does not hold must not be prescribed')
  assert.ok(brief.includes('prefer values already present'))
})

test('a page with existing problems tells the model not to compound them', () => {
  const broken = profile()
  broken.color.accentDiscipline = 0.17
  const brief = formatDesignBrief(broken)
  assert.ok(brief.includes('Do not spread it further'))
})

test('open findings are carried so an edit can avoid them', () => {
  const broken = profile()
  broken.space.adherence = 0.39
  broken.quality.spacingDrift = 0.61
  const reference = buildDesignReference({ profile: broken })
  assert.ok(reference.openFindings.length > 0)
  assert.ok(reference.openFindings.every((finding) => finding.summary && finding.check))
})

test('reference is attached to context and never widens mutation scope', () => {
  const request = {
    schemaVersion: 1,
    purpose: 'mutate',
    intent: 'make the button clearer',
    context: { projectId: 'p', selectedNodeId: 'node-1' },
    scopeNodeIds: ['node-1'],
  }
  const attached = attachDesignReference(request, buildDesignReference({ profile: profile() }))
  assert.deepEqual(attached.scopeNodeIds, ['node-1'], 'scope must be byte-identical after attaching knowledge')
  assert.equal(attached.context.designReference.kind, 'reference-only')
  assert.equal(attached.intent, request.intent)
  assert.deepEqual(request.context, { projectId: 'p', selectedNodeId: 'node-1' }, 'attaching must not mutate the original')
})

test('corpus priors ride along with their evidence, capped', () => {
  const corpus = Array.from({ length: 24 }, (_, site) => {
    const item = profile()
    item.origin = `https://site-${site}.test`
    item.space.base = 8
    item.type.measureCh = 60 + (site % 5)
    return item
  })
  const report = inducePriors(corpus, { minSupport: 4 })
  const offender = profile()
  offender.type.measureCh = 210
  offender.space.base = 96
  const reference = buildDesignReference({ profile: offender, priors: report.priors, maxPriorNotes: 2 })
  assert.ok(reference.priorNotes.length <= 2, 'notes must stay bounded')
  for (const note of reference.priorNotes) {
    assert.ok(note.support > 0, 'a note without evidence is an opinion')
    assert.ok(note.heldOutAccuracy >= 0 && note.heldOutAccuracy <= 1)
    assert.ok(reference.brief.includes('Corpus note'), 'notes must reach the brief')
  }
})

test('the brief is far cheaper than the evidence it replaces', () => {
  // The economic claim, checked rather than asserted: richer context that costs
  // less only holds if the bytes agree.
  const reference = buildDesignReference({ profile: profile() })
  const fakeScanRecords = Array.from({ length: 600 }, (_, index) => ({
    schemaVersion: 1,
    id: `scan:node-${index}:1`,
    node: { nodeId: `node-${index}`, path: `/html/body/div[${index}]`, fingerprint: { tag: 'div', classes: 'card grid gap-4' } },
    capturedAt: 1,
    childNodeIds: [], siblingNodeIds: [],
    signals: [
      { kind: 'layout', origin: 'observed', source: 'computed-style', values: { display: 'block', padding: '16px', margin: '0px', rect: { x: 0, y: index * 40, width: 960, height: 40 } } },
      { kind: 'appearance', origin: 'observed', source: 'computed-style', values: { color: 'rgb(17,17,17)', backgroundColor: 'rgba(0,0,0,0)', fontFamily: 'Inter', fontSize: '16px' } },
    ],
  }))
  const cost = referenceCostComparison({ reference, scanRecords: fakeScanRecords })
  console.log(`\n  brief ${cost.briefBytes}B   full reference ${cost.referenceBytes}B   raw scan records ${cost.rawBytes}B   ${cost.compression}× compression\n`)
  assert.ok(cost.compression > 50, `expected a large saving, got ${cost.compression}×`)
  assert.ok(cost.briefBytes < 1500, `the brief must stay prompt-sized, was ${cost.briefBytes}B`)
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error.message}`)
  }
}
console.log(`\ndesign reference: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
