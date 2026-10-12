#!/usr/bin/env node
/**
 * End-to-end on a phone: what someone gets editing their site from their
 * own phone, and whether the edit really reaches everyone.
 *
 * `froam dev --serve --host` runs the fixture exactly as users run it, and an
 * emulated iPhone (touch, a phone viewport, a mobile user agent) reaches it
 * over this machine's network address, so the bridge sees another device, not
 * localhost. It checks the phone UI is usable (the selection bar docked in
 * thumb reach with every control on screen, no keyboard inset without a
 * keyboard, finger-sized handles that don't cover the copy), that an unpaired
 * phone is told the truth and can't write the project, that a phone opened
 * from the pairing link `froam dev --host` prints can Save to Repo, and that
 * the saved edit is what a production visitor sees.
 *
 * Needs a network interface (skipped without one) and `npm run build` first.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = path.join(ROOT, 'test', 'e2e', 'site')
const BIN = path.join(ROOT, 'bin', 'froam.mjs')
const PHONE = devices['iPhone 13']

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

/* ─── shared state ─── */
let browser
let siteDir
let bridgeLog = ''
let pairLink = ''
let plainLink = ''
const designText = () => { const p = path.join(siteDir, 'froam', 'froam.design.json'); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '' }
const toastText = (page) => page.evaluate(() => document.querySelector('.fs-toast.is-visible')?.textContent?.trim() ?? '')

async function openOnPhone(url) {
  const context = await browser.newContext({ ...PHONE })
  const page = await context.newPage()
  await page.goto(url)
  await page.waitForSelector('.global-chef-button', { timeout: 20000 })
  await page.tap('.global-chef-button')
  await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 20000 })
  await page.waitForTimeout(1200)
  return { page, context }
}

