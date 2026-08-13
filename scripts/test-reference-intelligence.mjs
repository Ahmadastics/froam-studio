import assert from 'node:assert/strict'
import {
  adaptiveBreakpointSearch,
  analyzeReferenceReconstructions,
  createReferenceIntelligenceRequest,
  createResponsiveIntelligenceRequest,
  deriveGeometryRelationships,
  matchScreenshotRegions,
  normalizeReferenceRegions,
  planResponsiveValidation,
  referenceValidationWidths,
  serializeReferenceMetadata,
  validateReferenceSet,
  validateResponsiveHealth,
} from '../dist/project/index.js'
import { validateIntelligenceRequest } from '../dist/project/intelligence-transport.js'
import { FROAM_REFERENCE_MAX_REFERENCES, readReferenceConsent, referenceQualityLabel, suggestReferenceLabel, validateReferenceDimensions, validateReferenceFile, writeReferenceConsent } from '../dist/editor/reference-workspace-model.js'

const tests = []
function test(name, run) { tests.push({ name, run }) }
function region(id, x, y, width, height, options = {}) { return { id, nodeId: options.nodeId ?? `node:${id}`, x, y, width, height, kind: options.kind ?? 'container', confidence: options.confidence ?? .9, semanticRole: options.role ?? 'unknown', text: options.text, textConfidence: options.textConfidence, averageColor: options.color, componentFamilyId: options.family } }
function reconstruction(id, width, height, regions, options = {}) {
  return {
    analysis: { schemaVersion: 1, id: `analysis:${id}`, kind: 'screenshot-reconstruction', targetIds: regions.map((item) => item.nodeId), createdAt: 1, provider: 'fixture', local: true, confidence: .9, result: { validation: options.pixelSimilarity == null ? null : { pixelSimilarity: options.pixelSimilarity } } },
    nodes: [{ id: `root:${id}`, kind: 'frame', name: id, source: 'imported' }, ...regions.map((item) => ({ id: item.nodeId, kind: 'element', name: item.text ?? item.id, parentId: `root:${id}`, source: 'imported', metadata: { semanticRole: item.semanticRole } }))],
    relations: regions.map((item) => ({ id: `contains:${id}:${item.id}`, kind: 'contains', from: `root:${id}`, to: item.nodeId, metadata: { inferred: true, confidence: .8 } })), dna: [], regions, rootNodeId: `root:${id}`,
    references: [{ id, width, height }], ocr: [{ provider: 'fixture', available: regions.some((item) => item.text), lines: regions.filter((item) => item.text).map((item) => ({ id: item.id, text: item.text, bounds: { x: item.x, y: item.y, width: item.width, height: item.height }, confidence: item.textConfidence ?? .9 })), warnings: [] }], correctionPasses: [],
  }
}
function reference(id, width, height = 900) { return { id, viewport: { width, height }, source: 'screenshot', media: { id: `opaque:${id}`, mimeType: 'image/png', width, height } } }
function set(id, refs) { return { schemaVersion: 1, id, references: refs } }
function grid(id, width, columns) { const cardWidth = Math.floor((width - 80 - (columns - 1) * 16) / columns); return reconstruction(id, width, 900, Array.from({ length: 8 }, (_, index) => region(`${id}:card:${index}`, 40 + (index % columns) * (cardWidth + 16), 180 + Math.floor(index / columns) * 160, cardWidth, 140, { family: 'cards', color: 'rgb(20,20,20)' }))) }

