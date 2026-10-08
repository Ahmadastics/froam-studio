#!/usr/bin/env node
/**
 * Stack matrix — which stacks does Froam actually work on, end to end?
 *
 * "Works on any site" is Froam's whole position against Onlook and Plasmic,
 * and the README is honest that most of it is "implemented, not verified".
 * This verifies it. For each stack it builds the same small site, then does
 * what a user would, following only what Froam itself prints:
 *
 *   froam init → app dev server → froam dev --app (or --serve) → open the
 *   editor → select → type copy → nudge a button → Save to Repo → does copy
 *   land in the source file? does the editor survive the dev server's reload?
 *   → follow "Ship it (production)" → production build → serve it plainly →
 *   are the edits there?
 *
 *   node scripts/qa/stack-matrix.mjs                          # npm pack this repo, all stacks
 *   node scripts/qa/stack-matrix.mjs --pkg @ahmadastic/froam@latest
 *   node scripts/qa/stack-matrix.mjs --only next,astro
 *
 * Options: --pkg <spec|tgz>  --only <ids>  --out <dir>  --cache <dir> (reuse
 * installed stacks between runs)  --headed
 *
 * Exit 0 when every stack ships. Exit 1 when any stack fails a step.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import {
  tmpdir, parseArgs, findBrowser, freePort, waitForHttp, serveStatic, installFroam, froam, startFroam, run, start,
  openEditor, clickOn, deselect, selectedTag, saveAndWait, jsParses, watchErrors, sleep, stampDir, SEL,
} from './lib.mjs'
import { stacks, addTagsToHead, COPY } from './stacks.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const args = parseArgs()
const work = fs.mkdtempSync(path.join(tmpdir(), 'froam-stack-matrix-'))
const cache = path.resolve(args.cache && args.cache !== true ? args.cache : path.join(tmpdir(), 'froam-qa-stacks'))
const outDir = path.resolve(args.out && args.out !== true ? args.out : stampDir(path.join(tmpdir(), 'froam-qa'), 'stack-matrix'))
const TYPED = 'Shipped '
const NOISE = [/favicon\.ico/, /\/__vite_ping/, /webpack-hmr|_next\/static\/webpack|hot-update/, /\/@vite\/client.*ERR_ABORTED/]
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

// The columns of the matrix, in the order a user meets them.
const COLUMNS = [
  ['install', 'Install'], ['init', 'init'], ['dev', 'Dev server'], ['editor', 'Editor opens'],
  ['select', 'Select'], ['copy', 'Type copy'], ['style', 'Style edit'], ['save', 'Save'],
  ['writeback', 'Copy → source'], ['reload', 'Survives reload'], ['build', 'Prod build'],
  ['prodRuntime', 'Runtime runs'], ['prodCopy', 'Copy ships'], ['prodStyle', 'Style ships'], ['prodClean', 'No editor in prod'],
]

fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(cache, { recursive: true })
console.log(`◆ Froam stack matrix\n  work  ${work}\n  cache ${cache}\n  out   ${outDir}\n`)

const inst = installFroam(args.pkg && args.pkg !== true ? args.pkg : null, { repoRoot: REPO, workDir: work, build: !args['no-build'] })
console.log(`  testing ${inst.pkg.name}@${inst.pkg.version}\n`)
const browser = await chromium.launch({ executablePath: findBrowser(chromium), headless: !args.headed })

const only = args.only && args.only !== true ? new Set(String(args.only).split(',')) : null
const rows = []
for (const stack of stacks(HERE)) {
  if (only && !only.has(stack.id)) continue
  rows.push(await runStack(stack))
}
await browser.close()
writeMatrix(rows)
fs.rmSync(work, { recursive: true, force: true })
process.exitCode = rows.every((r) => Object.values(r.cells).every((c) => c.status !== 'fail')) ? 0 : 1

/* ─────────────────────────────────────────────────────────────── */

