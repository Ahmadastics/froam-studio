import { performance } from 'node:perf_hooks'
import { analyzeReferenceReconstructions, inferResponsiveSignature, matchScreenshotRegions, serializeReferenceMetadata } from '../dist/project/index.js'

function region(id, x, y, width, height, index) { return { id, nodeId: `node:${id}`, x, y, width, height, kind: index % 7 === 0 ? 'text' : 'container', confidence: .82, semanticRole: index % 7 === 0 ? 'label' : 'unknown', text: index % 7 === 0 ? `Item ${index}` : undefined, textConfidence: index % 7 === 0 ? .88 : undefined, averageColor: `rgb(${20 + index % 8},30,40)`, componentFamilyId: index % 7 === 0 ? undefined : 'benchmark-cards' } }
function reconstruction(id, width, regionCount = 48) {
  const columns = width < 600 ? 1 : width < 900 ? 2 : width < 1200 ? 3 : 4; const cardWidth = Math.floor((width - 80 - (columns - 1) * 16) / columns)
  const regions = Array.from({ length: regionCount }, (_, index) => region(`${id}:region:${index}`, 40 + (index % columns) * (cardWidth + 16), 100 + Math.floor(index / columns) * 88, cardWidth, 72, index))
  return { analysis: { schemaVersion: 1, id: `analysis:${id}`, kind: 'screenshot-reconstruction', targetIds: [], createdAt: 1, provider: 'benchmark', local: true, confidence: .82, result: { validation: null } }, nodes: [{ id: `root:${id}`, kind: 'frame', name: id, source: 'imported' }, ...regions.map((item) => ({ id: item.nodeId, kind: 'element', name: item.text ?? item.id, parentId: `root:${id}`, source: 'imported' }))], relations: regions.map((item) => ({ id: `contains:${item.id}`, kind: 'contains', from: `root:${id}`, to: item.nodeId })), dna: [], regions, rootNodeId: `root:${id}`, references: [{ id, width, height: 1200 }], ocr: [], correctionPasses: [] }
}
function fixture(count) { const widths = Array.from({ length: count }, (_, index) => Math.round(320 + index * (1600 / Math.max(1, count - 1)))); const references = widths.map((width, index) => ({ id: `ref-${count}-${index}`, viewport: { width, height: 1200 }, source: 'screenshot', media: { id: `opaque:ref-${count}-${index}` } })); return { set: { schemaVersion: 1, id: `benchmark-${count}`, references }, reconstructions: references.map((reference) => reconstruction(reference.id, reference.viewport.width)) } }
function percentile(values, fraction) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] }
function measure(run, iterations = 20) { const values = []; let last; for (let index = 0; index < iterations; index += 1) { const started = performance.now(); last = run(); values.push(performance.now() - started) } return { p50: percentile(values, .5), p95: percentile(values, .95), last } }

console.log('Reference intelligence benchmark (48 regions/reference, milliseconds)')
for (const count of [3, 6, 12]) {
  const input = fixture(count); let understanding = analyzeReferenceReconstructions(input.set, input.reconstructions)
  const orchestration = measure(() => analyzeReferenceReconstructions(input.set, input.reconstructions), 15); understanding = orchestration.last
  const matching = measure(() => { for (let index = 1; index < input.reconstructions.length; index += 1) matchScreenshotRegions(input.reconstructions[index - 1], input.reconstructions[index]) }, 20)
  const signature = measure(() => inferResponsiveSignature(input.set.id, understanding.reconstructions, understanding.comparisons), 30)
  const serialization = measure(() => JSON.stringify(serializeReferenceMetadata(understanding)), 40)
  const format = (metric) => `${metric.p50.toFixed(2)} p50 / ${metric.p95.toFixed(2)} p95`
  console.log(`${count} refs: orchestration ${format(orchestration)}; matching ${format(matching)}; signature ${format(signature)}; serialization ${format(serialization)}; bytes ${JSON.stringify(serializeReferenceMetadata(understanding)).length}`)
  if (orchestration.p95 > 1_500) throw new Error(`${count}-reference orchestration exceeded the 1500ms guardrail`)
}
