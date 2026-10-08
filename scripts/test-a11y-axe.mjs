/**
 * Froam's accessibility checks, held to axe-core — the reference engine —
 * on a page of known WCAG failures (scripts/fixtures/a11y-audit.html).
 *
 * Every surface that judges accessibility reads project/a11y: the A11y and
 * Health tabs, "Fix contrast everywhere", the reviewer checks and the scan
 * profile. Where axe can decide, Froam must agree with it — no misses, no
 * false alarms — and once the contrast sweep has run, axe must find nothing
 * left that the sweep didn't own up to. Where axe can't decide (gradients,
 * photos), Froam must either measure it correctly or say it can't.
 *
 * Runs the real source, bundled by esbuild, in headless Chromium.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const require = createRequire(import.meta.url)

function findBrowser() {
  if (process.env.FROAM_E2E_CHROME) return process.env.FROAM_E2E_CHROME
  try {
    const bundled = chromium.executablePath()
    if (bundled && fs.existsSync(bundled)) return bundled
  } catch { /* no bundled browser installed */ }
  const home = os.homedir()
  for (const cache of [path.join(home, 'AppData', 'Local', 'ms-playwright'), path.join(home, '.cache', 'ms-playwright'), path.join(home, 'Library', 'Caches', 'ms-playwright')]) {
    if (!fs.existsSync(cache)) continue
    for (const dir of fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const candidate = path.join(cache, dir, rel)
        if (fs.existsSync(candidate)) return candidate
      }
    }
  }
  return ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p)) ?? null
}

// The page-side harness: Froam's own functions, called the way the editor calls them.
const harness = `
import { sweepContrast } from './src/editor/smart-styles.ts'
import { checkRequestOnPage } from './src/editor/collaborate/request-checks.ts'
import { getElementPath } from './src/collab/paths.ts'
import { INTERACTIVE_SELECTOR, imageAlternative, readTextContrast, undersizedTargets } from './src/project/a11y.ts'
import { scanDomTree } from './src/project/scan.ts'

const caseOf = (el) => el?.closest?.('[data-case]')?.getAttribute('data-case') ?? null
const cased = (list) => [...new Set(list.filter(Boolean))].sort()

window.froamAudit = () => {
  const root = document.body
  const inCases = Array.from(root.querySelectorAll('[data-case] *'))
  const contrast = {}
  for (const el of inCases) {
    const reading = readTextContrast(el)
    if (reading.status === 'exempt') continue
    const c = caseOf(el)
    if (reading.status === 'unmeasurable') contrast[c] = { status: 'unmeasurable', reason: reading.reason }
    else contrast[c] = { status: 'measured', ratio: reading.ratio, required: reading.required, passes: reading.passes, fixable: reading.fixableByColour }
  }
  const missingAlt = cased(Array.from(root.querySelectorAll('img')).filter((img) => imageAlternative(img) === 'missing').map(caseOf))
  const smallTargets = cased(undersizedTargets(Array.from(root.querySelectorAll(INTERACTIVE_SELECTOR))).map(({ element }) => caseOf(element)))
  const paths = inCases.map((el) => getElementPath(el, root)).filter(Boolean)
  const review = checkRequestOnPage(root, paths).map((check) => ({ case: caseOf(findByPath(check.path)), kind: check.kind }))
  const bundle = scanDomTree(root, {}, { routeKey: '/', viewport: 'desktop', now: 1 })
  const scan = []
  for (const record of bundle.records) {
    const warnings = record.signals.find((signal) => signal.kind === 'accessibility')?.values?.warnings ?? []
    const el = root.querySelector('[data-froam-id="' + record.node.nodeId + '"]')
    for (const warning of warnings) scan.push({ case: caseOf(el), warning })
  }
  const sweep = sweepContrast(root)
  return {
    contrast, missingAlt, smallTargets,
    review: cased(review.filter((r) => r.kind === 'contrast').map((r) => r.case)),
    reviewAlt: cased(review.filter((r) => r.kind === 'alt').map((r) => r.case)),
    scanNames: cased(scan.filter((s) => s.warning === 'Interactive element has no accessible name').map((s) => s.case)),
    scanAlt: cased(scan.filter((s) => s.warning === 'Image has no alt attribute').map((s) => s.case)),
    sweep: { title: sweep.title, note: sweep.note, fixed: cased(sweep.fixes.map((fix) => caseOf(fix.element))) },
  }
}
const pathIndex = new Map()
function findByPath(p) {
  if (!pathIndex.size) for (const el of document.querySelectorAll('[data-case] *')) pathIndex.set(getElementPath(el, document.body), el)
  return pathIndex.get(p)
}
window.froamApplySweep = () => {
  const sweep = sweepContrast(document.body)
  for (const fix of sweep.fixes) Object.assign(fix.element.style, fix.styles)
  return sweep.fixes.map((fix) => ({ case: caseOf(fix.element), styles: fix.styles }))
}
`

async function runAxe(page) {
  const raw = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
    const caseOf = (selector) => document.querySelector(selector)?.closest('[data-case]')?.getAttribute('data-case') ?? 'page'
    const flat = (list) => list.map((rule) => ({ id: rule.id, cases: rule.nodes.map((node) => caseOf(node.target[0])) }))
    return { violations: flat(result.violations), incomplete: flat(result.incomplete) }
  })
  const casesOf = (list, rule) => [...new Set(list.filter((v) => v.id === rule).flatMap((v) => v.cases))].sort()
  return { raw, violations: (rule) => casesOf(raw.violations, rule), incomplete: (rule) => casesOf(raw.incomplete, rule) }
}