/** As a person does it: tap to select, tap again to write, select the words, type over them. */
async function selectAndWrite(page, text) {
  const box = await page.locator('#subtitle').boundingBox()
  await page.touchscreen.tap(box.x + 30, box.y + box.height / 2)
  await page.waitForTimeout(500)
  await page.touchscreen.tap(box.x + 30, box.y + box.height / 2)
  for (let i = 0; i < 20 && !(await page.evaluate(() => document.getElementById('subtitle').isContentEditable)); i += 1) await sleep(100)
  assert(await page.evaluate(() => document.getElementById('subtitle').isContentEditable), 'a second tap did not start writing')
  await page.evaluate(() => {
    const range = document.createRange()
    range.selectNodeContents(document.getElementById('subtitle'))
    const selection = getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const written = await page.evaluate(() => document.getElementById('subtitle').innerText.trim())
  assert(written === text, `typing left "${written}"`)
}

/* ─── tests ─── */

test('the selection bar docks in thumb reach with every control on screen, and no phantom keyboard lifts it', async () => {
  const { page, context } = await openOnPhone(plainLink)
  try {
    const box = await page.locator('#subtitle').boundingBox()
    await page.touchscreen.tap(box.x + 30, box.y + box.height / 2)
    await page.waitForTimeout(600)
    const geo = await page.evaluate(() => {
      const bar = document.querySelector('.froam-floating-bar')
      const r = bar.getBoundingClientRect()
      const offscreen = [...bar.querySelectorAll('button, .froam-floating-bar__stepper')]
        .filter((el) => el.offsetParent)
        .map((el) => ({ label: el.getAttribute('aria-label') || el.title || el.textContent.trim(), r: el.getBoundingClientRect() }))
        .filter(({ r: c }) => c.right > innerWidth + 1 || c.left < -1)
        .map(({ label }) => label)
      return { docked: bar.classList.contains('is-docked'), bottomGap: innerHeight - r.bottom, keyboard: getComputedStyle(document.documentElement).getPropertyValue('--froam-keyboard').trim(), offscreen }
    })
    assert(geo.docked, 'the selection bar is not docked on a phone')
    assert(geo.keyboard === '0px' || geo.keyboard === '', `a keyboard inset of ${geo.keyboard} with no keyboard open`)
    assert(geo.bottomGap < 140, `the bar floats ${Math.round(geo.bottomGap)}px above the bottom of the screen`)
    assert(geo.offscreen.length === 0, `controls off the screen: ${geo.offscreen.join(', ')}`)
    for (const label of ['Bold', 'Italic', 'Font family']) {
      assert(await page.locator(`.froam-floating-bar [aria-label="${label}"]`).first().isVisible(), `${label} is not on screen`)
    }
  } finally { await context.close() }
})

test('touch handles: finger-sized targets drawn as small dots, corners only, no size badge or spacing handles', async () => {
  const { page, context } = await openOnPhone(plainLink)
  try {
    const box = await page.locator('#subtitle').boundingBox()
    await page.touchscreen.tap(box.x + 30, box.y + box.height / 2)
    await page.waitForTimeout(600)
    const handles = await page.evaluate(() => {
      const visible = [...document.querySelectorAll('.froam-resize-handle')].filter((h) => getComputedStyle(h).display !== 'none')
      const dot = visible[0] && getComputedStyle(visible[0], '::after')
      return {
        count: visible.length,
        target: visible[0]?.getBoundingClientRect().width,
        dot: dot ? parseFloat(dot.width) : null,
        badge: [...document.querySelectorAll('.froam-resize-size-badge')].some((b) => getComputedStyle(b).display !== 'none'),
        spacing: [...document.querySelectorAll('.froam-spacing')].some((s) => getComputedStyle(s).display !== 'none'),
      }
    })
    assert(handles.count === 4, `${handles.count} handles on screen, not the 4 corners`)
    assert(handles.target >= 24, `handle target is ${handles.target}px — too small for a finger`)
    assert(handles.dot && handles.dot <= 14, `handle dot is ${handles.dot}px — it covers the copy`)
    assert(!handles.badge, 'the size badge shows on a phone')
    assert(!handles.spacing, 'spacing handles show on a phone')
  } finally { await context.close() }
})

test('an unpaired phone is told where its edit went, and cannot write the project', async () => {
  const { page, context } = await openOnPhone(plainLink)
  try {
    assert(!(await page.locator('.froam-tb__save-btn--repo').isVisible()), 'an unpaired phone shows Save to Repo')
    await selectAndWrite(page, 'From an unpaired phone')
    const before = designText()
    await page.keyboard.press('Control+Shift+S')
    await page.waitForTimeout(1500)
    const toast = await toastText(page)
    assert(!/offline/i.test(toast), `the phone was told the bridge is offline: "${toast}"`)
    assert(/computer/i.test(toast), `the phone wasn't told where its edit went: "${toast}"`)
    assert(designText() === before, 'an unpaired phone wrote the design')
    const published = fs.readFileSync(path.join(siteDir, 'froam', 'froam.published.json'), 'utf8')
    assert(published.includes('From an unpaired phone'), 'the edit did not reach the computer')
  } finally { await context.close() }
})

test('the pairing link: the phone is paired, the key leaves the address bar, and Save to Repo writes the project', async () => {
  const { page, context } = await openOnPhone(pairLink)
  // The page settles first: the pairing check and the computer's latest design both land after load.
  await page.waitForTimeout(2000)
  try {
    assert(!/froam-pair/.test(page.url()), `the key stayed in the address bar: ${page.url()}`)
    assert(await page.locator('.froam-tb__save-btn--repo').isVisible(), 'a paired phone has no Save to Repo')
    await selectAndWrite(page, 'Saved from my phone')
    await page.locator('.froam-tb__save-btn--repo').tap()
    for (let i = 0; i < 40 && !designText().includes('Saved from my phone'); i += 1) await sleep(150)
    assert(designText().includes('Saved from my phone'), `the paired save did not reach froam.design.json (toast: "${await toastText(page)}")`)
    const seen = []
    for (let i = 0; i < 30 && !seen.some((text) => /saved to your code/i.test(text)); i += 1) { seen.push(await toastText(page)); await sleep(100) }
    assert(seen.some((text) => /saved to your code/i.test(text)), `the paired phone was not told it saved to the code (saw: ${[...new Set(seen)].filter(Boolean).join(' / ') || 'no message'})`)
  } finally { await context.close() }
})

// Desktop flows down (src/editor/chef/cascade.ts): an edit saved in the editor's Desktop mode — the
// default, on a phone too — reaches every width, so the phone that made it sees it as a visitor.
test('what the phone saved is what a production visitor sees on a phone', async () => {
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
  const context = await browser.newContext({ ...PHONE })
  try {
    const visitor = await context.newPage()
    await visitor.goto(`http://127.0.0.1:${server.address().port}/`)
    await visitor.waitForTimeout(1200)
    const seen = await visitor.evaluate(() => document.getElementById('subtitle').innerText.trim())
    assert(seen === 'Saved from my phone', `a visitor to the production build sees "${seen}"`)
  } finally {
    await context.close()
    server.close()
  }
})

/* ─── run ─── */

const lan = (() => {
  const VIRTUAL = /warp|vpn|tun|tap|utun|vethernet|wsl|docker|virtualbox|vmware|vbox|hyper-?v|zerotier|tailscale|wireguard|^br-|^veth/i
  const all = Object.entries(os.networkInterfaces()).flatMap(([name, nets]) => (nets ?? []).filter((n) => n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')).map((n) => ({ name, address: n.address })))
  return (all.find((n) => !VIRTUAL.test(n.name)) ?? all[0])?.address
})()
if (!lan) {
  console.log('e2e phone: skipped — no network interface to reach the bridge as another device')
  process.exit(0)
}
if (!fs.existsSync(path.join(ROOT, 'dist', 'standalone', 'froam-editor.js'))) {
  console.log('e2e phone: dist/standalone is missing — run `npm run build` first')
  process.exit(1)
}
const browserPath = findBrowser()
if (!browserPath) {
  console.log('e2e phone: no Chrome or Chromium found — set FROAM_E2E_CHROME')
  process.exit(1)
}

siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-e2e-phone-'))
fs.cpSync(FIXTURE, siteDir, { recursive: true })
const port = await freePort()
const bridge = spawn(process.execPath, [BIN, 'dev', '--serve', '.', '--port', String(port), '--host'], { cwd: siteDir, env: { ...process.env, FROAM_SHARE: 'off', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
bridge.stdout.on('data', (d) => { bridgeLog += d })
bridge.stderr.on('data', (d) => { bridgeLog += d })
let passed = 0
try {
  for (let i = 0; i < 150 && !/froam-pair=/.test(bridgeLog); i += 1) await sleep(150)
  const key = bridgeLog.match(/#froam-pair=([A-Za-z0-9_-]+)/)?.[1]
  if (!key) throw new Error(`froam dev --host printed no pairing link:\n${bridgeLog.slice(-600)}`)
  plainLink = `http://${lan}:${port}/`
  pairLink = `${plainLink}#froam-pair=${key}`
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(plainLink)).ok) break } catch { /* not yet */ } await sleep(150) }
  browser = await chromium.launch({ executablePath: browserPath, headless: !process.env.FROAM_E2E_HEADED })
  console.log('phone')
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
  console.log(`e2e phone: setup failed — ${error.message}`)
} finally {
  await browser?.close().catch(() => {})
  bridge.kill()
  await sleep(300)
  try { fs.rmSync(siteDir, { recursive: true, force: true }) } catch { /* Windows may still hold a file */ }
}
console.log(`e2e phone: ${passed}/${tests.length} passed`)
process.exitCode = passed === tests.length ? 0 : 1
