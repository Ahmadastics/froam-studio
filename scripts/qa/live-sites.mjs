#!/usr/bin/env node
/**
 * Live sites — does Froam load a real website fully, and can you work on all of it?
 *
 * The stack matrix proves the loop on sites we built. This asks the question a
 * visitor to froam.vercel.app asks first: "will it work on MY site?" For each
 * site it loads the page twice in the same browser, once directly and once
 * through `froam dev --app`, and compares:
 *
 *   load      requests that fail only through Froam, new errors, content that
 *             is missing (elements, words, page height, pictures) and how far
 *             the two screenshots differ
 *   editor    does the Froam button come up, and does the editor open
 *   select    clicks dozens of visible parts spread down the whole page and
 *             checks the editor picks the thing under the pointer
 *   write     selects the main heading, types, and checks the words changed
 *   reach     what the editor cannot get into at all: iframes, shadow DOM,
 *             canvas
 *
 *   node scripts/qa/live-sites.mjs                        # the default set
 *   node scripts/qa/live-sites.mjs --sites https://stripe.com,https://dominos.ng
 *   node scripts/qa/live-sites.mjs --samples 60 --headed
 *
 * Nothing is saved to the sites: the proxy is read-only and the workspace is a
 * temp folder. Uses the working tree's CLI and dist (run `npm run build` first).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { tmpdir, parseArgs, findBrowser, freePort, waitForHttp, start, sleep, stampDir, SEL } from './lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const CLI = path.join(REPO, 'bin', 'froam.mjs')
const args = parseArgs()
const SAMPLES = Number(args.samples) || 40
const outDir = path.resolve(args.out && args.out !== true ? args.out : stampDir(path.join(tmpdir(), 'froam-qa'), 'live-sites'))
const work = fs.mkdtempSync(path.join(tmpdir(), 'froam-live-'))
fs.mkdirSync(outDir, { recursive: true })

// Different builders, frameworks and weights. Public pages, no login.
const DEFAULT_SITES = [
  'https://www.dominos.ng/',
  'https://paystack.com/',
  'https://stripe.com/',
  'https://vercel.com/',
  'https://linear.app/',
  'https://tailwindcss.com/',
  'https://svelte.dev/',
  'https://astro.build/',
  'https://nuxt.com/',
  'https://webflow.com/',
  'https://www.allbirds.com/',
  'https://wordpress.org/news/',
]
const sites = args.sites && args.sites !== true ? String(args.sites).split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_SITES

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const FROAM_OWN = /\/(froam\.js|froam\.css|froam-modules\/|__froam\/|api\/froam\/)/

console.log(`◆ Froam live sites · ${sites.length} sites · ${SAMPLES} clicks each\n  out ${outDir}\n`)
const browser = await chromium.launch({ executablePath: findBrowser(chromium), headless: !args.headed })
const rows = []
for (const site of sites) rows.push(await runSite(site))
await browser.close()
writeReport(rows)
fs.rmSync(work, { recursive: true, force: true })

/* ─────────────────────────────────────────────────────────────── */

