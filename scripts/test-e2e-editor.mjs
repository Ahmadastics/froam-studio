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
const { LOOKS } = await import('../dist/editor/floating-bar-looks.js')

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

const REAL_FILES = '#features li:nth-child(2) h3'
const ANY_STACK = '#features li:nth-child(3) h3'
async function typeInto(page, selector, text) {
  await deselect(page)
  await clickOn(page, selector, 0.02, 0.5)
  await page.keyboard.type(text, { delay: 25 })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await deselect(page)
}
async function openHistory(page) {
  if (!(await page.locator('.froam-tb__history-pop').count())) await page.click('button[aria-label="History"]')
  await page.waitForSelector('.froam-tb__history-pop', { timeout: 3000 })
}

test('Ctrl+Z after typing puts the page’s own words back; Ctrl+Y brings the typing back', async ({ page }) => {
  await typeInto(page, REAL_FILES, 'Now ')
  assert((await textOf(page, REAL_FILES)).startsWith('Now Real files'), `typed text is "${await textOf(page, REAL_FILES)}"`)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(400)
  assert((await textOf(page, REAL_FILES)) === 'Real files', `after undo the heading reads "${await textOf(page, REAL_FILES)}"`)
  await page.keyboard.press('Control+y')
  await page.waitForTimeout(400)
  assert((await textOf(page, REAL_FILES)).startsWith('Now Real files'), `after redo the heading reads "${await textOf(page, REAL_FILES)}"`)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(400)
  assert((await textOf(page, REAL_FILES)) === 'Real files', 'the page was not left as it was')
})

test('clicking in and out of copy without typing changes nothing', async ({ page }) => {
  await openHistory(page)
  const before = await page.locator('.froam-tb__history-list li').count()
  await page.click('button[aria-label="History"]')
  await deselect(page)
  await clickOn(page, ANY_STACK)
  await clickOn(page, ANY_STACK, 0.3, 0.5)
  await deselect(page)
  await page.waitForTimeout(300)
  await openHistory(page)
  const after = await page.locator('.froam-tb__history-list li').count()
  await page.click('button[aria-label="History"]')
  assert(after === before, `an untouched click-in added ${after - before} change(s) to History`)
})

test('History takes back one older change and leaves the later one; Save counts what is unsaved', async ({ page }) => {
  await typeInto(page, REAL_FILES, 'A ')
  await typeInto(page, ANY_STACK, 'B ')
  const save = page.locator('.froam-tb__save-btn:not(.froam-tb__save-btn--repo)')
  const count = Number(await save.locator('.froam-tb__unsaved').innerText().catch(() => '0'))
  assert(count >= 2, `Save shows ${count} unsaved changes after two edits`)
  assert(/not saved yet/.test(await save.getAttribute('title') ?? ''), 'Save does not say what is unsaved')
  await openHistory(page)
  const rows = page.locator('.froam-tb__history-list li')
  assert(/Rewrote copy/.test(await rows.nth(0).innerText()), `newest row reads "${await rows.nth(0).innerText()}"`)
  await rows.nth(1).hover()
  await rows.nth(1).locator('button').click()
  await page.waitForTimeout(500)
  assert((await textOf(page, REAL_FILES)) === 'Real files', `the older change was not taken back: "${await textOf(page, REAL_FILES)}"`)
  assert((await textOf(page, ANY_STACK)).startsWith('B Any stack'), 'taking back the older change undid the later one too')
  // Ctrl+Z now takes back the take-back — not the later edit.
  await page.click('button[aria-label="History"]')
  await deselect(page)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(400)
  assert((await textOf(page, REAL_FILES)).startsWith('A Real files'), 'Ctrl+Z after a History undo did not restore it')
  assert((await textOf(page, ANY_STACK)).startsWith('B Any stack'), 'Ctrl+Z after a History undo touched the later edit')
  // Leave the page as it was.
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(250)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(400)
  assert((await textOf(page, REAL_FILES)) === 'Real files' && (await textOf(page, ANY_STACK)) === 'Any stack', `left "${await textOf(page, REAL_FILES)}" / "${await textOf(page, ANY_STACK)}"`)
})

const unsavedCount = (page) => page.evaluate(() => Number(document.querySelector('.froam-tb__save-btn:not(.froam-tb__save-btn--repo) .froam-tb__unsaved')?.textContent ?? 0))

