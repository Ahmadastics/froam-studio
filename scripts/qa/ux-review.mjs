#!/usr/bin/env node
/**
 * UX review — what a new user meets, and whether the Looks are good.
 *
 * Two passes, both against the installed package in a real browser:
 *
 *   first-run  The README's "Try it" path as a stranger takes it: run `froam`
 *              with a site already running, read the prompt, pick the site,
 *              accept the folder, click the launcher, make the first visible
 *              improvement, save. Counts clicks and seconds against the
 *              targets in docs/COMPETITIVE_POSITIONING.md (first visible
 *              improvement < 60 s, first shippable edit < 5 min, no dead
 *              buttons, no unexplained screens). Clicks every toolbar button
 *              once to find dead ones, and lists every word a new user reads.
 *
 *   looks      Previews every Look on a button, a card, a heading and a photo,
 *              the way the Styles panel does, and checks each one: still
 *              visible, text still readable (WCAG), neighbours not shoved,
 *              text not clipped, "Alive" looks actually answer the pointer,
 *              motion stops under prefers-reduced-motion. Writes contact
 *              sheets — one image per target and group — for a taste review.
 *
 *   node scripts/qa/ux-review.mjs                       # npm pack this repo, both passes
 *   node scripts/qa/ux-review.mjs --pkg @ahmadastic/froam@latest --only looks
 *   node scripts/qa/ux-review.mjs --only looks --targets cta,card --groups Alive,Depth
 *
 * Options: --pkg  --only first-run|looks  --targets cta,card,headline,photo
 *          --groups <names>  --limit <n per target>  --out <dir>  --headed
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import {
  tmpdir, parseArgs, findBrowser, freePort, waitForHttp, installFroam, froam, startFroam, start, run,
  openEditor, clickOn, deselect, selectedTag, saveAndWait, watchErrors, Report, stampDir, sleep, SEL,
} from './lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const FIXTURE = path.join(HERE, 'fixtures', 'ship-site')
const args = parseArgs()
const work = fs.mkdtempSync(path.join(tmpdir(), 'froam-ux-'))
const outDir = path.resolve(args.out && args.out !== true ? args.out : stampDir(path.join(tmpdir(), 'froam-qa'), 'ux-review'))
const only = args.only && args.only !== true ? String(args.only) : null
fs.mkdirSync(outDir, { recursive: true })

// Words that need explaining to someone who has never seen Froam. The
// positioning doc keeps Labs, physics, forensic and attention surfaces out of
// first use; the rest are engineering words leaking into the interface.
const JARGON = /\b(Labs?|Intel(ligence)?|DNA|Forensics?|Physics|Oplog|Op-log|Branch(es)?|Checkpoints?|Scope|Runtime|Gate|Bridge|Sidecar|Predicted attention|Heatmap|Judge|Induce|Corpus|Priors?|Drift|Anchor(ed)?|Orphan(ed)?|Hydrat\w*|Payload|Schema)\b/i
// Product names that are not this product.
const FOREIGN_BRANDS = /\b(Claude|Anthropic|ChatGPT|OpenAI|Copilot|Cursor|Webflow|Framer)\b/
// Never click these during the dead-button scan.
const DESTRUCTIVE = /delete|remove|reset|end collaboration|clear|sign out|log out|publish|approve|revert|discard|exit|close|new links|leave/i

let inst
let browser
let calcPage

async function main() {
  console.log(`◆ Froam UX review\n  out ${outDir}\n`)
  inst = installFroam(args.pkg && args.pkg !== true ? args.pkg : null, { repoRoot: REPO, workDir: work, build: !args['no-build'] })
  console.log(`  testing ${inst.pkg.name}@${inst.pkg.version}\n`)
  browser = await chromium.launch({ executablePath: findBrowser(chromium), headless: !args.headed })
  const summary = { package: `${inst.pkg.name}@${inst.pkg.version}` }
  try {
    if (!only || only === 'first-run') summary.firstRun = await firstRun()
    if (!only || only === 'looks') summary.looks = await looks()
  } finally {
    await browser.close()
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
    fs.rmSync(work, { recursive: true, force: true })
    console.log(`\n  reports in ${outDir}`)
  }
  const failed = (summary.firstRun?.failed ?? 0) > 0
  process.exitCode = failed ? 1 : 0
}

/* ════════════════════════ first run ════════════════════════ */

