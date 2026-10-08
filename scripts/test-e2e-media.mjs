#!/usr/bin/env node
/**
 * End-to-end: placing pictures and videos, in a real browser, through the
 * real CLI — and what a visitor then gets, from a plain static server.
 *
 *   node scripts/test-e2e-media.mjs          # headless
 *   FROAM_E2E_HEADED=1 node scripts/...      # watch it
 *
 * Requires `npm run build` first.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(ROOT, 'bin', 'froam.mjs')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/* ─── fixture ─── */

function crc32(buf) {
  let c
  const table = crc32.table ??= Array.from({ length: 256 }, (_, n) => {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function png(width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = y * (width * 3 + 1) + 1 + x * 3
    raw[o] = 120 + (y * 100) / height; raw[o + 1] = 170; raw[o + 2] = 235 - (y * 40) / height
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

/** An animated GIF, written uncompressed (a clear code every two pixels). */
function gif() {
  const W = 160, H = 120
  const lzw = (indices) => {
    const bits = []
    const emit = (code) => { for (let i = 0; i < 3; i++) bits.push((code >> i) & 1) }
    for (let i = 0; i < indices.length; i += 2) { emit(4); emit(indices[i]); if (i + 1 < indices.length) emit(indices[i + 1]) }
    emit(5)
    const bytes = []
    for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8 && i + j < bits.length; j++) b |= bits[i + j] << j; bytes.push(b) }
    const out = [2]
    for (let i = 0; i < bytes.length; i += 255) { const chunk = bytes.slice(i, i + 255); out.push(chunk.length, ...chunk) }
    out.push(0)
    return out
  }
  const frame = (shift) => Array.from({ length: W * H }, (_, i) => {
    const x = i % W, y = Math.floor(i / W)
    return (x - (40 + shift)) ** 2 + (y - 60) ** 2 < 625 ? 2 : y < 60 ? 0 : 1
  })
  const bytes = [...Buffer.from('GIF89a'), W, 0, H, 0, 0xf1, 0, 0, 0xf6, 0xa3, 0x5b, 0x2d, 0x2a, 0x6b, 0xff, 0xe9, 0xa8, 0x22, 0xc5, 0x5e,
    0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0]
  for (const shift of [0, 80]) bytes.push(0x21, 0xf9, 4, 0, 40, 0, 0, 0, 0x2c, 0, 0, 0, 0, W, 0, H, 0, 0, ...lzw(frame(shift)))
  bytes.push(0x3b)
  return Buffer.from(bytes)
}

function writeFixture(dir) {
  fs.writeFileSync(path.join(dir, 'wide.png'), png(1280, 720))
  fs.writeFileSync(path.join(dir, 'ball.gif'), gif())
  // A real clip: headless Chrome records nothing from a canvas.
  fs.copyFileSync(path.join(ROOT, 'test', 'e2e', 'media', 'clip.webm'), path.join(dir, 'clip.webm'))
  fs.writeFileSync(path.join(dir, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="400" height="200" fill="#0ea5e9"/><circle cx="100" cy="100" r="70" fill="#fde047"/></svg>')
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Media fixture</title>
<link rel="stylesheet" href="/froam/froam.generated.css"><script src="/froam/froam.runtime.js" defer></script>
<style>
  * { box-sizing: border-box } body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #fdf9f5 }
  main { max-width: 960px; margin: 0 auto; padding: 40px 24px } h1 { margin: 0 0 24px }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px } figure { margin: 0; padding: 12px; background: #fff; border-radius: 16px }
  figure img, figure video { display: block; width: 100%; height: auto; border-radius: 10px }
  .hero { margin-top: 28px; padding: 64px 32px; border-radius: 16px; background: #1d2433; color: #fff }
</style></head>
<body><main>
  <h1>Media fixture</h1>
  <div class="cards">
    <figure><img id="plain" src="wide.png" alt=""></figure>
    <figure><img id="responsive" src="wide.png" srcset="wide.png 1280w" sizes="420px" alt=""></figure>
    <figure><picture><source srcset="wide.png" type="image/png"><img id="pictured" src="wide.png" alt=""></picture></figure>
    <figure><img id="vector" src="wide.png" alt=""></figure>
  </div>
  <section class="hero" id="hero"><h2 id="hero-title">Hero</h2><p>Copy above a background video.</p></section>
</main></body></html>`)
}

/* ─── harness ─── */

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

async function waitForHttp(url) {
  for (let started = Date.now(); Date.now() - started < 20000;) {
    try { if ((await fetch(url)).ok) return } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`no answer at ${url}`)
}

function serveStatic(dir) {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.mp4': 'video/mp4' }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
    const file = path.join(dir, rel)
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, () => resolve({ url: `http://localhost:${server.address().port}/`, close: () => server.close() })))
}

async function openEditor(page, url) {
  await page.goto(url)
  await page.waitForSelector('.global-chef-button', { timeout: 20000 })
  await page.keyboard.press('Control+.')
  await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 20000 })
  await page.waitForTimeout(600)
}

async function select(page, selector) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), selector)
  await page.waitForTimeout(100)
  const box = await page.locator(selector).first().boundingBox()
  assert(box, `${selector} is not on the page`)
  await page.mouse.click(box.x + Math.min(box.width - 8, box.width * 0.85), box.y + Math.min(24, box.height / 2))
  await page.waitForTimeout(200)
}

