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
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    let now = await read()
    assert(now.field === '', `clearing the size field left "${now.field}"`)
    await page.keyboard.type('24')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    now = await read()
    assert(now.field === '24' && now.applied === '24px', `typing 24 gave the field "${now.field}" and the text ${now.applied}`)
    // Too small is kept to the smallest size once the field is left, not on every keystroke.
    await page.keyboard.press('Control+A')
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