async function runSite(siteUrl) {
  const target = new URL(siteUrl)
  const id = target.hostname.replace(/^www\./, '')
  const row = { site: siteUrl, id, notes: [] }
  console.log(`▸ ${id}`)

  // 1. Directly: what the site is without Froam.
  const direct = await loadAndMeasure(siteUrl, null, `${id}-direct`)
  row.direct = direct
  if (direct.error) {
    row.notes.push(`direct load failed: ${direct.error}`)
    console.log(`    · direct load failed (${direct.error}) — skipped`)
    return row
  }
  if (direct.blocked) row.notes.push('the site may block automated browsers; numbers below are for what it served')

  // 2. Through Froam.
  const port = await freePort()
  const dir = path.join(work, id)
  const bridge = start(process.execPath, [CLI, 'dev', '--app', siteUrl, '--port', String(port), '--dir', dir], {
    cwd: work, env: { FROAM_SHARE: 'off', FROAM_NO_OPEN: '1', BROWSER: 'none' },
  })
  try {
    try { await waitForHttp(`http://localhost:${port}/__froam/config`, 60000) } catch (err) {
      row.notes.push(`froam dev did not start: ${err.message} ${bridge.log().slice(-300)}`)
      return row
    }
    const proxiedUrl = `http://localhost:${port}${target.pathname}${target.search}`
    const proxied = await loadAndMeasure(proxiedUrl, target, `${id}-froam`, true)
    row.proxied = proxied
    if (proxied.error) { row.notes.push(`load through Froam failed: ${proxied.error}`); return row }
    row.compare = compare(direct, proxied)
    await sideBySide(`${id}-direct`, `${id}-froam`, id)
    row.visualDiff = await pixelDiff(`${id}-direct`, `${id}-froam`)
    printLoad(row)
  } finally {
    await bridge.stop()
  }
  return row
}

/**
 * Load, settle, scroll the whole page (lazy content), measure; through Froam,
 * then open the editor and work on the page.
 */
async function loadAndMeasure(url, target, shot, viaFroam = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, locale: 'en-US' })
  const page = await context.newPage()
  const requests = new Map() // url → { ok, status, failure }
  const consoleErrors = []
  const pageErrors = []
  const norm = (u) => {
    try {
      const x = new URL(u)
      if (target && (x.hostname === 'localhost' || x.hostname === '127.0.0.1')) return `${target.origin}${x.pathname}${x.search}`
      return x.href
    } catch { return u }
  }
  page.on('response', (res) => {
    const u = res.url()
    if (viaFroam && FROAM_OWN.test(u)) return
    requests.set(norm(u), { ok: res.status() < 400, status: res.status(), type: res.request().resourceType() })
  })
  page.on('requestfailed', (req) => {
    const u = req.url()
    if (viaFroam && FROAM_OWN.test(u)) return
    const failure = req.failure()?.errorText ?? '?'
    if (/ERR_ABORTED/.test(failure)) return
    requests.set(norm(u), { ok: false, status: 0, failure, type: req.resourceType() })
  })
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)))

  const result = {}
  try {
    const t0 = Date.now()
    const res = await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    result.status = res?.status() ?? 0
    result.loadMs = Date.now() - t0
    await sleep(2500)
    await scrollWholePage(page)
    result.metrics = await measure(page)
    result.blocked = result.status === 403 || result.status === 429 || /captcha|access denied|attention required|just a moment/i.test(result.metrics.title)
    await page.evaluate(() => window.scrollTo(0, 0))
    await sleep(800)
    // The Froam button would differ in every screenshot: hide it for the shot.
    if (viaFroam) await page.addStyleTag({ content: '.global-chef-button,[data-chef-editor-root="true"]{visibility:hidden!important}' }).catch(() => {})
    await page.screenshot({ path: path.join(outDir, `${shot}.png`) })
    if (viaFroam) await page.addStyleTag({ content: '.global-chef-button,[data-chef-editor-root="true"]{visibility:visible!important}' }).catch(() => {})
    result.requests = [...requests.entries()].map(([u, r]) => ({ url: u, ...r }))
    result.consoleErrors = consoleErrors.slice(0, 20)
    result.pageErrors = pageErrors.slice(0, 20)
    if (viaFroam) {
      result.editor = await openEditorHere(page)
      if (result.editor.opened) {
        result.select = await selectionSweep(page)
        result.write = await writeHeading(page)
        result.reach = await unreachable(page)
      }
      result.consoleErrorsAfter = consoleErrors.slice(0, 30)
      result.pageErrorsAfter = pageErrors.slice(0, 30)
      await page.screenshot({ path: path.join(outDir, `${shot}-editor.png`) }).catch(() => {})
    }
  } catch (err) {
    result.error = err.message.split('\n')[0]
  } finally {
    await context.close()
  }
  return result
}

