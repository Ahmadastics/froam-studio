/**
 * Go Live: what was saved in the editor, on the real site, from one button —
 * on the computer or a paired phone.
 *
 * Saving writes the project. Visitors only get it once the site is deployed,
 * which used to mean a terminal: `froam publish` for a plain HTML site, a
 * commit and a push for anything in git. This does that step, in two halves:
 *
 *   plan()   what would go and where, said plainly, with a token for exactly
 *            that. Nothing is touched. The editor shows it and asks.
 *   start()  the same plan (refused if anything changed since it was shown),
 *            then commit and push, or publish — and then the live site is read
 *            until it serves what was sent. "Live" is only said when it is.
 *
 * In git, only what Froam wrote is committed: the design and the two files
 * visitors load (and their copies in a public folder), placed media, and the
 * source files Froam put copy, classes or sections into. Anything else
 * someone is in the middle of stays uncommitted. Nothing is ever forced:
 * no --force, no skipped hooks, no pull or merge on anyone's behalf.
 *
 * With a record (lib/record.mjs), going live is written down first, the record
 * goes in the same commit, and the commit message carries the record's newest
 * hash ("Froam-Record: …"), so pushed history vouches for the record.
 */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { findShipDir } from './codegen.mjs'
import { HOSTS, PUBLISH_TARGETS, buildPublishFolder, isLoggedIn } from './publish.mjs'
import { createGitHubDeploys, findGitHubToken, githubRepoOf, waitForDeploy } from './github-deploys.mjs'
import { findSiteAddress } from './site-address.mjs'
import { findLoadedWorkspaces, workspaceIsLoaded } from './workspace-finder.mjs'

