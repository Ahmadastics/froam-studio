#!/usr/bin/env node
/**
 * End-to-end: the editor on a real page, driven by a real browser.
 *
 * Everything else in `npm test` runs without a DOM, so none of it can see
 * what a person sees: whether a click selects the thing under the pointer,
 * whether typing writes where you clicked, whether Save to Repo writes the
 * edit to disk and a reload shows it. This does.
 *
 * It copies test/e2e/site to a temp folder, serves it through the real CLI
 * (`froam dev --serve`, exactly as users run it — editor injected, bridge
 * writing to disk), and drives Chrome against it with playwright-core.
 *
 *   node scripts/test-e2e-editor.mjs            # headless
 *   FROAM_E2E_HEADED=1 node scripts/...         # watch it
 *   FROAM_E2E_CHROME=/path/to/chrome node ...   # pick the browser
 *
 * Requires `npm run build` first (it serves dist/standalone).
 */
import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { INJECTION_KEY, writeArtifacts } from '../lib/codegen.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = path.join(ROOT, 'test', 'e2e', 'site')
const APP_FIXTURE = path.join(ROOT, 'test', 'e2e', 'app')
const BIN = path.join(ROOT, 'bin', 'froam.mjs')

/* ─── harness ─── */

/**
 * DOM mutations on the page while nobody touches it. Drafts are painted from
 * a MutationObserver; a painter that reacts to its own writes repaints every
 * frame (~50 per 800 ms) — which also wipes any selection or caret in the
 * copy it rewrites. A settled page is silent.
 */
async function churnWhileIdle(page, ms = 800) {
  return page.evaluate((ms) => new Promise((resolve) => {
    let count = 0
    const observer = new MutationObserver((records) => { count += records.length })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    setTimeout(() => { observer.disconnect(); resolve(count) }, ms)
  }), ms)
}

/**
 * Save to Repo, then wait for the design file to actually be rewritten. It
 * exists from the start (the bridge scaffolds an empty one), so "exists" says
 * nothing about whether this save has landed.
 */
async function saveAndWait(page, designPath) {
  const stamp = () => (fs.existsSync(designPath) ? fs.statSync(designPath).mtimeMs : 0)
  const before = stamp()
  await page.keyboard.press('Control+Shift+S')
  const started = Date.now()
  while (stamp() === before && Date.now() - started < 10000) await new Promise((r) => setTimeout(r, 120))
  await new Promise((r) => setTimeout(r, 150))
}

/** Serves `dir` as a plain static site — production, no editor, no bridge. */
async function serveStatic(dir) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
    const file = path.join(dir, rel)
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(0, r))
  return { url: `http://localhost:${server.address().port}/`, close: () => server.close() }
}

/** A fixture as it ships: its own HTML plus the two tags Froam tells you to add. */
function productionHtml(fixture = FIXTURE) {
  return fs.readFileSync(path.join(fixture, 'index.html'), 'utf8')
    .replace('</head>', '  <link rel="stylesheet" href="/froam/froam.generated.css">\n  </head>')
    .replace('</body>', '  <script src="/froam/froam.runtime.js" defer></script>\n  </body>')
}

// Two sites: a static page (test/e2e/site) and an app with a #root and a
// dialog it mounts on <body>, the way React portals do (test/e2e/app).
const suites = { site: [], app: [], collab: [] }
const only = process.env.FROAM_E2E_ONLY ? new RegExp(process.env.FROAM_E2E_ONLY, 'i') : null
function test(name, fn) {
  suites.site.push({ name, fn })
}
function appTest(name, fn) {
  suites.app.push({ name, fn })
}
function collabTest(name, fn) {
  suites.collab.push({ name, fn })
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function findBrowser() {
  if (process.env.FROAM_E2E_CHROME) return process.env.FROAM_E2E_CHROME
  try {
    const bundled = chromium.executablePath()
    if (bundled && fs.existsSync(bundled)) return bundled
  } catch { /* no bundled browser installed */ }
  const home = os.homedir()
  const caches = [
    path.join(home, 'AppData', 'Local', 'ms-playwright'),
    path.join(home, '.cache', 'ms-playwright'),
    path.join(home, 'Library', 'Caches', 'ms-playwright'),
  ]
  for (const cache of caches) {
    if (!fs.existsSync(cache)) continue
    const dirs = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
    for (const dir of dirs) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const candidate = path.join(cache, dir, rel)
        if (fs.existsSync(candidate)) return candidate
      }
    }
  }
  const system = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  return system.find((p) => fs.existsSync(p)) ?? null
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

async function waitForHttp(url, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`bridge did not come up at ${url}`)
}

/* ─── page helpers ─── */

async function openEditor(page, url) {
  await page.goto(url)
  await page.waitForSelector('.global-chef-button', { timeout: 20000 })
  await page.keyboard.press('Control+.')
  await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 20000 })
  // Let the offset + click-through marking settle.
  await page.waitForTimeout(600)
}

/** Real mouse click at a point inside an element (fractions of its box). */
async function clickOn(page, selector, fx = 0.5, fy = 0.5, options = {}) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), selector)
  await page.waitForTimeout(80)
  const box = await page.locator(selector).first().boundingBox()
  assert(box, `${selector} is not on the page`)
  const x = box.x + box.width * fx
  const y = box.y + box.height * fy
  if (options.double) await page.mouse.dblclick(x, y)
  else await page.mouse.click(x, y)
  await page.waitForTimeout(options.settle ?? 180)
  return { x, y }
}

const selectedId = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-froam-root] [data-chef-selected="true"], #root [data-chef-selected="true"]') ?? document.querySelector('[data-chef-selected="true"]')
  return el ? el.id || el.tagName.toLowerCase() : null
})

async function deselect(page) {
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(80)
}

const isWriting = (page, selector) => page.evaluate((s) => document.querySelector(s)?.isContentEditable ?? false, selector)
const textOf = (page, selector) => page.evaluate((s) => document.querySelector(s)?.innerText ?? '', selector)