async function scrollWholePage(page) {
  for (let i = 0; i < 40; i += 1) {
    const done = await page.evaluate(() => {
      window.scrollBy(0, Math.round(window.innerHeight * 0.85))
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
    }).catch(() => true)
    await sleep(250)
    if (done) break
  }
  await sleep(1500)
}

function measure(page) {
  return page.evaluate(() => {
    const own = (el) => el.closest('[data-chef-editor-root="true"],[id^="froam-"],[data-froam-stage]')
    const all = [...document.querySelectorAll('body *')].filter((el) => !own(el))
    let visible = 0
    for (const el of all) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') visible += 1
    }
    const imgs = [...document.images].filter((i) => !own(i))
    const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim()
    return {
      title: document.title,
      elements: all.length,
      visible,
      textChars: text.length,
      height: document.documentElement.scrollHeight,
      images: imgs.length,
      imagesLoaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      stylesheets: document.styleSheets.length,
      fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').length,
      iframes: [...document.querySelectorAll('iframe')].filter((f) => !own(f)).length,
      shadowHosts: all.filter((el) => el.shadowRoot).length,
      canvases: all.filter((el) => el.tagName === 'CANVAS').length,
    }
  })
}

async function openEditorHere(page) {
  const t0 = Date.now()
  try {
    await page.waitForSelector(SEL.launcher, { timeout: 30000 })
    const launcherMs = Date.now() - t0
    await page.keyboard.press('Control+.')
    // A site with its own shortcuts can take Ctrl+.; a person then clicks the button.
    const opened = await page.waitForSelector(SEL.chrome, { timeout: 5000 }).then(() => true, () => false)
    if (!opened) {
      await page.click(SEL.launcher, { timeout: 10000 })
      await page.waitForSelector(SEL.chrome, { timeout: 20000 })
    }
    // The first-open scan runs once; let it finish or skip it.
    await sleep(1500)
    await page.keyboard.press('Escape').catch(() => {})
    await sleep(2500)
    return { opened: true, launcherMs, openMs: Date.now() - t0 }
  } catch (err) {
    return { opened: false, error: err.message.split('\n')[0] }
  }
}

/**
 * Click the middle of N visible parts spread down the page; the editor should
 * select that part (or, for an element that is just a wrapper of one other
 * element, its near relative). A part covered by something else at its middle
 * is not clickable for a person either, so it's counted apart.
 */
