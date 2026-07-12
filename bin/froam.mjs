#!/usr/bin/env node
/**
 * froam — the Froam Studio v3 CLI. Visual editing for ANY project:
 * Vite, Next.js, Nuxt, SvelteKit, Astro, Rails, PHP, plain HTML —
 * if it serves a page, Froam can edit it and write the design into
 * your repo as committable files.
 *
 *   froam init             detect the project, scaffold froam files, wire it up
 *   froam dev              universal editor bridge (proxy / static / script-tag)
 *   froam build            recompile design.json → generated.css + runtime.js
 *   froam status           design summary, artifact freshness, git state
 *   froam doctor           health-check the whole setup
 *   froam migrate          upgrade froam.design.json to v3
 *   froam version          print the installed froam-studio version
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  DESIGN_VERSION,
  emptyDesign,
  ensureScaffold,
  generateCss,
  generateRuntimeJs,
  loadDesign,
  migrateDesign,
  writeArtifacts,
} from '../lib/codegen.mjs'
import { createBridgeServer } from '../lib/dev-server.mjs'

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EDITOR_BUNDLE = path.join(PACKAGE_ROOT, 'dist', 'standalone', 'froam-editor.js')
const CONFIG_FILE = 'froam.config.json'

function packageVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version ?? '?'
  } catch {
    return '?'
  }
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') execFileSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' })
    else if (process.platform === 'darwin') execFileSync('open', [url], { stdio: 'ignore' })
    else execFileSync('xdg-open', [url], { stdio: 'ignore' })
  } catch { /* opening the browser is best-effort */ }
}

function lanAddresses() {
  const addresses = []
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address)
    }
  }
  return addresses
}

const cwd = process.cwd()
const [, , cmd, ...rest] = process.argv

/* ── tiny ANSI kit (honors NO_COLOR) ─────────────────────────── */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code) => (text) => (useColor ? `[${code}m${text}[0m` : String(text))
const bold = paint('1')
const dim = paint('2')
const teal = paint('96')
const green = paint('92')
const yellow = paint('93')
const red = paint('91')
const OK = green('✔')
const WARN = yellow('!')
const BAD = red('✖')

function log(msg = '') { process.stdout.write(msg + '\n') }
function fail(msg) { process.stderr.write(`${BAD} froam: ${msg}\n`); process.exit(1) }

function parseFlags(args) {
  const flags = {}
  const positional = []
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg.startsWith('-')) { positional.push(arg); continue }
    const key = arg.replace(/^--?/, '')
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith('-')) { flags[key] = next; i += 1 }
    else flags[key] = true
  }
  return { flags, positional }
}

/* ── project detection ───────────────────────────────────────── */
function readPackageJson(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

const FRAMEWORK_LABELS = {
  'vite-react': 'Vite + React',
  vite: 'Vite',
  next: 'Next.js',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  astro: 'Astro',
  remix: 'Remix',
  angular: 'Angular',
  cra: 'Create React App',
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  node: 'Node.js project',
  static: 'Static HTML site',
  unknown: 'Generic project',
}

function detectFramework(dir) {
  const pkg = readPackageJson(dir)
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const has = (name) => Boolean(deps[name])

  if (has('next')) return 'next'
  if (has('nuxt') || has('nuxt3')) return 'nuxt'
  if (has('@sveltejs/kit')) return 'sveltekit'
  if (has('astro')) return 'astro'
  if (has('@remix-run/react') || has('@remix-run/node')) return 'remix'
  if (has('@angular/core')) return 'angular'
  if (has('react-scripts')) return 'cra'
  if (has('vite')) {
    return has('react') || has('@vitejs/plugin-react') || has('@vitejs/plugin-react-swc') ? 'vite-react' : 'vite'
  }
  if (has('react')) return 'react'
  if (has('vue')) return 'vue'
  if (has('svelte')) return 'svelte'
  if (pkg) return 'node'

  try {
    if (fs.readdirSync(dir).some((name) => name.endsWith('.html'))) return 'static'
  } catch { /* unreadable dir */ }
  return 'unknown'
}

function loadProjectConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(cwd, CONFIG_FILE), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function resolveFroamDir(flagDir) {
  if (flagDir) return path.resolve(cwd, flagDir)
  const config = loadProjectConfig()
  if (config.dir) return path.resolve(cwd, config.dir)
  if (fs.existsSync(path.join(cwd, 'src', 'froam'))) return path.join(cwd, 'src', 'froam')
  if (fs.existsSync(path.join(cwd, 'froam'))) return path.join(cwd, 'froam')
  return fs.existsSync(path.join(cwd, 'src')) ? path.join(cwd, 'src', 'froam') : path.join(cwd, 'froam')
}

function relDir(absDir) {
  const rel = path.relative(cwd, absDir)
  return rel === '' ? '.' : rel.split(path.sep).join('/')
}

/* ── init ────────────────────────────────────────────────────── */
function findViteConfig() {
  for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts']) {
    const p = path.join(cwd, name)
    if (fs.existsSync(p)) return p
  }
  return null
}