test('Save reads as saved again when the page is back to what was saved — by Ctrl+Z or from History', async ({ page }) => {
  await deselect(page)
  await page.click('.froam-tb__save-btn:not(.froam-tb__save-btn--repo)')
  await page.waitForTimeout(800)
  assert((await unsavedCount(page)) === 0, `right after Save, ${await unsavedCount(page)} unsaved`)
  await typeInto(page, REAL_FILES, 'Soon ')
  assert((await unsavedCount(page)) >= 1, 'an edit after Save is not counted as unsaved')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)
  assert((await textOf(page, REAL_FILES)) === 'Real files', `undo left "${await textOf(page, REAL_FILES)}"`)
  assert((await unsavedCount(page)) === 0, `with the only edit since Save undone, Save still shows ${await unsavedCount(page)} unsaved`)
  // Taking it back from History is a new change, but it puts the page back as saved.
  await page.keyboard.press('Control+y')
  await page.waitForTimeout(500)
  assert((await unsavedCount(page)) >= 1, 'redoing the edit is not counted as unsaved')
  await openHistory(page)
  const newest = page.locator('.froam-tb__history-list li:not(.is-version):not(.is-undo)').first()
  assert(/Soon|Rewrote copy/.test(await newest.innerText()), `the newest change reads "${await newest.innerText()}"`)
  await newest.hover()
  await newest.locator('button').click()
  await page.waitForTimeout(500)
  await page.click('button[aria-label="History"]')
  assert((await textOf(page, REAL_FILES)) === 'Real files', `History left "${await textOf(page, REAL_FILES)}"`)
  assert((await unsavedCount(page)) === 0, `back to the saved page from History, Save shows ${await unsavedCount(page)} unsaved`)
})

test('History keeps a named moment beside the changes, restores it, and Ctrl+Z takes the restore back', async ({ page }) => {
  await deselect(page)
  await openHistory(page)
  await page.click('.froam-tb__history-name')
  await page.fill('.froam-tb__history-naming input', 'Before the rewrite')
  await page.press('.froam-tb__history-naming input', 'Enter')
  const moment = page.locator('.froam-tb__history-list li.is-version', { hasText: 'Before the rewrite' })
  await moment.waitFor({ timeout: 5000 })
  await page.click('button[aria-label="History"]')
  await typeInto(page, ANY_STACK, 'Later ')
  assert((await textOf(page, ANY_STACK)).startsWith('Later Any stack'), `typed text is "${await textOf(page, ANY_STACK)}"`)
  await openHistory(page)
  const order = await page.locator('.froam-tb__history-list li').evaluateAll((rows) => rows.map((row) => (row.classList.contains('is-version') ? 'moment' : 'change')))
  assert(order[0] === 'change' && order.indexOf('moment') > 0, `History is not newest first: ${order.join(', ')}`)
  await moment.locator('button', { hasText: 'Restore' }).click()
  await page.waitForTimeout(800)
  assert((await textOf(page, ANY_STACK)) === 'Any stack', `restoring the moment left "${await textOf(page, ANY_STACK)}"`)
  assert(/Restored “Before the rewrite”/.test(await page.evaluate(() => document.body.innerText)), 'no word that the moment was restored')
  await deselect(page)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)
  assert((await textOf(page, ANY_STACK)).startsWith('Later Any stack'), `Ctrl+Z after a restore left "${await textOf(page, ANY_STACK)}"`)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)
  assert((await textOf(page, ANY_STACK)) === 'Any stack', `the page was not left as it was: "${await textOf(page, ANY_STACK)}"`)
})

test('scrolling with the editor on leaves the page alone: no hover restyling mid-scroll', async ({ page }) => {
  await deselect(page)
  await page.evaluate(() => { document.documentElement.style.minHeight = '4000px'; window.scrollTo(0, 0) })
  await page.mouse.move(720, 500)
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    window.__froamScrollMutations = 0
    window.__froamScrollObserver = new MutationObserver((records) => {
      window.__froamScrollMutations += records.filter((r) => r.target instanceof Element && !r.target.closest('[data-chef-editor-root="true"]') && r.target.id !== 'froam-boundary-tag').length
    })
    window.__froamScrollObserver.observe(document.body, { subtree: true, attributes: true, childList: true })
  })
  for (let i = 0; i < 12; i += 1) { await page.mouse.wheel(0, 120); await page.waitForTimeout(30) }
  const during = await page.evaluate(() => window.__froamScrollMutations)
  await page.waitForTimeout(400)
  await page.evaluate(() => { window.__froamScrollObserver.disconnect(); document.documentElement.style.removeProperty('min-height'); window.scrollTo(0, 0) })
  assert(during <= 2, `${during} changes to the page while scrolling`)
})

