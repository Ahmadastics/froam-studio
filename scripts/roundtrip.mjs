/**
 * The round-trip skill: can Froam build a page that obeys a system it measured?
 *
 *   profile a scanned page → generate a page from that profile
 *                          → scan the generation → profile it → measure the gap
 *
 * Scored against a baseline, like every other skill here. The baseline generates
 * from a *generic* profile — plain defaults, no measurement — so the question is
 * not "does the output look like a website" but "did measuring the target help".
 * A generator that ignores the profile entirely would still produce a page; only
 * the margin over the generic build is evidence of anything.
 *
 *   node scripts/roundtrip.mjs --corpus=corpus.json
 *   node scripts/roundtrip.mjs --corpus=corpus.json --limit=10 --keep=out/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { chromium } from 'playwright-core'
import { buildPageProfile } from '../dist/project/page-profile.js'
import { generatePageFromProfile } from '../dist/project/generate.js'
import { profileDistance } from '../dist/project/profile-distance.js'
import { learnableProfiles } from '../dist/project/corpus.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const flags = {}
for (const arg of process.argv.slice(2)) {
  if (!arg.startsWith('--')) continue
  const [key, value] = arg.slice(2).split('=')
  flags[key] = value ?? true
}
if (!flags.corpus) {
  console.error('usage: node scripts/roundtrip.mjs --corpus=<path> [--limit=n] [--keep=dir]')
  process.exit(1)
}

/**
 * A profile with nothing measured in it.
 *
 * The control: whatever the generator produces from this is what you get
 * without looking at the target at all.
 */
function genericProfile(reference) {
  return {
    ...reference,
    color: {
      palette: [
        { oklch: { l: 1, c: 0, h: 0 }, hex: '#ffffff', areaShare: 0.7, role: 'surface', appearsOn: [], channel: 'background', nodeCount: 1 },
        { oklch: { l: 0.2, c: 0, h: 0 }, hex: '#111111', areaShare: 0.2, role: 'ink', appearsOn: [], channel: 'text', nodeCount: 1 },
        { oklch: { l: 0.5, c: 0.15, h: 250 }, hex: '#3366cc', areaShare: 0.03, role: 'accent', appearsOn: [], channel: 'background', nodeCount: 1 },
      ],
      accentDiscipline: 1, contrastFloor: 12, contrastFailures: [], contrastSamples: 10, contrastUnmeasurable: 0, modeSignal: 'light',
    },
    type: {
      families: [{ stack: 'system-ui, sans-serif', role: 'body', areaShare: 1 }],
      scale: [16, 20, 25, 31].map((px) => ({ px, weight: 400, lineHeight: px * 1.5, usedBy: [], count: 1 })),
      ratio: 1.25, ratioSpread: 0.02, belowMinimumSizes: 0, measureCh: 66,
    },
    space: { base: 8, scale: [8, 16, 24, 32, 48], adherence: 1, sectionGapPx: [64], density: 'balanced' },
    surface: { radii: [8], shadowTiers: 1, borderWeights: [1] },
    flow: { sections: [], signature: '' },
  }
}

const bundle = (await esbuild.build({
  stdin: {
    contents: `import { scanDomTree } from './project/scan'
      window.__froamScan = (o) => ({ records: scanDomTree(document.body, {}, o).records })`,
    resolveDir: path.join(root, 'src'),
    loader: 'ts',
  },
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', write: false, logLevel: 'silent',
})).outputFiles[0].text

const corpus = JSON.parse(fs.readFileSync(String(flags.corpus), 'utf8'))
const targets = learnableProfiles(corpus).slice(0, Number(flags.limit ?? 12))
if (!targets.length) { console.error('no learnable profiles in the corpus'); process.exit(2) }
if (flags.keep) fs.mkdirSync(String(flags.keep), { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
let closed = false
const shutdown = async () => { if (!closed) { closed = true; await browser.close().catch(() => {}) } }
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => void shutdown().then(() => process.exit(130)))

try {
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })

  /** Render HTML in the browser and profile it exactly as a scanned page would be. */
  const profileHtml = async (html, origin) => {
    await page.setContent(html, { waitUntil: 'load', timeout: 20000 })
    await page.evaluate(bundle)
    const scan = await page.evaluate(() => window.__froamScan({ routeKey: '/', viewport: 'desktop', maxNodes: 2500, now: 1 }))
    return buildPageProfile({ records: scan.records, origin, routeKey: '/', viewport: 'desktop' })
  }

  const rows = []
  console.log(`\n── round trip: ${targets.length} pages ${'─'.repeat(40)}`)
  for (const target of targets) {
    const host = target.origin.replace(/^https?:\/\//, '')
    try {
      const built = await profileHtml(generatePageFromProfile(target, { seed: 7 }), 'https://generated.local')
      const control = await profileHtml(
        generatePageFromProfile(genericProfile(target), { seed: 7, flow: target.flow.sections.map((s) => s.archetype) }),
        'https://control.local',
      )
      const measured = profileDistance(target, built)
      const baseline = profileDistance(target, control)
      rows.push({ host, measured: measured.total, baseline: baseline.total, axes: measured.axes })
      const win = measured.total < baseline.total
      console.log(`  ${host.padEnd(30)} distance ${measured.total.toFixed(3)}   generic ${baseline.total.toFixed(3)}   ${win ? 'closer' : 'NOT closer'}`)
      if (flags.keep) fs.writeFileSync(path.join(String(flags.keep), `${host.replace(/\W+/g, '-')}.html`), generatePageFromProfile(target, { seed: 7 }))
    } catch (error) {
      console.error(`  ${host.padEnd(30)} failed: ${error?.message ?? error}`)
    }
  }

  if (!rows.length) { console.error('\nevery page failed'); process.exitCode = 1 }
  else {
    const mean = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length
    const measuredMean = mean((row) => row.measured)
    const baselineMean = mean((row) => row.baseline)
    const wins = rows.filter((row) => row.measured < row.baseline).length

    console.log(`\n  mean distance ${measuredMean.toFixed(3)}   generic baseline ${baselineMean.toFixed(3)}   ` +
      `improvement ${((1 - measuredMean / baselineMean) * 100).toFixed(1)}%`)
    console.log(`  closer than generic on ${wins}/${rows.length} pages`)

    console.log('\n  where the gap is')
    const axisNames = rows[0].axes.map((axis) => axis.axis)
    for (const name of axisNames) {
      const value = mean((row) => row.axes.find((axis) => axis.axis === name).distance)
      console.log(`    ${name.padEnd(10)} ${value.toFixed(3)}  ${'█'.repeat(Math.round(value * 30))}`)
    }
    console.log('')
    console.log(wins > rows.length / 2
      ? '  Measuring the target produced a closer page than not measuring it.'
      : '  Measuring the target did NOT beat a generic build. The generator is not using the profile well enough to matter.')
    console.log('')
  }
} finally {
  await shutdown()
}