async function firstRun() {
  console.log('▸ first run')
  const report = new Report(`Froam first-run review — ${inst.pkg.name}@${inst.pkg.version}`)
  const site = path.join(work, 'kola-site')
  fs.cpSync(FIXTURE, site, { recursive: true })
  const procs = []
  const metrics = {}
  try {
    /* 0 — the wait before anything happens: npx with an empty cache */
    await report.step('cold npx: download and start', async () => {
      const cacheDir = path.join(work, 'npm-cache')
      const spec = inst.packed ? inst.packed.file : inst.spec
      const res = run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', spec, 'version'], { cwd: work, env: { npm_config_cache: cacheDir, npm_config_update_notifier: 'false' }, timeout: 300000 })
      if (res.code !== 0) throw new Error(res.out.slice(-400))
      metrics.coldNpxMs = res.ms
      if (res.ms > 30000) throw new Error(`${(res.ms / 1000).toFixed(1)} s before Froam prints anything (target: under 30 s on a normal connection)`)
      return `${(res.ms / 1000).toFixed(1)} s on this connection${inst.packed ? ' (local tarball — the registry adds download time)' : ''}`
    }, { warnOnly: true })

    /* 1 — a site is already running, the way a tester's dev server would be */
    // A port a dev server would really use (Froam's prompt looks for those), and one that's free here.
    const sitePort = await firstFreePort([5173, 5174, 3000, 4321, 8080, 3001])
    const server = start(process.execPath, ['-e', STATIC_SERVER, String(sitePort)], { cwd: site })
    procs.push(server)
    await waitForHttp(`http://127.0.0.1:${sitePort}/`, 15000)

    /* 2 — `froam` with no arguments: read the prompt like a stranger */
    const t0 = Date.now()
    const cli = await interactiveFroam(site, [
      { when: /Website URL, or a number|Paste the website/i, answer: (out) => pickSite(out, 'Kola Logistics', sitePort) },
      { when: /\[Y\/n\]/i, answer: () => '' },
    ])
    procs.push(cli)
    const transcript = () => stripAnsi(cli.log())
    let editorUrl
    await report.step('cli: offers the running site by its page title', async () => {
      await cli.waitFor(/Website URL, or a number|Paste the website/i, 30000)
      metrics.promptMs = Date.now() - t0
      const out = transcript()
      if (!/Kola Logistics/.test(out)) throw new Error(`the list does not name the running site:\n${out.slice(0, 600)}`)
      return `prompt in ${(metrics.promptMs / 1000).toFixed(1)} s, lists "Kola Logistics"`
    }, { warnOnly: true })
    await report.step('cli: asks before writing into the project, and names the folder', async () => {
      await cli.waitFor(/\[Y\/n\]|Where should Froam save/i, 20000)
      const out = transcript()
      if (!out.includes(path.basename(site))) throw new Error(`the question does not show the project folder:\n${out.slice(-500)}`)
      return 'shows the folder and waits for Enter'
    }, { warnOnly: true })
    const reached = await report.step('cli: prints a local address to open', async () => {
      // The site's own address is printed too ("Connecting to …"); the editor is the other one.
      const m = await cli.waitFor(new RegExp(`http://(?:localhost|127\\.0\\.0\\.1):(?!${sitePort}\\b)\\d+`), 30000)
      editorUrl = m[0] + '/'
      metrics.cliToUrlMs = Date.now() - t0
      return `${editorUrl} after ${(metrics.cliToUrlMs / 1000).toFixed(1)} s`
    })
    fs.writeFileSync(path.join(outDir, 'first-run-cli-transcript.txt'), transcript())
    report.notes.push(`CLI transcript saved as first-run-cli-transcript.txt (${transcript().split('\n').length} lines a new user reads before the editor).`)
    if (!reached) return finish()

    /* 3 — the browser: launcher, first open, what's on screen */
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const errors = watchErrors(page, [/favicon\.ico/])
    const tBrowser = Date.now()
    await page.goto(editorUrl, { waitUntil: 'domcontentloaded' })
    let clicks = 0
    const launched = await report.step('editor: launcher appears and says what it does', async () => {
      await page.waitForSelector(SEL.launcher, { timeout: 30000 })
      metrics.launcherMs = Date.now() - tBrowser
      const l = await page.evaluate((s) => { const e = document.querySelector(s); return { text: e.innerText.replace(/\s+/g, ' ').trim(), title: e.title, aria: e.getAttribute('aria-label') } }, SEL.launcher)
      metrics.launcher = l
      return `"${l.text}" after ${(metrics.launcherMs / 1000).toFixed(1)} s`
    })
    await page.screenshot({ path: path.join(outDir, 'first-run-1-launcher.png') })
    if (!launched) { await context.close(); return finish() }
    await report.step('editor: launcher speaks as Froam', async () => {
      const l = metrics.launcher
      const foreign = [l.text, l.title, l.aria].join(' ').match(FOREIGN_BRANDS)
      if (foreign) throw new Error(`the launcher calls itself "${foreign[0]}": tooltip "${l.title}", screen reader "${l.aria}"`)
    })
    await page.click(SEL.launcher); clicks += 1
    await page.waitForSelector(SEL.chrome, { timeout: 20000 })
    await sleep(700)
    await page.screenshot({ path: path.join(outDir, 'first-run-2-editor.png') })
    const ui = await readEditorUi(page)
    metrics.firstScreen = { controls: ui.controls.length, words: ui.words }
    await report.step('editor: first screen is calm', async () => {
      if (ui.controls.length > 30) throw new Error(`${ui.controls.length} controls on the first screen (aim for ≤ 30)`)
      return `${ui.controls.length} controls; hint: "${ui.hint || '(none)'}"`
    }, { warnOnly: true })
    await report.step('editor: speaks as Froam, not another product', async () => {
      const hits = ui.controls.filter((c) => FOREIGN_BRANDS.test(c)).concat(ui.words.match(new RegExp(FOREIGN_BRANDS, 'g')) ?? [])
      if (hits.length) throw new Error(`another product's name in Froam's interface: ${[...new Set(hits)].slice(0, 6).map((h) => `"${h}"`).join(', ')}`)
    })
    await report.step('editor: no unexplained jargon on the first screen', async () => {
      const found = [...new Set([...ui.controls, ui.words].join(' · ').match(new RegExp(JARGON, 'gi')) ?? [])]
      if (found.length) throw new Error(`a new user reads: ${found.join(', ')}`)
    }, { warnOnly: true })

    /* 4 — the first visible improvement, counted in clicks */
    const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const before = await contrastOf(page, '#faint', ground)
    let improved = false
    await report.step('first improvement: Fix contrast on faint text via Quick Edit', async () => {
      await deselect(page)
      await clickOn(page, '#faint'); clicks += 1
      await page.click(SEL.askBtn); clicks += 1
      await page.waitForSelector(SEL.quickChat, { timeout: 8000 })
      const chips = await page.locator(SEL.smartChips).allInnerTexts()
      const chip = chips.find((c) => /contrast/i.test(c))
      if (!chip) throw new Error(`Quick Edit on faint text offers ${chips.join(', ') || 'nothing'} — no contrast fix`)
      await page.locator(SEL.smartChips, { hasText: chip }).click(); clicks += 1
      await page.waitForSelector(`${SEL.intentResult}.is-preview, ${SEL.intentResult}.is-error`, { timeout: 10000 })
      const why = await page.locator('.froam-intent-result__why').first().innerText().catch(() => '')
      await page.locator(SEL.intentKeep).click(); clicks += 1
      await sleep(500)
      const after = await contrastOf(page, '#faint', ground)
      metrics.firstImprovementMs = Date.now() - tBrowser
      metrics.clicksToImprovement = clicks
      if (after < 4.5) throw new Error(`contrast ${before.toFixed(2)}:1 → ${after.toFixed(2)}:1, still below AA`)
      improved = true
      return `${before.toFixed(2)}:1 → ${after.toFixed(2)}:1 in ${clicks} clicks, ${(metrics.firstImprovementMs / 1000).toFixed(1)} s of machine time · preview said "${why.slice(0, 90)}"`
    })
    await page.screenshot({ path: path.join(outDir, 'first-run-3-improved.png') })
    await report.step('first shippable edit: Save to Repo from the toolbar', async () => {
      if (!improved) throw new Error('nothing to save — the improvement step failed')
      await deselect(page)
      const design = path.join(site, 'froam', 'froam.design.json')
      const stamp = fs.existsSync(design) ? fs.statSync(design).mtimeMs : 0
      const saveBtn = page.locator('#froam-editor-portal button[aria-label*="Save to Repo"], #froam-editor-portal button[title*="Save to Repo"]').first()
      if (await saveBtn.count()) { await saveBtn.click(); clicks += 1 } else { await page.keyboard.press('Control+Shift+S'); report.notes.push('No visible Save to Repo button found; used Ctrl+Shift+S.') }
      const t = Date.now()
      while ((fs.existsSync(design) ? fs.statSync(design).mtimeMs : 0) === stamp && Date.now() - t < 15000) await sleep(150)
      if ((fs.existsSync(design) ? fs.statSync(design).mtimeMs : 0) === stamp) throw new Error('froam/froam.design.json was not written')
      metrics.clicksToShippable = clicks
      metrics.shippableMs = Date.now() - t0
      if (metrics.shippableMs > 5 * 60000) throw new Error(`${(metrics.shippableMs / 60000).toFixed(1)} min to first shippable edit (target < 5 min)`)
      return `${clicks} clicks total; ${(metrics.shippableMs / 1000).toFixed(1)} s from typing \`froam\` (machine time — a person adds reading time)`
    })
    await report.step('the selected element\'s font reads true in the floating bar', async () => {
      await deselect(page)
      await clickOn(page, '#cta')
      const seen = await page.evaluate(() => {
        // What the control *shows*: a select's chosen option, a button's first line.
        const shown = (e) => (e.tagName === 'SELECT' ? (e.selectedOptions?.[0]?.text ?? e.value) : (e.innerText || e.value || '')).split('\n')[0]
        const bar = [...document.querySelectorAll('#froam-editor-portal button, #froam-editor-portal select, #froam-editor-portal [role=combobox]')].map(shown).find((t) => /grotesk|grotesque|inter\b|system|segoe|sans|serif|helvetica|arial|roboto|bricolage|font/i.test(t)) ?? ''
        return { bar: bar.trim(), computed: getComputedStyle(document.getElementById('cta')).fontFamily }
      })
      if (!seen.bar) return 'no font control visible'
      const first = seen.computed.split(',')[0].replace(/["']/g, '').trim().toLowerCase()
      const shown = seen.bar.toLowerCase()
      if (!shown.includes(first.slice(0, 6)) && !(first === 'system-ui' && /system/.test(shown))) throw new Error(`the bar shows "${seen.bar}" for a button whose font is ${seen.computed}`)
      return `"${seen.bar}"`
    }, { warnOnly: true })
    await context.close()

    /* 5 — every toolbar button once: dead ones, broken ones */
    const dead = await deadButtonScan(editorUrl)
    metrics.buttonsScanned = dead.scanned
    await report.step('toolbar: every button does something', async () => {
      if (dead.dead.length) throw new Error(`no visible effect: ${dead.dead.join(', ')}`)
      return `${dead.scanned} buttons clicked`
    })
    await report.step('toolbar: no button throws', async () => {
      if (dead.broken.length) throw new Error(dead.broken.slice(0, 6).join('\n'))
    })
    if (dead.thirdParty.length) report.notes.push(`The editor contacted outside hosts (worth knowing for the "nothing leaves your computer" story): ${dead.thirdParty.join(', ')}`)
    if (dead.jargon.length) report.notes.push(`Words met behind toolbar buttons that may need explaining: ${dead.jargon.join(', ')}`)
    if (dead.foreign.length) report.add('panels: speak as Froam', 'fail', `another product's name behind toolbar buttons: ${dead.foreign.join(', ')}`)
    await report.step('session: no errors in the console', async () => {
      if (errors.length) throw new Error([...new Set(errors)].slice(0, 6).join('\n'))
    }, { warnOnly: true })
  } finally {
    for (const p of procs) await p.stop()
  }
  return finish()

  function finish() {
    report.meta = { ...report.meta, ...flatMetrics(metrics) }
    const { mdPath } = report.write(path.join(outDir, 'first-run'))
    console.log(`  → ${mdPath}`)
    return { ok: report.ok, failed: report.failed.length, warnings: report.warned.length, metrics }
  }
}

async function readEditorUi(page) {
  return page.evaluate(() => {
    const root = document.getElementById('froam-editor-portal') ?? document.body
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 }
    const controls = [...root.querySelectorAll('button, [role=button], [role=tab], a[href], input, select')].filter(vis)
      .map((b) => [b.getAttribute('aria-label'), b.title, b.innerText, b.placeholder].filter(Boolean).join(' / ').replace(/\s+/g, ' ').trim().slice(0, 80))
    const hint = [...root.querySelectorAll('*')].find((e) => /click anything|get started|welcome/i.test(e.innerText ?? '') && e.children.length < 6)?.innerText.replace(/\s+/g, ' ').trim() ?? ''
    return { controls, words: root.innerText.replace(/\s+/g, ' ').trim(), hint }
  })
}

/** Clicks each visible toolbar button once, on a fresh editor each time. */
async function deadButtonScan(url) {
  const result = { scanned: 0, dead: [], broken: [], jargon: new Set(), foreign: new Set(), thirdParty: new Set() }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await openEditor(page, url)
  // Buttons already in their "on" state (the active tool, the current viewport) are not dead for doing nothing.
  const active = await page.evaluate(() => [...document.querySelectorAll('#froam-editor-portal button, #froam-editor-portal [role=tab]')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-current') || /\b(is-active|active|is-selected)\b/.test(b.className))
    .map((b) => b.getAttribute('aria-label') || b.title || b.innerText.trim()))
  const labels = (await readEditorUi(page)).controls.filter((l) => l && !DESTRUCTIVE.test(l) && !/^Got it$/i.test(l) && !active.includes(l.split(' / ')[0]))
  for (const label of labels) {
    const name = label.split(' / ')[0]
    let errors = []
    try {
      await openEditor(page, url)
      errors = watchErrors(page, [/favicon\.ico/])
      const dismiss = page.locator('#froam-editor-portal button', { hasText: /^Got it$/ })
      if (await dismiss.count()) await dismiss.first().click().catch(() => {})
      const target = page.locator('#froam-editor-portal').locator(`[aria-label="${cssEscape(name)}"], [title="${cssEscape(name)}"]`).first()
      const button = (await target.count()) ? target : page.locator('#froam-editor-portal button', { hasText: name }).first()
      if (!(await button.count()) || !(await button.isVisible())) continue
      const startUrl = page.url()
      await page.evaluate(() => {
        window.__qaMut = 0
        window.__qaObs?.disconnect()
        window.__qaObs = new MutationObserver((r) => { window.__qaMut += r.length })
        window.__qaObs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
      })
      let requests = 0
      const onReq = () => { requests += 1 }
      page.on('request', onReq)
      const pages = context.pages().length
      const outside = (req) => { try { const h = new URL(req.url()).hostname; if (!/^(localhost|127\.0\.0\.1)$/.test(h)) result.thirdParty.add(`${h} (after "${name}")`) } catch { /* data: etc */ } }
      page.on('request', outside)
      await button.click({ timeout: 3000 })
      await sleep(700)
      page.off('request', onReq)
      page.off('request', outside)
      const mutations = await page.evaluate(() => window.__qaMut).catch(() => 1)
      result.scanned += 1
      const changed = mutations > 0 || requests > 0 || page.url() !== startUrl || context.pages().length !== pages
      if (!changed) result.dead.push(`"${name}"`)
      // A third-party host this sandbox can't reach is reported as a host, not a broken button.
      const own = errors.filter((e) => !/ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED/.test(e) || /localhost|127\.0\.0\.1/.test(e))
      if (own.length) result.broken.push(`"${name}": ${own[0]}`)
      const text = await page.evaluate(() => document.getElementById('froam-editor-portal')?.innerText ?? '').catch(() => '')
      for (const m of text.match(new RegExp(JARGON, 'gi')) ?? []) result.jargon.add(m)
      for (const m of text.match(new RegExp(FOREIGN_BRANDS, 'g')) ?? []) result.foreign.add(`${m} (after "${name}")`)
      await page.keyboard.press('Escape').catch(() => {})
      for (const extra of context.pages().slice(1)) await extra.close().catch(() => {})
    } catch (err) {
      result.broken.push(`"${name}": ${err.message.split('\n')[0]}`)
    }
  }
  await context.close()
  return { ...result, jargon: [...result.jargon], foreign: [...result.foreign], thirdParty: [...result.thirdParty] }
}

/* ════════════════════════ looks ════════════════════════ */

const TARGETS = {
  cta: { selector: '#cta', label: 'Button', text: true, neighbours: ['#ghost', '#subtitle'] },
  card: { selector: '#card-2', label: 'Card', text: true, neighbours: ['#card-1', '#card-3', '#pricing-title'], at: [0.5, 0.92] },
  headline: { selector: '#headline', label: 'Heading', text: true, neighbours: ['#subtitle', '.eyebrow'], at: 'first-word' },
  photo: { selector: '#card-1 img', label: 'Photo', text: false, neighbours: ['#card-1 h3'] },
}

async function looks() {
  console.log('▸ looks')
  const site = path.join(work, 'looks-site')
  fs.cpSync(FIXTURE, site, { recursive: true })
  froam(inst, ['init'], { cwd: site, input: '' })
  const port = await freePort()
  const bridge = startFroam(inst, ['dev', '--serve', '.', '--port', String(port)], { cwd: site })
  const url = `http://localhost:${port}/`
  await waitForHttp(url, 45000)
  const targets = (args.targets && args.targets !== true ? String(args.targets).split(',') : Object.keys(TARGETS)).filter((t) => TARGETS[t])
  const groups = args.groups && args.groups !== true ? new Set(String(args.groups).split(',').map((g) => g.toLowerCase())) : null
  const limit = Number(args.limit) || Infinity
  const results = []
  calcPage = await browser.newPage()
  const shotsDir = path.join(outDir, 'looks', 'shots')
  fs.mkdirSync(shotsDir, { recursive: true })
  try {
    for (const key of targets) {
      const target = TARGETS[key]
      const context = await browser.newContext({ viewport: { width: 1800, height: 1000 } })
      const page = await context.newPage()
      const errors = watchErrors(page, [/favicon\.ico/])
      await openEditor(page, url)
      await page.addStyleTag({ content: 'html.froam-qa-shot [data-chef-editor-root="true"], html.froam-qa-shot #froam-editor-portal { visibility: hidden !important } html.froam-qa-shot [data-chef-selected] { outline: none !important }' })
      await selectTarget(page, target)
      await page.click(SEL.looksBtn)
      await page.waitForSelector(SEL.lookTiles, { timeout: 10000 })
      // Opening Styles moves the page out from under the panel; measure "before" with it open.
      await page.mouse.move(2, 990)
      await sleep(500)
      const baseline = await measure(page, target)
      if (target.text) baseline.px = await pixelContrast(page, target)
      const tiles = await page.evaluate((s) => [...document.querySelectorAll(s)].map((b, i) => ({ i, name: (b.querySelector('span')?.textContent ?? '').trim() || b.getAttribute('aria-label') || `#${i}`, title: b.title, alive: b.classList.contains('is-alive') })), SEL.lookTiles)
      const LOOK_GROUP = await lookGroups()
      const offered = tiles.filter((t) => !groups || groups.has((LOOK_GROUP[normName(t.name)] ?? '').toLowerCase())).slice(0, limit)
      console.log(`  ${target.label}: ${tiles.length} looks offered, checking ${offered.length}`)
      const baseShot = await shoot(page, target, path.join(shotsDir, `${key}--baseline.png`))
      for (const tile of offered) {
        const errCount = errors.length
        const row = { target: key, look: tile.name, group: LOOK_GROUP[normName(tile.name)] ?? '?', alive: tile.alive, flags: [], shot: `shots/${key}--${slug(tile.name)}.png` }
        try {
          await page.locator(SEL.lookTiles).nth(tile.i).click({ timeout: 4000 })
          await page.mouse.move(2, 990)
          await sleep(450)
          const m = await measure(page, target)
          row.metrics = m
          flagLook(row, m, baseline, target)
          if (target.text) {
            const px = await pixelContrast(page, target)
            row.contrast = px
            textFlags(row, px, m, '')
          }
          const restShot = await shoot(page, target, path.join(outDir, 'looks', row.shot))
          const restDiff = await imageDiff(baseShot, restShot)
          if ((tile.alive || /alive/i.test(row.group)) && !/^reset/i.test(tile.name)) {
            const box = await page.locator(target.selector).first().boundingBox()
            const byFocus = /focus/i.test(tile.name)
            if (box) {
              if (byFocus) await page.evaluate((sel) => { const el = document.querySelector(sel); el.tabIndex = el.tabIndex < 0 ? 0 : el.tabIndex; el.focus({ focusVisible: true }) }, target.selector)
              else await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
              await sleep(550)
              const hover = await measure(page, target)
              const hoverShot = await shoot(page, target, path.join(shotsDir, `${key}--${slug(tile.name)}--hover.png`))
              if (target.text) textFlags(row, await pixelContrast(page, target), hover, 'on hover: ')
              row.hoverShot = `shots/${key}--${slug(tile.name)}--hover.png`
              const hoverDiff = await imageDiff(restShot, hoverShot)
              if (hoverDiff != null && hoverDiff < 0.002) row.flags.push(restDiff != null && restDiff < 0.002 ? `changed nothing visible, at rest or on ${byFocus ? 'focus' : 'hover'}` : `alive look does not change on ${byFocus ? 'focus' : 'hover'}`)
              if (byFocus) await page.evaluate(() => document.activeElement?.blur())
              await page.mouse.move(2, 990)
              await sleep(300)
            }
          }
          if (m.animations > 0) {
            await page.emulateMedia({ reducedMotion: 'reduce' })
            await sleep(200)
            const reduced = await measure(page, target)
            await page.emulateMedia({ reducedMotion: 'no-preference' })
            if (reduced.animations > 0) row.flags.push(`${reduced.animations} animation(s) keep running under prefers-reduced-motion`)
          }
          if (restDiff != null && restDiff < 0.002 && !row.alive && !/alive/i.test(row.group) && !/^reset/i.test(row.look)) row.flags.push('no visible change on this target (or too subtle to see)')
          if (errors.length > errCount) row.flags.push(`error: ${errors[errors.length - 1].slice(0, 120)}`)
        } catch (err) {
          row.flags.push(`could not preview: ${err.message.split('\n')[0]}`)
        }
        results.push(row)
      }
      await context.close()
    }
  } finally {
    await bridge.stop()
  }
  const sheets = await contactSheets(results)
  return writeLooksReport(results, sheets)
}

async function selectTarget(page, target) {
  await deselect(page)
  if (target.at === 'first-word') {
    const p = await page.evaluate((s) => { const el = document.querySelector(s); el.scrollIntoView({ block: 'center' }); const text = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); const r = document.createRange(); r.setStart(text, 0); r.setEnd(text, 3); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } }, target.selector)
    await page.mouse.click(p.x, p.y)
    await sleep(250)
  } else await clickOn(page, target.selector, ...(target.at ?? [0.5, 0.5]))
  const sel = await page.evaluate((s) => !!document.querySelector(s)?.matches('[data-chef-selected="true"]'), target.selector)
  if (!sel) throw new Error(`could not select ${target.label} (${await selectedTag(page)} is selected)`)
}