test('the Hand tool drags the page', async ({ page }) => {
  await deselect(page)
  await page.evaluate(() => { document.documentElement.style.minHeight = '4000px'; window.scrollTo(0, 0) })
  await page.keyboard.press('h')
  await page.waitForTimeout(150)
  await page.mouse.move(720, 700)
  await page.mouse.down()
  await page.mouse.move(720, 400, { steps: 8 })
  await page.mouse.up()
  const scrolled = await page.evaluate(() => Math.round(document.scrollingElement.scrollTop))
  await page.keyboard.press('v')
  await page.evaluate(() => { document.documentElement.style.removeProperty('min-height'); window.scrollTo(0, 0) })
  assert(Math.abs(scrolled - 300) <= 2, `dragging up 300px with the Hand tool scrolled ${scrolled}px`)
})

test('the phone preview shows the page’s phone layout — header included — and puts it all back', async ({ page }) => {
  await deselect(page)
  const style = await page.addStyleTag({ content: '@media (max-width: 640px) { #headline { color: rgb(200, 30, 60) } } @media (hover: none) { #cta { outline: 3px solid rgb(0, 160, 255) } }' })
  const desktop = await page.evaluate(() => ({ color: getComputedStyle(document.getElementById('headline')).color, order: [...document.body.children].filter((n) => !n.id.startsWith('froam-') && n.getAttribute('data-chef-editor-root') !== 'true').map((n) => n.id || n.tagName).join(',') }))
  await page.click('button[aria-label*="Mobile" i], button[title*="Mobile" i], button[title*="Phone" i]')
  await page.waitForTimeout(900)
  const phone = await page.evaluate(() => ({
    color: getComputedStyle(document.getElementById('headline')).color,
    outline: getComputedStyle(document.getElementById('cta')).outlineColor,
    headerOnScreen: Boolean(document.getElementById('site-header')?.closest('[data-froam-stage]')),
    bar: document.querySelector('.froam-device-bar')?.textContent ?? '',
  }))
  assert(phone.color === 'rgb(200, 30, 60)', `the page's phone CSS did not apply (headline ${phone.color})`)
  assert(phone.outline === 'rgb(0, 160, 255)', 'a phone is a touch screen: (hover: none) should apply')
  assert(phone.headerOnScreen, 'the header is not on the phone screen')
  assert(/390 × 844/.test(phone.bar), `the size bar reads "${phone.bar}"`)
  await clickOn(page, '#logo')
  assert((await selectedId(page)) === 'logo', `clicking the logo on the phone selected ${await selectedId(page)}`)
  await deselect(page)
  await page.click('button[aria-label*="Desktop" i], button[title*="Desktop" i]')
  await page.waitForTimeout(700)
  const back = await page.evaluate(() => ({ color: getComputedStyle(document.getElementById('headline')).color, order: [...document.body.children].filter((n) => !n.id.startsWith('froam-') && n.getAttribute('data-chef-editor-root') !== 'true').map((n) => n.id || n.tagName).join(','), frames: document.querySelectorAll('[data-froam-stage]').length }))
  await style.evaluate((node) => node.remove())
  assert(back.frames === 0, 'the phone frame was left behind')
  assert(back.color === desktop.color, `desktop CSS did not come back (headline ${back.color})`)
  assert(back.order === desktop.order, `the page did not go back in its place: ${back.order}`)
})

test('in the phone preview the page’s scroll scripts follow the phone screen, and the window gets its own scroll back after', async ({ page }) => {
  await deselect(page)
  const style = await page.addStyleTag({ content: '#features { min-height: 2400px }' })
  await page.evaluate(() => {
    window.__froamHeard = { events: 0, y: -1 }
    window.__froamOnScroll = () => { window.__froamHeard.events += 1; window.__froamHeard.y = window.scrollY }
    window.addEventListener('scroll', window.__froamOnScroll, { passive: true })
  })
  await page.click('button[aria-label*="Mobile" i], button[title*="Mobile" i], button[title*="Phone" i]')
  await page.waitForTimeout(900)
  const screen = await page.locator('[data-froam-stage="scroll"]').boundingBox()
  await page.mouse.move(screen.x + screen.width / 2, screen.y + screen.height / 2)
  for (let i = 0; i < 6; i += 1) { await page.mouse.wheel(0, 150); await page.waitForTimeout(40) }
  await page.waitForTimeout(400)
  const phone = await page.evaluate(() => {
    const scroller = document.querySelector('[data-froam-stage="scroll"]')
    const seen = { top: scroller.scrollTop, scrollY: window.scrollY, element: document.scrollingElement === scroller, heard: { ...window.__froamHeard } }
    window.scrollTo(0, 0)
    seen.afterScrollTo = scroller.scrollTop
    return seen
  })
  await page.click('button[aria-label*="Desktop" i], button[title*="Desktop" i]')
  await page.waitForTimeout(700)
  const desktop = await page.evaluate(() => {
    window.scrollTo(0, 120)
    const seen = { scrollY: window.scrollY, real: document.documentElement.scrollTop, element: document.scrollingElement === document.documentElement }
    window.scrollTo(0, 0)
    window.removeEventListener('scroll', window.__froamOnScroll)
    return seen
  })
  await style.evaluate((node) => node.remove())
  assert(phone.top > 200, `the phone screen scrolled ${phone.top}px`)
  assert(phone.heard.events > 0, 'the page’s scroll listener never heard the phone screen scroll')
  assert(phone.scrollY === phone.top && phone.heard.y === phone.top, `window.scrollY reads ${phone.scrollY} (listener saw ${phone.heard.y}) with the phone screen at ${phone.top}`)
  assert(phone.element, 'document.scrollingElement is not the phone screen')
  assert(phone.afterScrollTo === 0, `window.scrollTo(0, 0) left the phone screen at ${phone.afterScrollTo}`)
  assert(desktop.scrollY === 120 && desktop.real === 120 && desktop.element, `after the preview the window scrolls as ${JSON.stringify(desktop)}`)
})