async function deselect(page) {
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
}

/** Put a file into Froam's upload input, the way choosing it in a file dialog would. */
async function upload(page, makeFile) {
  await page.evaluate(makeFile)
  await page.evaluate(() => {
    const input = document.querySelector('input.fs-hidden-input[type=file]')
    const dt = new DataTransfer()
    dt.items.add(window.__upload)
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForSelector('.froam-image-fit__actions .is-accent:not([disabled])', { timeout: 20000 })
}

async function place(page) {
  await page.click('.froam-image-fit__actions .is-accent')
  await page.waitForSelector('.froam-image-fit', { state: 'detached', timeout: 30000 })
  await page.waitForTimeout(300)
}

const photo = () => (async () => {
  const c = document.createElement('canvas'); c.width = 3000; c.height = 4000
  const g = c.getContext('2d'); g.fillStyle = '#22c55e'; g.fillRect(0, 0, 3000, 4000); g.fillStyle = '#0f172a'; g.fillRect(0, 2000, 3000, 2000)
  window.__upload = new File([await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))], 'photo.jpg', { type: 'image/jpeg' })
})()
/** One of the fixture's own files, as if chosen from disk. */
const fetched = async ([url, name, type]) => { window.__upload = new File([await (await fetch(url)).blob()], name, { type }) }
const box = (page, selector) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }, selector)

/* ─── tests ─── */

const tests = []
const test = (name, fn) => tests.push({ name, fn })

test('a photo into a responsive <img>: it shows, in widths for the slot, and the card keeps its size', async ({ page }) => {
  const before = await box(page, '#responsive')
  await select(page, '#responsive')
  await page.evaluate(photo)
  await upload(page, () => {})
  await place(page)
  const after = await page.evaluate(() => {
    const img = document.getElementById('responsive')
    return { current: img.currentSrc, srcset: img.getAttribute('srcset') ?? '' }
  })
  assert(after.current.includes('/__froam/media/'), `the page's own srcset still wins: ${after.current}`)
  assert(after.srcset.split(',').length >= 2, `expected several widths, got "${after.srcset}"`)
  assert(JSON.stringify(await box(page, '#responsive')) === JSON.stringify(before), 'the card changed size')
})

test('a photo into a <picture>: its <source> no longer wins', async ({ page }) => {
  await deselect(page)
  await select(page, '#pictured')
  await page.evaluate(photo)
  await upload(page, () => {})
  await place(page)
  const current = await page.evaluate(() => document.getElementById('pictured').currentSrc)
  assert(current.includes('/__froam/media/'), `the <source> still wins: ${current}`)
})

test('an SVG into an <img> stays a vector, and the card keeps its shape', async ({ page }) => {
  const before = await box(page, '#vector')
  await deselect(page)
  await select(page, '#vector')
  await page.evaluate(fetched, ['/logo.svg', 'logo.svg', 'image/svg+xml'])
  await upload(page, () => {})
  await place(page)
  const src = await page.evaluate(() => document.getElementById('vector').getAttribute('src'))
  assert(/\.svg$/.test(src), `expected the SVG itself, got ${src}`)
  assert(JSON.stringify(await box(page, '#vector')) === JSON.stringify(before), `card reshaped: ${JSON.stringify(before)} → ${JSON.stringify(await box(page, '#vector'))}`)
})