/* ─── tests ─── */

test('the editor mounts on a plain HTML site and opens', async ({ page }) => {
  assert(await page.locator('#froam-editor-portal .froam-chrome').isVisible(), 'studio chrome not visible')
})

test("the site's sticky header sits below Froam's toolbar and is clickable", async ({ page }) => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(150)
  const geo = await page.evaluate(() => ({
    chrome: document.querySelector('#froam-editor-portal .froam-chrome').getBoundingClientRect().bottom,
    header: document.getElementById('site-header').getBoundingClientRect().top,
  }))
  assert(geo.header >= geo.chrome - 1, `header top ${geo.header} is under the toolbar (bottom ${geo.chrome})`)
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
  await page.waitForTimeout(150)
  const stuck = await page.evaluate(() => document.getElementById('site-header').getBoundingClientRect().top)
  assert(stuck >= geo.chrome - 1, `scrolled, the sticky header (${stuck}) slid under the toolbar`)
  await deselect(page)
  await clickOn(page, '#logo-mark')
  assert((await selectedId(page)) === 'logo-mark', `logo click selected ${await selectedId(page)}`)
})

test('every visible element selects what is under the pointer', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const root = document.querySelector('[data-froam-root]') ?? document.body
    const isUi = (el) => !!el.closest('[data-chef-editor-root="true"]')
    const rollUp = (hit) => {
      let el = hit
      while (el && el.namespaceURI === 'http://www.w3.org/2000/svg' && el.tagName.toLowerCase() !== 'svg') el = el.parentElement
      return el
    }
    const topAt = (x, y) => {
      root.setAttribute('data-froam-hittest', 'true')
      const hits = document.elementsFromPoint(x, y)
      root.removeAttribute('data-froam-hittest')
      return hits.find((e) => !isUi(e))
    }
    const ambient = (el) => {
      const cs = getComputedStyle(el)
      if (cs.pointerEvents !== 'none' || (el.innerText || '').trim()) return false
      const r = el.getBoundingClientRect()
      return r.width * r.height >= innerWidth * innerHeight * 0.35
    }
    const describe = (el) => el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` : 'nothing'
    let tested = 0
    const failures = []
    for (const el of [...root.querySelectorAll('*')]) {
      if (isUi(el)) continue
      const cs = getComputedStyle(el)
      const r0 = el.getBoundingClientRect()
      if (r0.width < 2 || r0.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
      await sleep(10)
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
      const raw = document.elementFromPoint(x, y)
      if (!raw || isUi(raw)) continue
      const hit = topAt(x, y)
      if (!hit || !(el === hit || el.contains(hit))) continue
      const expected = rollUp(hit)
      if (ambient(expected)) continue
      // Start from nothing selected, so a click can't read as "click selected copy again".
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(30)
      raw.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, detail: 1, view: window }))
      await sleep(70)
      tested += 1
      const selected = document.querySelector('[data-chef-selected="true"]')
      if (selected !== expected) failures.push(`${describe(expected)} → ${describe(selected)}`)
    }
    return { tested, failures }
  })
  assert(result.tested > 30, `only ${result.tested} elements were testable`)
  assert(result.failures.length === 0, `${result.failures.length}/${result.tested} missed: ${result.failures.slice(0, 8).join(', ')}`)
})

test('an SVG icon inside a link selects the icon and does not navigate', async ({ page, context }) => {
  await deselect(page)
  const before = page.url()
  const tabs = context.pages().length
  await clickOn(page, '#share-icon')
  assert((await selectedId(page)) === 'share-icon', `selected ${await selectedId(page)}`)
  await clickOn(page, '#nav-pricing') // target=_blank link
  await page.waitForTimeout(300)
  assert(page.url() === before, `navigated to ${page.url()}`)
  assert(context.pages().length === tabs, 'a link opened a new tab')
})

test('a click-through annotation is selectable; a page-wide overlay yields to content', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#annotation')
  assert((await selectedId(page)) === 'annotation', `annotation click selected ${await selectedId(page)}`)
  await deselect(page)
  await clickOn(page, '#stage', 0.5, 0.55)
  assert((await selectedId(page)) === 'stage', `stage click selected ${await selectedId(page)} (the ambient overlay should yield)`)
})

test('a disabled button is selectable', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#disabled-btn')
  assert((await selectedId(page)) === 'disabled-btn', `selected ${await selectedId(page)}`)
})

test('form controls are edited, not used: no focus, no dropdown, no toggling', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#plan')
  assert((await selectedId(page)) === 'plan', `select click selected ${await selectedId(page)}`)
  assert(!(await page.evaluate(() => document.activeElement?.id === 'plan')), 'the <select> took focus')
  await deselect(page)
  await clickOn(page, '#email')
  assert(!(await page.evaluate(() => document.activeElement?.id === 'email')), 'the input took focus')
  await deselect(page)
  await clickOn(page, '#terms')
  assert(!(await page.evaluate(() => document.getElementById('terms').checked)), 'the checkbox toggled')
})

test('inline pieces of copy select exactly: gradient word, <strong>, <small>', async ({ page }) => {
  for (const id of ['gradient-word', 'strong-word', 'small-word']) {
    await deselect(page)
    await clickOn(page, `#${id}`)
    assert((await selectedId(page)) === id, `#${id} click selected ${await selectedId(page)}`)
  }
})

test('typing on selected copy writes where you clicked', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#subtitle', 0.002, 0.5)
  const chip = await page.locator('.froam-selection-handoff').innerText().catch(() => '')
  assert(/type to edit/i.test(chip), `chip read "${chip}"`)
  await page.keyboard.type('Hey ', { delay: 40 })
  await page.waitForTimeout(120)
  assert(await isWriting(page, '#subtitle'), 'typing did not start writing')
  const text = await textOf(page, '#subtitle')
  assert(text.startsWith('Hey Extraordinary'), `text is "${text.slice(0, 30)}"`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  assert(!(await isWriting(page, '#subtitle')), 'Escape did not finish writing')
})