async function runStack(stack) {
  console.log(`▸ ${stack.label}`)
  const row = { id: stack.id, label: stack.label, cells: {}, notes: [], init: '' }
  const cell = (key, status, detail = '') => {
    row.cells[key] = { status, detail }
    const icon = { pass: '✔', fail: '✖', warn: '▲', skip: '·' }[status]
    console.log(`    ${icon} ${key}${detail ? ` — ${detail.split('\n')[0].slice(0, 150)}` : ''}`)
  }
  const procs = []
  const dir = path.join(work, stack.id)
  try {
    /* scaffold + install (installs are cached; the site is always fresh) */
    fs.mkdirSync(dir, { recursive: true })
    let cached = null
    if (!stack.static) {
      try { cached = ensureInstall(stack, false) } catch (err) { cell('install', 'fail', err.message); return row }
      linkInstall(cached, dir)
    }
    for (const [rel, content] of Object.entries(stack.files())) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
      fs.writeFileSync(path.join(dir, rel), content)
    }
    const versions = !cached ? '' : Object.keys({ ...stack.deps.dependencies, ...stack.deps.devDependencies })
      .map((d) => { try { return `${d}@${JSON.parse(fs.readFileSync(path.join(cached, 'node_modules', d, 'package.json'), 'utf8')).version}` } catch { return d } }).join(', ')
    cell('install', 'pass', versions || 'no dependencies')

    /* init — with --no-install, because installs here come from the cache:
       init then prints the install as its first step, and the harness takes
       that step itself (test-init.mjs covers init doing the install). */
    const init = froam(inst, ['init', '--no-install'], { cwd: dir, timeout: 60000, input: '' })
    row.init = init.out.replace(/\x1b\[[0-9;]*m/g, '').trim()
    const detected = row.init.match(/detected (.+)/)?.[1] ?? '?'
    const cfg = readJson(path.join(dir, 'froam.config.json'))
    const froamDir = path.resolve(dir, cfg?.dir ?? 'froam')
    if (init.code !== 0) { cell('init', 'fail', `exit ${init.code}: ${init.out.slice(-300)}`); return row }
    cell('init', /Generic|Node\.js project/.test(detected) ? 'warn' : 'pass', `detected ${detected}; workspace ${path.relative(dir, froamDir) || '.'}`)
    if (/@ahmadastic\/froam\S* — before your dev server starts/.test(row.init)) {
      linkInstall(ensureInstall(stack, true), dir)
      row.notes.push('init printed "install @ahmadastic/froam before your dev server starts"; did that (from the cache).')
    }

    /* dev server + froam dev */
    let target
    if (stack.static) target = ['dev', '--serve', '.']
    else {
      const appPort = await freePort()
      const [cmd, a] = stack.dev(appPort)
      const startApp = () => {
        const app = start(cmd === 'npx' ? npx : cmd, a, { cwd: dir, env: { BROWSER: 'none', ...(stack.env ?? {}) } })
        procs.push(app)
        return app
      }
      let app = startApp()
      const appUp = () => Promise.race([
        waitForHttp(`http://127.0.0.1:${appPort}/`, 120000),
        // Exit 0 can be a dev server handing itself to a background daemon
        // (Astro 7 without a terminal); only a failing exit is fatal.
        new Promise((_, reject) => app.proc.once('exit', (code) => { if (code) reject(new Error(`dev server exited (${code})`)) })),
      ])
      try { await appUp() } catch (err) {
        const log = app.log()
        // init wiring @ahmadastic/froam/vite into the config without the
        // package (or without saying to install it) crashes the next step.
        // Record that, then do what the user would: install it.
        if (/ERR_MODULE_NOT_FOUND|Cannot find (package|module) '@ahmadastic\/froam/.test(log)) {
          cell('init', 'fail', `init wired '@ahmadastic/froam/vite' into the Vite config but the package is not installed, so "start your app's dev server as usual" (its next step) crashes: ${log.match(/Error \[ERR_MODULE_NOT_FOUND\][^\n]*/)?.[0] ?? 'module not found'}`)
          row.notes.push('Recovered the way a user would: npm install -D @ahmadastic/froam, then restarted the dev server.')
          await app.stop()
          linkInstall(ensureInstall(stack, true), dir)
          app = startApp()
          try { await appUp() } catch (err2) { cell('dev', 'fail', `${err2.message}\n${app.log().slice(-500)}`); return row }
        } else { cell('dev', 'fail', `${err.message}\n${log.slice(-500)}`); return row }
      }
      target = ['dev', '--app', `http://localhost:${appPort}`]
      row.appPort = appPort
    }
    const port = await freePort()
    const bridge = startFroam(inst, [...target, '--port', String(port)], { cwd: dir })
    procs.push(bridge)
    const url = `http://localhost:${port}/`
    try { await waitForHttp(url, 60000) } catch (err) { cell('dev', 'fail', `froam dev: ${err.message}\n${bridge.log().slice(-500)}`); return row }
    cell('dev', 'pass', stack.static ? 'froam dev --serve' : `app :${row.appPort} → froam :${port}`)

    /* editor */
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const errors = watchErrors(page, NOISE)
    try {
      const hydration = () => errors.find((e) => /Hydration failed|hydrat/i.test(e))
      try {
        const t = await openEditor(page, url, { timeout: 45000 })
        await page.waitForSelector('#subtitle', { timeout: 15000 })
        cell('editor', hydration() ? 'warn' : 'pass', hydration() ? `opened, but the app threw: ${hydration().slice(0, 160)}` : `open in ${t.openMs} ms`)
      } catch (err) {
        await page.screenshot({ path: path.join(outDir, `${stack.id}-editor-failed.png`) }).catch(() => {})
        const why = hydration() ? `the app threw "${hydration().slice(11, 120)}…" and the editor never appeared` : `${err.message.split('\n')[0]}${errors.length ? ` · ${errors[0]}` : ''}`
        // A user would refresh. Do that once, so the rest of the row still says something.
        try {
          await openEditor(page, url, { timeout: 45000 })
          await page.waitForSelector('#subtitle', { timeout: 15000 })
          cell('editor', 'fail', `${why} — appeared after a refresh`)
        } catch {
          cell('editor', 'fail', why)
          return row
        }
      }

      await step(cell, 'select', async () => {
        await deselect(page)
        await clickOn(page, '#headline', 0.5, 0.5)
        const sel = await selectedTag(page)
        if (sel !== '#headline') throw new Error(`clicking the headline selected ${sel}`)
      })
      await step(cell, 'copy', async () => {
        await deselect(page)
        await clickOn(page, '#subtitle', 0.002, 0.5)
        await page.keyboard.type(TYPED, { delay: 30 })
        await sleep(150)
        await page.keyboard.press('Escape')
        await sleep(200)
        const text = await page.evaluate(() => document.getElementById('subtitle')?.innerText ?? '')
        if (!text.startsWith(TYPED)) throw new Error(`subtitle reads "${text.slice(0, 40)}"`)
      })
      await step(cell, 'style', async () => {
        await deselect(page)
        await clickOn(page, '#cta')
        if ((await selectedTag(page)) !== '#cta') throw new Error(`clicking the CTA selected ${await selectedTag(page)}`)
        for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight')
        await sleep(250)
        const left = await page.evaluate(() => getComputedStyle(document.getElementById('cta')).left)
        if (left !== '5px') throw new Error(`left is ${left}`)
      })
      await page.screenshot({ path: path.join(outDir, `${stack.id}-editor.png`) }).catch(() => {})

      const designPath = path.join(froamDir, 'froam.design.json')
      const saved = await step(cell, 'save', async () => {
        await deselect(page)
        if (!(await saveAndWait(page, designPath))) throw new Error(`${path.relative(dir, designPath)} was not rewritten`)
        const rt = jsParses(path.join(froamDir, 'froam.runtime.js'))
        if (!rt.ok) throw new Error(`runtime is not valid JS: ${rt.detail}`)
        return `→ ${path.relative(dir, froamDir)}/`
      })

      const sourceFile = path.join(dir, stack.copySource)
      const written = fs.readFileSync(sourceFile, 'utf8').includes(`${TYPED}${COPY.subtitle}`)
      const designHasCopy = saved && fs.readFileSync(designPath, 'utf8').includes(TYPED.trim())
      if (written) cell('writeback', 'pass', `written into ${stack.copySource}`)
      else if (designHasCopy) cell('writeback', 'warn', `kept as a Froam edit (runtime applies it); ${stack.copySource} unchanged`)
      else cell('writeback', 'fail', 'the typed copy is in neither the source nor the design')

      // A source write makes the dev server reload or hot-update the page under
      // the editor. The person editing must not lose the editor or their work.
      await step(cell, 'reload', async () => {
        await sleep(3500)
        const state = await page.evaluate((sel) => ({
          editor: !!document.querySelector(sel.chrome) || !!document.querySelector(sel.launcher),
          subtitle: document.getElementById('subtitle')?.innerText ?? null,
          left: document.getElementById('cta') ? getComputedStyle(document.getElementById('cta')).left : null,
        }), SEL).catch((err) => ({ error: err.message }))
        await page.screenshot({ path: path.join(outDir, `${stack.id}-after-save.png`) }).catch(() => {})
        if (state.error) throw new Error(state.error)
        if (!state.editor) throw new Error('the editor is gone after the dev server reloaded')
        if (!state.subtitle?.startsWith(TYPED)) throw new Error(`after reload the subtitle reads "${(state.subtitle ?? '(missing)').slice(0, 40)}"`)
        if (state.left !== '5px') throw new Error(`after reload the CTA nudge is ${state.left}`)
        // Nothing is excused: the fixture is clean, so a hydration mismatch or
        // a missing editor file is Froam's. (Both used to be "known" here,
        // which hid the Next.js removeChild failures behind them.)
        if (errors.length) throw new Error(`errors in the editor session: ${errors.slice(0, 3).join(' | ')}`)
        return ''
      })
    } finally {
      await context.close()
    }
    for (const p of procs.splice(0)) await p.stop()
    if (stack.stop) { const [cmd, a] = stack.stop; run(cmd === 'npx' ? npx : cmd, a, { cwd: dir, timeout: 30000 }) }

    /* ship it: follow the CLI's "Ship it (production)" instructions */
    let outRoot = dir
    if (!stack.static) {
      const ship = shipLikeTheInstructionsSay(stack, dir, froamDir, row)
      if (!ship.ok) { cell('build', 'fail', ship.detail); return row }
      const [cmd, a] = stack.build()
      const built = run(cmd === 'npx' ? npx : cmd, a, { cwd: dir, timeout: 600000, env: stack.env })
      if (built.code !== 0) { cell('build', 'fail', built.out.slice(-800)); return row }
      outRoot = path.join(dir, stack.out)
      cell('build', 'pass', ship.detail)
    } else cell('build', 'pass', 'no build — the folder is the site')

    const server = await serveStatic(outRoot)
    const prod = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const visitor = await prod.newPage()
    const prodErrors = watchErrors(visitor, [/favicon\.ico/])
    try {
      await visitor.goto(server.url, { waitUntil: 'load' })
      await visitor.waitForSelector('#late', { timeout: 5000 }).catch(() => {})
      await sleep(1200)
      const seen = await visitor.evaluate(() => ({
        route: document.documentElement.getAttribute('data-froam-route'),
        subtitle: document.getElementById('subtitle')?.innerText ?? '',
        left: document.getElementById('cta') ? getComputedStyle(document.getElementById('cta')).left : null,
        editor: !!document.querySelector('.global-chef-button, #froam-editor-portal, [data-froam-gate]'),
      }))
      if (seen.editor) row.notes.push('⚠ The production build shows the Froam editor launcher to every visitor.')
      await visitor.screenshot({ path: path.join(outDir, `${stack.id}-production.png`) }).catch(() => {})
      if (seen.editor) cell('prodClean', 'fail', 'the editor launcher is visible on the production site')
      cell('prodRuntime', seen.route ? (prodErrors.length ? 'warn' : 'pass') : 'fail', seen.route ? (prodErrors[0] ?? `route "${seen.route}"`) : `runtime did not run${prodErrors.length ? `: ${prodErrors[0]}` : ''}`)
      cell('prodCopy', seen.subtitle.startsWith(TYPED) ? 'pass' : 'fail', seen.subtitle.startsWith(TYPED) ? '' : `reads "${seen.subtitle.slice(0, 40)}"`)
      if (!seen.editor) cell('prodClean', 'pass')
      cell('prodStyle', seen.left === '5px' ? 'pass' : 'fail', seen.left === '5px' ? '' : `CTA left is ${seen.left}; ${await styleMiss(visitor)}`)
    } finally {
      await prod.close()
      await server.close()
    }
  } catch (err) {
    row.notes.push(`harness error: ${err.stack ?? err}`)
    console.log(`    ✖ harness error — ${err.message}`)
  } finally {
    for (const p of procs) await p.stop()
    if (stack.stop && fs.existsSync(dir)) { const [cmd, a] = stack.stop; run(cmd === 'npx' ? npx : cmd, a, { cwd: dir, timeout: 30000 }) }
  }
  return row
}