const ctaLook = (page) => page.evaluate(() => { const s = getComputedStyle(document.getElementById('cta')); return `${s.backgroundColor}|${s.boxShadow}|${s.borderRadius}|${s.color}|${s.backgroundImage}` })
/** A Styles tile by its exact name. */
const lookTile = (page, name) => page.locator('.froam-floating-bar__pop--looks .froam-floating-bar__looks button', { has: page.locator('span', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) })
async function openStyles(page) {
  if (!(await page.locator('.froam-floating-bar__pop--looks').count())) await page.click('.froam-floating-bar__looks-btn')
  await page.waitForSelector('.froam-floating-bar__pop--looks .froam-floating-bar__looks button', { timeout: 10000 })
}
async function closeStyles(page) {
  await page.click('.froam-floating-bar__pop--looks .froam-floating-bar__look-apply')
  await page.waitForTimeout(200)
}

test('Styles fetches its looks the first time it opens, and a look applies and undoes', async ({ page }) => {
  await deselect(page)
  const asked = []
  const listen = (request) => { if (/floating-bar-looks/.test(request.url())) asked.push(request.url()) }
  page.on('request', listen)
  // Read the button unselected and unhovered: the selection ring is the editor's, not the look's.
  const unselected = async () => { await deselect(page); await page.mouse.move(4, 890); await page.waitForTimeout(250); return ctaLook(page) }
  const before = await unselected()
  await clickOn(page, '#cta')
  assert((await selectedId(page)) === 'cta', `clicking the button selected ${await selectedId(page)}`)
  const earlyAsks = asked.length
  await page.click('.froam-floating-bar__looks-btn')
  await page.waitForSelector('.froam-floating-bar__pop--looks .froam-floating-bar__looks button', { timeout: 10000 })
  const looks = page.locator('.froam-floating-bar__pop--looks .froam-floating-bar__looks button')
  const count = await looks.count()
  await lookTile(page, 'Lift').click()
  await page.waitForTimeout(500)
  await page.click('.froam-floating-bar__pop--looks .froam-floating-bar__look-apply')
  const after = await unselected()
  let undone = after
  let undos = 0
  for (; undos < 4 && undone !== before; undos += 1) {
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(400)
    undone = await unselected()
  }
  page.off('request', listen)
  assert(earlyAsks === 0, 'the looks were downloaded before Styles was opened')
  assert(asked.length === 1, `opening Styles fetched the looks ${asked.length} time(s)`)
  assert(count > 100, `Styles shows ${count} looks`)
  assert(after !== before, 'the look changed nothing on the button')
  assert(undone === before, 'Ctrl+Z did not take the look back')
  assert(undos === 1, `taking one look back took ${undos} presses of Ctrl+Z`)
})

test('all 253 looks write CSS a real browser accepts — every property, every hover and ::after', async ({ page }) => {
  const recipes = LOOKS.flatMap((look) => [['', look.styles('#6366f1')], ...(look.text ? [[' (words)', look.text('#6366f1')]] : [])].map(([kind, recipe]) => [`${look.name}${kind}`, recipe]))
  const rejected = await page.evaluate((all) => {
    const probe = document.createElement('div')
    const out = []
    for (const [name, recipe] of all) {
      for (const [key, value] of Object.entries(recipe)) {
        if (!value) continue
        const property = key.replace(/^__froamState:[^:]+:/, '').replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
        // A vendor alias this engine doesn't have (-webkit-backdrop-filter is Safari's) isn't a mistake.
        if (property.startsWith('-webkit-') && !CSS.supports(property, 'inherit')) continue
        probe.removeAttribute('style')
        probe.style.setProperty(property, value)
        // Shorthands (border: none) set longhands and may not read back as themselves.
        if (!probe.style.length) out.push(`${name}: ${property}: ${value}`)
      }
    }
    return out
  }, recipes)
  assert(recipes.length > 253, `only ${recipes.length} recipes checked`)
  assert(rejected.length === 0, `the browser drops ${rejected.length} declaration(s): ${rejected.slice(0, 6).join(' | ')}`)
})