test('a lone shortcut letter on selected copy is still the shortcut', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#feature-1-title')
  await page.keyboard.press('h')
  await page.waitForTimeout(500)
  assert(!(await isWriting(page, '#feature-1-title')), 'a lone "h" started writing')
  assert(await page.locator('.froam-tb__tool[aria-label="Hand"][aria-pressed="true"]').count() === 1, 'the Hand tool is not active')
  await page.keyboard.press('v')
  await page.waitForTimeout(200)
})

test('second click writes at the caret; Enter finishes a heading for good', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#headline', 0.02, 0.12, { settle: 700 })
  await clickOn(page, '#headline', 0.02, 0.12)
  assert(await isWriting(page, '#headline'), 'second click did not start writing')
  await page.keyboard.type('X', { delay: 30 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  assert(!(await isWriting(page, '#headline')), 'Enter did not finish the heading (or writing restarted)')
  assert((await textOf(page, '#headline')).startsWith('X'), 'the typed X is missing')
  assert(!(await textOf(page, '#headline')).includes('\n'), 'Enter inserted a line break')
})

test('double-click writes with the word under the pointer selected', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#subtitle', 0.8, 0.5, { double: true, settle: 300 })
  const selectedText = await page.evaluate(() => String(window.getSelection()).trim())
  assert(selectedText.length > 0 && !selectedText.includes(' '), `selection is "${selectedText}"`)
  assert(await isWriting(page, '#subtitle'), 'double-click did not start writing')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
})

test('pasting onto selected copy writes plain text, never markup', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#plan-cell', 0.95, 0.5)
  await page.evaluate(() => {
    const data = new DataTransfer()
    data.setData('text/plain', ' Plus')
    data.setData('text/html', '<b style="color:red">Plus</b>')
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(150)
  assert((await textOf(page, '#plan-cell')).includes('Plus'), 'paste did not write')
  assert(!(await page.evaluate(() => !!document.querySelector('#plan-cell b'))), 'pasted markup got in')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
})

test('a modal the page adds after load (outside its root) is editable', async ({ page }) => {
  await page.waitForSelector('#late-modal', { timeout: 5000 })
  await page.waitForTimeout(700) // click-through marking + offset settle after the insert
  await deselect(page)
  await clickOn(page, '#late-modal-title', 0.98, 0.5)
  assert((await selectedId(page)) === 'late-modal-title', `modal title click selected ${await selectedId(page)}`)
  await page.keyboard.type(' now', { delay: 30 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  assert((await textOf(page, '#late-modal-title')).includes('now'), 'typing into the modal title did not write')
})

test('arrow keys nudge the selected element (a style edit)', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#cta')
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(200)
  const left = await page.evaluate(() => getComputedStyle(document.getElementById('cta')).left)
  assert(left === '5px', `left is ${left}`)
})

test('::before content is editable from the design panel', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#badge', 0.85, 0.5)
  assert((await selectedId(page)) === 'badge', `badge click selected ${await selectedId(page)}`)
  await page.click('[aria-label="Show design controls panel"]')
  const section = page.locator('button.froam-dp__section-header', { hasText: 'Before & after' })
  await section.waitFor({ timeout: 5000 })
  if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click()
  const input = page.locator('input[aria-label="::before content"]')
  await input.waitFor({ timeout: 5000 })
  const shown = await input.inputValue()
  assert(shown === '★ ', `the field shows the page's own ::before as "${shown}"`)
  await input.fill('NEW ')
  await page.waitForTimeout(300)
  const content = await page.evaluate(() => getComputedStyle(document.getElementById('badge'), '::before').content)
  await page.click('[aria-label="Hide design controls panel"]')
  await page.waitForTimeout(200)
  assert(content === '"NEW "', `::before content is ${content}`)
})

test('selection handles stay on the element when the page scrolls', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#cta')
  const offset = () => page.evaluate(() => {
    const element = document.getElementById('cta').getBoundingClientRect()
    const handles = [...document.querySelectorAll('#froam-editor-portal [class*="handle"]')].map((h) => h.getBoundingClientRect()).filter((r) => r.width > 0)
    return handles.length ? Math.round(Math.min(...handles.map((r) => r.top)) - element.top) : null
  })
  const before = await offset()
  await page.mouse.move(700, 600)
  await page.mouse.wheel(0, 240)
  await page.waitForTimeout(400)
  const after = await offset()
  await page.mouse.wheel(0, -240)
  await page.waitForTimeout(300)
  assert(before !== null, 'no resize handles on the selection')
  assert(Math.abs(after - before) <= 2, `handles drifted ${after - before}px from the element on scroll`)
})

test('opening a side panel moves the page out from under it', async ({ page }) => {
  const leftOf = (selector) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().left, selector)
  const logoBefore = await leftOf('#logo')
  await page.click('[aria-label="Show pages and layers panel"]')
  await page.waitForTimeout(700)
  const seen = await page.evaluate(() => {
    const panel = document.querySelector('#froam-editor-portal .froam-figma-left')?.getBoundingClientRect()
    const logo = document.getElementById('logo').getBoundingClientRect()
    return { panelRight: panel ? Math.round(panel.right) : 0, logoLeft: Math.round(logo.left) }
  })
  await page.click('[aria-label="Hide pages and layers panel"]')
  await page.waitForTimeout(500)
  const logoAfter = await leftOf('#logo')
  assert(seen.panelRight > 100, 'the pages panel did not open')
  assert(seen.logoLeft >= seen.panelRight, `the logo (x=${seen.logoLeft}) is under the panel (right edge ${seen.panelRight})`)
  assert(Math.abs(logoAfter - logoBefore) <= 1, `closing the panel left the page shifted (${logoBefore} → ${logoAfter})`)
})