/**
 * What a developer does with "Serve the two generated files with your site and
 * add <link …> <script …>": put the files where the stack serves static files
 * from, and put the tags in the stack's <head>. Records what had to be worked
 * out that the instructions did not say.
 */
function shipLikeTheInstructionsSay(stack, dir, froamDir, row) {
  if (stack.ship === 'react-runtime') return shipReactRuntime(dir, froamDir, row)
  // "Nothing more to do": init put the tags in the head and every save keeps
  // the public copies current. Check that it did, and touch nothing.
  if (/Ship it \(production\)\s+Nothing more to do/.test(row.init)) {
    const head = fs.readFileSync(path.join(dir, stack.head), 'utf8')
    const urlBase = head.match(/href="([^"]+)\/froam\.generated\.css"/)?.[1]
    if (!urlBase || !head.includes(`${urlBase}/froam.runtime.js`)) return { ok: false, detail: `init said nothing more to do, but ${stack.head} doesn't load both files` }
    const served = path.join(dir, stack.publicDir, urlBase.replace(/^\//, ''))
    for (const f of ['froam.generated.css', 'froam.runtime.js']) {
      const shipped = path.join(served, f)
      if (!fs.existsSync(shipped)) return { ok: false, detail: `${path.relative(dir, shipped)} is missing` }
      if (fs.readFileSync(shipped, 'utf8') !== fs.readFileSync(path.join(froamDir, f), 'utf8')) return { ok: false, detail: `${path.relative(dir, shipped)} is stale — the last save didn't update it` }
    }
    return { ok: true, detail: `init wired ${stack.head}; ${stack.publicDir}${urlBase}/ current after the save` }
  }
  const printed = row.init.match(/href="([^"]+)\/froam\.generated\.css"/)?.[1]
  const urlBase = printed ?? `/${path.relative(dir, froamDir).split(path.sep).join('/')}`
  const publicFroam = path.join(dir, stack.publicDir, urlBase.replace(/^\//, ''))
  fs.mkdirSync(publicFroam, { recursive: true })
  for (const f of ['froam.generated.css', 'froam.runtime.js']) fs.copyFileSync(path.join(froamDir, f), path.join(publicFroam, f))
  try {
    addTagsToHead(path.join(dir, stack.head), urlBase, { jsx: stack.headJsx })
  } catch (err) { return { ok: false, detail: err.message } }
  if (!printed) row.notes.push('init printed no "Ship it" tags for this stack; used the workspace path')
  row.notes.push(`To ship, copied froam.generated.css + froam.runtime.js into ${stack.publicDir}${urlBase}/ and added the tags to ${stack.head}. The printed instructions say "serve the two generated files" but not where — and the copies go stale on every save unless the workspace itself lives in ${stack.publicDir}/.`)
  return { ok: true, detail: `tags in ${stack.head}, files in ${stack.publicDir}${urlBase}/` }
}

/**
 * Vite + React: init prints "Mount the editor + runtime once in your app" with
 * a snippet. Follow it literally — in a .jsx file, minus the TypeScript.
 */
function shipReactRuntime(dir, froamDir, row) {
  const main = path.join(dir, 'src', 'main.jsx')
  const rel = `./${path.relative(path.join(dir, 'src'), froamDir).split(path.sep).join('/')}`
  let src = fs.readFileSync(main, 'utf8')
  src = `import { FroamGate, FroamRuntime } from '@ahmadastic/froam'\nimport '@ahmadastic/froam/css'\nimport '@ahmadastic/froam/gate-css'\nimport froamDesign from '${rel}'\n${src}`
  src = src.replace('.render(<App />)', `.render(<><FroamRuntime design={froamDesign} routes="*" /><FroamGate enabled initialOpen={false} localRoutes="*" /><App /></>)`)
  fs.writeFileSync(main, src)
  if (/type FroamLocalDesign|as FroamLocalDesign/.test(row.init)) row.notes.push('The printed mount snippet is TypeScript (`type FroamLocalDesign`, `as FroamLocalDesign`); pasted into a .jsx file it is a syntax error. Used it without the types.')
  row.notes.push('Shipped by mounting <FroamRuntime> and <FroamGate> in src/main.jsx exactly as init prints.')
  return { ok: true, detail: `FroamRuntime + FroamGate mounted in src/main.jsx (design from ${rel})` }
}

/**
 * Why a style edit did not show in production: find the generated rule that
 * carries it and ask the production page what that selector matches.
 */
function styleMiss(page) {
  return page.evaluate(() => {
    const found = []
    const walk = (rules) => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.style?.left === '5px') found.push(r.selectorText) } }
    for (const sheet of document.styleSheets) { try { if (/froam/.test(sheet.href ?? '')) walk(sheet.cssRules) } catch { /* cross-origin */ } }
    if (!found.length) return 'no left:5px rule reached the page (stylesheet missing or not loaded)'
    const sel = found[0]
    let hits = []
    try { hits = [...document.querySelectorAll(sel)] } catch { return `rule \`${sel}\` is not a valid selector here` }
    const cta = document.getElementById('cta')
    const path = (el) => { const parts = []; for (let n = el; n && n !== document.documentElement; n = n.parentElement) parts.unshift(n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '')); return parts.join(' > ') }
    return `rule \`${sel.slice(0, 200)}\` matches ${hits.length ? hits.map((h) => (h === cta ? 'the CTA' : path(h))).join(', ') : 'nothing'} in production; the CTA's path here is \`${path(cta)}\``
  }).catch((err) => `could not inspect: ${err.message}`)
}