test('a living look answers the pointer in the editor — and trying the next look leaves nothing of it behind', async ({ page }) => {
  const transformY = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('cta')).transform).f)
  const arrow = () => page.evaluate(() => { const s = getComputedStyle(document.getElementById('cta'), '::after'); return { content: s.content, x: new DOMMatrix(s.transform === 'none' ? '' : s.transform).e } })
  const hoverCta = async () => { const box = await page.locator('#cta').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(700) }
  const away = async () => { await page.mouse.move(4, 890); await page.waitForTimeout(600) }
  await deselect(page)
  await clickOn(page, '#cta')
  await openStyles(page)
  // The looks come in the site's own brand colour, not the most common colour on the page.
  const accent = await page.evaluate(() => document.querySelector('.froam-floating-bar__look-editor input[type=color]')?.value)
  assert(accent === '#2563eb', `Styles' accent is ${accent}, not the site's blue`)
  await lookTile(page, 'Levitate').click()
  await away()
  const restY = await transformY()
  await hoverCta()
  const liftedY = await transformY()
  await away()
  // Trying the next look: Levitate's lift and shadow come off; the arrow arrives.
  await lookTile(page, 'Arrow nudge').click()
  await away()
  const arrowAtRest = await arrow()
  await hoverCta()
  const hoveredY = await transformY()
  const arrowOnHover = await arrow()
  await away()
  await closeStyles(page)
  await deselect(page)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(400)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)
  const cleared = await arrow()
  assert(Math.abs(restY) < 0.5, `Levitate at rest is moved ${restY}px`)
  assert(Math.abs(liftedY + 6) < 0.6, `hovering Levitate in the editor lifts it ${-liftedY}px, not 6px`)
  assert(Math.abs(hoveredY) < 0.5, `after switching to Arrow nudge, hover still lifts the button ${-hoveredY}px`)
  assert(arrowAtRest.content === '"→"' && Math.abs(arrowAtRest.x) < 0.5, `Arrow nudge at rest: ${JSON.stringify(arrowAtRest)}`)
  assert(Math.abs(arrowOnHover.x - 5) < 0.6, `on hover the arrow moved ${arrowOnHover.x}px, not 5px`)
  assert(cleared.content === 'none' || cleared.content === 'normal', `two Ctrl+Z left the arrow: ${cleared.content}`)
})

test('on words, box-only looks are hidden and a look’s own text recipe is applied as written', async ({ page }) => {
  await deselect(page)
  const box = await page.evaluate(() => { const range = document.createRange(); const text = [...document.getElementById('headline').childNodes].find((node) => node.nodeType === 3 && node.textContent.trim()); range.setStart(text, 0); range.setEnd(text, 3); const r = range.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await page.mouse.click(box.x, box.y)
  await page.waitForTimeout(250)
  assert((await selectedId(page)) === 'headline', `clicking "Discover" selected ${await selectedId(page)}`)
  await openStyles(page)
  const boxOnly = await lookTile(page, 'Clicky').count()
  const holo = lookTile(page, 'Holo foil')
  const offered = await holo.count()
  await holo.click()
  await page.waitForTimeout(400)
  await closeStyles(page)
  const seen = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('headline')); return { clip: s.webkitBackgroundClip || s.backgroundClip, fill: s.webkitTextFillColor, image: s.backgroundImage } })
  await deselect(page)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => getComputedStyle(document.getElementById('headline')).backgroundImage)
  assert(boxOnly === 0, 'a box-only look (Clicky) is offered for a heading')
  assert(offered === 1, 'Holo foil is not offered for a heading')
  assert(seen.clip === 'text' && seen.fill === 'rgba(0, 0, 0, 0)', `the heading's letters are not foil-filled: ${JSON.stringify(seen)}`)
  assert(/214, 58, 147/.test(seen.image), 'the words recipe (deep inks) was not the one applied')
  assert(after === 'none', 'Ctrl+Z left the foil on the heading')
})

