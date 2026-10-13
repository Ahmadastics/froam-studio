/**
 * `froam publish`: a static site, online.
 *
 * Two halves. The first is Froam's own and always the same: a clean copy of
 * the site in `.froam/publish/<name>/`, with the page files and the two
 * files visitors load, and none of what only the editor needs (the design
 * history, rooms, the project log, backups, this README). The second hands
 * that folder to a host. Each host is a small runner here, so another one
 * (a Froam-hosted one, say) is one more entry, not a new command.
 *
 * Hosts are reached through their own command-line tools, run with npx, in
 * the person's own account: Froam never sees a password or a token. Logging
 * in is the host's own flow, in the terminal and browser, shown as it is.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

/** Files under the workspace that visitors' browsers load; everything else in it stays private. */
const SHIPPED_WORKSPACE_FILES = new Set(['froam.generated.css', 'froam.runtime.js'])
const SKIPPED_TOP_LEVEL = new Set(['froam.config.json', 'README.md', 'node_modules'])

export const PUBLISH_TARGETS = [
  { id: 'cloudflare', label: 'Cloudflare Pages', hint: 'free, fast everywhere, fine for a business' },
  { id: 'netlify', label: 'Netlify', hint: 'free; drag the folder onto a page in your browser' },
  { id: 'vercel', label: 'Vercel', hint: 'free for personal sites; a business site needs their paid plan' },
  { id: 'folder', label: 'Just the folder', hint: 'upload it anywhere yourself' },
]

export const isPublishTarget = (id) => PUBLISH_TARGETS.some((target) => target.id === id)

/**
 * Copy what a visitor needs from `siteDir` into a fresh `outDir`.
 * Dot-entries inside `outDir` (a host's .vercel link, say) are kept.
 *
 * @returns {{ files: string[], bytes: number, warnings: string[] }}
 */
export function buildPublishFolder(siteDir, outDir, { froamDir = 'froam' } = {}) {
  const site = path.resolve(siteDir)
  const out = path.resolve(outDir)
  if (!fs.existsSync(path.join(site, 'index.html'))) throw new Error('there is no index.html to publish here')

  fs.mkdirSync(out, { recursive: true })
  for (const entry of fs.readdirSync(out)) {
    if (!entry.startsWith('.')) fs.rmSync(path.join(out, entry), { recursive: true, force: true })
  }

  const workspace = path.resolve(site, froamDir)
  const files = []
  let bytes = 0
  const copy = (from, rel) => {
    const to = path.join(out, rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
    files.push(rel.split(path.sep).join('/'))
    bytes += fs.statSync(from).size
  }
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      const relative = rel ? path.join(rel, entry.name) : entry.name
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
      if (!rel && SKIPPED_TOP_LEVEL.has(entry.name)) continue
      if (path.resolve(full) === out || out.startsWith(path.resolve(full) + path.sep)) continue
      if (/\.bak$/i.test(entry.name)) continue
      if (path.resolve(full) === workspace) {
        if (!entry.isDirectory()) continue
        for (const name of SHIPPED_WORKSPACE_FILES) {
          if (fs.existsSync(path.join(full, name))) copy(path.join(full, name), path.join(relative, name))
        }
        const media = path.join(full, 'media')
        if (fs.existsSync(media)) walk(media, path.join(relative, 'media'))
        continue
      }
      if (entry.isDirectory()) walk(full, relative)
      else if (entry.isFile()) copy(full, relative)
    }
  }
  walk(site, '')

  const warnings = []
  const index = fs.readFileSync(path.join(site, 'index.html'), 'utf8')
  if (!index.includes('froam.generated.css') || !index.includes('froam.runtime.js')) {
    warnings.push("index.html doesn't load froam.generated.css and froam.runtime.js, so style edits saved in Froam won't show. Run `froam init` here once to add them.")
  }
  return { files, bytes, warnings }
}

/** The address a host's output names, preferring the one that will last (production over a preview). */
export function findSiteUrl(output, host) {
  const urls = String(output).match(/https:\/\/[\w.-]+\.[a-z]{2,}[^\s"'<>)]*/gi) ?? []
  const clean = urls.map((url) => url.replace(/[.,;]+$/, '').replace(/\/$/, ''))
  if (host === 'cloudflare') {
    const pages = clean.filter((url) => /\.pages\.dev$/i.test(url))
    // A deployment preview is <hash>.<project>.pages.dev; the site is <project>.pages.dev.
    // Publishing again only names the preview (the project exists already), so the site is read off it.
    const site = pages.find((url) => new URL(url).hostname.split('.').length === 3)
    if (site) return site
    const preview = pages.at(-1)
    if (!preview) return null
    const { protocol, hostname } = new URL(preview)
    return `${protocol}//${hostname.split('.').slice(-3).join('.')}`
  }
  if (host === 'vercel') {
    const aliased = /(?:Aliased|Production):\s*(https:\/\/\S+)/i.exec(output)?.[1]
    return aliased?.replace(/[.,;]+$/, '').replace(/\/$/, '') ?? clean.filter((url) => /\.vercel\.app$/i.test(url)).at(-1) ?? null
  }
  return clean.at(-1) ?? null
}

/** The npx a host's tool runs through; FROAM_NPX stands in for it (tests, a pinned install). */
function npxCommand() {
  return process.env.FROAM_NPX || 'npx --yes'
}

const quote = (arg) => (/[\s"^&|<>]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg)

/**
 * Run a host's tool. `show: 'all'` hands it the terminal (logging in);
 * otherwise its output is passed through and also kept, to read the address from.
 */
function run(args, { cwd, show = 'tee', stdin = 'inherit' }) {
  const line = `${npxCommand()} ${args.map(quote).join(' ')}`
  if (show === 'all') {
    const result = spawnSync(line, { cwd, stdio: 'inherit', shell: true })
    return Promise.resolve({ code: result.status ?? 1, output: '' })
  }
  return new Promise((resolve) => {
    const child = spawn(line, { cwd, stdio: [stdin, 'pipe', 'pipe'], shell: true })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk) })
    child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk) })
    child.on('error', (error) => resolve({ code: 1, output: `${output}${error.message}` }))
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}

