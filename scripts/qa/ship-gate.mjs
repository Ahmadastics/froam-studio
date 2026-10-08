#!/usr/bin/env node
/**
 * Ship gate — does the package you are about to publish actually ship an edit?
 *
 * 8.3.2 passed every test and still shipped a froam.runtime.js the browser
 * could not parse: Save to Repo said "saved", and production showed nothing.
 * The tests ran against the working tree; users run the tarball. This gate
 * runs the tarball, through the real CLI, in a real browser, and then loads
 * the result on a plain static server with no editor — the page a visitor gets.
 *
 *   node scripts/qa/ship-gate.mjs                          # npm pack this repo, gate the tarball
 *   node scripts/qa/ship-gate.mjs --pkg @ahmadastic/froam@latest   # gate what's on the registry
 *   node scripts/qa/ship-gate.mjs --pkg ./ahmadastic-froam-9.4.0.tgz
 *
 * Options
 *   --no-build        when packing this repo, skip `npm run build` (use it when the build just ran)
 *   --fixture <dir>   site to edit (default scripts/qa/fixtures/ship-site)
 *   --out <dir>       where report.md/json + screenshots go (default: OS temp)
 *   --headed          watch it
 *   --keep            keep the temp install and site
 *
 * Exit 0: safe to publish. Exit 1: do not publish. Exit 2: the gate itself broke.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import {
  tmpdir, parseArgs, findBrowser, freePort, waitForHttp, serveStatic, installFroam, froam, startFroam,
  exportTargets, openEditor, clickOn, deselect, selectedTag, saveAndWait, churnWhileIdle, jsParses,
  watchErrors, Report, stampDir, sleep, run, SEL,
} from './lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const args = parseArgs()
const work = fs.mkdtempSync(path.join(tmpdir(), 'froam-ship-gate-'))
const outDir = path.resolve(args.out && args.out !== true ? args.out : stampDir(path.join(tmpdir(), 'froam-qa'), 'ship-gate'))
const fixture = path.resolve(args.fixture && args.fixture !== true ? args.fixture : path.join(HERE, 'fixtures', 'ship-site'))
const COPY = 'Shipped '
// The editor's own network noise on a static fixture is not a shipping fault.
const EDITOR_NOISE = [/favicon\.ico/, /Failed to load resource: .*404/, /ERR_CONNECTION_REFUSED/]

const report = new Report('Froam ship gate')
let bridge = null
let browser = null

async function main() {
  console.log(`◆ Froam ship gate\n  work ${work}\n  out  ${outDir}\n`)

  /* 1 ─ the package as a user gets it */
  let inst
  const installed = await report.step('install', async () => {
    inst = installFroam(args.pkg && args.pkg !== true ? args.pkg : null, { repoRoot: REPO, workDir: work, build: !args['no-build'] })
    report.meta.package = `${inst.pkg.name}@${inst.pkg.version}`
    report.meta.source = inst.packed ? `npm pack of ${REPO}` : inst.spec
    if (inst.packed) report.meta.tarball = `${(inst.packed.size / 1024).toFixed(0)} KB packed · ${(inst.packed.unpackedSize / 1024).toFixed(0)} KB unpacked · ${inst.packed.files} files`
    return `${inst.pkg.name}@${inst.pkg.version} installed clean in ${(inst.installMs / 1000).toFixed(1)} s`
  })
  if (!installed) return

  await report.step('package: exports and bin point at real files', async () => {
    const targets = exportTargets(inst.pkg)
    const missing = targets.filter((t) => !fs.existsSync(path.join(inst.pkgDir, t)))
    if (missing.length) throw new Error(`missing from the package: ${missing.join(', ')}`)
    return `${targets.length} targets present`
  })

  await report.step('package: entry points import', async () => {
    const results = []
    for (const spec of ['@ahmadastic/froam', '@ahmadastic/froam/server', '@ahmadastic/froam/vite']) {
      if (!inst.pkg.exports?.[spec.replace('@ahmadastic/froam', '.') || '.']) continue
      const probe = path.join(inst.installDir, `probe-${results.length}.mjs`)
      fs.writeFileSync(probe, `const m = await import(${JSON.stringify(spec)}); console.log(Object.keys(m).length)`)
      const res = run(process.execPath, [probe], { cwd: inst.installDir, timeout: 60000 })
      if (res.code !== 0) throw new Error(`import ${spec} failed: ${res.out.trim().split('\n').slice(-3).join(' | ')}`)
      results.push(`${spec.replace('@ahmadastic/froam', '.') || '.'} (${res.out.trim()} exports)`)
    }
    return results.join(', ')
  })

  await report.step('cli: version matches the package', async () => {
    const res = froam(inst, ['version'])
    if (res.code !== 0) throw new Error(res.out)
    if (!res.out.includes(inst.pkg.version)) throw new Error(`printed "${res.out.trim()}", package is ${inst.pkg.version}`)
    return res.out.trim()
  })

  await report.step('cli: unknown command fails fast instead of hanging', async () => {
    const res = froam(inst, ['definitely-not-a-command'], { timeout: 15000 })
    if (res.code === -1 || res.ms >= 15000) throw new Error(`still running after 15 s: ${res.out.slice(-300)}`)
    return `exit ${res.code} in ${res.ms} ms`
  }, { warnOnly: true })

  /* 2 ─ init on a real static site */
  const site = path.join(work, 'site')
  fs.cpSync(fixture, site, { recursive: true })
  const original = fs.readFileSync(path.join(site, 'index.html'), 'utf8')
  const inited = await report.step('init: scaffolds and wires the site', async () => {
    const res = froam(inst, ['init'], { cwd: site, timeout: 60000, input: '' })
    if (res.code !== 0) throw new Error(`exit ${res.code}: ${res.out.slice(-800)}`)
    const need = ['froam/froam.design.json', 'froam/froam.generated.css', 'froam/froam.runtime.js', 'froam.config.json', 'index.html.bak']
    const missing = need.filter((f) => !fs.existsSync(path.join(site, f)))
    if (missing.length) throw new Error(`not created: ${missing.join(', ')}`)
    const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8')
    if (!/froam\.generated\.css/.test(html) || !/froam\.runtime\.js/.test(html)) throw new Error('index.html is missing the generated CSS or runtime tag')
    if (fs.readFileSync(path.join(site, 'index.html.bak'), 'utf8') !== original) throw new Error('index.html.bak is not the original page')
    return 'design, CSS, runtime, config, tags and backup all present'
  })
  if (!inited) return

  await report.step('init: scaffolded runtime is valid JavaScript', async () => {
    const r = jsParses(path.join(site, 'froam', 'froam.runtime.js'))
    if (!r.ok) throw new Error(r.detail)
  })

  /* 3 ─ the editor, through the real bridge */
  const port = await freePort()
  bridge = startFroam(inst, ['dev', '--serve', '.', '--port', String(port)], { cwd: site })
  const url = `http://localhost:${port}/`
  const up = await report.step('dev: bridge serves the site', async () => {
    await waitForHttp(url, 45000)
    return url
  })
  if (!up) { report.notes.push(`bridge log:\n${bridge.log().slice(-1500)}`); return }

  const browserPath = findBrowser(chromium)
  if (!browserPath) throw new Error('no Chrome/Chromium found — set FROAM_QA_CHROME')
  browser = await chromium.launch({ executablePath: browserPath, headless: !args.headed })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const editorErrors = watchErrors(page, EDITOR_NOISE)

  const opened = await report.step('editor: launcher appears and Ctrl+. opens it', async () => {
    const t = await openEditor(page, url)
    report.meta.editorOpenMs = t.openMs
    return `launcher ${t.launcherMs} ms, editor open ${t.openMs} ms`
  })
  if (!opened) { await page.screenshot({ path: path.join(outDir, 'editor-failed.png') }).catch(() => {}); return }

  const edits = {}

  await report.step('edit: type copy into the subtitle', async () => {
    await deselect(page)
    await clickOn(page, '#subtitle', 0.002, 0.5)
    await page.keyboard.type(COPY, { delay: 30 })
    await sleep(150)
    await page.keyboard.press('Escape')
    await sleep(200)
    const text = await page.evaluate(() => document.getElementById('subtitle').innerText)
    if (!text.startsWith(COPY)) throw new Error(`subtitle reads "${text.slice(0, 40)}"`)
    edits.copy = true
  })

  await report.step('edit: nudge the CTA (a style edit)', async () => {
    await deselect(page)
    await clickOn(page, '#cta')
    const sel = await selectedTag(page)
    if (sel !== '#cta') throw new Error(`clicking the CTA selected ${sel}`)
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight')
    await sleep(250)
    const left = await page.evaluate(() => getComputedStyle(document.getElementById('cta')).left)
    if (left !== '5px') throw new Error(`left is ${left}`)
    edits.nudge = true
  })

  // A Look exercises the generated-CSS path hardest (hover, ::after, shadows).
  // UI selectors drift between versions, so failing to *find* the button is a
  // warning; a look that applies in the editor and is missing in production is a fail.
  await report.step('edit: apply a Look to a card', async () => {
    await deselect(page)
    await clickOn(page, '#card-2', 0.5, 0.92)
    const sel = await selectedTag(page)
    if (sel !== '#card-2') throw new Error(`clicking the card selected ${sel}`)
    const before = await cardLook(page)
    if (!(await page.locator(SEL.looksPop).count())) await page.click(SEL.looksBtn, { timeout: 5000 })
    await page.waitForSelector(SEL.lookTiles, { timeout: 10000 })
    const tile = page.locator(SEL.lookTiles, { has: page.locator('span', { hasText: /^Lift$/ }) })
    if (await tile.count()) await tile.first().click()
    else await page.locator(SEL.lookTiles).first().click()
    await sleep(500)
    await page.click(SEL.lookApply)
    await deselect(page)
    await page.mouse.move(4, 890)
    await sleep(300)
    const after = await cardLook(page)
    if (JSON.stringify(after) === JSON.stringify(before)) throw new Error('the look changed nothing on the card')
    edits.look = after
    return `card now ${JSON.stringify(after).slice(0, 140)}`
  }, { warnOnly: true })

  await page.screenshot({ path: path.join(outDir, 'editor.png') }).catch(() => {})

  const designPath = path.join(site, 'froam', 'froam.design.json')
  const saved = await report.step('save: Ctrl+Shift+S writes the design', async () => {
    await deselect(page)
    if (!(await saveAndWait(page, designPath))) throw new Error('froam.design.json was not rewritten within 15 s')
    return `${fs.statSync(designPath).size} B design`
  })
  if (!saved) return

  await report.step('save: design.json is valid JSON', async () => {
    const d = JSON.parse(fs.readFileSync(designPath, 'utf8'))
    return `version ${d.version ?? '?'}, rootScope ${d.rootScope ?? '?'}`
  })
  await report.step('save: froam.runtime.js is valid JavaScript', async () => {
    const r = jsParses(path.join(site, 'froam', 'froam.runtime.js'))
    if (!r.ok) throw new Error(r.detail)
    return `${fs.statSync(path.join(site, 'froam', 'froam.runtime.js')).size} B`
  })
  await report.step('save: copy edit was written into index.html', async () => {
    const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8')
    if (!html.includes(`${COPY}Riders you can track`)) throw new Error('index.html does not contain the typed copy (it may be carried by the runtime instead — production check decides)')
  }, { warnOnly: true })
  await report.step('save: generated CSS has rules a browser accepts', async () => {
    const css = fs.readFileSync(path.join(site, 'froam', 'froam.generated.css'), 'utf8')
    const rules = await page.evaluate((text) => { const s = new CSSStyleSheet(); s.replaceSync(text); return s.cssRules.length }, css)
    if (rules === 0) throw new Error('no rules parsed from froam.generated.css')
    return `${rules} top-level rules, ${css.length} B`
  })

  await report.step('editor: no uncaught errors during the session', async () => {
    if (editorErrors.length) throw new Error(editorErrors.slice(0, 5).join('\n'))
  })
  await context.close()

  /* 4 ─ production: plain server, no editor, no bridge */
  await bridge.stop()
  bridge = null
  await productionCheck('production', site, edits)

  /* 5 ─ the CLI's own after-save commands */
  await report.step('check: froam check finds no drift', async () => {
    const res = froam(inst, ['check', '--serve', '.'], { cwd: site, timeout: 120000 })
    if (res.code !== 0) throw new Error(`exit ${res.code}: ${res.out.trim().split('\n').slice(-6).join(' | ')}`)
    return res.out.trim().split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 160)
  })
  await report.step('build: froam build regenerates output', async () => {
    const res = froam(inst, ['build'], { cwd: site, timeout: 60000 })
    if (res.code !== 0) throw new Error(`exit ${res.code}: ${res.out.slice(-600)}`)
    const r = jsParses(path.join(site, 'froam', 'froam.runtime.js'))
    if (!r.ok) throw new Error(`runtime after build: ${r.detail}`)
  })
  await productionCheck('production after froam build', site, edits)
}