/* Smart Quick Edits: open Quick Edit on a selection, take a smart chip, read the preview. */
async function smartQuickEdit(page, selector, chip, at = [0.5, 0.5]) {
  await deselect(page)
  if (at === 'first-word') {
    // On the element's own words, not a <span> inside it.
    const box = await page.evaluate((s) => { const range = document.createRange(); const text = [...document.querySelector(s).childNodes].find((node) => node.nodeType === 3 && node.textContent.trim()); range.setStart(text, 0); range.setEnd(text, 3); const r = range.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, selector)
    await page.mouse.click(box.x, box.y)
    await page.waitForTimeout(250)
  } else await clickOn(page, selector, at[0], at[1])
  await page.click('.froam-tb__ask-btn')
  await page.waitForSelector('.froam-quick-chat', { timeout: 5000 })
  const chips = await page.locator('.froam-quick-chat__suggestions button.is-smart').allInnerTexts()
  assert(chips.includes(chip), `Quick Edit on ${await selectedId(page) || 'the selection'} (${await page.locator('.froam-quick-chat').getAttribute('aria-label')}) offers ${chips.join(', ') || 'no smart edits'}`)
  await page.locator('.froam-quick-chat__suggestions button.is-smart', { hasText: chip }).click()
  await page.waitForSelector('.froam-intent-result.is-preview, .froam-intent-result.is-error', { timeout: 10000 })
  const why = await page.locator('.froam-intent-result__why, .froam-intent-result.is-error strong').first().innerText().catch(() => '')
  return { chips, why }
}
const cancelPreview = async (page) => { await page.locator('.froam-intent-result button', { hasText: 'Cancel' }).click(); await page.waitForTimeout(400) }
const contrastOn = (page, selector, ground) => page.evaluate(([s, bg]) => {
  const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).map(Number); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) }
  const [hi, lo] = [lum(getComputedStyle(document.querySelector(s)).color), lum(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}, [selector, ground])

test('smart Quick Edit: Fix contrast reads the real background, passes WCAG, says so — and Keep then Ctrl+Z works', async ({ page }) => {
  const style = await page.addStyleTag({ content: '#subtitle { color: #b8c2cc }' })
  const pageGround = 'rgb(253, 249, 245)'
  const before = await contrastOn(page, '#subtitle', pageGround)
  const { chips, why } = await smartQuickEdit(page, '#subtitle', 'Fix contrast')
  assert(chips.includes('Fix contrast') && chips.includes('Balance lines'), `a paragraph is offered ${chips.join(', ')}`)
  assert(/→ .*passes WCAG AA/.test(why), `the preview says "${why}"`)
  const previewed = await contrastOn(page, '#subtitle', pageGround)
  await page.locator('.froam-intent-result [data-froam-intent-primary]').click()
  await page.waitForTimeout(600)
  const kept = await contrastOn(page, '#subtitle', pageGround)
  await deselect(page)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)
  const undone = await contrastOn(page, '#subtitle', pageGround)
  await style.evaluate((node) => node.remove())
  assert(before < 2.5, `the fixture should start unreadable (${before.toFixed(2)}:1)`)
  assert(previewed >= 4.5, `previewed at ${previewed.toFixed(2)}:1`)
  assert(kept >= 4.5, `kept at ${kept.toFixed(2)}:1`)
  assert(Math.abs(undone - before) < 0.05, `Ctrl+Z left ${undone.toFixed(2)}:1 (was ${before.toFixed(2)}:1)`)
})

test('smart Quick Edit: Brand gradient finds the site’s own blue and clips it to the headline', async ({ page }) => {
  const { chips, why } = await smartQuickEdit(page, '#headline', 'Brand gradient', 'first-word')
  const seen = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('headline')); return { clip: s.webkitBackgroundClip || s.backgroundClip, image: s.backgroundImage } })
  await cancelPreview(page)
  const after = await page.evaluate(() => getComputedStyle(document.getElementById('headline')).backgroundImage)
  assert(chips.includes('Brand gradient') && chips.includes('Fluid size'), `a heading is offered ${chips.join(', ')}`)
  assert(/brand colour #2563eb/.test(why), `the preview says "${why}"`)
  assert(seen.clip === 'text' && /linear-gradient/.test(seen.image) && /37, 99, 235/.test(seen.image), `the headline shows ${JSON.stringify(seen)}`)
  assert(after === 'none', 'Cancel left the gradient on the headline')
})

