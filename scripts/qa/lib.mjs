/**
 * Shared helpers for the QA harnesses in scripts/qa/.
 *
 * These harnesses test Froam the way a user gets it — an installed package,
 * the real CLI, a real browser — never the working tree directly. That is
 * the gap `npm test` and test-e2e-editor.mjs leave: they prove the source
 * works, not that the thing on the registry does.
 */
import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * The temp folder by its real name. Windows hands out the 8.3 short form
 * (C:\Users\AHMADM~1\…); Vite compares that against real paths and answers
 * 403 for a project living there.
 */
export function tmpdir() {
  try { return fs.realpathSync.native(os.tmpdir()) } catch { return os.tmpdir() }
}

/* ─── args ─── */

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) { out._.push(a); continue }
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else { out[key] = next; i += 1 }
  }
  return out
}

/* ─── browser ─── */

export function findBrowser(chromium) {
  const env = process.env.FROAM_QA_CHROME || process.env.FROAM_E2E_CHROME
  if (env) return env
  try {
    const bundled = chromium.executablePath()
    if (bundled && fs.existsSync(bundled)) return bundled
  } catch { /* no bundled browser */ }
  const home = os.homedir()
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(home, 'AppData', 'Local', 'ms-playwright'),
    path.join(home, '.cache', 'ms-playwright'),
    path.join(home, 'Library', 'Caches', 'ms-playwright'),
  ].filter(Boolean)
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

/** Collects uncaught page errors and console errors, minus noise we expect. */
export function watchErrors(page, ignore = []) {
  const errors = []
  const skip = (text) => ignore.some((re) => re.test(text))
  page.on('pageerror', (err) => { const t = `pageerror: ${err.message}`; if (!skip(t)) errors.push(t) })
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    // Chrome's "Failed to load resource" line has no URL; the response hook
    // below reports the same failure with the URL that failed.
    if (/^Failed to load resource/.test(msg.text())) return
    const t = `console: ${msg.text()}`
    if (!skip(t)) errors.push(t)
  })
  page.on('response', (res) => {
    if (res.status() < 400) return
    const t = `HTTP ${res.status()}: ${res.url()}`
    if (!skip(t)) errors.push(t)
  })
  page.on('requestfailed', (req) => {
    // Aborted = superseded by a navigation or a newer request, not a failure.
    if (/ERR_ABORTED/.test(req.failure()?.errorText ?? '')) return
    const t = `request failed: ${req.url()} (${req.failure()?.errorText ?? '?'})`
    if (!skip(t)) errors.push(t)
  })
  return errors
}

/* ─── network / processes ─── */

export function freePort() {
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

export async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now()
  let last = ''
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (res.ok) return
      last = `HTTP ${res.status}`
    } catch (err) { last = err.message }
    await sleep(200)
  }
  throw new Error(`${url} did not come up in ${timeoutMs} ms (${last})`)
}

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