async function productionCheck(label, site, edits) {
  const server = await serveStatic(site)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = watchErrors(page, [/favicon\.ico/])
  try {
    await page.goto(server.url, { waitUntil: 'load' })
    await page.waitForSelector('#late', { timeout: 5000 }).catch(() => {})
    await sleep(1200)
    await page.mouse.move(4, 890)
    await sleep(200)
    const seen = await page.evaluate(() => ({
      route: document.documentElement.getAttribute('data-froam-route'),
      editor: !!document.getElementById('froam-editor-portal') || !!document.querySelector('.global-chef-button'),
      subtitle: document.getElementById('subtitle')?.innerText ?? '',
      ctaLeft: getComputedStyle(document.getElementById('cta')).left,
      editable: document.querySelectorAll('[contenteditable]').length,
    }))
    const look = edits.look ? await cardLook(page) : null
    await page.screenshot({ path: path.join(outDir, `${label.replace(/\W+/g, '-')}.png`), fullPage: true }).catch(() => {})
    const churn = await churnWhileIdle(page)

    await report.step(`${label}: runtime ran (data-froam-route set)`, async () => {
      if (!seen.route) throw new Error('data-froam-route is not set on <html> — the runtime did not run, so no scoped CSS rule can match')
      return `route "${seen.route}"`
    })
    await report.step(`${label}: no errors in the console`, async () => {
      if (errors.length) throw new Error(errors.slice(0, 5).join('\n'))
    })
    await report.step(`${label}: editor is not shipped`, async () => {
      if (seen.editor) throw new Error('the production page loaded the editor')
      if (seen.editable) throw new Error(`${seen.editable} contenteditable elements on the production page`)
    })
    if (edits.copy) await report.step(`${label}: copy edit is visible`, async () => {
      if (!seen.subtitle.startsWith(COPY)) throw new Error(`subtitle reads "${seen.subtitle.slice(0, 40)}"`)
    })
    if (edits.nudge) await report.step(`${label}: style edit is visible`, async () => {
      if (seen.ctaLeft !== '5px') throw new Error(`CTA left is ${seen.ctaLeft}, edited to 5px`)
    })
    if (edits.look) await report.step(`${label}: Look is visible`, async () => {
      const diff = Object.keys(edits.look).filter((k) => edits.look[k] !== look[k])
      if (diff.length) throw new Error(`differs from the editor on ${diff.map((k) => `${k}: "${look[k]}" vs "${edits.look[k]}"`).join('; ')}`)
    })
    await report.step(`${label}: page is quiet when idle`, async () => {
      if (churn > 2) throw new Error(`${churn} DOM mutations in 800 ms with nobody touching it`)
      return `${churn} mutations`
    })
  } finally {
    await context.close()
    await server.close()
  }
}

const cardLook = (page) => page.evaluate(() => {
  const s = getComputedStyle(document.getElementById('card-2'))
  return { boxShadow: s.boxShadow, transform: s.transform, borderRadius: s.borderRadius, background: s.backgroundImage === 'none' ? s.backgroundColor : s.backgroundImage, borderColor: s.borderTopColor }
})

let crashed = null
try { await main() } catch (err) { crashed = err; report.add('gate', 'fail', `the gate itself crashed: ${err.stack ?? err}`) } finally {
  if (bridge) await bridge.stop()
  if (browser) await browser.close().catch(() => {})
  const { mdPath } = report.write(outDir)
  if (!args.keep) fs.rmSync(work, { recursive: true, force: true })
  console.log(`\n${report.ok ? '✔ PASS' : '✖ FAIL'} — ${report.failed.length} failed, ${report.warned.length} warnings\n  report ${mdPath}`)
  process.exitCode = crashed ? 2 : report.ok ? 0 : 1
}