test('accepts one-reference sets', () => assert.equal(validateReferenceSet(set('one', [reference('a', 390)])).references.length, 1))
test('rejects empty sets', () => assert.throws(() => validateReferenceSet(set('empty', [])), /1 to 20/))
test('rejects duplicate reference ids', () => assert.throws(() => validateReferenceSet(set('dup', [reference('a', 390), reference('a', 768)])), /Duplicate/))
test('rejects impossible viewports', () => assert.throws(() => validateReferenceSet(set('bad', [reference('a', 0)])), /Invalid viewport/))
test('rejects data URLs as media handles', () => assert.throws(() => validateReferenceSet(set('raw', [{ ...reference('a', 390), media: { id: 'data:image/png;base64,AAAA' } }])), /opaque/))
test('reference workspace and project validation share a 20-reference boundary', () => { assert.equal(FROAM_REFERENCE_MAX_REFERENCES, 20); assert.equal(validateReferenceSet(set('max', Array.from({ length: 20 }, (_, index) => reference(`ref-${index}`, 320 + index)))).references.length, 20); assert.throws(() => validateReferenceSet(set('too-many', Array.from({ length: 21 }, (_, index) => reference(`ref-${index}`, 320 + index)))), /1 to 20/) })

const geometryEntry = { reference: reference('geometry', 1000, 800), reconstruction: reconstruction('geometry', 1000, 800, [region('full', 0, 0, 950, 100), region('left-a', 20, 200, 200, 100), region('left-b', 20, 350, 200, 100), region('row-b', 300, 200, 200, 100)]) }
test('normalizes geometry by viewport', () => assert.equal(normalizeReferenceRegions(geometryEntry)[0].width, .95))
test('detects full-width regions', () => assert(deriveGeometryRelationships(geometryEntry).some((item) => item.kind === 'full-width')))
test('detects contained regions', () => assert(deriveGeometryRelationships(geometryEntry).some((item) => item.kind === 'contained')))
test('detects same-row relationships', () => assert(deriveGeometryRelationships(geometryEntry).some((item) => item.kind === 'same-row')))
test('detects stacked relationships', () => assert(deriveGeometryRelationships(geometryEntry).some((item) => item.kind === 'stacked')))

const matchFrom = reconstruction('from', 1200, 800, [region('source-heading', 80, 80, 400, 60, { kind: 'text', role: 'heading', text: 'Build better products', nodeId: 'shared-id' })])
const matchTo = reconstruction('to', 600, 800, [region('wrong-id', 20, 80, 200, 40, { kind: 'text', role: 'heading', text: 'Unrelated', nodeId: 'shared-id' }), region('right-text', 20, 120, 400, 60, { kind: 'text', role: 'heading', text: 'Build better products', nodeId: 'different-id' })])
test('matches exact OCR text across widths', () => assert.equal(matchScreenshotRegions(matchFrom, matchTo).matches[0].toRegionId, 'right-text'))
test('does not treat node ids as correspondence evidence', () => assert.notEqual(matchScreenshotRegions(matchFrom, matchTo).matches[0].toNodeId, 'shared-id'))
test('records explicit match evidence', () => assert(matchScreenshotRegions(matchFrom, matchTo).matches[0].evidence.some((item) => item.signal === 'ocr-text')))
const ambiguousFrom = reconstruction('amb-from', 500, 500, [region('blank', 0, 0, 100, 100)])
const ambiguousTo = reconstruction('amb-to', 500, 500, [region('candidate-a', 0, 0, 100, 100), region('candidate-b', 0, 0, 100, 100)])
test('leaves near-tied candidates unmatched', () => assert.equal(matchScreenshotRegions(ambiguousFrom, ambiguousTo).matches.length, 0))
test('reports ambiguous candidates', () => assert.equal(matchScreenshotRegions(ambiguousFrom, ambiguousTo).ambiguous[0].candidateRegionIds.length, 2))
test('ambiguity carries reduced certainty versus exact text', () => assert(matchScreenshotRegions(ambiguousFrom, ambiguousTo).ambiguous[0].confidence < matchScreenshotRegions(matchFrom, matchTo).matches[0].confidence))
const sameWidthUnderstanding = analyzeReferenceReconstructions(set('same-width', [reference('closed-menu', 390, 700), reference('open-menu', 390, 700)]), [reconstruction('closed-menu', 390, 700, [region('menu', 330, 20, 40, 40, { kind: 'text', role: 'button', text: 'Menu' })]), reconstruction('open-menu', 390, 700, [region('home', 20, 80, 120, 30, { kind: 'text', role: 'label', text: 'Home' }), region('work', 20, 120, 120, 30, { kind: 'text', role: 'label', text: 'Work' })])])
test('same-width references remain distinct states', () => { assert.equal(sameWidthUnderstanding.reconstructions.length, 2); assert.deepEqual(sameWidthUnderstanding.reconstructions.map((item) => item.reference.id).sort(), ['closed-menu', 'open-menu']); assert.equal(sameWidthUnderstanding.comparisons.length, 1) })