/** Logged in to the host's tool, logging in if not. Quietly asks first, so a logged-in person sees nothing. */
async function ensureLogin({ whoami, login, signedOut }, cwd, log) {
  const check = spawnSync(`${npxCommand()} ${whoami.join(' ')}`, { cwd, encoding: 'utf8', shell: true })
  const said = `${check.stdout ?? ''}${check.stderr ?? ''}`
  if (check.status === 0 && !signedOut.test(said)) return true
  log('  You need to log in once. Your browser will open; come back here when it says you are done.')
  const result = await run(login, { cwd, show: 'all' })
  return result.code === 0
}

const LOGIN_CHECKS = {
  cloudflare: { whoami: ['wrangler', 'whoami'], login: ['wrangler', 'login'], signedOut: /not authenticated|not logged in/i },
  vercel: { whoami: ['vercel', 'whoami'], login: ['vercel', 'login'], signedOut: /no existing credentials|not logged in|vercel login/i },
}

/**
 * Signed in to the host's tool? Asked without blocking (Go Live runs inside
 * froam dev, which is serving editors meanwhile) and without ever starting a
 * login: that needs the terminal and a browser on the computer.
 */
export function isLoggedIn(target, cwd) {
  const check = LOGIN_CHECKS[target]
  if (!check) return Promise.resolve(false)
  return new Promise((resolve) => {
    const child = spawn(`${npxCommand()} ${check.whoami.join(' ')}`, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: true, windowsHide: true })
    let said = ''
    const timer = setTimeout(() => { child.kill(); resolve(false) }, 120_000)
    child.stdout.on('data', (chunk) => { said += chunk })
    child.stderr.on('data', (chunk) => { said += chunk })
    child.on('error', () => { clearTimeout(timer); resolve(false) })
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 && !check.signedOut.test(said)) })
  })
}

/**
 * Each host: put `dir` online as `project`. Resolves to { url } or throws with what to do.
 * `signedIn`: the caller already checked (Go Live), so no login is attempted.
 * `quiet`: nothing reads the terminal's input (a host tool must not take froam dev's keyboard).
 */
export const HOSTS = {
  async cloudflare({ dir, project, cwd, log, signedIn = false, quiet = false }) {
    const stdin = quiet ? 'ignore' : 'inherit'
    if (!signedIn && !await ensureLogin(LOGIN_CHECKS.cloudflare, cwd, log)) {
      throw new Error('Cloudflare login did not finish. Run `froam publish` again to retry.')
    }
    // Creating a project that already exists fails harmlessly; a new one names its address.
    const created = await run(['wrangler', 'pages', 'project', 'create', project, '--production-branch', 'main'], { cwd, stdin })
    if (created.code !== 0 && !/already exists/i.test(created.output)) {
      throw new Error(`Cloudflare could not create the "${project}" project. Try another name: froam publish --name another-name`)
    }
    const deployed = await run(['wrangler', 'pages', 'deploy', dir, '--project-name', project, '--branch', 'main', '--commit-dirty=true'], { cwd, stdin })
    if (deployed.code !== 0) throw new Error('Cloudflare did not take the upload. The message above says why.')
    return { url: findSiteUrl(created.output, 'cloudflare') ?? findSiteUrl(deployed.output, 'cloudflare') ?? `https://${project}.pages.dev` }
  },

  async vercel({ dir, cwd, log, signedIn = false, quiet = false }) {
    if (!signedIn && !await ensureLogin(LOGIN_CHECKS.vercel, cwd, log)) {
      throw new Error('Vercel login did not finish. Run `froam publish` again to retry.')
    }
    const deployed = await run(['vercel', 'deploy', dir, '--prod', '--yes'], { cwd, stdin: quiet ? 'ignore' : 'inherit' })
    if (deployed.code !== 0) throw new Error('Vercel did not take the upload. The message above says why.')
    return { url: findSiteUrl(deployed.output, 'vercel') }
  },
}