test('an element’s own inline styles survive Cancel, Undo and a phone preview — only Froam’s come off', async ({ page }) => {
  const own = 'position: absolute; right: 24px; bottom: 24px; padding: 14px 18px; background: rgb(255, 255, 255); font-weight: 600;'
  await page.evaluate((style) => { const caption = document.createElement('div'); caption.id = 'inline-caption'; caption.setAttribute('style', style); caption.textContent = 'Santorini · 3 nights'; document.getElementById('stage').append(caption) }, own)
  const styleNow = () => page.evaluate(() => document.getElementById('inline-caption').getAttribute('style'))
  const { why } = await smartQuickEdit(page, '#inline-caption', 'Frosted glass', [0.03, 0.5])
  const previewed = await page.evaluate(() => getComputedStyle(document.getElementById('inline-caption')).backdropFilter)
  await cancelPreview(page)
  const afterCancel = await styleNow()
  await smartQuickEdit(page, '#inline-caption', 'Frosted glass', [0.03, 0.5])
  await page.locator('.froam-intent-result [data-froam-intent-primary]').click()
  await page.waitForTimeout(600)
  await deselect(page)
  await page.click('button[aria-label*="Mobile" i], button[title*="Mobile" i], button[title*="Phone" i]')
  await page.waitForTimeout(900)
  const onPhone = await page.evaluate(() => getComputedStyle(document.getElementById('inline-caption')).position)
  await page.click('button[aria-label*="Desktop" i], button[title*="Desktop" i]')
  await page.waitForTimeout(700)
  const backOnDesktop = await page.evaluate(() => getComputedStyle(document.getElementById('inline-caption')).backdropFilter)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(600)
  const afterUndo = await styleNow()
  await page.evaluate(() => document.getElementById('inline-caption')?.remove())
  assert(/gradient/.test(why), `glass over the stage's gradient says "${why}"`)
  assert(/blur/.test(previewed), `the preview shows no glass (${previewed})`)
  assert(afterCancel === own, `Cancel left style="${afterCancel}"`)
  assert(onPhone === 'absolute', `on the phone the caption lost its own position (${onPhone})`)
  assert(/blur/.test(backOnDesktop), `back on desktop the kept glass is gone (${backOnDesktop})`)
  assert(afterUndo === own, `Ctrl+Z left style="${afterUndo}"`)
})

test('smart Quick Edit: Match the others brings an odd card back in line with its look-alikes', async ({ page }) => {
  const style = await page.addStyleTag({ content: '#features li:nth-child(1) { border-radius: 0; padding: 4px }' })
  const { chips, why } = await smartQuickEdit(page, '#features li:nth-child(1)', 'Match the others', [0.5, 0.97])
  const matched = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('#features li:nth-child(1)')); return `${s.borderTopLeftRadius} ${s.paddingTop}` })
  await cancelPreview(page)
  await style.evaluate((node) => node.remove())
  assert(chips.includes('Match the others'), `a card is offered ${chips.join(', ')}`)
  assert(/Matched to the 2 other items like it: .*corners.*padding|padding.*corners/.test(why), `the preview says "${why}"`)
  assert(matched === '12px 18px', `the card now has ${matched}`)
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

  await page.locator('.froam-collab__trigger .froam-collab__badge:not(.is-chat)').waitFor({ timeout: 12000 })
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
  await request.locator('.froam-collab__checks').waitFor({ timeout: 5000 })
  const checks = await request.locator('.froam-collab__checks').innerText()
  assert(/Checks passed|to look at/.test(checks), `checks read: ${checks}`)
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
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="Message the room"]')?.value.startsWith('@'), null, { timeout: 3000 }).catch(() => {})
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