/** Everything the checks need, read from the page as a visitor would see it. */
function measure(page, target) {
  return page.evaluate(({ sel, neighbours }) => {
    const el = document.querySelector(sel)
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : null }
    const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    const lum = ([r1, g, b]) => 0.2126 * channel(r1) + 0.7152 * channel(g) + 0.0722 * channel(b)
    // The colour really behind the text: first opaque background up the tree.
    let ground = null; let measurable = true
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { measurable = false; break }
      const bg = parse(cs.backgroundColor)
      if (bg && (bg[3] === undefined || bg[3] > 0.9)) { ground = bg; break }
    }
    const color = parse(s.color)
    const clipText = /text/.test(s.webkitBackgroundClip || s.backgroundClip || '') || (color && color[3] === 0)
    let contrast = null
    if (measurable && !clipText && ground && color && (color[3] === undefined || color[3] > 0.5)) {
      const [a, b] = [lum(color), lum(ground)].sort((x, y) => y - x)
      contrast = (a + 0.05) / (b + 0.05)
    }
    const after = getComputedStyle(el, '::after'); const before = getComputedStyle(el, '::before')
    const anims = el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && (a.effect?.getTiming?.().iterations === Infinity || a.effect?.getComputedTiming?.().endTime > 2000))
    // Document coordinates: the editor scrolls the page to keep the selection
    // in view, and a scroll is not a layout change.
    // …and relative to <main>, because the editor also shifts the whole page
    // (by its toolbar height) when panels open and close.
    const anchor = (document.querySelector('main') ?? document.body).getBoundingClientRect()
    const sx = -anchor.x; const sy = -anchor.y
    return {
      box: { x: Math.round(r.x + sx), y: Math.round(r.y + sy), w: Math.round(r.width), h: Math.round(r.height) },
      neighbours: Object.fromEntries(neighbours.map((n) => { const e = document.querySelector(n); const b = e?.getBoundingClientRect(); return [n, b ? { x: Math.round(b.x + sx), y: Math.round(b.y + sy) } : null] })),
      visible: r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && +s.opacity > 0.15,
      opacity: +s.opacity,
      contrast, measurable: measurable && !clipText,
      fontSize: parseFloat(s.fontSize), fontWeight: +s.fontWeight || 400,
      overflow: el.scrollWidth > el.clientWidth + 2 && s.overflowX !== 'visible' ? `${el.scrollWidth}>${el.clientWidth}` : null,
      animations: anims.length,
      style: [s.backgroundColor, s.backgroundImage, s.backgroundPosition, s.backgroundSize, s.boxShadow, s.transform, s.translate, s.scale, s.rotate, s.color, s.borderTopColor, s.borderRadius, s.filter, s.backdropFilter, s.textShadow, s.outlineColor, s.outlineOffset, s.letterSpacing, s.textDecorationColor, s.textDecorationThickness, s.textUnderlineOffset, s.clipPath, s.opacity].join('|'),
      pseudo: [after, before].map((p) => [p.content, p.transform, p.translate, p.scale, p.opacity, p.width, p.height, p.left, p.backgroundImage, p.backgroundPosition, p.backgroundSize, p.clipPath].join(',')).join('|'),
    }
  }, { sel: target.selector, neighbours: target.neighbours })
}