/** A plain static server: production, no editor, no bridge. */
export async function serveStatic(dir) {
  const root = path.resolve(dir)
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '')
    let file = path.join(root, rel)
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { url: `http://localhost:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) }
}

/**
 * Windows runs npm.cmd / npx.cmd only through a shell, but a shell splits an
 * unquoted executable path at its spaces (C:\Program Files\nodejs\node.exe), so
 * only batch files get one.
 */
const needsShell = (cmd) => process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd)
/** The shell joins arguments with spaces, so a path with one in it needs quotes. */
const shellArgs = (cmd, args) => (needsShell(cmd) ? args.map((a) => (/[\s"^&|<>]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a)) : args)

/** Runs a command to completion. Never throws; returns { code, out, ms }. */
export function run(cmd, args, opts = {}) {
  const started = Date.now()
  const res = spawnSync(cmd, shellArgs(cmd, args), { encoding: 'utf8', shell: needsShell(cmd), timeout: opts.timeout ?? 180000, ...opts, env: { ...process.env, ...(opts.env ?? {}) } })
  return { code: res.status ?? (res.error ? -1 : 0), out: `${res.stdout ?? ''}${res.stderr ?? ''}${res.error ? `\n${res.error.message}` : ''}`, ms: Date.now() - started }
}

/** Starts a long-running process; returns { proc, log(), stop() }. */
export function start(cmd, args, opts = {}) {
  const isWin = process.platform === 'win32'
  // Own process group, so stopping `npx vite` also stops the vite it spawned.
  const proc = spawn(cmd, shellArgs(cmd, args), { shell: needsShell(cmd), detached: !isWin, ...opts, env: { ...process.env, ...(opts.env ?? {}) }, stdio: ['ignore', 'pipe', 'pipe'] })
  let buf = ''
  proc.stdout.on('data', (d) => { buf += d })
  proc.stderr.on('data', (d) => { buf += d })
  return {
    proc,
    log: () => buf,
    stop: () => new Promise((resolve) => {
      if (proc.exitCode !== null) return resolve()
      proc.once('exit', () => resolve())
      const signal = (sig) => { try { process.kill(-proc.pid, sig) } catch { try { proc.kill(sig) } catch { /* gone */ } } }
      if (isWin) spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'])
      else signal('SIGTERM')
      setTimeout(() => { if (!isWin) signal('SIGKILL'); resolve() }, 4000)
    }),
  }
}

/* ─── package ─── */

/**
 * Installs Froam into a clean temp directory, the way a user gets it.
 * `spec` is a registry spec (@ahmadastic/froam@9.3.0), a .tgz path, or
 * null to `npm pack` the repo at `repoRoot` first (what publish would upload).
 */
export function installFroam(spec, { repoRoot, workDir, build = true }) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const info = { spec, packed: null }
  if (!spec) {
    // Publish builds first (prepublishOnly → check:release → build); pack
    // alone does not. Build, so the gate tests what publish would upload.
    const own = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
    if (build && own.scripts?.build) {
      const built = run(npm, ['run', 'build'], { cwd: repoRoot, timeout: 900000 })
      if (built.code !== 0) throw new Error(`npm run build failed:\n${built.out.slice(-2000)}`)
    }
    const packDir = path.join(workDir, 'pack')
    fs.mkdirSync(packDir, { recursive: true })
    const packed = run(npm, ['pack', '--json', '--pack-destination', packDir], { cwd: repoRoot, timeout: 600000 })
    if (packed.code !== 0) throw new Error(`npm pack failed:\n${packed.out.slice(-2000)}`)
    const json = JSON.parse(packed.out.slice(packed.out.indexOf('[')))
    info.packed = { file: path.join(packDir, json[0].filename), size: json[0].size, unpackedSize: json[0].unpackedSize, files: json[0].entryCount }
    spec = info.packed.file
    info.spec = spec
  }
  const installDir = path.join(workDir, 'install')
  fs.mkdirSync(installDir, { recursive: true })
  fs.writeFileSync(path.join(installDir, 'package.json'), JSON.stringify({ name: 'froam-qa-host', version: '0.0.0', private: true }))
  const res = run(npm, ['install', spec, '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: installDir, timeout: 600000 })
  if (res.code !== 0) throw new Error(`npm install ${spec} failed:\n${res.out.slice(-2000)}`)
  const pkgDir = path.join(installDir, 'node_modules', '@ahmadastic', 'froam')
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
  const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.froam
  return { ...info, installDir, pkgDir, pkg, bin: path.join(pkgDir, binRel), installMs: res.ms }
}

/** Runs the installed CLI with node (no shell, no npx resolution games). */
export const froam = (inst, args, opts = {}) => run(process.execPath, [inst.bin, ...args], opts)
export const startFroam = (inst, args, opts = {}) => start(process.execPath, [inst.bin, ...args], { ...opts, env: { FROAM_SHARE: 'off', FROAM_NO_OPEN: '1', BROWSER: 'none', ...(opts.env ?? {}) } })

/** Every file the package.json `exports` and `bin` fields point at. */
export function exportTargets(pkg) {
  const targets = new Set()
  const walk = (v) => {
    if (typeof v === 'string') { if (!v.includes('*')) targets.add(v) }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(pkg.exports)
  walk(pkg.main)
  walk(pkg.module)
  walk(pkg.types)
  walk(pkg.bin)
  return [...targets]
}

/* ─── editor helpers (selectors match scripts/test-e2e-editor.mjs) ─── */

export const SEL = {
  launcher: '.global-chef-button',
  chrome: '#froam-editor-portal .froam-chrome',
  selected: '[data-chef-selected="true"]',
  looksBtn: '.froam-floating-bar__looks-btn',
  looksPop: '.froam-floating-bar__pop--looks',
  lookTiles: '.froam-floating-bar__pop--looks .froam-floating-bar__looks button',
  lookApply: '.froam-floating-bar__pop--looks .froam-floating-bar__look-apply',
  askBtn: '.froam-tb__ask-btn',
  quickChat: '.froam-quick-chat',
  smartChips: '.froam-quick-chat__suggestions button.is-smart',
  intentResult: '.froam-intent-result',
  intentKeep: '.froam-intent-result [data-froam-intent-primary]',
}

export async function openEditor(page, url, { timeout = 30000 } = {}) {
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(SEL.launcher, { timeout })
  const launcherMs = Date.now() - t0
  await page.keyboard.press('Control+.')
  await page.waitForSelector(SEL.chrome, { timeout })
  await sleep(600)
  return { launcherMs, openMs: Date.now() - t0 }
}

export async function clickOn(page, selector, fx = 0.5, fy = 0.5, settle = 200) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), selector)
  await sleep(80)
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error(`${selector} is not on the page`)
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
  await sleep(settle)
}

export async function deselect(page) {
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await sleep(100)
}

export const selectedTag = (page) => page.evaluate((s) => {
  const el = document.querySelector(s)
  return el ? (el.id ? `#${el.id}` : el.tagName.toLowerCase()) : null
}, SEL.selected)