const gridRefs = [reference('mobile', 390), reference('tablet', 768), reference('laptop', 1024), reference('desktop', 1440)]
const gridUnderstanding = analyzeReferenceReconstructions(set('grid-set', gridRefs), [grid('desktop', 1440, 4), grid('mobile', 390, 1), grid('laptop', 1024, 3), grid('tablet', 768, 2)])
test('sorts reconstructions by viewport width', () => assert.deepEqual(gridUnderstanding.reconstructions.map((item) => item.reference.id), ['mobile', 'tablet', 'laptop', 'desktop']))
test('compares every adjacent viewport pair', () => assert.equal(gridUnderstanding.comparisons.length, 3))
test('detects a 4/3/2/1 card progression', () => assert.deepEqual(gridUnderstanding.responsiveSignature.observations.filter((item) => item.kind === 'grid').map((item) => item.values.columns), [1, 2, 3, 4]))
test('bounds grid transitions between observed widths', () => assert.deepEqual(gridUnderstanding.responsiveSignature.hypotheses.filter((item) => item.kind === 'layout-transition').map((item) => item.betweenWidths), [[390, 768], [768, 1024], [1024, 1440]]))
test('labels observations as observed', () => assert(gridUnderstanding.responsiveSignature.observations.every((item) => item.origin === 'observed')))
test('labels hypotheses as inferred', () => assert(gridUnderstanding.responsiveSignature.hypotheses.every((item) => item.origin === 'inferred')))

const heroNarrow = reconstruction('hero-narrow', 390, 800, [region('h-n', 24, 90, 340, 60, { kind: 'text', role: 'heading', text: 'A clear hero' }), region('i-n', 24, 210, 340, 250, { kind: 'image' })])
const heroWide = reconstruction('hero-wide', 1280, 800, [region('h-w', 80, 140, 480, 80, { kind: 'text', role: 'heading', text: 'A clear hero' }), region('i-w', 700, 80, 480, 360, { kind: 'image' })])
const heroUnderstanding = analyzeReferenceReconstructions(set('hero-set', [reference('hero-wide', 1280, 800), reference('hero-narrow', 390, 800)]), [heroNarrow, heroWide])
test('detects row-to-column hero evidence', () => assert(heroUnderstanding.responsiveSignature.hypotheses.some((item) => item.summary.includes('Hero changes'))))
test('hero breakpoint remains an interval', () => assert.deepEqual(heroUnderstanding.responsiveSignature.hypotheses.find((item) => item.summary.includes('Hero changes')).betweenWidths, [390, 1280]))

const navNarrow = reconstruction('nav-narrow', 390, 700, [region('menu', 330, 20, 40, 40, { kind: 'text', role: 'button', text: 'Menu' })])
const navWide = reconstruction('nav-wide', 1280, 700, ['Home', 'Work', 'About', 'Contact'].map((text, index) => region(`nav-${index}`, 700 + index * 120, 30, 90, 28, { kind: 'text', role: 'label', text })))
const navUnderstanding = analyzeReferenceReconstructions(set('nav-set', [reference('nav-narrow', 390, 700), reference('nav-wide', 1280, 700)]), [navWide, navNarrow])
test('detects text navigation becoming compact', () => assert(navUnderstanding.responsiveSignature.hypotheses.some((item) => item.kind === 'navigation-transformation')))
test('detects cross-width visibility changes', () => assert(navUnderstanding.responsiveSignature.hypotheses.some((item) => item.kind === 'visibility-change')))

