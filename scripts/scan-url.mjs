/**
 * Scan a live URL: browser → scan → profile → audit → corpus.
 *
 * This is the step that makes everything else real. Until a profile has come
 * off an actual page, the profiler has only ever been tested against fixtures
 * that were written by the same person who wrote the profiler, which is a
 * closed loop.
 *
 * Uses playwright-core driving the system Chrome, so nothing downloads a
 * browser. playwright-core is a devDependency and never ships to consumers.
 *
 *   node scripts/scan-url.mjs https://example.com
 *   node scripts/scan-url.mjs https://example.com --tier=reference --viewport=mobile
 *   node scripts/scan-url.mjs https://a.com https://b.com --corpus=corpus.json --json
 *
 * Flags
 *   --tier=<reference|good|baseline|negative>  quality label; required to write to a corpus
 *   --viewport=<desktop|tablet|mobile>         default desktop
 *   --corpus=<path>                            append the profile to this corpus file
 *   --out=<dir>                                write profile JSON per page
 *   --json                                     emit machine-readable output only
 *   --max-nodes=<n>                            default 2500
 *   --timeout=<ms>                             navigation timeout, default 45000
 *   --headed                                   show the browser
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { chromium } from 'playwright-core'
import { buildPageProfile } from '../dist/project/page-profile.js'
import { judgePage, formatJudgeReport } from '../dist/project/judge.js'
import { addToCorpus, emptyCorpus, corpusStats } from '../dist/project/corpus.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Below this, a "page" is a block screen, a consent wall or a failed load. */
const MIN_PLAUSIBLE_NODES = 25

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
}

function parseArgs(argv) {
  const urls = []
  const flags = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) { urls.push(arg); continue }
    const [key, value] = arg.slice(2).split('=')
    flags[key] = value ?? true
  }
  return { urls, flags }
}

/**
 * Bundle scanDomTree for the page.
 *
 * The scanner reads computed styles and layout geometry, so it has to execute
 * inside the document — there is no way to obtain a real rect from Node. It is
 * bundled fresh from src rather than read from dist so a scan always matches
 * the source being worked on.
 */