test('the Library previews real patterns, drawn in the site\'s own style', async ({ page }) => {
  await deselect(page)
  await page.getByRole('button', { name: /^Library$/ }).first().click()
  await page.locator('.fsp-pattern').first().waitFor({ timeout: 5000 })
  await page.waitForTimeout(600)
  const seen = await page.evaluate(() => ({
    chip: document.querySelector('.fsp-theme-chip')?.textContent ?? '',
    cards: document.querySelectorAll('.fsp-pattern').length,
    firstPreview: document.querySelector('.fsp-live-preview__stage')?.textContent ?? '',
    previewHeight: document.querySelector('.fsp-live-preview')?.getBoundingClientRect().height ?? 0,
    innerTabs: document.querySelectorAll('.fsp-tabs').length,
  }))
  assert(seen.cards >= 30, `${seen.cards} pattern cards`)
  assert(seen.chip.includes('Solara'), `theme chip reads "${seen.chip}"`)
  assert(seen.firstPreview.includes('Solara'), 'the navbar preview does not carry the site\'s brand name')
  assert(seen.previewHeight >= 40, `preview is ${seen.previewHeight}px tall`)
  assert(seen.innerTabs === 0, 'the Library still shows a second row of planner tabs')
})

test('dragging a pattern onto the page drops it between sections, styled like the site', async ({ page }) => {
  const card = page.locator('.fsp-pattern', { hasText: 'Split media hero' })
  await card.scrollIntoViewIfNeeded()
  const features = await page.locator('#features').boundingBox()
  await card.dragTo(page.locator('#features'), { targetPosition: { x: features.width * 0.6, y: 10 } })
  await page.waitForTimeout(700)
  const seen = await page.evaluate(() => {
    const inserted = document.querySelector('[data-froam-component-id="hero-02"]')
    return inserted && {
      before: inserted.previousElementSibling?.className ?? '',
      after: inserted.nextElementSibling?.id ?? '',
      accent: getComputedStyle(inserted).getPropertyValue('--fx-accent').trim(),
      editable: inserted.querySelectorAll('[contenteditable="true"]').length,
      indicatorGone: !document.getElementById('froam-drop-indicator'),
    }
  })
  await page.click('[aria-label="Hide pages and layers panel"]')
  await page.waitForTimeout(200)
  assert(seen, 'no pattern was inserted')
  assert(seen.before === 'hero' && seen.after === 'features', `inserted between "${seen.before}" and "${seen.after}"`)
  assert(seen.accent === '#2563eb', `pattern accent is ${seen.accent}, not the site's blue`)
  assert(seen.editable === 0, 'the inserted pattern is contenteditable')
  assert(seen.indicatorGone, 'the drop line stayed on the page')
})

test('an edited page is quiet: drafts are painted once, not every frame', async ({ page }) => {
  await deselect(page)
  await page.mouse.move(4, 890)
  await page.waitForTimeout(300)
  const churn = await churnWhileIdle(page)
  assert(churn <= 2, `${churn} DOM mutations in 800 ms with nobody touching the page`)
})

test('Save to Repo writes the edits to disk, and a reload shows them', async ({ page, siteDir, url, context }) => {
  await deselect(page)
  const designPath = path.join(siteDir, 'froam', 'froam.design.json')
  await saveAndWait(page, designPath)
  assert(fs.existsSync(designPath), 'froam/froam.design.json was not written')
  const design = fs.readFileSync(designPath, 'utf8')
  // Copy edits whose words appear once in the source are written into it —
  // the design keeps only what the source can't say (styles, split copy).
  const source = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8')
  assert(source.includes('Hey Extraordinary'), 'the typed subtitle was not written into index.html')
  assert(!design.includes('Hey Extraordinary'), 'the subtitle is still carried as a Froam edit after being written to source')
  assert(source.includes('Get 10% off now'), 'the late modal copy (built by a script) was not written into index.html')
  assert(fs.existsSync(path.join(siteDir, 'froam', 'froam.generated.css')), 'froam.generated.css was not written')
  assert(fs.existsSync(path.join(siteDir, 'froam', 'froam.runtime.js')), 'froam.runtime.js was not written')

  // A fresh visitor — no local drafts — sees the saved copy.
  const fresh = await context.browser().newContext({ viewport: { width: 1440, height: 900 } })
  const visitor = await fresh.newPage()
  await visitor.goto(url)
  await visitor.waitForFunction(() => document.getElementById('subtitle')?.innerText.startsWith('Hey '), null, { timeout: 10000 }).catch(() => {})
  const seen = await visitor.evaluate(() => document.getElementById('subtitle')?.innerText ?? '')
  await fresh.close()
  assert(seen.startsWith('Hey Extraordinary'), `after reload a visitor sees "${seen.slice(0, 30)}"`)
})