test('validation widths include every baseline width', () => assert([320, 360, 390, 430, 480, 640, 768, 834, 1024, 1280, 1440, 1600, 1920].every((width) => referenceValidationWidths([], []).includes(width))))
test('validation widths include references', () => assert(referenceValidationWidths([777], []).includes(777)))
test('validation widths include interval boundary deltas', () => assert([767, 768, 769, 1023, 1024, 1025].every((width) => referenceValidationWidths([], [{ betweenWidths: [768, 1024] }]).includes(width))))
test('validation widths are sorted and deduplicated', () => { const widths = referenceValidationWidths([390, 390], [{ betweenWidths: [390, 390] }]); assert.deepEqual(widths, [...new Set(widths)].sort((a, b) => a - b)) })
test('responsive validation plan uses the existing observation contract', () => { const plan = planResponsiveValidation([], {}, [390], []); assert.equal(plan.observationContract, 'observeResponsiveState'); assert(plan.cinemaSweep.length > plan.widths.length) })
test('responsive validation plan uses existing policy suggestions', () => { const records = [{ node: { nodeId: 'hero' }, signals: [] }]; const policies = { hero: { schemaVersion: 1, nodeId: 'hero', priority: 'high', canHide: false, canCollapse: true, canWrap: true, canTruncate: false, canCrop: false, canReposition: true, minimumUsefulWidth: 700, updatedAt: 1, updatedBy: 'fixture' } }; assert(planResponsiveValidation(records, policies, [390], []).suggestions.some((item) => item.items.some((suggestion) => suggestion.action === 'reposition'))) })

test('adaptive search stops at the probe budget', async () => { const result = await adaptiveBreakpointSearch({ lowerWidth: 320, upperWidth: 1280, lowerState: 'compact', upperState: 'wide', observe: (width) => width < 800 ? 'compact' : 'wide', maxProbes: 3 }); assert.equal(result.probes.length, 3) })
test('adaptive search narrows a transition interval', async () => { const result = await adaptiveBreakpointSearch({ lowerWidth: 320, upperWidth: 1280, lowerState: 'compact', upperState: 'wide', observe: (width) => width < 800 ? 'compact' : 'wide', maxProbes: 8 }); assert(result.interval[1] - result.interval[0] < 10) })
test('adaptive search skips equal endpoint states', async () => { const result = await adaptiveBreakpointSearch({ lowerWidth: 320, upperWidth: 1280, lowerState: 'same', upperState: 'same', observe: () => 'same' }); assert.equal(result.transitionFound, false); assert.equal(result.probes.length, 0) })

const single = analyzeReferenceReconstructions(set('single', [reference('single-ref', 390)]), [reconstruction('single-ref', 390, 900, [region('only', 0, 0, 390, 900)])])
test('single reference leaves responsive quality unknown', () => assert.equal(single.quality.responsiveEvidence, undefined))
test('missing OCR leaves text quality unknown', () => assert.equal(single.quality.text, undefined))
test('missing candidate pixels leave visual quality unknown', () => assert.equal(single.quality.visual, undefined))
test('quality limitations explain unknown dimensions', () => assert(single.quality.limitations.length >= 3))
test('visual quality uses measured pixel similarity only', () => { const measured = analyzeReferenceReconstructions(set('visual', [reference('visual-ref', 390)]), [reconstruction('visual-ref', 390, 900, [region('only', 0, 0, 390, 900)], { pixelSimilarity: .87 })]); assert.equal(measured.quality.visual, .87) })