async function selectionSweep(page) {
  const startUrl = page.url()
  const candidates = await page.evaluate((n) => {
    const own = (el) => el.closest('[data-chef-editor-root="true"],[id^="froam-"],[data-froam-stage]')
    const leafy = (el) => {
      const tag = el.tagName
      if (['IMG', 'SVG', 'BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'VIDEO', 'PICTURE', 'H1', 'H2', 'H3', 'H4', 'P', 'LI', 'LABEL'].includes(tag)) return true
      return [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1)
    }
    const found = []
    for (const el of document.querySelectorAll('body *')) {
      if (own(el) || !leafy(el)) continue
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || r.width > 1400) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue
      found.push(el)
    }
    // Spread the sample over the whole document.
    const step = Math.max(1, found.length / n)
    const picked = []
    for (let i = 0; i < found.length && picked.length < n; i += step) picked.push(found[Math.floor(i)])
    return picked.map((el, k) => {
      el.setAttribute('data-froam-qa', String(k))
      const label = (el.innerText || el.getAttribute('alt') || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      return { k, tag: el.tagName.toLowerCase(), label }
    })
  }, SAMPLES)

  const out = { tried: 0, exact: 0, near: 0, wrong: 0, none: 0, covered: 0, navigated: 0, misses: [] }
  for (const c of candidates) {
    const sel = `[data-froam-qa="${c.k}"]`
    const probe = await page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return { gone: true }
      el.scrollIntoView({ block: 'center', behavior: 'instant' })
      const r = el.getBoundingClientRect()
      const x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2
      if (x < 0 || y < 60 || x > innerWidth || y > innerHeight) return { offscreen: true }
      const top = document.elementFromPoint(x, y)
      const ok = top && (top === el || el.contains(top) || top.contains(el))
      return { x, y, covered: !ok, by: top ? `${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}` : null }
    }, sel).catch(() => ({ gone: true }))
    if (probe.gone || probe.offscreen) continue
    out.tried += 1
    if (probe.covered) { out.covered += 1; continue }
    await page.mouse.click(probe.x, probe.y)
    await sleep(250)
    if (page.url() !== startUrl) {
      out.navigated += 1
      out.misses.push(`${c.tag} "${c.label}": the click navigated to ${page.url()}`)
      await page.goto(startUrl, { waitUntil: 'load' }).catch(() => {})
      await openEditorHere(page)
      continue
    }
    const verdict = await page.evaluate((s) => {
      const el = document.querySelector(s)
      const picked = document.querySelector('[data-chef-selected="true"]')
      if (!picked) return 'none'
      if (!el) return 'none'
      if (picked === el) return 'exact'
      const depth = (a, b) => { let d = 0; for (let n = a; n; n = n.parentElement, d += 1) if (n === b) return d; return -1 }
      const up = depth(el, picked), down = depth(picked, el)
      if ((up > 0 && up <= 2) || (down > 0 && down <= 2)) return 'near'
      return `wrong:${picked.tagName.toLowerCase()}${picked.id ? '#' + picked.id : ''}`
    }, sel)
    if (verdict === 'exact') out.exact += 1
    else if (verdict === 'near') out.near += 1
    else if (verdict === 'none') { out.none += 1; out.misses.push(`${c.tag} "${c.label}": nothing selected`) }
    else { out.wrong += 1; out.misses.push(`${c.tag} "${c.label}": selected ${verdict.slice(6)}`) }
    await page.keyboard.press('Escape')
    await sleep(80)
  }
  out.misses = out.misses.slice(0, 8)
  return out
}

/** Select the main heading, type, check the words changed, undo. */
async function writeHeading(page) {
  try {
    const box = await page.evaluate(() => {
      const own = (el) => el.closest('[data-chef-editor-root="true"],[id^="froam-"]')
      // A heading a person can click: on screen, not a screen-reader-only
      // copy, and not under another layer (stripe.com stacks two copies).
      for (const h of document.querySelectorAll('h1, h2')) {
        if (own(h) || !h.innerText.trim()) continue
        h.scrollIntoView({ block: 'center', behavior: 'instant' })
        const r = h.getBoundingClientRect()
        if (r.height < 10 || r.width < 10) continue
        const x = r.left + Math.min(10, r.width / 4), y = r.top + r.height / 2
        const top = document.elementFromPoint(x, y)
        if (!top || !(h.contains(top) || top.contains(h))) continue
        return { x, y, before: h.innerText.trim().slice(0, 60) }
      }
      return null
    })
    if (!box) return { ok: false, detail: 'no heading on the page' }
    await page.keyboard.press('Escape')
    await page.mouse.click(box.x, box.y)
    await sleep(300)
    await page.keyboard.type('Zq ', { delay: 40 })
    await sleep(200)
    await page.keyboard.press('Escape')
    await sleep(300)
    // Where the words went: the element now holding them (textContent — a
    // heading styled uppercase reads "ZQ" through innerText).
    const after = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeValue.includes('Zq')) return n.parentElement.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)
      }
      return document.querySelector('[data-chef-selected="true"]')?.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) ?? '(nothing selected)'
    })
    const ok = after.includes('Zq')
    await page.keyboard.press('Control+z').catch(() => {})
    return { ok, detail: ok ? `"${after}"` : `still "${after}" (was "${box.before}")` }
  } catch (err) {
    return { ok: false, detail: err.message.split('\n')[0] }
  }
}