function wireViteConfig(froamDirRel) {
  const viteConfig = findViteConfig()
  if (!viteConfig) {
    log(`${WARN} no vite.config found — add manually:`)
    log(dim("    import froamStudio from 'froam-studio/vite'"))
    log(dim(`    plugins: [react(), froamStudio({ dir: '${froamDirRel}' })]`))
    return
  }
  let src = fs.readFileSync(viteConfig, 'utf8')
  if (src.includes('froam-studio/vite')) {
    log(`${OK} vite config already wired`)
    return
  }
  fs.writeFileSync(viteConfig + '.bak', src)
  src = "import froamStudio from 'froam-studio/vite'\n" + src
  const pluginArgs = froamDirRel === 'src/froam' ? '' : `{ dir: '${froamDirRel}' }`
  if (/plugins:\s*\[/.test(src)) {
    src = src.replace(/plugins:\s*\[/, (m) => `${m}froamStudio(${pluginArgs}), `)
    fs.writeFileSync(viteConfig, src)
    log(`${OK} wired froamStudio() into ${path.basename(viteConfig)} ${dim('(backup: .bak)')}`)
  } else {
    fs.writeFileSync(viteConfig, src)
    log(`${WARN} added import to ${path.basename(viteConfig)} — add froamStudio(${pluginArgs}) to your plugins array yourself`)
  }
}

function wireStaticHtml(froamDirRel) {
  const indexPath = path.join(cwd, 'index.html')
  if (!fs.existsSync(indexPath)) return false
  let html = fs.readFileSync(indexPath, 'utf8')
  if (html.includes('froam.generated.css') || html.includes('froam.runtime.js')) {
    log(`${OK} index.html already wired`)
    return true
  }
  fs.writeFileSync(indexPath + '.bak', html)
  const linkTag = `  <link rel="stylesheet" href="/${froamDirRel}/froam.generated.css">`
  const scriptTag = `  <script src="/${froamDirRel}/froam.runtime.js" defer></script>`
  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${linkTag}\n${scriptTag}\n</head>`)
  } else {
    html = `${linkTag}\n${scriptTag}\n${html}`
  }
  fs.writeFileSync(indexPath, html)
  log(`${OK} wired froam tags into index.html ${dim('(backup: .bak)')}`)
  return true
}

const REACT_MOUNT_SNIPPET = `
  import { FroamGate, FroamRuntime, type FroamLocalDesign } from 'froam-studio'
  import 'froam-studio/css'
  import 'froam-studio/gate-css'
  import froamDesign from './froam'

  // Render once, near the root of your app:
  <FroamRuntime design={froamDesign as FroamLocalDesign} routes="*" />
  <FroamGate enabled initialOpen={false} localRoutes="*" />
`

function printNextSteps(framework, froamDirRel, port = 4600) {
  log()
  log(bold('Next steps'))
  switch (framework) {
    case 'vite-react':
      log('  Mount the editor + runtime once in your app:')
      log(dim(REACT_MOUNT_SNIPPET))
      log('  Run your dev server, open the Froam gate, edit visually,')
      log(`  then ${teal('Save to Repo')} (Ctrl+Shift+S). Commit ${froamDirRel} and push — done.`)
      break
    case 'static':
      log(`  1. ${teal('npx froam dev --serve .')}`)
      log(`  2. Open ${teal(`http://localhost:${port}`)} — your site with the editor on top.`)
      log(`  3. Edit visually, hit ${teal('Save to Repo')} (Ctrl+Shift+S), commit ${froamDirRel}/.`)
      log(`  Production needs nothing extra — the tags in index.html ship your design.`)
      break
    default:
      log(`  1. Start your app's dev server as usual.`)
      log(`  2. ${teal('npx froam dev --app http://localhost:3000')} ${dim('(use your app\'s port)')}`)
      log(`  3. Open ${teal(`http://localhost:${port}`)} — your app with the editor on top.`)
      log(`  4. Edit visually, hit ${teal('Save to Repo')} (Ctrl+Shift+S), commit ${froamDirRel}/.`)
      log()
      log(bold('Ship it (production)'))
      log('  Serve the two generated files with your site and add:')
      log(dim(`    <link rel="stylesheet" href="/${froamDirRel}/froam.generated.css">`))
      log(dim(`    <script src="/${froamDirRel}/froam.runtime.js" defer></script>`))
      if (framework === 'next' || framework === 'remix' || framework === 'cra' || framework === 'react') {
        log(dim(`  (React apps can import 'froam-studio' and mount <FroamRuntime design={...}/> instead.)`))
      }
      break
  }
}

function init(flags) {
  const framework = detectFramework(cwd)
  const isBundledReact = framework === 'vite-react'
  const froamDir = resolveFroamDir(flags.dir)
  const froamDirRel = relDir(froamDir)

  log(`${teal('◆')} ${bold('Froam Studio v3')} ${dim('· init')}`)
  log(`${OK} detected ${bold(FRAMEWORK_LABELS[framework])}`)

  ensureScaffold(froamDir, { glue: isBundledReact })
  log(`${OK} scaffolded ${froamDirRel}/ ${dim(`(design.json, generated.css, runtime.js${isBundledReact ? ', index.ts' : ''})`)}`)

  const config = { dir: froamDirRel, framework }
  fs.writeFileSync(path.join(cwd, CONFIG_FILE), JSON.stringify(config, null, 2) + '\n')
  log(`${OK} wrote ${CONFIG_FILE}`)

  if (isBundledReact || framework === 'vite') wireViteConfig(froamDirRel)
  if (framework === 'static') wireStaticHtml(froamDirRel)

  printNextSteps(framework, froamDirRel)
}

/* ── dev ─────────────────────────────────────────────────────── */
function dev(flags) {
  const port = Number(flags.port ?? flags.p ?? 4600)
  const app = flags.app ?? flags.a ?? null
  const config = loadProjectConfig()
  let serveDir = flags.serve ?? flags.s ?? null
  if (serveDir === true) serveDir = '.'
  if (!app && !serveDir && (config.framework === 'static' || detectFramework(cwd) === 'static')) {
    serveDir = '.'
  }
  if (serveDir) serveDir = path.resolve(cwd, String(serveDir))

  const froamDir = resolveFroamDir(flags.dir)
  ensureScaffold(froamDir, { glue: false })

  if (!fs.existsSync(EDITOR_BUNDLE)) {
    fail('editor bundle missing (dist/standalone/froam-editor.js) — reinstall froam-studio or run `npm run build` inside it')
  }

  const { server, appTarget } = createBridgeServer({
    port,
    froamDir,
    app,
    serveDir,
    log: (line) => log(`${dim(new Date().toLocaleTimeString())} ${OK} ${line}`),
  })

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') fail(`port ${port} is already in use — try \`froam dev --port ${port + 1}\``)
    fail(error.message)
  })

  const exposeHost = flags.host === true ? '0.0.0.0' : typeof flags.host === 'string' ? flags.host : null

  server.listen(port, exposeHost ?? '127.0.0.1', () => {
    log(`${teal('◆')} ${bold('Froam Bridge')} ${dim('v3')}`)
    log()
    if (appTarget) {
      log(`  ${bold('mode')}     proxy → ${teal(appTarget.origin)} ${dim('(editor injected into every page)')}`)
      log(`  ${bold('local')}    ${teal(`http://localhost:${port}`)}`)
    } else if (serveDir) {
      log(`  ${bold('mode')}     static → ${relDir(serveDir)}/ ${dim('(editor injected into every .html)')}`)
      log(`  ${bold('local')}    ${teal(`http://localhost:${port}`)}`)
    } else {
      log(`  ${bold('mode')}     bridge only ${dim('— add this tag to your dev page:')}`)
      log(`           ${dim(`<script src="http://localhost:${port}/froam.js" defer></script>`)}`)
    }
    if (exposeHost) {
      for (const address of lanAddresses()) {
        log(`  ${bold('network')}  ${teal(`http://${address}:${port}`)} ${dim('← open on your phone (same Wi-Fi)')}`)
      }
    } else if (appTarget || serveDir) {
      log(`  ${dim('network')}  ${dim('add --host to expose on your local network')}`)
    }
    log(`  ${bold('repo')}     ${relDir(froamDir)}/ ${dim('← Save to Repo (Ctrl+Shift+S) writes here')}`)
    log()
    log(dim('  Ctrl+C to stop'))
    if (flags.open && (appTarget || serveDir)) openBrowser(`http://localhost:${port}`)
  })
}

/* ── build ───────────────────────────────────────────────────── */
function build(flags) {
  const froamDir = resolveFroamDir(flags.dir)
  const designPath = path.join(froamDir, 'froam.design.json')
  if (!fs.existsSync(designPath)) fail(`no ${relDir(froamDir)}/froam.design.json — run \`froam init\` first`)
  const design = loadDesign(designPath)
  const files = writeArtifacts(froamDir, design)
  for (const file of files) {
    const size = fs.statSync(path.join(froamDir, file)).size
    log(`${OK} ${relDir(froamDir)}/${file} ${dim(`(${(size / 1024).toFixed(1)} kB)`)}`)
  }
}

/* ── status ──────────────────────────────────────────────────── */
function status(flags) {
  const froamDir = resolveFroamDir(flags.dir)
  const designPath = path.join(froamDir, 'froam.design.json')
  if (!fs.existsSync(designPath)) fail(`no ${relDir(froamDir)}/froam.design.json — run \`froam init\` first`)
  const raw = JSON.parse(fs.readFileSync(designPath, 'utf8'))
  const design = migrateDesign(raw)
  const routes = Object.keys(design.routes ?? {})

  log(`${teal('◆')} ${bold('froam.design.json')} ${dim(`v${raw.version ?? '?'} · updated ${design.updatedAt ?? 'never'}`)}`)
  if (Number(raw.version) !== DESIGN_VERSION) log(`${WARN} design file is v${raw.version ?? '?'} — run ${teal('froam migrate')} to upgrade to v${DESIGN_VERSION}`)
  if (!routes.length) log(dim('  (no routes designed yet)'))
  for (const route of routes) {
    const viewports = Object.entries(design.routes[route])
      .map(([vp, store]) => `${vp}:${Object.keys(store ?? {}).length}`)
      .join(' · ')
    log(`  ${route}  ${dim('→')}  ${viewports}`)
  }

  const designTime = fs.statSync(designPath).mtimeMs
  for (const artifact of ['froam.generated.css', 'froam.runtime.js']) {
    const artifactPath = path.join(froamDir, artifact)
    if (!fs.existsSync(artifactPath)) log(`${WARN} ${artifact} missing — run ${teal('froam build')}`)
    else if (fs.statSync(artifactPath).mtimeMs < designTime - 2000) log(`${WARN} ${artifact} older than design — run ${teal('froam build')}`)
  }

  try {
    const out = execFileSync('git', ['status', '--porcelain', '--', froamDir], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    log(out ? `\n${WARN} git: uncommitted froam changes\n${dim(out)}` : `\n${OK} git: clean — everything committed`)
  } catch {
    log(`\n${dim('git: not a repository')}`)
  }
}

/* ── doctor ──────────────────────────────────────────────────── */
function doctor(flags) {
  const froamDir = resolveFroamDir(flags.dir)
  const framework = loadProjectConfig().framework ?? detectFramework(cwd)
  let problems = 0
  const check = (ok, okMsg, badMsg, warnOnly = false) => {
    if (ok) log(`${OK} ${okMsg}`)
    else {
      log(`${warnOnly ? WARN : BAD} ${badMsg}`)
      if (!warnOnly) problems += 1
    }
  }

  log(`${teal('◆')} ${bold('froam doctor')}`)
  log()

  const [major] = process.versions.node.split('.').map(Number)
  check(major >= 18, `node ${process.version}`, `node ${process.version} — Froam needs Node 18+`)
  check(true, `project type: ${FRAMEWORK_LABELS[framework] ?? framework}`)

  const designPath = path.join(froamDir, 'froam.design.json')
  if (!fs.existsSync(designPath)) {
    check(false, '', `no ${relDir(froamDir)}/froam.design.json — run \`froam init\``)
  } else {
    let raw = null
    try { raw = JSON.parse(fs.readFileSync(designPath, 'utf8')) } catch { /* handled below */ }
    check(Boolean(raw?.routes), `${relDir(froamDir)}/froam.design.json parses`, `${relDir(froamDir)}/froam.design.json is invalid JSON or missing routes`)
    if (raw) {
      check(Number(raw.version) === DESIGN_VERSION, `design format v${DESIGN_VERSION}`, `design format v${raw.version ?? '?'} — run \`froam migrate\``, true)
    }
    for (const artifact of ['froam.generated.css', 'froam.runtime.js']) {
      check(fs.existsSync(path.join(froamDir, artifact)), `${artifact} present`, `${artifact} missing — run \`froam build\``, true)
    }
  }

  check(fs.existsSync(EDITOR_BUNDLE), 'standalone editor bundle present', 'standalone editor bundle missing — reinstall froam-studio (needed for `froam dev`)', framework === 'vite-react')

  if (framework === 'vite-react' || framework === 'vite') {
    const viteConfig = findViteConfig()
    check(
      Boolean(viteConfig && fs.readFileSync(viteConfig, 'utf8').includes('froam-studio/vite')),
      'vite config wired with froamStudio()',
      'vite config not wired — run `froam init` or add froamStudio() to plugins',
      true,
    )
  }

  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, stdio: 'pipe' })
    check(true, 'git repository detected')
  } catch {
    check(false, '', 'not a git repository — Repo Mode saves files but you\'ll want git to ship them', true)
  }

  log()
  if (problems === 0) log(`${green(bold('All good.'))} Froam is ready — run ${teal('froam dev')}`)
  else { log(`${red(bold(`${problems} problem${problems > 1 ? 's' : ''} found.`))}`); process.exit(1) }
}

/* ── migrate ─────────────────────────────────────────────────── */
function migrate(flags) {
  const froamDir = resolveFroamDir(flags.dir)
  const designPath = path.join(froamDir, 'froam.design.json')
  if (!fs.existsSync(designPath)) fail(`no ${relDir(froamDir)}/froam.design.json — run \`froam init\` first`)
  const raw = JSON.parse(fs.readFileSync(designPath, 'utf8'))
  const fromVersion = raw?.version ?? '?'
  const design = migrateDesign(raw)
  writeArtifacts(froamDir, design)
  log(`${OK} migrated design v${fromVersion} → v${DESIGN_VERSION} and rebuilt artifacts`)
}

/* ── help ────────────────────────────────────────────────────── */
function help() {
  log(`${teal('◆')} ${bold('froam')} ${dim('v3')} — visual editor that writes git-ready design files, for any project`)
  log()
  log(bold('Commands'))
  log(`  ${teal('init')}               detect project type, scaffold froam files, wire everything`)
  log(`  ${teal('dev')}                universal editor bridge`)
  log(`      ${dim('--app <url|port>')}   overlay the editor on a running dev server (any stack)`)
  log(`      ${dim('--serve [dir]')}      serve a static folder with the editor injected`)
  log(`      ${dim('--port <n>')}         bridge port (default 4600)`)
  log(`      ${dim('--open')}             open the browser once the bridge is up`)
  log(`      ${dim('--host [addr]')}      expose on your local network (phone testing)`)
  log(`  ${teal('build')}              recompile design.json → generated.css + runtime.js`)
  log(`  ${teal('status')}             design summary, artifact freshness, git state`)
  log(`  ${teal('doctor')}             health-check the setup`)
  log(`  ${teal('migrate')}            upgrade froam.design.json to v${DESIGN_VERSION}`)
  log(`  ${teal('version')}            print the installed froam-studio version`)
  log()
  log(dim('  All commands accept --dir <path> to point at a custom froam directory.'))
}

/* ── dispatch ────────────────────────────────────────────────── */
const { flags } = parseFlags(rest)

switch (cmd) {
  case 'init': init(flags); break
  case 'dev': dev(flags); break
  case 'build': build(flags); break
  case 'status': status(flags); break
  case 'doctor': doctor(flags); break
  case 'migrate': migrate(flags); break
  case 'version':
  case '--version':
  case '-v': log(`froam-studio v${packageVersion()}`); break
  case 'help':
  case '--help':
  case '-h':
  case undefined: help(); break
  default:
    log(`${BAD} unknown command: ${cmd}`)
    log()
    help()
    process.exit(1)
}
