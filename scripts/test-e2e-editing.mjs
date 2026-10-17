#!/usr/bin/env node
/**
 * End-to-end: three things people hit while editing, each found on a real
 * site (Run'Am) and fixed.
 *
 *   - Typing a new font size: clearing the field used to snap it to 6, so
 *     typing "24" gave 624px.
 *   - Duplicating: Ctrl+Z took the copy out of the design but left it on the
 *     page; redo and a reload lost it.
 *   - Scrolling on a site with a smooth-scroll library that the site pauses
 *     while Froam edits (Lenis): nothing scrolled, page or font list.
 *
 * `froam dev --serve` runs the e2e fixture. Needs `npm run build` first.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = path.join(ROOT, 'test', 'e2e', 'site')
const BIN = path.join(ROOT, 'bin', 'froam.mjs')

function findBrowser() {
  if (process.env.FROAM_E2E_CHROME) return process.env.FROAM_E2E_CHROME
  try { const bundled = chromium.executablePath(); if (bundled && fs.existsSync(bundled)) return bundled } catch { /* none */ }
  for (const cache of [path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'), path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')]) {
    if (!fs.existsSync(cache)) continue
    for (const dir of fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        if (fs.existsSync(path.join(cache, dir, rel))) return path.join(cache, dir, rel)
      }
    }
  }
  return ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p)) ?? null
}

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.on('error', reject)
  server.listen(0, () => { const { port } = server.address(); server.close(() => resolve(port)) })
})

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let browser
let url = ''

/** A fresh browser on the fixture with the editor open (nothing left from another test). */
async function openEditor({ before } = {}) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 } })
  const page = await context.newPage()
  if (before) await page.addInitScript(before)
  await page.goto(url)
  await page.waitForSelector('.global-chef-button', { timeout: 20000 })
  await page.keyboard.press('Control+.')
  await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 20000 })
  await page.waitForTimeout(800)
  return { page, context }
}

async function select(page, selector) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), selector)
  await page.waitForTimeout(150)
  const box = await page.locator(selector).boundingBox()
  await page.mouse.click(box.x + Math.min(30, box.width / 2), box.y + box.height / 2)
  await page.waitForTimeout(500)
}

test('typing a new font size: a cleared field stays empty, and "24" is 24px', async () => {
  const { page, context } = await openEditor()
  try {
    await select(page, '#subtitle')
    const read = () => page.evaluate(() => ({ field: document.querySelector('[aria-label="Font size"]').value, applied: getComputedStyle(document.getElementById('subtitle')).fontSize }))
    await page.locator('[aria-label="Font size"]').click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')
    let now = await read()
    assert(now.field === '', `clearing the size field left "${now.field}"`)
    await page.keyboard.type('24')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    now = await read()
    assert(now.field === '24' && now.applied === '24px', `typing 24 gave the field "${now.field}" and the text ${now.applied}`)
    // Too small is kept to the smallest size once the field is left, not on every keystroke.
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('3')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)
    now = await read()
    assert(now.applied === '6px', `a size of 3 left the text at ${now.applied}, not the smallest (6px)`)
  } finally { await context.close() }
})

test('a duplicate is one step: Ctrl+Z takes it off the page, Ctrl+Y puts it back, and a reload keeps it', async () => {
  const { page, context } = await openEditor()
  try {
    const count = () => page.evaluate(() => document.querySelectorAll('.features li p').length)
    const before = await count()
    await select(page, '.features li:first-child p')
    await page.keyboard.press('Control+d')
    await page.waitForTimeout(800)
    assert(await count() === before + 1, `Ctrl+D made ${await count()} paragraphs, not ${before + 1}`)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(800)
    assert(await count() === before, `after Ctrl+Z there are ${await count()} paragraphs: the copy stayed on the page`)
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(800)
    assert(await count() === before + 1, `after Ctrl+Y there are ${await count()} paragraphs: redo didn't bring the copy back`)
    await page.waitForTimeout(1200)
    await page.reload()
    await page.waitForSelector('.global-chef-button')
    await page.waitForTimeout(1500)
    assert(await count() === before + 1, `after a reload there are ${await count()} paragraphs: the copy wasn't kept`)
  } finally { await context.close() }
})

/**
 * What Lenis does, as far as Froam is concerned: html.lenis.lenis-stopped clips
 * the page, and every wheel is swallowed unless something on its way up is
 * marked data-lenis-prevent. Paused whenever data-chef-editing appears — which is
 * exactly what Run'Am's own code does.
 */