async function step(cell, key, fn) {
  try {
    const detail = await fn()
    cell(key, 'pass', detail ?? '')
    return true
  } catch (err) {
    cell(key, 'fail', err.message)
    return false
  }
}

function writeMatrix(rows) {
  const icon = { pass: '✅', fail: '❌', warn: '⚠️', skip: '➖' }
  const lines = [
    `# Froam stack matrix — ${inst.pkg.name}@${inst.pkg.version}`,
    '',
    `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Node ${process.version} · ${process.platform}`,
    '',
    `| Stack | ${COLUMNS.map(([, h]) => h).join(' | ')} |`,
    `| --- | ${COLUMNS.map(() => ':-:').join(' | ')} |`,
    ...rows.map((r) => `| ${r.label} | ${COLUMNS.map(([k]) => (r.cells[k] ? icon[r.cells[k].status] : '➖')).join(' | ')} |`),
    '',
    '✅ works · ⚠️ works with a caveat · ❌ broken · ➖ not reached',
    '',
  ]
  for (const r of rows) {
    lines.push(`## ${r.label}`, '')
    for (const [k, h] of COLUMNS) {
      const c = r.cells[k]
      if (c && c.status !== 'pass') lines.push(`- ${icon[c.status]} **${h}** — ${c.detail.replace(/\n/g, ' ').slice(0, 500)}`)
      else if (c?.detail) lines.push(`- ${icon.pass} ${h} — ${c.detail.slice(0, 200)}`)
    }
    for (const n of r.notes) lines.push(`- 📝 ${n.slice(0, 700)}`)
    lines.push('', '<details><summary>froam init output</summary>', '', '```', r.init, '```', '</details>', '')
  }
  fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'))
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ package: `${inst.pkg.name}@${inst.pkg.version}`, rows }, null, 2))
  console.log(`\n  report ${path.join(outDir, 'report.md')}`)
}