test('production (no editor, just the generated CSS + runtime) shows the same edits', async ({ siteDir, context }) => {
  const design = JSON.parse(fs.readFileSync(path.join(siteDir, 'froam', 'froam.design.json'), 'utf8'))
  assert(design.rootScope === 'page', `a fresh design should edit the whole page (rootScope is ${design.rootScope})`)
  // The site as it ships: original HTML + the two tags Froam tells you to add.
  const prodDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-e2e-prod-'))
  fs.cpSync(path.join(siteDir, 'froam'), path.join(prodDir, 'froam'), { recursive: true })
  // The site as saved: its (now edited) source HTML plus Froam's two tags.
  fs.writeFileSync(path.join(prodDir, 'index.html'), productionHtml(siteDir))
  const server = await serveStatic(prodDir)
  const visitorContext = await context.browser().newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const visitor = await visitorContext.newPage()
    await visitor.goto(server.url)
    await visitor.waitForSelector('#late-modal', { timeout: 5000 })
    await visitor.waitForTimeout(1200)
    const seen = await visitor.evaluate(() => ({
      editorLoaded: !!document.getElementById('froam-editor-portal') || !!document.querySelector('.global-chef-button'),
      subtitle: document.getElementById('subtitle').innerText,
      header: document.getElementById('headline').innerText,
      modal: document.getElementById('late-modal-title')?.innerText ?? '',
      ctaLeft: getComputedStyle(document.getElementById('cta')).left,
      badgeBefore: getComputedStyle(document.getElementById('badge'), '::before').content,
      pattern: (() => {
        const inserted = document.querySelector('[data-froam-component-id="hero-02"]')
        return inserted && {
          accent: getComputedStyle(inserted).getPropertyValue('--fx-accent').trim(),
          editable: document.querySelectorAll('[contenteditable]').length,
        }
      })(),
    }))
    assert(!seen.editorLoaded, 'the production page loaded the editor')
    assert(seen.subtitle.startsWith('Hey Extraordinary'), `production subtitle: "${seen.subtitle.slice(0, 30)}"`)
    assert(seen.header.startsWith('X'), `production headline: "${seen.header.slice(0, 20)}"`)
    assert(seen.ctaLeft === '5px', `production CTA nudge: left is ${seen.ctaLeft}`)
    assert(seen.badgeBefore === '"NEW "', `production badge ::before: ${seen.badgeBefore}`)
    assert(seen.pattern, 'the Library pattern did not ship to production')
    assert(seen.pattern.accent === '#2563eb', `production pattern accent: ${seen.pattern.accent}`)
    assert(seen.pattern.editable === 0, 'production page has contenteditable content')
    assert(seen.modal.includes('now'), `production late modal title: "${seen.modal}"`)
    const churn = await churnWhileIdle(visitor)
    assert(churn <= 2, `production page: ${churn} DOM mutations in 800 ms with nobody touching it`)
  } finally {
    await visitorContext.close()
    server.close()
    fs.rmSync(prodDir, { recursive: true, force: true })
  }
})

test('production paints an added block and whitespace-edged copy once, not every frame', async ({ context }) => {
  // The two shapes a plain equality check misses: an injected block (the
  // runtime removes and re-inserts it, so its own writes looked like page
  // changes) and copy the browser normalises on read ("About us " reads
  // back as "About us", so it never compared equal).
  const prodDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-e2e-prod-'))
  fs.mkdirSync(path.join(prodDir, 'froam'))
  writeArtifacts(path.join(prodDir, 'froam'), {
    version: 3,
    rootScope: 'page',
    routes: {
      '/': {
        desktop: {
          'header:1/nav:1/a:1': { text: 'About us ' },
          [`${INJECTION_KEY}:banner`]: { text: JSON.stringify({ html: '<div id="injected-banner">Free shipping this week</div>', parentPath: '__froam_root__', order: 0 }) },
        },
      },
    },
  })
  fs.writeFileSync(path.join(prodDir, 'index.html'), productionHtml())
  const server = await serveStatic(prodDir)
  const visitorContext = await context.browser().newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const visitor = await visitorContext.newPage()
    await visitor.goto(server.url)
    await visitor.waitForSelector('#injected-banner', { timeout: 5000 })
    await visitor.waitForSelector('#late-modal', { timeout: 5000 })
    await visitor.waitForTimeout(400)
    await visitor.evaluate(() => { window.__banner = document.getElementById('injected-banner') })
    const churn = await churnWhileIdle(visitor)
    const seen = await visitor.evaluate(() => ({
      about: document.getElementById('nav-about')?.innerText ?? '',
      sameBanner: window.__banner === document.getElementById('injected-banner'),
      banners: document.querySelectorAll('#injected-banner').length,
    }))
    assert(seen.about.startsWith('About us'), `nav link reads "${seen.about}"`)
    assert(seen.banners === 1, `${seen.banners} copies of the injected block`)
    assert(seen.sameBanner, 'the injected block was torn down and rebuilt while idle')
    assert(churn <= 2, `${churn} DOM mutations in 800 ms with nobody touching the page`)
  } finally {
    await visitorContext.close()
    server.close()
    fs.rmSync(prodDir, { recursive: true, force: true })
  }
})

/* ─── an app: #root, and a dialog on <body> ─── */

appTest('an app root keeps its own root: the page is not wrapped', async ({ page }) => {
  const state = await page.evaluate(() => ({
    rootParent: document.getElementById('root')?.parentElement?.tagName,
    wrappers: document.querySelectorAll('[data-froam-root]').length,
  }))
  assert(state.rootParent === 'BODY', `#root was moved into ${state.rootParent}`)
  assert(state.wrappers === 0, 'the app page was wrapped in a page-scope root')
})

appTest('a dialog the app mounts on <body> is selectable, and stays where the app put it', async ({ page }) => {
  await page.waitForSelector('#dialog-title', { timeout: 5000 })
  await page.waitForTimeout(700)
  await deselect(page)
  await clickOn(page, '#dialog-title', 0.5, 0.5)
  assert((await selectedId(page)) === 'dialog-title', `dialog title click selected ${await selectedId(page)}`)
  const parent = await page.evaluate(() => document.getElementById('dialog')?.parentElement?.tagName)
  assert(parent === 'BODY', `the dialog was moved into ${parent}`)
})