const pretendLenis = () => {
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style')
    style.textContent = '.lenis.lenis-stopped { overflow: clip; } html.lenis body { height: auto; }'
    document.head.append(style)
    document.documentElement.classList.add('lenis')
    new MutationObserver(() => {
      document.documentElement.classList.toggle('lenis-stopped', document.documentElement.hasAttribute('data-chef-editing'))
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-chef-editing'] })
    window.addEventListener('wheel', (event) => {
      if (event.composedPath().some((node) => node instanceof HTMLElement && node.hasAttribute('data-lenis-prevent'))) return
      if (document.documentElement.classList.contains('lenis-stopped')) event.preventDefault()
    }, { passive: false })
  })
}

test('on a site whose smooth scrolling pauses while Froam edits, the page and the font list still scroll', async () => {
  const { page, context } = await openEditor({ before: pretendLenis })
  try {
    assert(await page.evaluate(() => document.documentElement.classList.contains('lenis-stopped')), 'the stand-in scroller did not pause for editing')
    await page.mouse.move(680, 500)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(600)
    const y = await page.evaluate(() => scrollY)
    assert(y > 100, `the page didn't scroll while editing (scrollY ${y})`)

    await page.evaluate(() => window.scrollTo(0, 0))
    await select(page, '#subtitle')
    await page.locator('.froam-floating-bar [aria-label="Font family"]').first().click()
    await page.waitForSelector('.froam-font-picker__list')
    const list = await page.locator('.froam-font-picker__list').boundingBox()
    const top = () => page.evaluate(() => document.querySelector('.froam-font-picker__list').scrollTop)
    const startTop = await top()
    await page.mouse.move(list.x + list.width / 2, list.y + 40)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(500)
    assert(await top() > startTop, 'the font list did not scroll while editing')
    await page.keyboard.press('Escape')

    // Closing the editor hands the page back to the site's own scroller.
    await page.locator('[aria-label="Exit Froam editing"]').click()
    await page.waitForTimeout(500)
    const handedBack = await page.evaluate(() => ({ prevent: document.body.hasAttribute('data-lenis-prevent'), stopped: document.documentElement.classList.contains('lenis-stopped') }))
    assert(!handedBack.prevent && !handedBack.stopped, `after closing the editor: ${JSON.stringify(handedBack)}`)
  } finally { await context.close() }
})

test('cut, copy and paste elements: each is one step, Undo takes it back, and a moved element stays moved after a reload', async () => {
  const { page, context } = await openEditor()
  try {
    const after = (id) => page.evaluate((id) => document.getElementById(id)?.nextElementSibling?.textContent?.trim() ?? null, id)
    const exists = (id) => page.evaluate((id) => Boolean(document.getElementById(id)), id)
    // Copy a card's words and paste them after the subtitle.
    await select(page, '.features li:first-child p')
    const words = await page.evaluate(() => document.querySelector('.features li:first-child p').textContent.trim())
    await page.keyboard.press('Control+c')
    await select(page, '#subtitle')
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(700)
    assert(await after('subtitle') === words, `the paste isn't after the subtitle (found "${await after('subtitle')}")`)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(700)
    assert(await after('subtitle') !== words, 'Ctrl+Z left the pasted copy on the page')

    // Cut the badge and paste it after the subtitle: it moves.
    await select(page, '#badge')
    await page.keyboard.press('Control+x')
    await page.waitForTimeout(700)
    assert(!(await exists('badge')), 'the cut badge is still on the page')
    await select(page, '#subtitle')
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(700)
    const moved = await page.evaluate(() => document.getElementById('subtitle').nextElementSibling)
    assert(await page.evaluate(() => document.getElementById('subtitle').nextElementSibling?.id === 'badge'), `the badge was not pasted after the subtitle: ${await page.evaluate(() => document.getElementById('subtitle').nextElementSibling?.outerHTML.slice(0, 200))}`)
    // Undo the paste, then the cut: the badge is back where it was.
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(700)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(900)
    assert(await page.evaluate(() => Boolean(document.querySelector('.features #badge'))), 'two Ctrl+Z did not put the badge back in its card')
    // Redo both, and reload: it stays moved.
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(700)
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(1500)
    await page.reload()
    await page.waitForSelector('.global-chef-button')
    await page.waitForTimeout(1500)
    const placed = await page.evaluate(() => ({ afterSubtitle: document.getElementById('subtitle').nextElementSibling?.id ?? null, inCard: Boolean(document.querySelector('.features #badge')) }))
    assert(placed.afterSubtitle === 'badge' && !placed.inCard, `after redo and a reload the badge is ${JSON.stringify(placed)}`)
    void moved
  } finally { await context.close() }
})