/** Save to Repo, then wait for the design file to actually be rewritten. */
export async function saveAndWait(page, designPath, timeoutMs = 15000) {
  const stamp = () => (fs.existsSync(designPath) ? fs.statSync(designPath).mtimeMs : 0)
  const before = stamp()
  await page.keyboard.press('Control+Shift+S')
  const started = Date.now()
  while (stamp() === before && Date.now() - started < timeoutMs) await sleep(120)
  await sleep(250)
  return stamp() !== before
}

/** DOM mutations while nobody touches the page. A settled page is silent. */
export function churnWhileIdle(page, ms = 800) {
  return page.evaluate((ms) => new Promise((resolve) => {
    let count = 0
    const observer = new MutationObserver((records) => { count += records.length })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true })
    setTimeout(() => { observer.disconnect(); resolve(count) }, ms)
  }), ms)
}

/** Is this file valid JavaScript? (The 8.3.2 runtime was not.) */
export function jsParses(file) {
  const res = run(process.execPath, ['--check', file])
  return { ok: res.code === 0, detail: res.out.trim().split('\n').slice(0, 6).join('\n') }
}

/* ─── reporting ─── */

export class Report {
  constructor(title, meta = {}) {
    this.title = title
    this.meta = meta
    this.checks = []
    this.notes = []
    this.started = Date.now()
  }

  /** status: pass | fail | warn | skip */
  add(id, status, detail = '', extra = {}) {
    this.checks.push({ id, status, detail: String(detail ?? ''), ...extra })
    const icon = { pass: '✔', fail: '✖', warn: '▲', skip: '·' }[status] ?? '?'
    console.log(`  ${icon} ${id}${detail ? ` — ${String(detail).split('\n')[0].slice(0, 160)}` : ''}`)
  }

  /** Runs fn; records pass with its returned detail, or fail with the error. */
  async step(id, fn, { warnOnly = false } = {}) {
    const t0 = Date.now()
    try {
      const detail = await fn()
      this.add(id, 'pass', detail ?? '', { ms: Date.now() - t0 })
      return true
    } catch (err) {
      this.add(id, warnOnly ? 'warn' : 'fail', err?.message ?? String(err), { ms: Date.now() - t0 })
      return false
    }
  }

  get failed() { return this.checks.filter((c) => c.status === 'fail') }
  get warned() { return this.checks.filter((c) => c.status === 'warn') }
  get ok() { return this.failed.length === 0 }

  write(outDir) {
    fs.mkdirSync(outDir, { recursive: true })
    const totalMs = Date.now() - this.started
    const json = { title: this.title, meta: this.meta, ok: this.ok, totalMs, checks: this.checks, notes: this.notes }
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(json, null, 2))
    const icon = { pass: '✅', fail: '❌', warn: '⚠️', skip: '➖' }
    const lines = [
      `# ${this.title}`,
      '',
      `**Verdict: ${this.ok ? (this.warned.length ? 'PASS with warnings' : 'PASS') : 'FAIL'}** · ${this.checks.filter((c) => c.status === 'pass').length} passed · ${this.failed.length} failed · ${this.warned.length} warnings · ${(totalMs / 1000).toFixed(1)} s`,
      '',
      ...Object.entries(this.meta).map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`),
      '',
      '| | Check | Detail | Time |',
      '| --- | --- | --- | --- |',
      ...this.checks.map((c) => `| ${icon[c.status] ?? ''} | ${c.id} | ${c.detail.replace(/\n/g, '<br>').replace(/\|/g, '\\|').slice(0, 600)} | ${c.ms != null ? `${(c.ms / 1000).toFixed(1)} s` : ''} |`),
      '',
      ...(this.notes.length ? ['## Notes', '', ...this.notes.map((n) => `- ${n}`), ''] : []),
    ]
    fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'))
    return { json, mdPath: path.join(outDir, 'report.md') }
  }
}

export function stampDir(base, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return path.join(base, `${label}-${ts}`)
}