function flagLook(row, m, base, target) {
  if (!m.visible) row.flags.push(`element no longer visible (opacity ${m.opacity})`)
  // A wider button nudging the link beside it is what restyling a button means.
  // Pushing the content below it down (or pulling it up) is a layout change a
  // "look" should not make on its own.
  for (const [n, p] of Object.entries(m.neighbours)) {
    const b = base.neighbours[n]
    if (!p || !b) continue
    const dy = p.y - b.y; const dx = p.x - b.x
    if (Math.abs(dy) > 3 || Math.abs(dx) > 40) row.flags.push(`shifted ${n} ${dy ? `${dy > 0 ? 'down' : 'up'} ${Math.abs(dy)}px` : `${Math.abs(dx)}px sideways`}`)
  }
  const grow = Math.max(m.box.w / Math.max(base.box.w, 1), m.box.h / Math.max(base.box.h, 1))
  if (grow > 1.35) row.flags.push(`grew ${Math.round((grow - 1) * 100)}%`)
  if (m.overflow) row.flags.push(`content clipped (${m.overflow})`)
}

/**
 * Contrast as a visitor sees it, gradients and images included: shoot the
 * element, shoot it again with its text made transparent, and compare the
 * glyph pixels with what is behind them. Returns the median contrast of the
 * glyphs' cores, and how much text is visible at all.
 */