function unreachable(page) {
  return page.evaluate(() => {
    const own = (el) => el.closest('[data-chef-editor-root="true"],[id^="froam-"]')
    const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height }
    const vis = (el) => area(el) > 2500
    return {
      iframes: [...document.querySelectorAll('iframe')].filter((f) => !own(f) && vis(f)).length,
      shadowHosts: [...document.querySelectorAll('body *')].filter((el) => el.shadowRoot && !own(el) && vis(el)).length,
      canvases: [...document.querySelectorAll('canvas')].filter((c) => !own(c) && vis(c)).length,
    }
  })
}

/* ── comparison ── */

function compare(d, p) {
  const dm = d.metrics, pm = p.metrics
  const okDirect = new Set(d.requests.filter((r) => r.ok).map((r) => r.url))
  const failedOnlyViaFroam = p.requests.filter((r) => !r.ok && okDirect.has(r.url))
  const ratio = (a, b) => (b ? Math.round((a / b) * 100) : 100)
  const newErrors = [...p.pageErrors, ...p.consoleErrors].filter((e) => ![...d.pageErrors, ...d.consoleErrors].includes(e))
  return {
    failedOnlyViaFroam: failedOnlyViaFroam.length,
    failedSample: failedOnlyViaFroam.slice(0, 5).map((r) => `${r.status || r.failure} ${r.type} ${r.url.slice(0, 110)}`),
    elements: ratio(pm.elements, dm.elements),
    text: ratio(pm.textChars, dm.textChars),
    height: ratio(pm.height, dm.height),
    images: `${pm.imagesLoaded}/${pm.images} (direct ${dm.imagesLoaded}/${dm.images})`,
    fonts: `${pm.fontsLoaded} (direct ${dm.fontsLoaded})`,
    newErrors: newErrors.length,
    newErrorSample: newErrors.slice(0, 3),
  }
}

/** Image work in a blank page's canvas, so the harness needs no image library. */
async function inCanvas(fn, ...names) {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    const urls = names.map((n) => `data:image/png;base64,${fs.readFileSync(path.join(outDir, `${n}.png`)).toString('base64')}`)
    return await page.evaluate(fn, urls)
  } finally {
    await context.close()
  }
}

async function pixelDiff(a, b) {
  try {
    return await inCanvas(async ([ua, ub]) => {
      const load = (u) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.src = u })
      const [x, y] = await Promise.all([load(ua), load(ub)])
      const w = 480, h = 300
      const px = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data }
      const p = px(x), q = px(y)
      let diff = 0
      for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 60) diff += 1
      return Math.round((diff / (w * h)) * 100)
    }, a, b)
  } catch { return null }
}

async function sideBySide(a, b, id) {
  try {
    const dataUrl = await inCanvas(async ([ua, ub]) => {
      const load = (u) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.src = u })
      const [x, y] = await Promise.all([load(ua), load(ub)])
      const w = 720, h = 450, c = document.createElement('canvas')
      c.width = w * 2 + 10; c.height = h
      const g = c.getContext('2d')
      g.fillStyle = '#888'; g.fillRect(0, 0, c.width, h)
      g.drawImage(x, 0, 0, w, h); g.drawImage(y, w + 10, 0, w, h)
      return c.toDataURL('image/jpeg', 0.78)
    }, a, b)
    fs.writeFileSync(path.join(outDir, `${id}-compare.jpg`), Buffer.from(dataUrl.split(',')[1], 'base64'))
  } catch { /* screenshots missing */ }
}