/** The page as a visitor gets it: only the two Froam files, no editor. */
async function servedAsVisitor() {
  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8')
    .replace('</head>', '<link rel="stylesheet" href="/froam/froam.generated.css"></head>')
    .replace('</body>', '<script src="/froam/froam.runtime.js" defer></script></body>')
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
    if (rel === 'index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return }
    const file = path.join(siteDir, rel)
    if (!file.startsWith(siteDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }
}

/** Select an element, open Effects, and press an effect's tile. */
async function addEffect(page, selector, label) {
  await select(page, selector)
  await page.locator('.froam-floating-bar [aria-label="Effects"]').click()
  await page.waitForSelector('.froam-floating-bar__pop--looks')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

test('effects reach visitors: chosen in Styles, saved, and alive on the live page — and still for reduce-motion', async () => {
  const { page, context } = await openEditor()
  try {
    await addEffect(page, '#stage', '3D tilt')
    await addEffect(page, '#plan-cell', 'Reveal')
    const inline = await page.evaluate(() => ({ tilt: document.getElementById('stage').style.getPropertyValue('--froam-fx-tilt'), reveal: document.getElementById('plan-cell').style.getPropertyValue('--froam-fx-reveal') }))
    assert(inline.tilt === 'on' && inline.reveal === 'on', `the effects weren't applied in the editor: ${JSON.stringify(inline)}`)
    const design = path.join(siteDir, 'froam', 'froam.design.json')
    const before = fs.statSync(design).mtimeMs
    await page.keyboard.press('Control+Shift+S')
    for (let i = 0; i < 60 && fs.statSync(design).mtimeMs === before; i += 1) await sleep(150)
    await sleep(500)
    assert(fs.readFileSync(path.join(siteDir, 'froam', 'froam.generated.css'), 'utf8').includes('--froam-fx-tilt: on'), 'the stylesheet does not carry the tilt')
    assert(fs.readFileSync(path.join(siteDir, 'froam', 'froam.runtime.js'), 'utf8').includes('__froamFx'), 'the runtime does not carry the effects engine')
  } finally { await context.close() }

  const site = await servedAsVisitor()
  try {
    const visitor = await browser.newContext({ viewport: { width: 1360, height: 860 } })
    const page = await visitor.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(site.url)
    await page.waitForTimeout(1200)
    // Below the fold, the table waits hidden for its moment...
    const hidden = await page.evaluate(() => Number(getComputedStyle(document.getElementById('plan-cell')).opacity))
    const why = await page.evaluate(() => { const el = document.getElementById('plan-cell'); return { top: Math.round(el.getBoundingClientRect().top), innerHeight, marked: el.hasAttribute('data-froam-fx'), engine: Boolean(window.__froamFx), value: getComputedStyle(el).getPropertyValue('--froam-fx-reveal'), anims: el.getAnimations().length } })
    assert(hidden < 0.2, `the table was showing before it was scrolled to (opacity ${hidden}; ${JSON.stringify(why)})`)
    // ...and arrives when it's scrolled into view.
    await page.evaluate(() => document.getElementById('plan-cell').scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(1400)
    const shown = await page.evaluate(() => Number(getComputedStyle(document.getElementById('plan-cell')).opacity))
    assert(shown > 0.95, `the table didn't reveal once scrolled to (opacity ${shown})`)
    // The stage leans toward the cursor.
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    const stage = await page.locator('#stage').boundingBox()
    await page.mouse.move(stage.x + stage.width * 0.9, stage.y + stage.height * 0.15, { steps: 6 })
    await page.waitForTimeout(700)
    const leaning = await page.evaluate(() => document.getElementById('stage').style.transform)
    assert(/rotateX\((?!0\.00deg)/.test(leaning), `the stage didn't tilt for a visitor: "${leaning}"`)
    assert(!errors.length, `the live page threw: ${errors.join(' | ')}`)
    await visitor.close()

    // Reduce motion: everything shown as it is, nothing moves.
    const still = await browser.newContext({ viewport: { width: 1360, height: 860 }, reducedMotion: 'reduce' })
    const calm = await still.newPage()
    await calm.goto(site.url)
    await calm.waitForTimeout(1200)
    const visible = await calm.evaluate(() => Number(getComputedStyle(document.getElementById('plan-cell')).opacity))
    assert(visible > 0.95, `with reduce motion the table was hidden (opacity ${visible})`)
    const calmStage = await calm.locator('#stage').boundingBox()
    await calm.mouse.move(calmStage.x + calmStage.width * 0.9, calmStage.y + calmStage.height * 0.15, { steps: 6 })
    await calm.waitForTimeout(500)
    const unmoved = await calm.evaluate(() => document.getElementById('stage').style.transform)
    assert(!/rotate/.test(unmoved), `with reduce motion the stage still tilted: "${unmoved}"`)
    await still.close()
  } finally { site.close() }
})


test('a restyle saves only the style: the words and the page’s own inline style stay the code’s to change', async () => {
  // A heading with an inline style of its own, as plenty of sites have.
  const index = path.join(siteDir, 'index.html')
  const original = fs.readFileSync(index, 'utf8')
  fs.writeFileSync(index, original.replace('<h3 id="feature-1-title">', '<h3 id="feature-1-title" style="letter-spacing: 1px">'))
  let edited = ''
  try {
    const { page, context } = await openEditor()
    try {
      await select(page, '#feature-1-title')
      await page.locator('button[aria-label="Bold"]').click()
      await page.waitForTimeout(400)
      edited = await page.evaluate(() => getComputedStyle(document.getElementById('feature-1-title')).fontWeight)
      // Something else selected, untouched, when Save is pressed: that alone must save nothing.
      await select(page, '.features li:nth-child(3) h3')
      const design = path.join(siteDir, 'froam', 'froam.design.json')
      // Earlier tests saved edits of their own here; this save may add only the heading's.
      const saved = () => (fs.existsSync(design) ? Object.entries(JSON.parse(fs.readFileSync(design, 'utf8')).routes?.['/'] ?? {}).flatMap(([size, store]) => Object.entries(store ?? {}).map(([where, draft]) => ({ key: `${size} ${where}`, draft }))) : [])
      const earlier = new Set(saved().map((entry) => entry.key))
      const before = fs.existsSync(design) ? fs.statSync(design).mtimeMs : 0
      await page.keyboard.press('Control+Shift+S')
      for (let i = 0; i < 60 && (fs.existsSync(design) ? fs.statSync(design).mtimeMs : 0) === before; i += 1) await sleep(150)
      await sleep(500)
      const added = saved().filter((entry) => !earlier.has(entry.key))
      assert(added.length === 1, `saving with an untouched element selected saved ${added.length} new edits: ${JSON.stringify(added.map((entry) => [entry.key, Object.keys(entry.draft)]))}`)
      const heading = added[0].draft
      assert(heading.styles?.fontWeight, `the bold wasn't saved: ${JSON.stringify(heading)}`)
      assert(heading.text === undefined, `the heading's unchanged words were saved as an edit: "${heading.text}"`)
      assert(!heading.styles.letterSpacing, `the page's own inline style was saved as an edit: ${heading.styles.letterSpacing}`)
    } finally { await context.close() }

    // The words and the inline style change in the code: a visitor sees the code's, and the bold.
    fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('>Live editing<', '>Live editing, from the code<').replace('letter-spacing: 1px', 'letter-spacing: 3px'))
    const site = await servedAsVisitor()
    try {
      const visitor = await browser.newContext({ viewport: { width: 1360, height: 860 } })
      const page = await visitor.newPage()
      await page.goto(site.url)
      await page.waitForTimeout(1200)
      const shown = await page.evaluate(() => { const el = document.getElementById('feature-1-title'); const cs = getComputedStyle(el); return { text: el.textContent.trim(), spacing: cs.letterSpacing, weight: cs.fontWeight } })
      assert(shown.text === 'Live editing, from the code', `Froam put the old words back over the code's: "${shown.text}"`)
      assert(shown.spacing === '3px', `Froam put the old inline style back over the code's: ${shown.spacing}`)
      assert(Number(shown.weight) >= 600 || Number(shown.weight) <= 400, `the restyle itself didn't reach the visitor: weight ${shown.weight}`)
      await visitor.close()
    } finally { site.close() }
  } finally { fs.writeFileSync(index, original) }
})

/* ─── run ─── */

if (!fs.existsSync(path.join(ROOT, 'dist', 'standalone', 'froam-editor.js'))) {
  console.log('e2e editing: dist/standalone is missing — run `npm run build` first')
  process.exit(1)
}
const browserPath = findBrowser()
if (!browserPath) {
  console.log('e2e editing: no Chrome or Chromium found — set FROAM_E2E_CHROME')
  process.exit(1)
}

const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-e2e-editing-'))
fs.cpSync(FIXTURE, siteDir, { recursive: true })
const port = await freePort()
url = `http://localhost:${port}/`
const bridge = spawn(process.execPath, [BIN, 'dev', '--serve', '.', '--port', String(port)], { cwd: siteDir, env: { ...process.env, FROAM_SHARE: 'off', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
let passed = 0
try {
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(url)).ok) break } catch { /* not yet */ } await sleep(150) }
  browser = await chromium.launch({ executablePath: browserPath, headless: !process.env.FROAM_E2E_HEADED })
  console.log('editing')
  for (const t of tests) {
    try {
      await t.fn()
      passed += 1
      console.log(`  ok  ${t.name}`)
    } catch (error) {
      console.log(`  FAIL ${t.name}\n       ${error.message}`)
    }
  }
} catch (error) {
  console.log(`e2e editing: setup failed — ${error.message}`)
} finally {
  await browser?.close().catch(() => {})
  bridge.kill()
  await sleep(300)
  try { fs.rmSync(siteDir, { recursive: true, force: true }) } catch { /* Windows may still hold a file */ }
}
console.log(`e2e editing: ${passed}/${tests.length} passed`)
process.exitCode = passed === tests.length ? 0 : 1