async function pixelContrast(page, target) {
  const box = await page.evaluate((sel) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }, target.selector)
  const vp = page.viewportSize()
  const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(vp.width - Math.max(0, box.x), box.width), height: Math.min(vp.height - Math.max(0, box.y), box.height) }
  if (clip.width < 4 || clip.height < 4) return null
  await page.evaluate(() => document.documentElement.classList.add('froam-qa-shot'))
  try {
    const withText = await page.screenshot({ clip })
    // Text painted with background-clip: text (gradient words, Ink in, Shine
    // sweep on words) only disappears when its background goes too.
    await page.evaluate((sel) => {
      const root = document.querySelector(sel)
      window.__qaClip = false
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const cs = getComputedStyle(el)
        if (/text/.test(cs.webkitBackgroundClip || '') || /text/.test(cs.backgroundClip || '')) { el.setAttribute('data-qa-cliptext', ''); window.__qaClip = true }
      }
      const st = document.createElement('style'); st.id = 'froam-qa-notext'
      st.textContent = `${sel}, ${sel} *, ${sel}::before, ${sel}::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; transition: none !important; text-decoration-color: transparent !important; -webkit-text-stroke: 0 transparent !important; } [data-qa-cliptext], [data-qa-cliptext]::before, [data-qa-cliptext]::after { background: none !important; }`
      document.head.append(st)
    }, target.selector)
    await sleep(60)
    const noText = await page.screenshot({ clip })
    const clipText = await page.evaluate(() => window.__qaClip)
    await page.evaluate(() => { document.getElementById('froam-qa-notext')?.remove(); document.querySelectorAll('[data-qa-cliptext]').forEach((e) => e.removeAttribute('data-qa-cliptext')) })
    await sleep(350)
    const res = await calcPage.evaluate(async ([a, b]) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src })
      const [ia, ib] = await Promise.all([load(a), load(b)])
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height
      const x = c.getContext('2d', { willReadFrequently: true })
      x.drawImage(ia, 0, 0); const A = x.getImageData(0, 0, c.width, c.height).data
      x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const B = x.getImageData(0, 0, c.width, c.height).data
      const ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      const L = (d, i) => 0.2126 * ch(d[i]) + 0.7152 * ch(d[i + 1]) + 0.0722 * ch(d[i + 2])
      const px = []
      for (let i = 0; i < A.length; i += 4) {
        const diff = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])
        if (diff > 45) px.push([diff, i])
      }
      const area = c.width * c.height
      if (px.length < Math.max(12, area * 0.002)) return { visible: false, glyphPx: px.length }
      px.sort((p, q) => q[0] - p[0])
      const core = px.slice(0, Math.max(8, Math.floor(px.length * 0.25)))
      const ratios = core.map(([, i]) => { const [h, l] = [L(A, i), L(B, i)].sort((m, n) => n - m); return (h + 0.05) / (l + 0.05) }).sort((m, n) => m - n)
      return { visible: true, glyphPx: px.length, contrast: ratios[Math.floor(ratios.length / 2)] }
    }, [`data:image/png;base64,${withText.toString('base64')}`, `data:image/png;base64,${noText.toString('base64')}`])
    return { ...res, clipText }
  } finally {
    await page.evaluate(() => document.documentElement.classList.remove('froam-qa-shot'))
  }
}