function printLoad(row) {
  const c = row.compare, p = row.proxied
  console.log(`    load   failed only via Froam: ${c.failedOnlyViaFroam} · elements ${c.elements}% · words ${c.text}% · height ${c.height}% · pictures ${c.images} · screen differs ${row.visualDiff ?? '?'}% · new errors ${c.newErrors}`)
  if (p.editor?.opened) {
    const s = p.select
    console.log(`    editor opened in ${p.editor.openMs} ms · select ${s.exact + s.near}/${s.tried - s.covered} (exact ${s.exact}, near ${s.near}, wrong ${s.wrong}, none ${s.none}, covered ${s.covered}, navigated ${s.navigated}) · write ${p.write.ok ? 'ok' : 'FAILED'} · unreachable iframes ${p.reach.iframes}, shadow ${p.reach.shadowHosts}, canvas ${p.reach.canvases}`)
  } else console.log(`    editor did not open: ${p.editor?.error}`)
}

/* ── report ── */

function writeReport(rows) {
  const L = [
    '# Froam on live sites',
    '',
    `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${SAMPLES} clicks per site · each site loaded directly and through \`froam dev --app\``,
    '',
    '| Site | Fails only via Froam | Elements | Words | Height | Screen differs | New errors | Editor | Selects right | Typing | Can’t reach |',
    '| --- | --: | --: | --: | --: | --: | --: | :-: | --: | :-: | --- |',
  ]
  for (const r of rows) {
    if (!r.compare) { L.push(`| ${r.id} | — | | | | | | | | | ${r.notes[0] ?? ''} |`); continue }
    const c = r.compare, p = r.proxied, s = p.select
    const clickable = s ? s.tried - s.covered : 0
    L.push(`| ${r.id} | ${c.failedOnlyViaFroam} | ${c.elements}% | ${c.text}% | ${c.height}% | ${r.visualDiff ?? '?'}% | ${c.newErrors} | ${p.editor?.opened ? `${(p.editor.openMs / 1000).toFixed(1)} s` : '✖'} | ${s ? `${s.exact + s.near}/${clickable}` : '—'} | ${p.write ? (p.write.ok ? '✔' : '✖') : '—'} | ${p.reach ? [p.reach.iframes && `${p.reach.iframes} iframe`, p.reach.shadowHosts && `${p.reach.shadowHosts} shadow`, p.reach.canvases && `${p.reach.canvases} canvas`].filter(Boolean).join(', ') || 'none' : '—'} |`)
  }
  L.push('', 'Elements, Words and Height are the page through Froam as a share of the page loaded directly (100% = identical). Screen differs = share of the first screen that looks different (animations add noise). Selects right = clicks where the editor picked the part under the pointer or its immediate wrapper, out of the parts a person could click.', '')
  for (const r of rows) {
    L.push(`## ${r.id}`, '')
    for (const n of r.notes) L.push(`- ${n}`)
    if (r.compare) {
      const c = r.compare, p = r.proxied
      L.push(`- Direct: ${r.direct.metrics.elements} elements, ${r.direct.metrics.textChars} characters, loaded in ${r.direct.loadMs} ms (HTTP ${r.direct.status}). Through Froam: ${p.metrics.elements} elements, ${p.metrics.textChars} characters, ${p.loadMs} ms (HTTP ${p.status}).`)
      L.push(`- Pictures loaded: ${c.images}. Fonts loaded: ${c.fonts}.`)
      for (const f of c.failedSample) L.push(`- Failed only through Froam: \`${f}\``)
      for (const e of c.newErrorSample) L.push(`- New error: \`${e.replace(/`/g, "'")}\``)
      if (p.select) for (const m of p.select.misses) L.push(`- Click: ${m}`)
      if (p.write && !p.write.ok) L.push(`- Typing into the heading: ${p.write.detail}`)
      L.push(`- Screens: \`${r.id}-compare.jpg\` (left direct, right through Froam), \`${r.id}-froam-editor.png\``)
    }
    L.push('')
  }
  fs.writeFileSync(path.join(outDir, 'report.md'), L.join('\n'))
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(rows, null, 2))
  console.log(`\n  report ${path.join(outDir, 'report.md')}`)
}