const browserPath = findBrowser()
if (!browserPath) { console.log('a11y vs axe: no Chrome found — skipped'); process.exit(0) }

const bundled = await build({ stdin: { contents: harness, resolveDir: root, loader: 'ts' }, bundle: true, format: 'iife', write: false, logLevel: 'silent' })
const froamJs = bundled.outputFiles[0].text
const axeJs = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const html = fs.readFileSync(path.join(here, 'fixtures', 'a11y-audit.html'), 'utf8')

const browser = await chromium.launch({ executablePath: browserPath })
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } })
  await page.setContent(html)
  await page.addScriptTag({ content: axeJs })
  await page.addScriptTag({ content: froamJs })
  return page
}

const page = await open()
const axe = await runAxe(page)
const froam = await page.evaluate(() => window.froamAudit())
const contrastFailures = Object.entries(froam.contrast).filter(([, r]) => r.status === 'measured' && !r.passes).map(([c]) => c).sort()

const tests = []
const test = (name, fn) => tests.push([name, fn])
const same = (actual, expected, what) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${what}\n    froam: ${a}\n    axe:   ${e}`)
}

test('contrast: Froam fails exactly the texts axe fails (no misses, no false alarms)', () => {
  // axe can't decide over gradients; Froam measures them, so they are compared separately below.
  same(contrastFailures.filter((c) => !axe.incomplete('color-contrast').includes(c)), axe.violations('color-contrast'), 'color-contrast')
})

test('contrast: translucent text, faded containers and oklch colours are all measured', () => {
  for (const c of ['c03-alpha-text', 'c06-ancestor-opacity', 'c35-oklch-gray', 'c36-partial-opacity']) {
    if (!contrastFailures.includes(c)) throw new Error(`${c} should fail contrast; Froam read ${JSON.stringify(froam.contrast[c])}`)
  }
})

test('contrast: disabled controls are exempt and passing greys pass', () => {
  for (const c of ['c09-disabled-button', 'c02-boundary-767676', 'c07-large-949494']) {
    if (contrastFailures.includes(c)) throw new Error(`${c} is flagged but WCAG passes it`)
  }
})

test('contrast: a photo gets "can\'t measure", never a made-up ratio', () => {
  same(froam.contrast['c05-text-on-photo'], { status: 'unmeasurable', reason: 'photo' }, 'text over a photo')
})

test('contrast: white on a pale gradient is measured against its palest stop', () => {
  const r = froam.contrast['c04-white-on-light-gradient']
  if (r?.status !== 'measured' || r.passes || r.ratio > 1.01) throw new Error(`expected ~1:1 against the white stop, got ${JSON.stringify(r)}`)
})

test('the reviewer checks agree with the contrast engine, disabled controls included', () => {
  same(froam.review, contrastFailures, 'reviewer contrast checks')
})

test('alt: only the image with no alternative is flagged — alt="" is decorative', () => {
  same(froam.missingAlt, axe.violations('image-alt'), 'image-alt (Health tab)')
  same(froam.reviewAlt, axe.violations('image-alt'), 'image-alt (reviewer checks)')
  same(froam.scanAlt, axe.violations('image-alt'), 'image-alt (scan profile)')
})

test('names: the scan flags exactly the unnamed buttons and links axe does', () => {
  same(froam.scanNames, [...new Set([...axe.violations('button-name'), ...axe.violations('link-name')])].sort(), 'button-name + link-name')
})

test('target size: WCAG 2.5.8 at 24px, with the spacing and inline exceptions', () => {
  same(froam.smallTargets, axe.violations('target-size'), 'target-size')
})

test('"Fix contrast everywhere" leaves axe nothing it didn\'t own up to', async () => {
  const fixPage = await open()
  const before = await fixPage.evaluate(() => window.froamAudit())
  await fixPage.evaluate(() => window.froamApplySweep())
  const after = await runAxe(fixPage)
  const after2 = await fixPage.evaluate(() => window.froamAudit())
  await fixPage.close()
  // c06 is faded to 35%: no text colour can pass, and the sweep must say so.
  same(after.violations('color-contrast'), ['c06-ancestor-opacity'], 'color-contrast after the sweep')
  if (!/still fails?/.test(before.sweep.note) || !/35% opacity/.test(before.sweep.note)) throw new Error(`the sweep must name what it couldn't fix: "${before.sweep.note}"`)
  if (/All \d+/.test(before.sweep.note)) throw new Error(`the sweep claims everything passes: "${before.sweep.note}"`)
  if (!/on photos can't be measured/.test(before.sweep.note)) throw new Error(`the sweep must say it skipped the photo: "${before.sweep.note}"`)
  // The gradient fix axe can't judge: Froam's own reading after the fix must pass.
  const gradient = after2.contrast['c04-white-on-light-gradient']
  if (!gradient?.passes) throw new Error(`the gradient text still fails after its fix: ${JSON.stringify(gradient)}`)
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`) } catch (error) { console.error(`  FAIL ${name}\n    ${error.message}`) }
}
await browser.close()
if (passed !== tests.length && process.env.FROAM_A11Y_DEBUG) console.log(JSON.stringify({ froam, axe: axe.raw }, null, 1))
console.log(`a11y vs axe: ${passed}/${tests.length} passed`)
if (passed !== tests.length) process.exit(1)