appTest('writing and nudging in the dialog; the edits come back when the app reopens it', async ({ page }) => {
  await deselect(page)
  await clickOn(page, '#dialog-title', 0.98, 0.5)
  await page.keyboard.type(' today', { delay: 30 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  assert((await textOf(page, '#dialog-title')).endsWith('today'), 'typing into the dialog title did not write')
  await deselect(page)
  await clickOn(page, '#dialog-text')
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(200)
  // The app closes the dialog the way React does (body.removeChild — throws if
  // Froam had moved it), then opens a fresh one: the edits must follow.
  const reopened = await page.evaluate(() => {
    try { window.closeDialog(); window.openDialog(); return 'ok' } catch (error) { return String(error) }
  })
  assert(reopened === 'ok', `the app could not close its own dialog: ${reopened}`)
  await page.waitForTimeout(300)
  const seen = await page.evaluate(() => ({
    title: document.getElementById('dialog-title')?.innerText ?? '',
    left: getComputedStyle(document.getElementById('dialog-text')).left,
  }))
  assert(seen.title.endsWith('today'), `reopened dialog title reads "${seen.title}"`)
  assert(seen.left === '3px', `reopened dialog text nudge: left is ${seen.left}`)
})

appTest('Save writes @body paths, and production paints them whenever the dialog opens', async ({ page, siteDir, context }) => {
  await deselect(page)
  const designPath = path.join(siteDir, 'froam', 'froam.design.json')
  await saveAndWait(page, designPath)
  assert(fs.existsSync(designPath), 'froam/froam.design.json was not written')
  const design = JSON.parse(fs.readFileSync(designPath, 'utf8'))
  assert(design.rootScope === undefined, `an app keeps the auto root (rootScope is ${design.rootScope})`)
  const keys = Object.keys(design.routes?.['/']?.desktop ?? {})
  assert(keys.some((key) => key.startsWith('@body/')), `no @body path saved (keys: ${keys.join(', ')})`)
  assert(fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8').includes('Invite your team today'), 'the dialog copy was not written into the app source')

  const prodDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-e2e-app-prod-'))
  fs.cpSync(path.join(siteDir, 'froam'), path.join(prodDir, 'froam'), { recursive: true })
  fs.writeFileSync(path.join(prodDir, 'index.html'), productionHtml(siteDir))
  const server = await serveStatic(prodDir)
  const visitorContext = await context.browser().newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const visitor = await visitorContext.newPage()
    await visitor.goto(server.url)
    await visitor.waitForSelector('#dialog-title', { timeout: 5000 })
    await visitor.waitForTimeout(400)
    const read = () => visitor.evaluate(() => ({
      title: document.getElementById('dialog-title')?.innerText ?? '',
      left: getComputedStyle(document.getElementById('dialog-text')).left,
    }))
    let seen = await read()
    assert(seen.title.endsWith('today'), `production dialog title: "${seen.title}"`)
    assert(seen.left === '3px', `production dialog nudge: left is ${seen.left}`)
    const reopened = await visitor.evaluate(() => { try { window.closeDialog(); window.openDialog(); return 'ok' } catch (error) { return String(error) } })
    assert(reopened === 'ok', `production: the app could not close its dialog: ${reopened}`)
    await visitor.waitForTimeout(300)
    seen = await read()
    assert(seen.title.endsWith('today'), `production, reopened dialog title: "${seen.title}"`)
    const churn = await churnWhileIdle(visitor)
    assert(churn <= 2, `production app page: ${churn} DOM mutations in 800 ms with nobody touching it`)
  } finally {
    await visitorContext.close()
    server.close()
    fs.rmSync(prodDir, { recursive: true, force: true })
  }
})

appTest('the editor opens on the first Ctrl+. straight after load, and stays open', async ({ page, url }) => {
  await page.goto(url)
  await page.waitForSelector('.global-chef-button', { timeout: 20000 })
  await page.keyboard.press('Control+.')
  await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 4000 })
  await page.waitForTimeout(600)
  const open = await page.evaluate(() => {
    const chrome = document.querySelector('#froam-editor-portal .froam-chrome')
    return !!chrome && chrome.getBoundingClientRect().height > 0
  })
  assert(open, 'the editor closed itself right after opening')
})

/* ─── collaboration: invite, suggest, approve & publish ─── */

const collab = { contributor: null, contributorContext: null, link: null }

async function openShare(page) {
  if (!(await page.locator('.froam-collab__panel').count())) await page.click('.froam-collab__trigger')
  await page.locator('.froam-collab__panel').waitFor({ timeout: 5000 })
}
async function closeShare(page) {
  if (await page.locator('.froam-collab__panel').count()) await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
}

collabTest('the owner creates invite links from Share, one per role', async ({ page, url }) => {
  await openShare(page)
  await page.click('text=Create invite links')
  await page.locator('.froam-collab__invite').first().waitFor({ timeout: 8000 })
  const enabled = await page.locator('.froam-collab__copy:not([disabled])').count()
  const owned = await page.evaluate(() => JSON.parse(localStorage.getItem('froam-room-owner:v1') || 'null'))
  await closeShare(page)
  assert(enabled === 4, `${enabled} invite links can be copied`)
  assert(owned?.invites?.contributor, 'no "Can suggest changes" invite was minted')
  collab.link = `${url}?froam-room=${owned.roomId}&froam-token=${owned.invites.contributor}`
})

/** A 1×1 PNG: enough for the join card to crop, shrink and show as a face. */
const TINY_PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

collabTest('a contributor joins by link, says their name, and edits privately', async ({ page, context }) => {
  collab.contributorContext = await context.browser().newContext({ viewport: { width: 1440, height: 900 } })
  const maya = await collab.contributorContext.newPage()
  collab.contributor = maya
  await maya.goto(collab.link)
  await maya.waitForSelector('.global-chef-button', { timeout: 20000 })
  await maya.waitForTimeout(400)
  if (!(await maya.locator('#froam-editor-portal .froam-chrome').count())) await maya.keyboard.press('Control+.')
  await maya.waitForSelector('input[aria-label="Your name"]', { timeout: 10000 })
  await maya.fill('input[aria-label="Your name"]', 'Maya')
  await maya.fill('input[aria-label="What you do"]', 'Marketing')
  await maya.setInputFiles('.froam-collab__join input[type="file"]', { name: 'maya.png', mimeType: 'image/png', buffer: TINY_PHOTO })
  await maya.locator('.froam-collab__join .froam-collab__photo img').waitFor({ timeout: 5000 })
  await maya.click('button:has-text("Join")')
  await maya.waitForSelector('.froam-collab__trigger:has-text("Submit")', { timeout: 8000 })
  await maya.waitForTimeout(600)
  const banner = await maya.locator('text=sent this to review').count()
  assert(banner === 0, 'a contributor was shown the client review banner')
  const box = await maya.locator('#subtitle').boundingBox()
  await maya.mouse.click(box.x + 2, box.y + box.height / 2)
  await maya.waitForTimeout(250)
  await maya.keyboard.type('Spring deals. ', { delay: 20 })
  await maya.mouse.click(700, 880)
  await maya.waitForTimeout(2500)
  const onOwnersPage = await page.evaluate(() => document.getElementById('subtitle').innerText)
  assert(!onOwnersPage.includes('Spring deals'), 'the contributor\'s edit reached the owner\'s page before approval')
})