/**
 * One cached `npm install` per stack — plus, separately, the same stack with
 * Froam installed (what a user has after `npm i -D @ahmadastic/froam`), so the
 * plain install stays plain and npm dedupes React the way it would for them.
 */
function ensureInstall(stack, withFroam) {
  const deps = JSON.parse(JSON.stringify(stack.deps))
  if (withFroam) deps.devDependencies = { ...(deps.devDependencies ?? {}), '@ahmadastic/froam': path.isAbsolute(inst.spec) ? `file:${inst.spec}` : inst.spec.replace(/^@ahmadastic\/froam@?/, '') || 'latest' }
  const key = JSON.stringify(deps) + (withFroam ? inst.pkg.version : '')
  const cached = path.join(cache, withFroam ? `${stack.id}+froam` : stack.id)
  if (fs.existsSync(path.join(cached, 'node_modules')) && readMaybe(path.join(cached, '.deps')) === key) return cached
  fs.rmSync(cached, { recursive: true, force: true })
  fs.mkdirSync(cached, { recursive: true })
  fs.writeFileSync(path.join(cached, 'package.json'), JSON.stringify({ name: `kola-${stack.id}`, private: true, type: 'module', ...deps }, null, 2))
  const res = run(npm, ['install', '--no-audit', '--no-fund'], { cwd: cached, timeout: 900000 })
  if (res.code !== 0) throw new Error(`npm install failed: ${res.out.slice(-600)}`)
  fs.writeFileSync(path.join(cached, '.deps'), key)
  return cached
}

