import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createLocalScreenshotProvider } from '../dist/project/screenshot-reconstruction.js'
import { evaluateScreenshotReconstruction } from '../dist/project/screenshot-evaluation.js'

const directory = path.resolve(process.argv[2] ?? '')
if (!process.argv[2] || !fs.existsSync(path.join(directory, 'manifest.json'))) throw new Error('Usage: npm run evaluate:screenshots -- <fixture-pack-directory>')
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
const results = []
for (const fixture of manifest.cases ?? []) {
  const pixels = new Uint8ClampedArray(Buffer.from(fixture.reference.pixelsBase64, 'base64'))
  const reference = { ...fixture.reference, data: pixels, referenceId: fixture.id, metadata: { viewportWidth: fixture.viewport.width, viewportHeight: fixture.viewport.height, route: fixture.route, state: fixture.state } }
  const ocrProvider = { id: 'fixture-ocr', local: true, available: () => Array.isArray(fixture.ocr), async recognize() { return { provider: this.id, available: Array.isArray(fixture.ocr), lines: fixture.ocr ?? [], warnings: Array.isArray(fixture.ocr) ? [] : ['Fixture contains no annotated OCR.'] } } }
  const provider = createLocalScreenshotProvider(ocrProvider); const started = performance.now(); const reconstruction = await provider.reconstruct(reference); const timingMs = performance.now() - started
  results.push({ caseId: fixture.id, tags: fixture.tags ?? [], metrics: evaluateScreenshotReconstruction({ ...fixture, reference }, reconstruction, { timingMs }), regionCount: reconstruction.regions.length, warnings: reconstruction.ocr.flatMap((result) => result.warnings) })
}
console.log(JSON.stringify({ pack: manifest.name ?? path.basename(directory), provider: 'froam-local-reconstruction-v2', cases: results }, null, 2))