collabTest('the contributor submits; the owner sees what changed, previews it, and approves', async ({ page, siteDir }) => {
  const maya = collab.contributor
  await openShare(maya)
  const listed = await maya.locator('.froam-collab__changes li').count()
  assert(listed === 1, `the contributor sees ${listed} changes`)
  await maya.fill('input[aria-label="Title for your changes"]', 'Spring sale copy')
  await maya.fill('textarea[aria-label="Note for the owner"]', 'For Monday')
  await maya.click('text=Submit for approval')
  await maya.locator('.froam-collab__request.is-pending').waitFor({ timeout: 8000 })
  await closeShare(maya)

  await page.locator('.froam-collab__trigger .froam-collab__badge').waitFor({ timeout: 12000 })
  await openShare(page)
  const request = page.locator('.froam-collab__request.is-pending')
  await request.waitFor({ timeout: 5000 })
  const text = await request.innerText()
  assert(text.includes('Maya') && text.includes('Marketing') && text.includes('For Monday'), `request reads: ${text.slice(0, 120)}`)
  assert(await request.locator('.froam-collab__who img').count() === 1, 'the request does not show the sender\'s photo')
  assert(await request.locator('del').count() === 1 && await request.locator('ins').count() === 1, 'no before → after shown')
  await request.locator('button:has-text("Preview")').click()
  await page.waitForTimeout(400)
  const previewed = await page.evaluate(() => document.getElementById('subtitle').innerText)
  assert(previewed.startsWith('Spring deals.'), `preview shows "${previewed.slice(0, 30)}"`)
  await request.locator('button:has-text("Approve & publish")').click()
  await page.locator('.froam-collab__request.is-approved').waitFor({ timeout: 8000 })
  await closeShare(page)
  const source = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8')
  assert(source.includes('Spring deals. Extraordinary places.'), 'approved copy was not written into index.html')
})

collabTest('the contributor sees it approved, and their change list is clear', async () => {
  const maya = collab.contributor
  await maya.waitForTimeout(5500)
  await openShare(maya)
  await maya.locator('.froam-collab__request.is-approved').waitFor({ timeout: 8000 })
  const remaining = await maya.locator('.froam-collab__changes li').count()
  await closeShare(maya)
  assert(remaining === 0, `${remaining} changes still listed after approval`)
})

collabTest('a request carries the sender\'s profile, one click away', async ({ page }) => {
  await openShare(page)
  await page.click('.froam-collab__tabs button:has-text("Requests")')
  await page.locator('.froam-collab__request .froam-collab__who').first().click()
  const profile = page.locator('.froam-collab__profile')
  await profile.waitFor({ timeout: 5000 })
  const text = await profile.innerText()
  await profile.locator('button:has-text("Message")').click()
  const draft = await page.inputValue('textarea[aria-label="Message the room"]')
  await closeShare(page)
  assert(text.includes('Maya') && text.includes('Marketing') && text.includes('Suggesting'), `profile reads: ${text.slice(0, 160)}`)
  assert(/Changes sent\s+1 · 1 approved/.test(text), `profile counts: ${text.slice(0, 200)}`)
  assert(draft.startsWith('@Maya'), `Message prefilled "${draft}"`)
})

collabTest('people talk in Share → Chat: a peek and a badge for whoever is not looking', async ({ page }) => {
  const maya = collab.contributor
  await openShare(maya)
  await maya.click('.froam-collab__tabs button:has-text("Chat")')
  await maya.fill('textarea[aria-label="Message the room"]', 'Is the headline OK?')
  await maya.keyboard.press('Enter')
  await maya.locator('.froam-chat__msg.is-mine:not(.is-sending):not(.is-failed)').waitFor({ timeout: 8000 })
  await closeShare(maya)

  const peek = page.locator('.froam-collab__peek')
  await peek.waitFor({ timeout: 12000 })
  const peeked = await peek.innerText()
  const unread = await page.locator('.froam-collab__trigger .froam-collab__badge.is-chat').innerText()
  await peek.click()
  await page.locator('.froam-chat__msg').first().waitFor({ timeout: 5000 })
  const thread = await page.locator('.froam-chat__list').innerText()
  await page.waitForTimeout(300)
  const badgeAfter = await page.locator('.froam-collab__trigger .froam-collab__badge.is-chat').count()

  // Replying about a request threads the message to it.
  await page.click('.froam-collab__tabs button:has-text("Requests")')
  await page.locator('.froam-collab__request.is-approved button:has-text("Discuss")').click()
  await page.locator('.froam-chat__context').waitFor({ timeout: 3000 })
  await page.fill('textarea[aria-label="Message the room"]', 'Looks great, it is live')
  await page.keyboard.press('Enter')
  await page.locator('.froam-chat__msg.is-mine .froam-chat__about').waitFor({ timeout: 8000 })
  await closeShare(page)

  await maya.locator('.froam-collab__trigger .froam-collab__badge.is-chat').waitFor({ timeout: 12000 })
  await openShare(maya)
  await maya.click('.froam-collab__tabs button:has-text("Chat")')
  const reply = maya.locator('.froam-chat__msg:not(.is-mine)').last()
  await reply.waitFor({ timeout: 5000 })
  const replyText = await reply.innerText()
  await closeShare(maya)

  assert(peeked.includes('Maya') && peeked.includes('Is the headline OK?'), `peek reads: ${peeked}`)
  assert(unread.trim() === '1', `unread badge reads "${unread}"`)
  assert(thread.includes('Is the headline OK?'), 'the message is not in the owner\'s chat')
  assert(/sent Spring sale copy for approval/.test(thread) && /approved and published Spring sale copy/.test(thread), `the timeline misses request activity: ${thread.slice(0, 300)}`)
  assert(badgeAfter === 0, 'reading the chat did not clear the badge')
  assert(replyText.includes('Looks great, it is live') && replyText.includes('Spring sale copy'), `reply reads: ${replyText}`)
})