/** Share of pixels that differ between two same-size screenshots (null if sizes differ). */
async function imageDiff(a, b) {
  if (!a || !b) return null
  return calcPage.evaluate(async ([x, y]) => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src })
    const [ia, ib] = await Promise.all([load(x), load(y)])
    if (ia.width !== ib.width || ia.height !== ib.height) return 1
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(ia, 0, 0); const A = g.getImageData(0, 0, c.width, c.height).data
    g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const B = g.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) n += 1
    return n / (A.length / 4)
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`])
}

function textFlags(row, px, m, prefix) {
  if (!px) return
  // Text painted by its own background can't be separated from it reliably:
  // say so, and leave the verdict to the contact sheet.
  if (!px.visible) { row.flags.push(px.clipText ? `${prefix}text painted by its background — check the sheet` : `${prefix}text is not visible`); return }
  const large = m.fontSize >= 24 || (m.fontSize >= 18.66 && m.fontWeight >= 700)
  const need = large ? 3 : 4.5
  if (px.contrast < need) row.flags.push(`${prefix}text contrast ${px.contrast.toFixed(2)}:1 as rendered (needs ${need}:1)`)
}

async function shoot(page, target, file) {
  await page.evaluate(() => document.documentElement.classList.add('froam-qa-shot'))
  try {
    // Measure and shoot in the same frame, in the viewport (a full-page capture
    // resizes the window, which the editor answers by re-laying out).
    const box = await page.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, width: r.width, height: r.height } }, target.selector)
    if (!box) return
    const pad = 28
    const vp = page.viewportSize()
    const x = Math.max(0, box.x - pad); const y = Math.max(0, box.y - pad)
    const clip = { x, y, width: Math.min(vp.width - x, box.width + pad * 2), height: Math.min(vp.height - y, box.height + pad * 2) }
    if (clip.width > 4 && clip.height > 4) return await page.screenshot({ path: file, clip })
    return null
  } finally {
    await page.evaluate(() => document.documentElement.classList.remove('froam-qa-shot'))
  }
}

async function lookGroups() {
  try {
    const mod = await import(pathToUrl(path.join(inst.pkgDir, 'dist', 'editor', 'floating-bar-looks.js')))
    return Object.fromEntries(mod.LOOKS.map((l) => [normName(l.name), l.group]))
  } catch { return {} }
}

/** One image per target and group: every look's preview, flagged ones outlined. */
async function contactSheets(results) {
  const sheets = []
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const byKey = {}
  for (const r of results) (byKey[`${r.target}--${r.group}`] ??= []).push(r)
  for (const [key, rows] of Object.entries(byKey)) {
    const [target, group] = key.split('--')
    const img = (rel) => { const f = path.join(outDir, 'looks', rel); return fs.existsSync(f) ? `data:image/png;base64,${fs.readFileSync(f).toString('base64')}` : '' }
    const base = img(`shots/${target}--baseline.png`)
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:24px;font:13px/1.35 system-ui,sans-serif;background:#f4f2ee;color:#1d2433}
      h1{font-size:18px;margin:0 0 16px} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
      figure{margin:0;background:#fff;border-radius:10px;padding:10px;border:2px solid transparent}
      figure.flag{border-color:#d93025} figure.base{border-color:#1a73e8}
      img{width:100%;height:150px;object-fit:contain;background:#fbfaf7;border-radius:6px}
      figcaption b{display:block} figcaption small{color:#b3261e;display:block}
    </style><h1>${TARGETS[target].label} · ${group} · ${rows.length} looks · ${inst.pkg.version}</h1><div class="grid">
      <figure class="base"><img src="${base}"><figcaption><b>Before (no look)</b></figcaption></figure>
      ${rows.map((r) => `<figure class="${r.flags.length ? 'flag' : ''}"><img src="${img(r.shot)}">${r.hoverShot ? `<img src="${img(r.hoverShot)}" style="height:70px">` : ''}<figcaption><b>${esc(r.look)}</b>${r.flags.map((f) => `<small>${esc(f)}</small>`).join('')}</figcaption></figure>`).join('')}
    </div>`
    await page.setContent(html)
    await sleep(100)
    const file = path.join(outDir, 'looks', `sheet-${target}-${slug(group)}.png`)
    await page.screenshot({ path: file, fullPage: true })
    sheets.push(path.relative(outDir, file))
  }
  await page.close()
  return sheets
}