async function buildScanBundle() {
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { scanDomTree } from './project/scan'
        window.__froamScan = (options) => {
          const bundle = scanDomTree(document.body, {}, options)
          // Only the records cross the boundary. The registry holds live element
          // references and would not survive serialisation.
          return { records: bundle.records, families: bundle.families, rootNodeId: bundle.rootNodeId }
        }
      `,
      resolveDir: path.join(root, 'src'),
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
  })
  return result.outputFiles[0].text
}

/** Nudge lazy content into existence, then return to the top so geometry is measured from rest. */
async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.9)
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    window.scrollTo(0, 0)
    await new Promise((resolve) => setTimeout(resolve, 350))
  })
}

async function scanOne(page, url, { viewport, maxNodes, bundle, timeout }) {
  const started = Date.now()
  await page.setViewportSize(VIEWPORTS[viewport])
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
  // networkidle is a best effort; analytics beacons keep many pages permanently busy.
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await settle(page)
  await page.evaluate(bundle)
  const scan = await page.evaluate(
    ({ routeKey, viewport: vp, maxNodes: max }) => window.__froamScan({ routeKey, viewport: vp, maxNodes: max, now: Date.now() }),
    { routeKey: new URL(url).pathname || '/', viewport, maxNodes },
  )
  const origin = new URL(page.url()).origin
  const profile = buildPageProfile({
    records: scan.records,
    origin,
    routeKey: new URL(page.url()).pathname || '/',
    viewport,
  })
  return { profile, status: response?.status() ?? 0, finalUrl: page.url(), elapsedMs: Date.now() - started, scanned: scan.records.length }
}

async function main() {
  const { urls, flags } = parseArgs(process.argv.slice(2))
  if (!urls.length) {
    console.error('usage: node scripts/scan-url.mjs <url...> [--tier=good] [--viewport=desktop] [--corpus=path]')
    process.exit(1)
  }
  const viewport = String(flags.viewport ?? 'desktop')
  if (!VIEWPORTS[viewport]) { console.error(`unknown viewport "${viewport}"`); process.exit(1) }
  const maxNodes = Number(flags['max-nodes'] ?? 2500)
  const timeout = Number(flags.timeout ?? 45000)
  const asJson = Boolean(flags.json)
  const log = (...args) => { if (!asJson) console.log(...args) }

  if (flags.corpus && !flags.tier) {
    // The corpus refuses unlabelled entries by design; failing here rather than
    // after a slow scan keeps that from being discovered the hard way.
    console.error('--corpus requires --tier: nothing enters the corpus without a declared quality tier')
    process.exit(1)
  }

  log('bundling the scanner…')
  const bundle = await buildScanBundle()

  const browser = await chromium.launch({ channel: 'chrome', headless: !flags.headed })

  // A browser is only closed on the happy path unless you make it otherwise.
  // Eighteen headless Chrome processes accumulated during development from runs
  // that were interrupted or threw before reaching the close call, so teardown
  // is registered immediately after launch and runs exactly once.
  let closed = false
  const shutdown = async () => {
    if (closed) return
    closed = true
    await browser.close().catch(() => {})
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => { void shutdown().then(() => process.exit(130)) })
  }
  process.once('uncaughtException', (error) => { console.error(error); void shutdown().then(() => process.exit(1)) })

  try {
    const results = await scanAll()
    if (asJson) console.log(JSON.stringify({ viewport, results }, null, 2))
    const failures = results.filter((result) => !result.ok).length
    if (failures === urls.length) process.exitCode = 1
  } finally {
    await shutdown()
  }

  async function scanAll() {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
  })
  const page = await context.newPage()
  page.setDefaultTimeout(timeout)

  const results = []
  for (const url of urls) {
    try {
      log(`\nscanning ${url} (${viewport})…`)
      const result = await scanOne(page, url, { viewport, maxNodes, bundle, timeout })

      // A blocked or errored page still renders *something*, and the profiler
      // will dutifully measure it. craigslist.org answered 403 with four nodes
      // and was scored 85.9 and filed into the corpus — a profile of an error
      // page, indistinguishable from data once written. Refuse both the status
      // and the implausible thinness rather than trusting either alone: some
      // blocks answer 200.
      if (result.status >= 400) {
        throw new Error(`HTTP ${result.status} — refusing to profile an error page`)
      }
      if (result.profile.provenance.nodesRendered < MIN_PLAUSIBLE_NODES) {
        throw new Error(`only ${result.profile.provenance.nodesRendered} nodes rendered — the page is blocked, gated or did not load`)
      }
      const report = judgePage(result.profile)
      results.push({ url, ok: true, ...result, score: report.score, findings: report.findings.length })

      if (!asJson) {
        console.log(`  ${result.scanned} nodes in ${result.elapsedMs}ms, HTTP ${result.status}`)
        console.log('')
        console.log(formatJudgeReport(report))
        const profile = result.profile
        console.log('')
        console.log(`  palette    ${profile.color.palette.slice(0, 6).map((entry) => `${entry.hex} ${entry.role}`).join('  ')}`)
        console.log(`  type       ${profile.type.scale.map((step) => step.px).join(', ')}px  ratio ${profile.type.ratio ?? 'none'}`)
        console.log(`  spacing    ${profile.space.base}px @ ${(profile.space.adherence * 100).toFixed(0)}%`)
        console.log(`  flow       ${profile.flow.signature || '(no sections resolved)'}`)
        console.log(`  coverage   ${profile.provenance.nodesRendered}/${profile.provenance.nodesObserved}`)
      }

      if (flags.out) {
        fs.mkdirSync(String(flags.out), { recursive: true })
        const name = `${new URL(url).hostname}${new URL(url).pathname.replace(/\W+/g, '-')}.${viewport}.json`
        fs.writeFileSync(path.join(String(flags.out), name), JSON.stringify(result.profile, null, 2))
      }

      if (flags.corpus) {
        const file = String(flags.corpus)
        const corpus = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : emptyCorpus()
        const next = addToCorpus(corpus, result.profile, { tier: String(flags.tier), tags: [viewport], note: `scanned ${new Date().toISOString()}` })
        fs.writeFileSync(file, JSON.stringify(next, null, 2))
        const stats = corpusStats(next)
        log(`\n  corpus: ${stats.entries} pages across ${stats.origins} origins (${stats.learnable} learnable)`)
      }
    } catch (error) {
      results.push({ url, ok: false, error: String(error?.message ?? error) })
      console.error(`  failed: ${error?.message ?? error}`)
    }
  }
  return results
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