collabTest('sending back: the note reaches the contributor, and the change counts again', async ({ page }) => {
  const maya = collab.contributor
  await maya.evaluate(() => document.getElementById('cta').scrollIntoView({ block: 'center' }))
  const box = await maya.locator('#cta').boundingBox()
  await maya.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await maya.waitForTimeout(250)
  for (let i = 0; i < 4; i += 1) await maya.keyboard.press('ArrowRight')
  await maya.waitForTimeout(400)
  await openShare(maya)
  await maya.click('text=Submit for approval')
  await maya.locator('.froam-collab__request.is-pending').waitFor({ timeout: 8000 })
  await closeShare(maya)

  await page.locator('.froam-collab__trigger .froam-collab__badge').waitFor({ timeout: 12000 })
  await openShare(page)
  const request = page.locator('.froam-collab__request.is-pending')
  await request.locator('button:has-text("Request changes")').click()
  await page.fill('textarea[aria-label="What should change"]', 'Keep it where it was')
  await page.click('button:has-text("Send back")')
  await page.locator('.froam-collab__request.is-changes-requested').waitFor({ timeout: 8000 })
  await closeShare(page)

  await maya.waitForTimeout(5500)
  await openShare(maya)
  await maya.locator('.froam-collab__request.is-changes-requested').waitFor({ timeout: 8000 })
  const note = await maya.locator('.froam-collab__request.is-changes-requested blockquote').innerText()
  const again = await maya.locator('.froam-collab__changes li').count()
  await closeShare(maya)
  await collab.contributorContext.close()
  assert(note.includes('Keep it where it was'), `note reads "${note}"`)
  assert(again === 1, `the sent-back change should count again (${again} listed)`)
})

/* ─── run ─── */

const browserPath = findBrowser()
if (!browserPath) {
  console.log('e2e editor: no Chrome/Chromium found — set FROAM_E2E_CHROME or run `npx playwright install chromium`')
  process.exit(1)
}
if (!fs.existsSync(path.join(ROOT, 'dist', 'standalone', 'froam-editor.js'))) {
  console.log('e2e editor: dist/standalone is missing — run `npm run build` first')
  process.exit(1)
}

/**
 * One suite: the fixture copied to a temp folder, served through the real CLI
 * (cwd = the site, so the bridge's workspace lands in the copy), the editor
 * opened in a fresh browser context, and each test run in order against it.
 */
async function runSuite(browser, label, fixture, tests) {
  const run = tests.filter((t) => !only || only.test(t.name))
  if (!run.length) return { passed: 0, total: 0 }
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-e2e-'))
  fs.cpSync(fixture, siteDir, { recursive: true })
  const port = await freePort()
  const url = `http://localhost:${port}/`
  const bridge = spawn(process.execPath, [BIN, 'dev', '--serve', '.', '--port', String(port)], { cwd: siteDir, stdio: ['ignore', 'pipe', 'pipe'] })
  let bridgeLog = ''
  bridge.stdout.on('data', (d) => { bridgeLog += d })
  bridge.stderr.on('data', (d) => { bridgeLog += d })
  let passed = 0
  let context
  try {
    await waitForHttp(url)
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(e.message))
    await openEditor(page, url)
    console.log(label)
    for (const t of run) {
      try {
        await t.fn({ page, context, siteDir, url })
        passed += 1
        console.log(`  ok  ${t.name}`)
      } catch (error) {
        console.log(`  FAIL ${t.name}\n       ${error.message}`)
      }
    }
    if (pageErrors.length) console.log(`  (page errors: ${[...new Set(pageErrors)].slice(0, 3).join(' | ')})`)
  } catch (error) {
    console.log(`e2e editor: ${label} setup failed — ${error.message}\n${bridgeLog.slice(-800)}`)
  } finally {
    await context?.close().catch(() => {})
    const exited = new Promise((resolve) => bridge.once('exit', resolve))
    bridge.kill()
    await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))])
    if (process.env.FROAM_E2E_KEEP) console.log(`  (kept ${siteDir})`)
    for (let attempt = 0; attempt < 10 && !process.env.FROAM_E2E_KEEP; attempt += 1) {
      try {
        fs.rmSync(siteDir, { recursive: true, force: true })
        break
      } catch {
        await new Promise((r) => setTimeout(r, 300))
      }
    }
  }
  return { passed, total: run.length }
}

const browser = await chromium.launch({ executablePath: browserPath, headless: !process.env.FROAM_E2E_HEADED })
let passed = 0
let total = 0
try {
  for (const [label, fixture, tests] of [['static site', FIXTURE, suites.site], ['app with a portal', APP_FIXTURE, suites.app], ['collaboration', FIXTURE, suites.collab]]) {
    const result = await runSuite(browser, label, fixture, tests)
    passed += result.passed
    total += result.total
  }
} finally {
  await browser.close().catch(() => {})
}

console.log(`e2e editor: ${passed}/${total} passed`)
process.exit(passed === total ? 0 : 1)