function writeLooksReport(results, sheets) {
  const flagged = results.filter((r) => r.flags.length)
  const byFlag = {}
  for (const r of flagged) for (const f of r.flags) { const k = f.replace(/^error: .*/, 'error during preview').replace(/(\d+(\.\d+)?)(px|%|:1)?/g, 'N').replace(/[#.][\w-]+/g, '…'); (byFlag[k] ??= []).push(`${r.look} (${r.target})`) }
  const lines = [
    `# Froam Look critic — ${inst.pkg.name}@${inst.pkg.version}`,
    '',
    `${results.length} previews checked · **${flagged.length} flagged** · ${sheets.length} contact sheets`,
    '',
    '## Flags by kind', '',
    ...Object.entries(byFlag).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `- **${k}** — ${v.length}: ${v.slice(0, 18).join(', ')}${v.length > 18 ? ', …' : ''}`),
    '', '## Every flagged preview', '',
    '| Target | Group | Look | Flags |', '| --- | --- | --- | --- |',
    ...flagged.map((r) => `| ${r.target} | ${r.group} | ${r.look} | ${r.flags.join('; ')} |`),
    '', '## Contact sheets (for the taste review)', '',
    ...sheets.map((s) => `- ${s}`),
    '',
  ]
  fs.writeFileSync(path.join(outDir, 'looks', 'report.md'), lines.join('\n'))
  fs.writeFileSync(path.join(outDir, 'looks', 'report.json'), JSON.stringify(results, null, 2))
  console.log(`  → ${path.join(outDir, 'looks', 'report.md')}`)
  return { checked: results.length, flagged: flagged.length, sheets, byFlag: Object.fromEntries(Object.entries(byFlag).map(([k, v]) => [k, v.length])) }
}

/* ════════════════════════ helpers ════════════════════════ */

const STATIC_SERVER = `
const http = require('http'), fs = require('fs'), path = require('path')
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }
http.createServer((req, res) => {
  let f = path.join(process.cwd(), decodeURIComponent(req.url.split('?')[0]))
  if (f.endsWith('/')) f += 'index.html'
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
}).listen(+process.argv[1], '0.0.0.0')
`

/** Runs `froam` with a terminal-like stdin and answers its questions. */
async function interactiveFroam(cwd, script) {
  const { spawn } = await import('node:child_process')
  const proc = spawn(process.execPath, [inst.bin], { cwd, detached: process.platform !== 'win32', env: { ...process.env, FROAM_SHARE: 'off', FROAM_NO_OPEN: '1', BROWSER: 'none', NO_COLOR: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
  let buf = ''
  const answered = new Set()
  const onData = (d) => {
    buf += d
    script.forEach((s, i) => {
      if (answered.has(i) || !s.when.test(stripAnsi(buf))) return
      answered.add(i)
      setTimeout(() => proc.stdin.write(`${s.answer(stripAnsi(buf))}\n`), 150)
    })
  }
  proc.stdout.on('data', onData)
  proc.stderr.on('data', onData)
  return {
    log: () => buf,
    waitFor: async (re, ms) => {
      const t = Date.now()
      while (Date.now() - t < ms) { const m = stripAnsi(buf).match(re); if (m) return m; if (proc.exitCode !== null) break; await sleep(100) }
      throw new Error(`waited ${ms / 1000} s for ${re}; got:\n${stripAnsi(buf).slice(-600)}`)
    },
    stop: () => new Promise((resolve) => {
      if (proc.exitCode !== null) return resolve()
      proc.once('exit', resolve)
      try { process.platform === 'win32' ? proc.kill() : process.kill(-proc.pid, 'SIGTERM') } catch { proc.kill() }
      setTimeout(resolve, 3000)
    }),
  }
}

async function firstFreePort(ports) {
  const net = await import('node:net')
  for (const p of ports) {
    const free = await new Promise((resolve) => { const srv = net.createServer().once('error', () => resolve(false)).listen(p, '0.0.0.0', () => srv.close(() => resolve(true))) })
    if (free) return p
  }
  return freePort()
}

function pickSite(out, title, port) {
  const line = out.split('\n').find((l) => l.includes(title) || l.includes(`:${port}`))
  const n = line?.match(/^\s*(\d+)\s/)?.[1]
  return n ?? `localhost:${port}`
}

function contrastOf(page, selector, ground) {
  return page.evaluate(([s, bg]) => {
    const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).map(Number); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) }
    const [hi, lo] = [lum(getComputedStyle(document.querySelector(s)).color), lum(bg)].sort((a, b) => b - a)
    return (hi + 0.05) / (lo + 0.05)
  }, [selector, ground])
}

function flatMetrics(m) {
  const out = {}
  if (m.coldNpxMs != null) out['cold npx'] = `${(m.coldNpxMs / 1000).toFixed(1)} s`
  if (m.promptMs != null) out['froam → prompt'] = `${(m.promptMs / 1000).toFixed(1)} s`
  if (m.cliToUrlMs != null) out['froam → editor URL'] = `${(m.cliToUrlMs / 1000).toFixed(1)} s (machine time, prompts answered instantly)`
  if (m.launcherMs != null) out['page → launcher'] = `${(m.launcherMs / 1000).toFixed(1)} s`
  if (m.firstScreen) out['first screen'] = `${m.firstScreen.controls} controls`
  if (m.clicksToImprovement != null) out['clicks to first visible improvement'] = m.clicksToImprovement
  if (m.clicksToShippable != null) out['clicks to first shippable edit'] = m.clicksToShippable
  if (m.buttonsScanned != null) out['toolbar buttons clicked'] = m.buttonsScanned
  return out
}

const normName = (s) => String(s).normalize('NFKC').replace(/[\s\u00a0\u2009\u200b]+/g, ' ').trim().toLowerCase()
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const cssEscape = (s) => s.replace(/"/g, '\\"')
const pathToUrl = (p) => new URL(`file://${p.startsWith('/') ? '' : '/'}${p.replace(/\\/g, '/')}`).href

await main()
