#!/usr/bin/env node
/**
 * How fast the editor feels on a heavy page, measured in a real browser.
 *
 * A generated page (hundreds of sections, thousands of elements, hundreds of
 * images) is served through the real CLI, the editor is opened, and a person
 * is played back: hover, click to select, type into a heading, undo, scroll,
 * upload a 12-megapixel photo and place it. For every phase it records what
 * a person feels:
 *
 *   INP    the slowest interaction, input to next paint (Event Timing API)
 *   TBT    total blocking time: the part of every long task over 50 ms
 *   max    the longest single task
 *
 * plus how big the saved design got and the JS heap.
 *
 *   node scripts/benchmark-editor.mjs                 # default size
 *   FROAM_BENCH_SECTIONS=600 node scripts/...         # heavier page
 *   FROAM_E2E_HEADED=1 node scripts/...               # watch it
 *   FROAM_BENCH_PROFILE=1 node scripts/...            # top functions per phase
 *
 * Requires `npm run build` first. For readable profile names build with
 * FROAM_READABLE_BUILD=1.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(ROOT, 'bin', 'froam.mjs')
const SECTIONS = Number(process.env.FROAM_BENCH_SECTIONS ?? 300)
const PROFILE = Boolean(process.env.FROAM_BENCH_PROFILE)

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

function png(width, height, seed) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const o = y * (width * 3 + 1) + 1 + x * 3
      raw[o] = (x * 255 / width + seed * 37) & 255
      raw[o + 1] = (y * 255 / height + seed * 91) & 255
      raw[o + 2] = ((x + y) * 128 / (width + height) + seed * 13) & 255
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4)
  header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function writeFixture(dir) {
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true })
  for (let i = 0; i < 24; i++) fs.writeFileSync(path.join(dir, 'img', `p${i}.png`), png(640, 400, i))
  const words = 'design system layout spacing rhythm colour type contrast grid motion surface detail craft balance'.split(' ')
  const sentence = (n, s) => Array.from({ length: n }, (_, i) => words[(i * 7 + s) % words.length]).join(' ')
  const sections = Array.from({ length: SECTIONS }, (_, s) => `
    <section class="s" id="s${s}">
      <div class="wrap">
        <h2 id="h${s}">${sentence(5, s)}</h2>
        <p>${sentence(60, s)}.</p>
        <div class="row">
          <figure><img src="img/p${s % 24}.png" alt="" width="640" height="400"><figcaption>${sentence(4, s + 1)}</figcaption></figure>
          <figure><img src="img/p${(s + 7) % 24}.png" alt="" width="640" height="400"><figcaption>${sentence(4, s + 2)}</figcaption></figure>
        </div>
        <ul>${Array.from({ length: 5 }, (_, i) => `<li><a href="#s${(s + i) % SECTIONS}">${sentence(3, s + i)}</a></li>`).join('')}</ul>
        <div class="cta"><button type="button">${sentence(2, s)}</button><span class="tag">${sentence(1, s)}</span></div>
      </div>
    </section>`).join('')
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Heavy page</title>
<style>
  * { box-sizing: border-box } body { margin: 0; font: 16px/1.6 system-ui, sans-serif; color: #0b1524; background: #fbf8f4 }
  .s { padding: 48px 24px; border-bottom: 1px solid #e8e2da } .s:nth-child(2n) { background: #fff }
  .wrap { max-width: 1040px; margin: 0 auto } h2 { font-size: 32px; margin: 0 0 12px; text-transform: capitalize }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0 } figure { margin: 0 }
  img { display: block; width: 100%; height: auto; border-radius: 12px } figcaption { font-size: 13px; color: #667 }
  ul { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; list-style: none } a { color: #2350c8 }
  .cta { display: flex; gap: 12px; align-items: center } button { padding: 10px 18px; border: 0; border-radius: 999px; background: #0b1524; color: #fff }
  .tag { padding: 4px 10px; border-radius: 999px; background: #eef3ff; font-size: 12px }
</style></head><body><main>${sections}</main></body></html>`)
}

/* ─── harness ─── */

function findBrowser() {
  if (process.env.FROAM_E2E_CHROME) return process.env.FROAM_E2E_CHROME
  try {
    const bundled = chromium.executablePath()
    if (bundled && fs.existsSync(bundled)) return bundled
  } catch { /* none */ }
  for (const cache of [path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'), path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')]) {
    if (!fs.existsSync(cache)) continue
    for (const dir of fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        if (fs.existsSync(path.join(cache, dir, rel))) return path.join(cache, dir, rel)
      }
    }
  }
  return ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p)) ?? null
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
  throw new Error(`bridge did not come up at ${url}`)
}