collabTest('@mentions, typing and pins: talk about the thing, on the thing', async ({ page }) => {
  const maya = collab.contributor
  await maya.evaluate(() => document.getElementById('subtitle').scrollIntoView({ block: 'center' }))
  const box = await maya.locator('#subtitle').boundingBox()
  await maya.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await maya.waitForTimeout(300)
  await openShare(maya)
  await maya.click('.froam-collab__tabs button:has-text("Chat")')
  const input = maya.locator('textarea[aria-label="Message the room"]')
  await input.click()
  await maya.keyboard.type('@')
  const suggestion = maya.locator('.froam-chat__mentions button').first()
  await suggestion.waitFor({ timeout: 5000 })
  const suggested = await suggestion.innerText()
  await maya.keyboard.press('Enter')
  await maya.keyboard.type('is this line too long?')
  const drafted = await input.inputValue()

  // The owner sees Maya typing while it's unsent.
  await openShare(page)
  await page.click('.froam-collab__tabs button:has-text("Chat")')
  await page.locator('.froam-chat__typing').waitFor({ timeout: 12000 })
  const typing = await page.locator('.froam-chat__typing').innerText()
  await closeShare(page)

  // Pinned to the selected element, and sent.
  const pinButton = maya.locator('button[aria-label="Pin to the selected element"]')
  const pinEnabled = await pinButton.isEnabled()
  await pinButton.click()
  await maya.locator('.froam-chat__context.is-pin').waitFor({ timeout: 3000 })
  await input.press('Enter')
  await maya.locator('.froam-chat__msg.is-mine .froam-chat__pin').waitFor({ timeout: 8000 })
  await closeShare(maya)

  const peek = page.locator('.froam-collab__peek')
  await peek.waitFor({ timeout: 12000 })
  const peeked = await peek.innerText()
  await page.evaluate(() => document.getElementById('subtitle').scrollIntoView({ block: 'center' }))
  const pin = page.locator('.froam-pin').first()
  await pin.waitFor({ timeout: 8000 })
  await pin.click()
  const focused = page.locator('.froam-chat__msg.is-focused')
  await focused.waitFor({ timeout: 5000 })
  const focusedText = await focused.innerText()
  await closeShare(page)

  assert(suggested.length > 0, 'no one to mention')
  const mentioned = drafted.slice(1).split(' is this line')[0]
  assert(drafted.startsWith('@') && mentioned && suggested.includes(mentioned), `mention inserted as "${drafted}" from "${suggested}"`)
  assert(/is typing/.test(typing) && typing.includes('Maya'), `typing reads "${typing}"`)
  assert(pinEnabled, 'the pin button was disabled with an element selected')
  assert(peeked.includes('mentioned you'), `peek reads "${peeked}"`)
  assert(focusedText.includes('is this line too long?'), `pin opened "${focusedText}"`)
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

  await page.locator('.froam-collab__trigger .froam-collab__badge:not(.is-chat)').waitFor({ timeout: 12000 })
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
  assert(note.includes('Keep it where it was'), `note reads "${note}"`)
  assert(again === 1, `the sent-back change should count again (${again} listed)`)
})

collabTest('a notification link opens the request; the owner reverts it and the file follows', async ({ page, url, siteDir }) => {
  const owned = await page.evaluate(() => JSON.parse(localStorage.getItem('froam-room-owner:v1') || 'null'))
  await openShare(page)
  await page.click('.froam-collab__tabs button:has-text("Requests")')
  const approvedId = await page.locator('.froam-collab__request.is-approved').first().getAttribute('data-request-id')
  await closeShare(page)

  await page.goto(`${url}?froam-room-id=${owned.roomId}&froam-open=request:${approvedId}`)
  const focused = page.locator(`.froam-collab__request.is-focused[data-request-id="${approvedId}"]`)
  await focused.waitFor({ timeout: 20000 })
  const cleanUrl = await page.evaluate(() => window.location.search)

  await focused.locator('button:has-text("Revert")').click()
  await page.fill('textarea[aria-label="Why revert"]', 'Wrong season')
  await page.locator('.froam-collab__danger').click()
  await page.locator(`.froam-collab__request.is-reverted[data-request-id="${approvedId}"]`).waitFor({ timeout: 10000 })
  await closeShare(page)
  const source = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8')

  const maya = collab.contributor
  await maya.waitForTimeout(5500)
  await openShare(maya)
  await maya.locator('.froam-collab__request.is-reverted').waitFor({ timeout: 8000 })
  await closeShare(maya)

  assert(!cleanUrl.includes('froam-open'), `the link stayed in the address bar: ${cleanUrl}`)
  assert(!source.includes('Spring deals.'), 'reverting did not take the copy back out of index.html')
  assert(source.includes('Extraordinary places. Unforgettable experiences.'), 'the original copy is not back in index.html')
})

collabTest('the owner ends the session: links stop, Maya is told, Share starts fresh', async ({ page }) => {
  await openShare(page)
  await page.click('.froam-collab__tabs button:has-text("Share")')
  await page.click('button:has-text("End collaboration")')
  await page.locator('.froam-collab__end').waitFor({ timeout: 3000 })
  await page.click('.froam-collab__end button:has-text("End session")')
  await page.locator('text=Create invite links').waitFor({ timeout: 8000 })
  const owned = await page.evaluate(() => localStorage.getItem('froam-room-owner:v1'))
  await closeShare(page)

  const maya = collab.contributor
  await maya.waitForTimeout(5500)
  await maya.locator('.froam-collab__trigger:has-text("Ended")').waitFor({ timeout: 10000 })
  await openShare(maya)
  const said = await maya.locator('.froam-collab__panel').innerText()
  await closeShare(maya)
  await collab.contributorContext.close()

  assert(owned === null, 'the ended room is still remembered as the owner’s')
  assert(/ended this session/.test(said), `Maya’s panel reads: ${said.slice(0, 160)}`)
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
  // Invite links stay on this machine: the run never opens a public share.
  const bridge = spawn(process.execPath, [BIN, 'dev', '--serve', '.', '--port', String(port)], { cwd: siteDir, env: { ...process.env, FROAM_SHARE: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] })
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