test('a GIF with nothing selected: a new frame, the GIF itself as its background (it keeps moving)', async ({ page }) => {
  await deselect(page)
  const frames = await page.evaluate(() => document.querySelectorAll('[data-froam-image-frame]').length)
  await page.evaluate(fetched, ['/ball.gif', 'ball.gif', 'image/gif'])
  await upload(page, () => {})
  await place(page)
  const background = await page.evaluate(() => { const all = document.querySelectorAll('[data-froam-image-frame]'); return getComputedStyle(all[all.length - 1]).backgroundImage })
  assert((await page.evaluate(() => document.querySelectorAll('[data-froam-image-frame]').length)) === frames + 1, 'no new frame')
  assert(/\.gif"\)$/.test(background), `expected the GIF, got ${background}`)
})

test('a video behind a section: it plays under the copy, which stays clickable', async ({ page }) => {
  await deselect(page)
  await select(page, '#hero')
  await page.evaluate(fetched, ['/clip.webm', 'clip.webm', 'video/webm'])
  await upload(page, () => {})
  await place(page)
  const state = await page.evaluate(() => {
    const video = document.querySelector('#hero > froam-backdrop video')
    const title = document.getElementById('hero-title').getBoundingClientRect()
    const hit = document.elementFromPoint(title.x + 5, title.y + 5)
    return { video: Boolean(video), poster: video?.getAttribute('poster') ?? '', copyOnTop: hit?.id === 'hero-title' }
  })
  assert(state.video, 'no background video')
  assert(state.poster.includes('/__froam/media/'), 'no poster was made')
  assert(state.copyOnTop, 'the video covers the copy')
})

test('Save to Repo: the design holds references, not pictures; the CSS points at media/', async ({ page, siteDir }) => {
  const designPath = path.join(siteDir, 'froam', 'froam.design.json')
  const stamp = () => (fs.existsSync(designPath) ? fs.statSync(designPath).mtimeMs : 0)
  const before = stamp()
  await page.keyboard.press('Control+Shift+S')
  for (const started = Date.now(); stamp() === before && Date.now() - started < 10000;) await new Promise((r) => setTimeout(r, 120))
  await new Promise((r) => setTimeout(r, 300))
  const design = fs.readFileSync(designPath, 'utf8')
  assert(!/data:(?:image|video)\//.test(design), 'a picture is still inline in the design')
  assert(/froam-media:[a-f0-9]{32}\.webm/.test(design), 'the video is not referenced')
  const media = fs.readdirSync(path.join(siteDir, 'froam', 'media'))
  assert(media.some((name) => name.endsWith('.webp')), `no WebP was made: ${media.join(', ')}`)
  assert(design.length < 40_000, `design is ${design.length} bytes`)
})

test('after a reload: the background video is still there, and Adjust starts from the original', async ({ page, url }) => {
  await openEditor(page, url)
  assert(await page.evaluate(() => Boolean(document.querySelector('#hero > froam-backdrop video'))), 'the background video was lost on reload')
  await select(page, '#responsive')
  await page.click('[aria-label="Adjust image or video"]')
  await page.waitForSelector('.froam-image-fit__picture', { timeout: 15000 })
  await page.waitForFunction(() => document.querySelector('.froam-image-fit__picture')?.naturalWidth > 0, null, { timeout: 15000 })
  const natural = await page.evaluate(() => { const img = document.querySelector('.froam-image-fit__picture'); return [img.naturalWidth, img.naturalHeight] })
  assert(natural[0] === 3000 && natural[1] === 4000, `Adjust opened ${natural.join('×')}, not the 3000×4000 original`)
  await page.keyboard.press('Escape')
})

test('what a visitor gets: no editor, media from /froam/media, videos play when on screen', async ({ context, siteDir }) => {
  const site = await serveStatic(siteDir)
  const visitor = await context.newPage()
  try {
    await visitor.goto(site.url)
    await visitor.waitForFunction(() => document.getElementById('responsive')?.currentSrc.includes('/froam/media/'), null, { timeout: 15000 })
    const pictured = await visitor.evaluate(() => document.getElementById('pictured').currentSrc)
    assert(pictured.includes('/froam/media/'), `picture shows ${pictured}`)
    await visitor.evaluate(() => document.getElementById('hero').scrollIntoView({ block: 'center' }))
    await visitor.waitForFunction(() => { const v = document.querySelector('#hero froam-backdrop video'); return v && !v.paused && v.currentTime > 0 }, null, { timeout: 15000 })
    assert(!(await visitor.evaluate(() => document.getElementById('froam-editor-portal'))), 'the editor loaded for a visitor')
  } finally {
    await visitor.close()
    site.close()
  }
})

/* ─── run ─── */

const browserPath = findBrowser()
if (!browserPath) { console.log('e2e media: no Chrome found — set FROAM_E2E_CHROME'); process.exit(1) }
const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-media-e2e-'))
writeFixture(siteDir)
const port = await freePort()
const url = `http://localhost:${port}/`
const bridge = spawn(process.execPath, [BIN, 'dev', '--serve', '.', '--port', String(port)], { cwd: siteDir, env: { ...process.env, FROAM_SHARE: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] })
let bridgeLog = ''
bridge.stdout.on('data', (d) => { bridgeLog += d })
bridge.stderr.on('data', (d) => { bridgeLog += d })
const browser = await chromium.launch({ executablePath: browserPath, headless: !process.env.FROAM_E2E_HEADED, args: ['--autoplay-policy=no-user-gesture-required'] })
let passed = 0
try {
  await waitForHttp(url)
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await openEditor(page, url)
  for (const t of tests) {
    try {
      await t.fn({ page, context, siteDir, url })
      passed += 1
      console.log(`  ok  ${t.name}`)
    } catch (error) {
      console.log(`  FAIL ${t.name}\n       ${error.message}`)
    }
  }
  if (errors.length) console.log(`  (page errors: ${[...new Set(errors)].slice(0, 3).join(' | ')})`)
  await context.close()
} catch (error) {
  console.log(`e2e media: setup failed — ${error.message}\n${bridgeLog.slice(-800)}`)
} finally {
  await browser.close()
  bridge.kill()
  await new Promise((r) => setTimeout(r, 500))
  try { fs.rmSync(siteDir, { recursive: true, force: true }) } catch { /* still in use */ }
}
console.log(`e2e media: ${passed}/${tests.length} passed`)
if (passed !== tests.length) process.exit(1)