/** Long tasks and interactions, collected from the first byte of the page. */
const OBSERVE = () => {
  window.__bench = { tasks: [], events: [] }
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__bench.tasks.push({ start: e.startTime, duration: e.duration }) }).observe({ type: 'longtask', buffered: true })
  } catch { /* unsupported */ }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.interactionId) window.__bench.events.push({ start: e.startTime, duration: e.duration, name: e.name })
    }).observe({ type: 'event', durationThreshold: 16, buffered: true })
  } catch { /* unsupported */ }
}

const now = (page) => page.evaluate(() => performance.now())
const settle = (page, ms = 300) => page.waitForTimeout(ms)

async function phase(page, cdp, name, fn) {
  const start = await now(page)
  if (PROFILE) await cdp.send('Profiler.start')
  const wallStart = Date.now()
  await fn()
  await settle(page, 400)
  const wall = Date.now() - wallStart
  const end = await now(page)
  let top = []
  if (PROFILE) {
    const { profile } = await cdp.send('Profiler.stop')
    top = topFunctions(profile)
  }
  const { tasks, events } = await page.evaluate(([from, to]) => ({
    tasks: window.__bench.tasks.filter((t) => t.start >= from && t.start <= to),
    events: window.__bench.events.filter((e) => e.start >= from && e.start <= to),
  }), [start, end])
  const tbt = tasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0)
  const max = tasks.reduce((m, t) => Math.max(m, t.duration), 0)
  const durations = events.map((e) => e.duration).sort((a, b) => a - b)
  const inp = durations.length ? durations[durations.length - 1] : 0
  const p75 = durations.length ? durations[Math.floor(durations.length * 0.75)] : 0
  return { name, wall, tbt: Math.round(tbt), max: Math.round(max), longTasks: tasks.length, inp: Math.round(inp), p75: Math.round(p75), interactions: durations.length, top }
}

function topFunctions(profile, limit = 8) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const parentOf = new Map()
  for (const node of profile.nodes) for (const child of node.children ?? []) parentOf.set(child, node.id)
  const label = (node) => {
    const f = node.callFrame
    return `${f.functionName || '(anon)'} ${path.basename(f.url || '')}:${f.lineNumber + 1}`
  }
  const isPage = (node) => /froam|GlobalChef|chunk-/.test(node.callFrame.url || '')
  const self = new Map()
  profile.samples.forEach((id, i) => {
    const node = byId.get(id)
    if (['(idle)', '(program)', '(garbage collector)', '(root)'].includes(node.callFrame.functionName)) return
    // A native (getBoundingClientRect…) is named with the editor code that called it.
    let key = label(node)
    if (!isPage(node)) {
      let up = parentOf.get(id)
      while (up !== undefined && !isPage(byId.get(up))) up = parentOf.get(up)
      if (up === undefined) return
      key = `${key} ← ${label(byId.get(up))}`
    }
    self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000)
  })
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, ms]) => `${ms.toFixed(1)}ms ${k}`)
}

async function selectAt(page, selector) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), selector)
  await page.waitForTimeout(60)
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error(`${selector} not on the page`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(120)
}