test('serializes additive project metadata', () => assert.equal(JSON.parse(JSON.stringify(serializeReferenceMetadata(gridUnderstanding))).schemaVersion, 1))
test('serialized metadata contains no pixel buffers', () => assert(!JSON.stringify(serializeReferenceMetadata(gridUnderstanding)).includes('Uint8ClampedArray')))
const requestInput = { projectId: 'project', activeBranchId: 'main', routeKey: '/', intent: 'Analyze responsive reference evidence', consent: true }
const referenceRequest = createReferenceIntelligenceRequest(heroUnderstanding, requestInput)
test('builds reference-purpose AI context', () => assert.equal(referenceRequest.purpose, 'reference'))
test('builds responsive-purpose AI context', () => assert.equal(createResponsiveIntelligenceRequest(heroUnderstanding, requestInput).purpose, 'responsive'))
test('AI context includes matches, differences, signature, and quality', () => assert.deepEqual(Object.keys(referenceRequest.context.referenceEvidence).sort(), ['differences', 'limitations', 'matches', 'quality', 'responsiveSignature']))
test('analysis AI requests contain no mutation constraints', () => assert(!('constraints' in referenceRequest) && !('protectedNodeIds' in referenceRequest)))
test('reference AI context passes strict transport validation', () => assert.equal(validateIntelligenceRequest(referenceRequest).valid, true))
test('bounded multi-reference AI context passes strict transport validation', () => assert.equal(validateIntelligenceRequest(createReferenceIntelligenceRequest(gridUnderstanding, requestInput)).valid, true))
test('AI context carries only opaque media ids', () => assert(referenceRequest.context.references.every((item) => item.mediaReferenceId?.startsWith('opaque:'))))

const badObservation = { width: 390, overflowX: true, hiddenCritical: ['cta'], collisions: [['a', 'b']], clipped: ['copy'], touchTargets: ['menu'], markers: [] }
test('responsive health aggregates all issue classes', () => assert.equal(validateResponsiveHealth([badObservation], [{ width: 390, kind: 'visual', summary: 'diff', severity: 'critical' }]).issueCount, 6))
test('responsive health counts critical failures', () => assert.equal(validateResponsiveHealth([badObservation], [{ width: 390, kind: 'visual', summary: 'diff', severity: 'critical' }]).criticalIssueCount, 3))
test('responsive health can report a clean sweep', () => assert.equal(validateResponsiveHealth([{ width: 390, overflowX: false, hiddenCritical: [], collisions: [], clipped: [], touchTargets: [], markers: [] }]).healthy, true))
test('reference UI accepts PNG metadata', () => assert.equal(validateReferenceFile({ type: 'image/png', size: 12 }).valid, true))
test('reference UI accepts JPEG metadata', () => assert.equal(validateReferenceFile({ type: 'image/jpeg', size: 12 }).valid, true))
test('reference UI accepts WebP metadata', () => assert.equal(validateReferenceFile({ type: 'image/webp', size: 12 }).valid, true))
test('reference UI rejects unsupported files without decoding', () => assert.equal(validateReferenceFile({ type: 'application/pdf', size: 12 }).valid, false))
test('reference UI applies the existing 20 megapixel boundary', () => assert.equal(validateReferenceDimensions(5000, 5000).valid, false))
test('viewport label suggestions are deterministic and editable by the UI', () => assert.deepEqual([390, 768, 1440].map(suggestReferenceLabel), ['Mobile', 'Tablet', 'Desktop']))
test('quality UI preserves unknown values', () => assert.equal(referenceQualityLabel(undefined).tone, 'unknown'))
test('declining remote interpretation persists without invoking a provider', () => { const values = new Map(); const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; writeReferenceConsent(storage, 'declined'); assert.equal(readReferenceConsent(storage), 'declined') })

let passed = 0
for (const { name, run } of tests) {
  try { await run(); passed += 1 }
  catch (error) { console.error(`FAIL ${name}`); throw error }
}
console.log(`reference intelligence tests: ${passed}/${tests.length} passed`)