/**
 * A project's node_modules from a cached install, as hard links: a real
 * folder inside the project (Turbopack refuses symlinks and junctions that
 * leave the project root) that costs no copy. NTFS has hard links too.
 */
function linkInstall(cached, dir) {
  const nm = path.join(dir, 'node_modules')
  fs.rmSync(nm, { recursive: true, force: true })
  const src = path.join(cached, 'node_modules')
  const junk = ['.vite-temp', '.cache', '.vite']
  if (process.platform !== 'win32') {
    const res = run('cp', ['-al', src, nm])
    if (res.code !== 0) throw new Error(`could not link node_modules: ${res.out}`)
    for (const name of junk) fs.rmSync(path.join(nm, name), { recursive: true, force: true })
  } else {
    const linkTree = (from, to, top) => {
      fs.mkdirSync(to, { recursive: true })
      for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (top && junk.includes(entry.name)) continue
        const a = path.join(from, entry.name)
        const b = path.join(to, entry.name)
        if (entry.isDirectory()) linkTree(a, b, false)
        else if (entry.isSymbolicLink()) fs.cpSync(a, b, { recursive: true, dereference: true })
        else fs.linkSync(a, b)
      }
    }
    linkTree(src, nm, true)
  }
  if (!fs.existsSync(path.join(dir, 'package.json'))) fs.copyFileSync(path.join(cached, 'package.json'), path.join(dir, 'package.json'))
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null } }
function readMaybe(file) { try { return fs.readFileSync(file, 'utf8') } catch { return null } }