async function run() {
  const browserPath = findBrowser()
  if (!browserPath) { console.log('benchmark: no Chrome found — set FROAM_E2E_CHROME'); process.exit(1) }
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-bench-'))
  writeFixture(siteDir)
  const port = await freePort()
  const url = `http://localhost:${port}/`
  const bridge = spawn(process.execPath, [BIN, 'dev', '--serve', '.', '--port', String(port)], { cwd: siteDir, env: { ...process.env, FROAM_SHARE: 'off' }, stdio: 'ignore' })
  const browser = await chromium.launch({ executablePath: browserPath, headless: !process.env.FROAM_E2E_HEADED })
  const results = []
  try {
    await waitForHttp(url)
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await page.addInitScript(OBSERVE)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
    await page.goto(url)
    await page.waitForSelector('.global-chef-button', { timeout: 30000 })
    const elements = await page.evaluate(() => document.querySelectorAll('main *').length)

    results.push(await phase(page, cdp, 'open editor', async () => {
      await page.keyboard.press('Control+.')
      await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 30000 })
    }))

    results.push(await phase(page, cdp, 'hover sweep', async () => {
      for (let i = 0; i < 40; i++) {
        await page.mouse.move(200 + (i * 29) % 1000, 150 + (i * 53) % 650)
        await page.waitForTimeout(16)
      }
    }))

    results.push(await phase(page, cdp, 'select ×15', async () => {
      for (let i = 0; i < 15; i++) await selectAt(page, i % 3 === 0 ? `#h${i * 7}` : i % 3 === 1 ? `#s${i * 7} p` : `#s${i * 7} img`)
    }))

    results.push(await phase(page, cdp, 'type 40 chars', async () => {
      await selectAt(page, '#h3')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(100)
      await page.keyboard.press('End')
      for (const ch of ' and a little more copy to type in.....') await page.keyboard.type(ch, { delay: 25 })
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
    }))

    results.push(await phase(page, cdp, 'undo ×10', async () => {
      for (let i = 0; i < 10; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(60) }
    }))

    results.push(await phase(page, cdp, 'scroll', async () => {
      for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(32) }
    }))

    // A phone photo: 4000×3000 with noise, so it encodes like a real one.
    const photo = await phase(page, cdp, 'upload 12MP photo → dialog', async () => {
      await selectAt(page, '#s40 img')
      await page.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 4000; c.height = 3000
        const g = c.getContext('2d')
        const grad = g.createLinearGradient(0, 0, 4000, 3000); grad.addColorStop(0, '#f6a35b'); grad.addColorStop(1, '#2d2a6b')
        g.fillStyle = grad; g.fillRect(0, 0, 4000, 3000)
        const noise = g.getImageData(0, 0, 4000, 3000)
        for (let i = 0; i < noise.data.length; i += 4) { const n = (Math.random() - 0.5) * 40; noise.data[i] += n; noise.data[i + 1] += n; noise.data[i + 2] += n }
        g.putImageData(noise, 0, 0)
        window.__photo = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))
      })
      // Only the upload itself is the editor's work; making the photo is not.
      await page.evaluate(() => { window.__bench.tasks.length = 0; window.__bench.events.length = 0 })
      await page.evaluate(() => {
        const input = document.querySelector('input.fs-hidden-input[type=file]')
        const dt = new DataTransfer(); dt.items.add(new File([window.__photo], 'photo.jpg', { type: 'image/jpeg' }))
        input.files = dt.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await page.waitForSelector('.froam-image-fit__stage img', { timeout: 30000 })
    })
    photo.photoMB = Number((await page.evaluate(() => window.__photo.size / 1048576)).toFixed(1))
    results.push(photo)

    results.push(await phase(page, cdp, 'drag + zoom in dialog', async () => {
      const box = await page.locator('.froam-image-fit__stage').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      for (let i = 0; i < 20; i++) await page.mouse.move(box.x + box.width / 2 + i * 4, box.y + box.height / 2 + i * 3)
      await page.mouse.up()
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(30) }
    }))

    results.push(await phase(page, cdp, 'place photo', async () => {
      await page.click('.froam-image-fit__actions .is-accent')
      await page.waitForSelector('.froam-image-fit', { state: 'detached', timeout: 30000 })
    }))

    results.push(await phase(page, cdp, 'edit after photo ×10', async () => {
      for (let i = 0; i < 10; i++) await selectAt(page, `#h${41 + i}`)
      await selectAt(page, '#h41')
      await page.keyboard.press('Enter')
      for (const ch of ' more') await page.keyboard.type(ch, { delay: 25 })
      await page.keyboard.press('Escape')
    }))

    const storage = await page.evaluate(() => {
      let biggest = 0
      let total = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        const size = (localStorage.getItem(key) ?? '').length
        total += size
        biggest = Math.max(biggest, size)
      }
      return { total, biggest }
    })
    const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)

    console.log(`\nFroam editor benchmark — ${SECTIONS} sections, ${elements} elements in <main>\n`)
    console.log('phase'.padEnd(30), 'INP'.padStart(6), 'p75'.padStart(6), 'TBT'.padStart(7), 'max'.padStart(6), 'tasks'.padStart(6), 'wall'.padStart(7))
    for (const r of results) {
      console.log(r.name.padEnd(30), `${r.inp}`.padStart(6), `${r.p75}`.padStart(6), `${r.tbt}`.padStart(7), `${r.max}`.padStart(6), `${r.longTasks}`.padStart(6), `${r.wall}`.padStart(7))
      for (const line of r.top) console.log('     ', line)
    }
    console.log(`\nphoto ${photo.photoMB} MB · localStorage ${(storage.total / 1024).toFixed(0)} KB (largest key ${(storage.biggest / 1024).toFixed(0)} KB) · JS heap ${(heap / 1048576).toFixed(0)} MB`)
    const totals = results.reduce((sum, r) => sum + r.tbt, 0)
    console.log(`total blocking time ${totals} ms · worst interaction ${Math.max(...results.map((r) => r.inp))} ms`)
    if (process.env.FROAM_BENCH_JSON) fs.writeFileSync(process.env.FROAM_BENCH_JSON, JSON.stringify({ sections: SECTIONS, elements, results, storage, heap }, null, 2))
    await context.close()
  } finally {
    await browser.close()
    bridge.kill()
    await new Promise((r) => setTimeout(r, 500))
    try { fs.rmSync(siteDir, { recursive: true, force: true }) } catch { /* in use */ }
  }
}

await run()