const WORKSPACE_FILES = ['froam.design.json', 'froam.generated.css', 'froam.runtime.js']
const VISITOR_FILES = ['froam.generated.css', 'froam.runtime.js']
const PUBLIC_DIRS = ['public', 'static']
/** Worth a word before it's in the history for good; GitHub refuses a file over its limit outright. */
const BIG_FILE = 5 * 1024 * 1024
const GITHUB_FILE_LIMIT = 100 * 1024 * 1024
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`

const sha = (value) => createHash('sha256').update(value).digest('hex')
const fileHash = (file) => { try { return sha(fs.readFileSync(file)) } catch { return 'gone' } }
/**
 * One spelling per place. Windows gives a folder two names (C:\Users\AHMADM~1
 * and C:\Users\Ahmad Modibbo) and git always answers with the long one, so
 * every path is compared in its real form, or none of Froam's files look like Froam's.
 */
export const realPath = (file) => {
  try { return fs.realpathSync.native(file) } catch {
    // Gone (a deleted file): its folder still has a real name.
    try { return path.join(fs.realpathSync.native(path.dirname(file)), path.basename(file)) } catch { return path.resolve(file) }
  }
}
const samePath = process.platform === 'win32' ? (a, b) => a.toLowerCase() === b.toLowerCase() : (a, b) => a === b
const inside = (file, dir) => {
  const rel = path.relative(dir, file)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function git(args, cwd, { timeout = 30_000 } = {}) {
  return new Promise((resolve) => {
    // Never wait on a password prompt nobody can see: fail, and say what to do.
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
    execFile('git', args, { cwd, timeout, env, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

/** A remote URL as people say it: github.com/you/site — never with a token in it. */
export function describeRemote(url) {
  const text = String(url ?? '').trim()
  const scp = /^[\w.-]+@([\w.-]+):(.+?)(?:\.git)?\/?$/.exec(text)
  if (scp) return `${scp[1]}/${scp[2]}`
  // A folder on this computer (C:\repos\site.git reads as a URL with scheme "c:").
  if (/^(?:[A-Za-z]:[\\/]|[\\/]|\.)/.test(text)) return path.basename(text.replace(/[\\/]+$/, '')).replace(/\.git$/, '')
  try {
    const parsed = new URL(text)
    if (parsed.protocol === 'file:') return path.basename(parsed.pathname).replace(/\.git$/, '')
    return `${parsed.hostname}${parsed.pathname.replace(/\.git\/?$/, '').replace(/\/$/, '')}`
  } catch {
    return path.basename(text).replace(/\.git$/, '')
  }
}

/** Who deploys a repo when it's pushed, from the files hosts leave behind. Only for saying so. */
export function detectHost(top) {
  const has = (rel) => fs.existsSync(path.join(top, rel))
  if (has('.vercel/project.json') || has('vercel.json')) return 'Vercel'
  if (has('netlify.toml') || has('.netlify')) return 'Netlify'
  if (has('wrangler.toml') || has('wrangler.json') || has('wrangler.jsonc')) return 'Cloudflare'
  if (has('render.yaml')) return 'Render'
  if (has('fly.toml')) return 'Fly'
  try {
    if (fs.readdirSync(path.join(top, '.github', 'workflows')).some((name) => /pages|deploy/i.test(fs.readFileSync(path.join(top, '.github', 'workflows', name), 'utf8')))) return 'GitHub Actions'
  } catch { /* no workflows */ }
  return null
}

/** Where a file in the repo is served from on the site, when that's knowable: public/froam/x.css → /froam/x.css. */
export function servedPath(file, { top, serveDir }) {
  if (serveDir && inside(file, realPath(serveDir))) return `/${path.relative(realPath(serveDir), file).split(path.sep).join('/')}`
  const rel = path.relative(top, file).split(path.sep)
  const at = rel.findIndex((part) => PUBLIC_DIRS.includes(part))
  return at >= 0 && at < rel.length - 1 ? `/${rel.slice(at + 1).join('/')}` : null
}

function friendly(rel) {
  const name = path.basename(rel)
  if (name === 'froam.design.json') return 'Your design (what the editor saved)'
  if (name === 'froam.generated.css') return 'Styles visitors load'
  if (name === 'froam.runtime.js') return 'Content visitors load'
  if (/(^|\/)media\//.test(rel)) return `Picture or video: ${name}`
  if (/\.html?$/i.test(name)) return `Page: ${rel}`
  return `Copy and styles in ${rel}`
}

const normalizeText = (text) => String(text).replace(/\r\n?/g, '\n').trim()
/** HTML with the parts a host may add or rewrite (its own scripts, comments, whitespace) taken out. */
const normalizeHtml = (html) => String(html)
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+/g, '')

/**
 * @param {{
 *   froamDir: string, sourceRoot?: string | null, serveDir?: string | null,
 *   staticSite?: boolean, log?: (line: string) => void,
 *   progress?: (job: object) => void, fetchImpl?: typeof fetch,
 *   checkEveryMs?: number, checkForMs?: number,
 *   record?: ReturnType<typeof import('./record.mjs').createFroamRecord> | null,
 * }} options
 */
export function createGoLive({ froamDir, sourceRoot = null, serveDir = null, staticSite = false, log = () => {}, progress = () => {}, fetchImpl = globalThis.fetch, checkEveryMs = 5_000, checkForMs = 8 * 60_000, github: githubOptions = {}, deployTiming = {}, record = null }) {
  const workspace = realPath(froamDir)
  const siteDir = realPath(serveDir ?? sourceRoot ?? path.dirname(workspace))
  const configPath = path.join(siteDir, 'froam.config.json')
  /** Source files Froam wrote this run, and the words it wrote — what a commit may take, and what the live page should say. */
  const touched = new Set()
  const wrote = new Set()
  const routes = new Set()
  let job = null

  const readConfig = () => { try { return JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { return {} } }
  const writeConfig = (change) => {
    const config = readConfig()
    fs.writeFileSync(configPath, JSON.stringify({ ...config, ...change(config) }, null, 2) + '\n')
  }
  const siteUrl = (config = readConfig()) => {
    const url = config.siteUrl ?? process.env.FROAM_SITE_URL ?? config.publish?.url ?? null
    return typeof url === 'string' && /^https?:\/\//i.test(url) ? url.replace(/\/+$/, '') : null
  }

  /*
   * GitHub, for the remotes that are on it: what hosts last reported deploying,
   * the repo's website field and default branch. Asked once a minute at most,
   * and never fatal — without it Go Live works as before, just knowing less.
   * `github.fetchImpl` / `github.token` stand in for the network and the
   * person's sign-in in tests.
   */
  const githubFetch = githubOptions.fetchImpl ?? globalThis.fetch
  let tokenPromise = null
  const githubToken = (cwd) => {
    if (githubOptions.token !== undefined) return Promise.resolve(githubOptions.token)
    tokenPromise ??= findGitHubToken({ cwd }).catch(() => null)
    return tokenPromise
  }
  const factsCache = new Map()
  async function githubFacts({ owner, repo }, cwd) {
    const key = `${owner}/${repo}`
    const cached = factsCache.get(key)
    if (cached && Date.now() - cached.at < 60_000) return cached.facts
    const token = await githubToken(cwd)
    const client = createGitHubDeploys({ owner, repo, token, fetchImpl: githubFetch })
    let facts
    try {
      const [about, last] = await Promise.all([client.about(), client.lastProduction()])
      facts = { reachable: true, client, homepage: about.homepage, defaultBranch: about.defaultBranch, last }
    } catch (error) {
      const reason = error?.status === 404
        ? (token ? 'GitHub says this repo isn\'t there for the account git signs in with.' : 'This repo is private, and Froam has no GitHub sign-in to ask about it with. Set GITHUB_TOKEN, or sign in with the GitHub CLI (gh auth login).')
        : error instanceof Error ? error.message : 'GitHub couldn\'t be asked'
      facts = { reachable: false, reason, client: null }
    }
    factsCache.set(key, { at: Date.now(), facts })
    return facts
  }

  function update(change) {
    job = { ...job, ...change, updatedAt: Date.now() }
    progress(job)
    return job
  }

  /* ── what goes ── */

  async function gitPlan(options = {}) {
    const cwd = sourceRoot ?? siteDir
    const top = (await git(['rev-parse', '--show-toplevel'], cwd)).stdout.trim()
    if (!top) return null
    const root = realPath(top)
    const remotes = (await git(['remote'], root)).stdout.split('\n').map((line) => line.trim()).filter(Boolean)
    if (!remotes.length) return { blocked: 'This project isn\'t connected to GitHub (or any git host) yet, so there\'s nowhere to push it. Connect it once, then Go Live does the rest.' }
    // symbolic-ref, not rev-parse: a repo with no commits yet is still on a branch.
    const branch = (await git(['symbolic-ref', '--quiet', '--short', 'HEAD'], root)).stdout.trim()
    if (!branch) return { blocked: 'This repo isn\'t on a branch right now (a detached HEAD). Check out your branch, then try again.' }
    const upstream = (await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], root)).stdout.trim() || null
    const upstreamRemote = upstream ? remotes.find((name) => upstream.startsWith(`${name}/`)) ?? null : null

    // Every remote, and for those on GitHub, what a host last reported deploying from it.
    // As written in the config: `remote get-url` rewrites through insteadOf.
    const remoteInfo = await Promise.all(remotes.map(async (name) => {
      const url = (await git(['config', '--get', `remote.${name}.url`], root)).stdout.trim()
      const github = githubRepoOf(url)
      return { name, url, repo: describeRemote(url), github, deploys: github ? await githubFacts(github, root) : null }
    }))
    const config = readConfig()
    const saved = typeof config.goLive?.remote === 'string' && remotes.includes(config.goLive.remote) ? config.goLive.remote : null
    const requested = typeof options.remote === 'string' && remotes.includes(options.remote) ? options.remote : null
    const deploying = remoteInfo.filter((info) => info.deploys?.last)
    // Which remote gets it: the one you picked, or saved; the one a host deploys from; git's upstream;
    // the only one. Past that it's a guess, and the sheet asks rather than guessing.
    const [remote, chosenBy] = requested ? [requested, 'you']
      : saved ? [saved, 'saved']
        : deploying.length === 1 ? [deploying[0].name, 'host']
          : upstreamRemote ? [upstreamRemote, 'upstream']
            : remotes.length === 1 ? [remotes[0], 'only']
              : [remotes.includes('origin') ? 'origin' : remotes[0], 'guess']
    const chosen = remoteInfo.find((info) => info.name === remote)
    const remoteUrl = chosen.url
    const remoteBranch = upstream && remote === upstreamRemote ? upstream.slice(remote.length + 1) : branch
    // The branch the site is built from: what the host last deployed to production,
    // else GitHub's default branch, else the remote's own HEAD.
    const head = (await git(['symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`], root)).stdout.trim()
    const asked = head || chosen.deploys?.last?.branch || chosen.deploys?.defaultBranch ? '' : /^ref: refs\/heads\/(\S+)\s+HEAD/m.exec((await git(['ls-remote', '--symref', remote, 'HEAD'], root, { timeout: 20_000 })).stdout)?.[1] ?? ''
    const defaultBranch = chosen.deploys?.last?.branch || chosen.deploys?.defaultBranch || (head ? head.slice(remote.length + 1) : asked) || (['main', 'master'].includes(remoteBranch) ? remoteBranch : null)

    // Is the remote ahead? A push would be refused, and pulling is the owner's call.
    // Asked first whether the branch is there at all: fetching one that isn't
    // fails just like being offline does, and the two mean different things.
    const listed = await git(['ls-remote', '--heads', remote, remoteBranch], root, { timeout: 20_000 })
    const offline = listed.code !== 0
    const onRemote = !offline && listed.stdout.trim().length > 0
    if (onRemote) await git(['fetch', '--quiet', remote, remoteBranch], root, { timeout: 20_000 })
    const tracking = `refs/remotes/${remote}/${remoteBranch}`
    const known = onRemote && (await git(['rev-parse', '--verify', '--quiet', tracking], root)).code === 0
    // What the push would carry that the remote doesn't have: up to its branch, or, for a branch it has never had, whatever no branch there has yet.
    const unpushed = known ? [`${tracking}..HEAD`] : ['HEAD', '--not', `--remotes=${remote}`]
    const behind = known ? Number((await git(['rev-list', '--count', `HEAD..${tracking}`], root)).stdout.trim()) || 0 : 0
    const earlierCount = Number((await git(['rev-list', '--count', ...unpushed], root)).stdout.trim()) || 0
    const earlier = (await git(['log', '--format=%h%x09%s', '-n', '20', ...unpushed], root)).stdout.split('\n').filter(Boolean).map((line) => {
      const [hash, ...subject] = line.split('\t')
      return { hash, subject: subject.join('\t') }
    })

    // Froam's files, and only those, out of everything git sees changed.
    const shipped = findShipDir(workspace)
    const shipDir = shipped ? realPath(shipped) : null
    const owned = (file) => WORKSPACE_FILES.some((name) => samePath(file, path.join(workspace, name)))
      || inside(file, path.join(workspace, 'media'))
      || (shipDir && inside(file, shipDir))
      || [...touched].some((written) => samePath(file, written))
    const status = (await git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], root)).stdout.split('\0')
    const files = []
    let others = 0
    for (let i = 0; i < status.length; i += 1) {
      const entry = status[i]
      if (!entry) continue
      const code = entry.slice(0, 2)
      const file = path.resolve(root, entry.slice(3))
      if (code.includes('R') || code.includes('C')) i += 1
      if (owned(file)) files.push({ path: path.relative(root, file).split(path.sep).join('/'), file, change: code === '??' ? 'new' : code.includes('D') ? 'removed' : 'changed' })
      // The editor's own bookkeeping (froam.project.json, rooms, Save's drafts) is neither shipped nor someone's work.
      else if (!inside(file, workspace)) others += 1
    }

    // Before anything goes: files big enough to regret, and a Froam folder the site never reads.
    const sized = files.filter((entry) => entry.change !== 'removed').map((entry) => ({ ...entry, size: (() => { try { return fs.statSync(entry.file).size } catch { return 0 } })() }))
    const bigFiles = sized.filter((entry) => entry.size > BIG_FILE && entry.size <= GITHUB_FILE_LIMIT)
    const tooBig = sized.filter((entry) => entry.size > GITHUB_FILE_LIMIT)
    const notLoaded = []
    if (files.length && !workspaceIsLoaded(workspace, root)) {
      const loadedElsewhere = findLoadedWorkspaces(root).filter((dir) => !samePath(dir, workspace))
      const rel = (dir) => path.relative(root, dir).split(path.sep).join('/') || '.'
      notLoaded.push(loadedElsewhere.length
        ? `Your site doesn't load this Froam folder (${rel(workspace)}): it loads ${rel(loadedElsewhere[0])}. These edits won't show on it. Open Froam on the app itself so it saves where your site reads.`
        : `Nothing in your site loads this Froam folder (${rel(workspace)}), so these edits may not show on it. Run froam init in your site's folder to connect it.`)
    }

    // Where the site lives: what you told Froam; GitHub's website field for the repo; what the
    // project says itself (lib/site-address.mjs); the address of the host's last production deploy.
    const address = (() => {
      const saidUrl = siteUrl(config)
      if (saidUrl) return { url: saidUrl, source: null }
      if (chosen.deploys?.homepage) return { url: chosen.deploys.homepage, source: 'the repo\'s website on GitHub' }
      const found = findSiteAddress({ top: root, siteDir })
      if (found) return found
      if (chosen.deploys?.last?.url) return { url: chosen.deploys.last.url, source: `your last ${chosen.deploys.last.host ?? 'production'} deploy` }
      return { url: null, source: null }
    })()
    const url = address.url
    const checks = []
    for (const name of VISITOR_FILES) {
      for (const candidate of [shipDir && path.join(shipDir, name), path.join(workspace, name)]) {
        const served = candidate && fs.existsSync(candidate) ? servedPath(candidate, { top: root, serveDir }) : null
        if (served) { checks.push({ path: served, file: candidate }); break }
      }
    }
    return {
      mode: 'git',
      top: root,
      branch,
      remote,
      remoteBranch,
      upstream,
      where: {
        repo: describeRemote(remoteUrl),
        branch: remoteBranch,
        production: defaultBranch ? remoteBranch === defaultBranch : null,
        defaultBranch,
        // Who deploys it: as reported to GitHub when we can see that, else as the project's files suggest.
        host: chosen.deploys?.last?.host ?? detectHost(root),
        hostReported: Boolean(chosen.deploys?.last?.host),
        url,
        urlSource: address.source,
        // The push makes the branch there; on most hosts a new branch is a preview, not the site.
        newBranch: !offline && !onRemote,
        remote,
        // Every remote, so the sheet can offer the choice; `deploys` names the host that builds from it.
        remotes: remoteInfo.map((info) => ({ name: info.name, repo: info.repo, deploys: info.deploys?.last?.host ?? (info.deploys?.last ? 'a host' : null) })),
        chosenBy,
        needsChoice: chosenBy === 'guess',
        // Whether GitHub could be asked about this repo, and if not, why (shown so the person can fix it).
        github: chosen.github ? { reachable: Boolean(chosen.deploys?.reachable), reason: chosen.deploys?.reason ?? null } : null,
      },
      githubClient: chosen.deploys?.client ?? null,
      files,
      // The record rides along with what Froam saved, never on its own (see goGit).
      recording: Boolean(record) && readConfig().record?.commit !== false,
      earlier,
      earlierCount,
      others,
      behind,
      offline,
      checks,
      words: [...wrote],
      warnings: [...notLoaded, ...bigFiles.map(({ path: rel, size }) => `${path.basename(rel)} is ${megabytes(size)}. Once pushed it stays in your repo's history for good, and visitors download it with the page: a smaller copy would load faster.`)],
      blocked: behind
        ? `${describeRemote(remoteUrl)} has ${behind} newer commit${behind === 1 ? '' : 's'} on ${remoteBranch} than this computer. Pull ${behind === 1 ? 'it' : 'them'} first (git pull), so nothing of theirs is overwritten — then Go Live.`
        : tooBig.length ? `${tooBig.map((entry) => `${path.basename(entry.path)} (${megabytes(entry.size)})`).join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} over GitHub's 100 MB limit for a file, so the push would be refused. Use a smaller copy, then Go Live.`
          : !files.length && !earlier.length ? 'Nothing new to put live: everything Froam saved is already pushed.' : null,
    }
  }

  function publishPlan(config) {
    const settings = config.publish && typeof config.publish === 'object' ? config.publish : {}
    const target = PUBLISH_TARGETS.find((entry) => entry.id === settings.to)
    if (!target) return { mode: 'publish', blocked: 'Pick where your site lives once: run froam publish in the terminal on your computer. After that, this button puts every change live.' }
    if (!HOSTS[target.id]) return { mode: 'publish', blocked: `${target.label} takes your site as an upload you do yourself, so Go Live can't send it. Run froam publish on your computer for the folder.` }
    const project = settings.project ?? path.basename(siteDir)
    const outDir = path.join(siteDir, '.froam', 'publish', project)
    // What changed since it last went live: a hash per file, kept beside the upload.
    const manifestPath = path.join(siteDir, '.froam', 'live.json')
    let last = {}
    try { last = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files ?? {} } catch { /* never published from here */ }
    const scratch = path.join(siteDir, '.froam', 'plan', project)
    const built = buildPublishFolder(siteDir, scratch, { froamDir: path.relative(siteDir, workspace) || 'froam' })
    const hashes = Object.fromEntries(built.files.map((rel) => [rel, fileHash(path.join(scratch, rel))]))
    const files = Object.entries(hashes).filter(([rel, hash]) => last[rel] !== hash).map(([rel]) => ({ path: rel, change: last[rel] ? 'changed' : 'new' }))
    const removed = Object.keys(last).filter((rel) => !(rel in hashes))
    return {
      mode: 'publish',
      target: target.id,
      project,
      outDir,
      manifestPath,
      hashes,
      where: { host: target.label, project, url: siteUrl(config) },
      files: [...files, ...removed.map((rel) => ({ path: rel, change: 'removed' }))],
      total: built.files.length,
      warnings: built.warnings,
      blocked: files.length || removed.length || !settings.url ? null : 'Nothing new to put live: your site already has everything you saved.',
    }
  }

  /** What Go Live would do right now. Touches nothing but a scratch copy in .froam/. */
  async function plan(options = {}) {
    const config = readConfig()
    let result = null
    if (staticSite && config.publish) result = publishPlan(config)
    if (!result) result = await gitPlan(options)
    if (!result && staticSite) result = publishPlan(config)
    if (!result) result = { mode: 'none', blocked: 'This project isn\'t in git and has no host set up, so there\'s nowhere to send it yet.' }
    const files = (result.files ?? []).map(({ path: rel, change }) => ({ path: rel, change, label: friendly(rel) }))
    const token = sha(JSON.stringify({
      mode: result.mode,
      where: result.where ?? null,
      files: (result.files ?? []).map((entry) => [entry.path, entry.change, entry.file ? fileHash(entry.file) : result.hashes?.[entry.path] ?? null]),
      earlier: (result.earlier ?? []).map((commit) => commit.hash),
    })).slice(0, 24)
    return { ...result, files, token, busy: Boolean(job && !job.done) }
  }

  /** The plan as the editor may see it: no absolute paths. */
  function publicPlan(full) {
    const { top, outDir, manifestPath, hashes, checks, words, file, githubClient, ...shown } = full
    return { ...shown, canCheck: Boolean(full.where?.url && ((checks?.length ?? 0) || (words?.length ?? 0) || full.mode === 'publish')) }
  }

  /* ── is it live? ── */

  async function readLive(url) {
    const response = await fetchImpl(`${url}${url.includes('?') ? '&' : '?'}froam-live=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, redirect: 'follow' })
    return response.ok ? response.text() : null
  }

  /** Read the site until every expectation holds, or time runs out. */
  async function waitUntilLive(base, expectations, { forMs = checkForMs, say = () => {} } = {}) {
    const started = Date.now()
    let round = 0
    while (Date.now() - started <= forMs) {
      round += 1
      let all = true
      for (const expect of expectations) {
        let body = null
        try { body = await readLive(`${base}${expect.path}`) } catch { body = null }
        if (body === null || !expect.matches(body)) { all = false; break }
      }
      if (all) return true
      if (round % 6 === 0) say(Math.round((Date.now() - started) / 1000))
      await new Promise((resolve) => setTimeout(resolve, checkEveryMs))
    }
    return false
  }

  /* ── going live ── */

  /** The record's path in this commit, when it should go (not turned off in froam.config.json, not git-ignored). */
  async function recordPathIn(top) {
    if (!record || readConfig().record?.commit === false) return null
    const rel = path.relative(top, realPath(record.file)).split(path.sep).join('/')
    if (!rel || rel.startsWith('..')) return null
    return (await git(['check-ignore', '-q', '--', rel], top)).code === 0 ? null : rel
  }

  async function goGit(full, by) {
    const { top } = full
    let commit = null
    const where = [...routes].sort()
    if (full.files.length) {
      update({ step: 'commit', message: 'Committing what Froam saved' })
      const paths = full.files.map((entry) => entry.path)
      // Written down before the commit, so the commit carries its own entry and the chain's newest hash.
      const entry = record?.note({ type: 'live.started', by, pages: where, changes: full.files.map((file) => ({ label: `${file.label} (${file.change})` })), count: full.files.length, refs: { repo: full.where.repo, branch: full.remoteBranch } })
      const recordPath = entry ? await recordPathIn(top) : null
      if (recordPath) paths.push(recordPath)
      const added = await git(['add', '--', ...paths], top)
      if (added.code !== 0) throw new Error(`git couldn't stage the files: ${lastLine(added.stderr)}`)
      const subject = `Froam: ${where.length ? `edit ${where.slice(0, 4).join(', ')}${where.length > 4 ? ` and ${where.length - 4} more` : ''}` : 'design update'}`
      const body = full.files.map((entry) => `- ${entry.label}`).join('\n') + (recordPath ? `\n\nFroam-Record: ${entry.hash}` : '')
      // Only these paths, whatever else is staged: someone's half-done work stays out.
      const committed = await git(['commit', '-m', subject, '-m', body, '--only', '--', ...paths], top, { timeout: 120_000 })
      if (committed.code !== 0) {
        const said = `${committed.stdout}\n${committed.stderr}`
        throw new Error(/user\.(name|email)|Please tell me who you are/i.test(said)
          ? 'git doesn\'t know who you are yet. Run git config --global user.name "Your Name" and git config --global user.email you@example.com once, then Go Live.'
          : `git couldn't commit: ${lastLine(said)}`)
      }
      log(`committed ${paths.length} file${paths.length === 1 ? '' : 's'}: ${subject}`)
      commit = (await git(['rev-parse', '--short', 'HEAD'], top)).stdout.trim() || null
    } else {
      record?.note({ type: 'live.started', by, pages: where, result: 'Sent commits that were already made', refs: { repo: full.where.repo, branch: full.remoteBranch } })
    }
    update({ step: 'push', message: `Sending it to ${full.where.repo}` })
    const pushed = await git(full.upstream ? ['push', full.remote, `HEAD:${full.remoteBranch}`] : ['push', '-u', full.remote, full.branch], top, { timeout: 180_000 })
    if (pushed.code !== 0) {
      const said = `${pushed.stdout}\n${pushed.stderr}`
      throw new Error(/rejected|non-fast-forward|fetch first/i.test(said)
        ? `${full.where.repo} has newer commits than this computer. Pull them (git pull), then Go Live again. Your commit is kept.`
        : /could not read|authentication|permission denied|403|terminal prompts disabled/i.test(said)
          ? `git couldn't sign in to ${full.where.repo}. Push once from the terminal (git push) so your computer remembers you, then Go Live. Your commit is kept.`
          : `git couldn't push: ${lastLine(said)}. Your commit is kept.`)
    }
    log(`pushed to ${full.where.repo} (${full.remoteBranch})`)
    const done = { pushed: true, commit }

    // The host's own word, through GitHub: building, finished (and where), or failed (and its log).
    if (full.githubClient) {
      const sha = (await git(['rev-parse', 'HEAD'], full.top)).stdout.trim()
      const host = full.where.host ?? 'your host'
      update({ step: 'deploy', message: `Waiting for ${host} to pick it up` })
      const report = await waitForDeploy(full.githubClient, sha, { ...deployTiming, say: (seen, seconds) => update({ step: 'deploy', message: `${seen.host ?? host} is building it (${seconds}s)` }) })
      const who = report.host ?? host
      if (report.state === 'failure') {
        return { ...done, ok: false, outcome: 'failed', url: report.logUrl ?? null, linkLabel: 'Open the build log', message: `${who} couldn't build it, so your site still shows the last version. Your commit is pushed: fix what the log says, then Go Live again.` }
      }
      if (report.state === 'success' && report.production === false) {
        return { ...done, outcome: 'preview', url: report.url ?? null, message: `${who} made a preview of it — your live site builds from ${full.where.defaultBranch ?? 'your main branch'}, not ${full.remoteBranch}.` }
      }
      if (report.state === 'success') {
        // Said by the host itself. Where we know the site's own address, it's read too, so "Live" means the address people type.
        const expectations = full.where.url ? [
          ...full.checks.map((check) => { const want = normalizeText(fs.readFileSync(check.file, 'utf8')); return { path: check.path, matches: (body) => normalizeText(body) === want } }),
          ...(full.words.length ? [{ path: '/', matches: (body) => full.words.every((words) => body.includes(words)) }] : []),
        ] : []
        if (expectations.length) {
          update({ step: 'check', message: `${who} finished — checking ${full.where.url.replace(/^https?:\/\//, '')}` })
          const showing = await waitUntilLive(full.where.url, expectations, { forMs: Math.min(checkForMs, 120_000) })
          if (!showing) return { ...done, outcome: 'live', url: report.url ?? full.where.url, message: `${who} finished deploying it, but ${full.where.url.replace(/^https?:\/\//, '')} isn't showing it yet. If that isn't this site's address, change it in Go Live.` }
        }
        return { ...done, outcome: 'live', url: full.where.url ?? report.url ?? null, message: `Live — ${who} finished deploying it` }
      }
      if (report.state === 'unknown') log(`couldn't follow the deploy on GitHub: ${report.reason}`)
      // 'none': nothing reports to GitHub for this repo. Fall back to reading the site.
    }

    if (!full.where.url) return { ...done, outcome: 'pushed', message: `Sent to ${full.where.repo}${full.where.host ? `. ${full.where.host} deploys it from there` : ''}. Tell Froam your site's address and it will check when it's live.` }

    const expectations = [
      ...full.checks.map((check) => {
        const want = normalizeText(fs.readFileSync(check.file, 'utf8'))
        return { path: check.path, matches: (body) => normalizeText(body) === want }
      }),
      ...(full.words.length ? [{ path: '/', matches: (body) => full.words.every((words) => body.includes(words)) }] : []),
    ]
    if (!expectations.length) return { ...done, outcome: 'pushed', message: `Sent to ${full.where.repo}${full.where.host ? ` — ${full.where.host} deploys it` : ''}. This kind of site builds Froam's files into its own, so Froam can't tell the moment it's live: open it in a minute.` }
    update({ step: 'check', message: `Waiting for ${full.where.host ?? 'your host'} to deploy it` })
    const live = await waitUntilLive(full.where.url, expectations, { say: (seconds) => update({ step: 'check', message: `Still deploying (${seconds}s) — hosts usually take one to three minutes` }) })
    return live
      ? { ...done, outcome: 'live', message: 'Live — visitors see it now' }
      : { ...done, outcome: 'pushed', message: `Sent to ${full.where.repo}, but ${full.where.url} doesn't show it yet. ${full.where.host ?? 'Your host'} may still be building, or the build failed — its dashboard says which.` }
  }

  async function goPublish(full, by) {
    const config = readConfig()
    record?.note({ type: 'live.started', by, pages: [...routes].sort(), changes: full.files.map((file) => ({ label: `${file.path} (${file.change})` })), count: full.files.length, refs: { host: full.where.host, project: full.project } })
    update({ step: 'build', message: 'Getting your site ready' })
    const built = buildPublishFolder(siteDir, full.outDir, { froamDir: path.relative(siteDir, workspace) || 'froam' })
    update({ step: 'login', message: `Checking you're signed in to ${full.where.host}` })
    if (!await isLoggedIn(full.target, siteDir)) {
      throw new Error(`Sign in to ${full.where.host} once: run froam publish in the terminal on your computer. After that, Go Live works from anywhere.`)
    }
    update({ step: 'publish', message: `Uploading to ${full.where.host}` })
    const { url } = await HOSTS[full.target]({ dir: full.outDir, project: full.project, cwd: siteDir, log, signedIn: true, quiet: true })
    const liveUrl = (url ?? full.where.url ?? '').replace(/\/+$/, '') || null
    writeConfig((current) => ({ publish: { ...(current.publish ?? {}), ...(liveUrl ? { url: liveUrl } : {}) } }))
    const hashes = Object.fromEntries(built.files.map((rel) => [rel, fileHash(path.join(full.outDir, rel))]))
    fs.mkdirSync(path.dirname(full.manifestPath), { recursive: true })
    fs.writeFileSync(full.manifestPath, JSON.stringify({ at: new Date().toISOString(), url: liveUrl, files: hashes }, null, 2))
    if (!liveUrl) return { outcome: 'pushed', message: `Uploaded. ${full.where.host} shows your address in its dashboard.` }

    const changed = new Set(full.files.filter((entry) => entry.change !== 'removed').map((entry) => entry.path))
    const expectations = built.files
      .filter((rel) => changed.has(rel) && (/\.html?$/i.test(rel) || VISITOR_FILES.includes(path.basename(rel))))
      .slice(0, 6)
      .map((rel) => {
        const local = fs.readFileSync(path.join(full.outDir, rel), 'utf8')
        const servedAt = `/${rel.replace(/(^|\/)index\.html?$/i, '$1')}`
        return /\.html?$/i.test(rel)
          ? { path: servedAt, matches: (body) => normalizeHtml(body).includes(normalizeHtml(/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(local)?.[1] ?? local)) }
          : { path: servedAt, matches: (body) => normalizeText(body) === normalizeText(local) }
      })
    update({ step: 'check', message: 'Checking your live site' })
    const live = expectations.length ? await waitUntilLive(liveUrl, expectations, { forMs: Math.min(checkForMs, 90_000) }) : true
    return live
      ? { outcome: 'live', url: liveUrl, message: 'Live — visitors see it now' }
      : { outcome: 'pushed', url: liveUrl, message: `Uploaded, but ${liveUrl} isn't showing it yet. Hosts sometimes take a minute; open it to check.` }
  }

  /** Go, if `token` is still the plan. Resolves once it has started; progress goes to `progress`. */
  async function start(token, options = {}) {
    if (job && !job.done) return { ok: false, status: 409, error: 'Already going live — wait for that to finish', job }
    const full = await plan(options)
    if (full.token !== token) return { ok: false, status: 409, error: 'Something changed since you looked — check again', plan: publicPlan(full) }
    if (full.blocked) return { ok: false, status: 400, error: full.blocked, plan: publicPlan(full) }
    job = { id: sha(`${token}${Date.now()}`).slice(0, 12), mode: full.mode, step: 'start', message: 'Starting', url: full.where?.url ?? null, startedAt: Date.now(), done: false }
    progress(job)
    // Who pressed it, for the record: the owner, on this computer or a paired phone.
    const by = options.by && typeof options.by === 'object' ? options.by : { name: 'Owner', role: 'owner' }
    ;(async () => {
      try {
        const result = full.mode === 'git' ? await goGit(full, by) : await goPublish(full, by)
        const url = result.url ?? full.where?.url ?? null
        record?.note({ type: result.ok === false ? 'live.failed' : 'live.finished', by, result: result.message, refs: { outcome: result.outcome, ...(result.commit ? { commit: result.commit } : {}), ...(url ? { url } : {}) } })
        routes.clear()
        touched.clear()
        wrote.clear()
        // A remote picked in the sheet is remembered once it has actually been sent to.
        if (full.mode === 'git' && full.where?.chosenBy === 'you') writeConfig((config) => ({ goLive: { ...(config.goLive ?? {}), remote: full.remote } }))
        update({ step: 'done', done: true, ok: result.ok ?? true, ...result, url: result.url ?? full.where?.url ?? null })
        log(result.outcome === 'live' ? `live: ${job.url ?? 'yes'}` : result.message)
      } catch (error) {
        update({ step: 'failed', done: true, ok: false, message: error instanceof Error ? error.message : String(error) })
        log(`go live failed: ${job.message}`)
        record?.note({ type: 'live.failed', by, result: job.message })
      }
    })()
    return { ok: true, job }
  }

  return {
    /** A save that changed `routeKey` (for the commit message). */
    recordSave(routeKey) { if (typeof routeKey === 'string') routes.add(routeKey) },
    /** Source files Froam wrote, absolute, and the words it put there. */
    recordSource(files, words = []) {
      for (const file of files) if (file) touched.add(realPath(file))
      for (const text of words) if (typeof text === 'string' && text.trim().length >= 4 && !text.includes('<')) wrote.add(text.trim())
    },
    async plan(options = {}) { return publicPlan(await plan(options)) },
    start,
    job: () => job,
    siteUrl: () => siteUrl(),
    setSiteUrl(url) {
      const clean = String(url ?? '').trim().replace(/\/+$/, '')
      if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(clean)) throw new Error('That isn\'t a web address — it should start with https://')
      writeConfig(() => ({ siteUrl: clean }))
      return clean
    },
  }
}

function lastLine(text) {
  return String(text).trim().split('\n').map((line) => line.trim()).filter(Boolean).at(-1) ?? 'no message'
}
