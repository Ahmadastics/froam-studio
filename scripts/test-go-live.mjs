/**
 * Go Live (lib/go-live.mjs): saved work onto the real site from the editor.
 *
 * Runs against real git — a working copy and a bare repo standing in for
 * GitHub — and a stand-in host: "deploying" is reading the pushed branch out
 * of the bare repo (or the uploaded folder, for Cloudflare), after a delay,
 * the way a host serves the old site until its build finishes. The hosts'
 * own tools are a script (FROAM_NPX), as in test-publish.mjs. Offline, and it
 * never touches anyone's account.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createGoLive, describeRemote, servedPath } from '../lib/go-live.mjs'

const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'froam-test-golive-'))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const gitIdentity = ['-c', 'user.name=Tester', '-c', 'user.email=tester@example.com']

/** A static site in git, pushed once, with a bare "GitHub" beside it. */
function newRepo(name) {
  const remote = path.join(base, `${name}.git`)
  const site = path.join(base, name)
  git(base, 'init', '--quiet', '--bare', '--initial-branch=main', remote)
  fs.mkdirSync(path.join(site, 'froam'), { recursive: true })
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="froam/froam.generated.css"></head><body><h1>Old words</h1></body></html>\n')
  fs.writeFileSync(path.join(site, 'app.js'), 'console.log(1)\n')
  fs.writeFileSync(path.join(site, 'froam', 'froam.design.json'), '{"version":3,"routes":{}}\n')
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), '/* nothing yet */\n')
  fs.writeFileSync(path.join(site, 'froam', 'froam.runtime.js'), '/* runtime */\n')
  fs.writeFileSync(path.join(site, 'froam', 'froam.rooms.json'), '{}\n')
  fs.writeFileSync(path.join(site, '.gitignore'), 'froam/froam.rooms.json\n')
  git(site, 'init', '--quiet', '--initial-branch=main')
  git(site, 'config', 'user.name', 'Tester')
  git(site, 'config', 'user.email', 'tester@example.com')
  git(site, 'remote', 'add', 'origin', remote)
  git(site, 'add', '.')
  git(site, ...gitIdentity, 'commit', '--quiet', '-m', 'first')
  git(site, 'push', '--quiet', '-u', 'origin', 'main')
  fs.writeFileSync(path.join(site, 'froam.config.json'), JSON.stringify({ siteUrl: `https://${name}.example` }, null, 2))
  git(site, 'add', 'froam.config.json')
  git(site, ...gitIdentity, 'commit', '--quiet', '-m', 'config')
  git(site, 'push', '--quiet')
  return { site, remote }
}

/** The host: serves what `main` holds in the bare repo, but only `lag` reads after a push lands. */
function hostFor(remote, { lag = 2 } = {}) {
  let seenHead = null
  let reads = 0
  return async (url) => {
    const head = git(remote, 'rev-parse', 'main')
    if (head !== seenHead) { seenHead = head; reads = 0 }
    reads += 1
    const ref = reads > lag ? 'main' : 'main~1'
    const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '') || 'index.html'
    try {
      const body = execFileSync('git', ['show', `${ref}:${rel}`], { cwd: remote, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      return new Response(body, { status: 200 })
    } catch {
      return new Response('not found', { status: 404 })
    }
  }
}

async function finished(live) {
  for (let i = 0; i < 400; i += 1) {
    const job = live.job()
    if (job?.done) return job
    await sleep(25)
  }
  throw new Error(`still going: ${JSON.stringify(live.job())}`)
}

const tests = []
const test = (name, run) => tests.push([name, run])

test('git: commits only what Froam wrote, pushes it, and says live only once the site serves it', async () => {
  const { site, remote } = newRepo('shop')
  // Someone's own work in progress, which must stay out of the commit.
  fs.writeFileSync(path.join(site, 'app.js'), 'console.log("half done")\n')
  fs.writeFileSync(path.join(site, 'notes.txt'), 'todo\n')
  // What Froam saved: styles, and copy written into the page.
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'h1 { color: tomato !important; }\n')
  fs.writeFileSync(path.join(site, 'index.html'), fs.readFileSync(path.join(site, 'index.html'), 'utf8').replace('Old words', 'Fresh bread daily'))
  fs.writeFileSync(path.join(site, 'froam', 'froam.rooms.json'), '{"chat":"private"}\n')
  const events = []
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote), checkEveryMs: 10, checkForMs: 5000, progress: (job) => events.push(job.step) })
  live.recordSave('/')
  live.recordSource([path.join(site, 'index.html')], ['Fresh bread daily'])

  const plan = await live.plan()
  assert.equal(plan.mode, 'git')
  assert.equal(plan.blocked, null)
  assert.deepEqual(plan.files.map((file) => file.path).sort(), ['froam/froam.generated.css', 'index.html'])
  assert.equal(plan.others, 2, 'app.js and notes.txt are counted as left out')
  assert.equal(plan.where.branch, 'main')
  assert.equal(plan.where.production, true)
  assert.equal(plan.where.url, 'https://shop.example')
  assert.equal(plan.canCheck, true)
  assert.ok(!JSON.stringify(plan).includes(base), 'the plan the editor sees carries no absolute paths')

  const started = await live.start(plan.token)
  assert.equal(started.ok, true, started.error)
  const job = await finished(live)
  assert.equal(job.ok, true, job.message)
  assert.equal(job.outcome, 'live', job.message)
  assert.ok(events.includes('commit') && events.includes('push') && events.includes('check'), `steps: ${events.join(' → ')}`)

  const pushed = git(remote, 'show', '--name-only', '--format=%s', 'main').split('\n').filter(Boolean)
  assert.equal(pushed[0], 'Froam: edit /')
  assert.deepEqual(pushed.slice(1).sort(), ['froam/froam.generated.css', 'index.html'])
  const left = git(site, 'status', '--porcelain')
  assert.match(left, /^ ?M app\.js$/m)
  assert.match(left, /\?\? notes\.txt/)
  assert.doesNotMatch(git(remote, 'show', 'main:froam/froam.generated.css'), /nothing yet/)
})

test('git: a plan that changed since it was shown is refused', async () => {
  const { site, remote } = newRepo('bakery')
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote), checkEveryMs: 10, checkForMs: 2000 })
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'p { margin: 0 }\n')
  const shown = await live.plan()
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'p { margin: 4px }\n')
  const refused = await live.start(shown.token)
  assert.equal(refused.ok, false)
  assert.equal(refused.status, 409)
  assert.equal(git(remote, 'rev-list', '--count', 'main'), '2', 'nothing was pushed')
})

test('git: never pushes over newer commits on the remote — it asks for a pull', async () => {
  const { site, remote } = newRepo('florist')
  const other = path.join(base, 'florist-teammate')
  git(base, 'clone', '--quiet', remote, other)
  fs.writeFileSync(path.join(other, 'README.md'), 'teammate\n')
  git(other, 'add', '.')
  git(other, ...gitIdentity, 'commit', '--quiet', '-m', 'teammate work')
  git(other, 'push', '--quiet')
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'a { color: red }\n')
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote) })
  const plan = await live.plan()
  assert.equal(plan.behind, 1)
  assert.match(plan.blocked, /git pull/)
  const refused = await live.start(plan.token)
  assert.equal(refused.ok, false)
  assert.equal(git(remote, 'log', '-1', '--format=%s', 'main'), 'teammate work')
})

test('git: earlier commits that would go along are named', async () => {
  const { site, remote } = newRepo('cafe')
  fs.writeFileSync(path.join(site, 'app.js'), 'console.log(2)\n')
  git(site, ...gitIdentity, 'commit', '--quiet', '-am', 'my own fix')
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote) })
  const plan = await live.plan()
  assert.deepEqual(plan.earlier.map((commit) => commit.subject), ['my own fix'])
  assert.deepEqual(plan.files, [])
  assert.equal(plan.blocked, null, 'pushing the earlier commit alone is still allowed')
})

test('git: without a site address it says pushed, not live', async () => {
  const { site, remote } = newRepo('gym')
  fs.rmSync(path.join(site, 'froam.config.json'))
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote) })
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'b { font-weight: 800 }\n')
  const plan = await live.plan()
  assert.equal(plan.canCheck, false)
  await live.start(plan.token)
  const job = await finished(live)
  assert.equal(job.outcome, 'pushed')
  assert.match(job.message, /address/)
  assert.throws(() => live.setSiteUrl('not a url'), /web address/)
  assert.equal(live.setSiteUrl('https://gym.example/'), 'https://gym.example')
})

test('no remote, and no host set up: blocked with what to do', async () => {
  const site = path.join(base, 'lonely')
  fs.mkdirSync(path.join(site, 'froam'), { recursive: true })
  fs.writeFileSync(path.join(site, 'index.html'), '<h1>hi</h1>')
  git(site, 'init', '--quiet')
  const plan = await createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site }).plan()
  assert.match(plan.blocked, /isn't connected/)
  const bare = path.join(base, 'bare-folder')
  fs.mkdirSync(path.join(bare, 'froam'), { recursive: true })
  fs.writeFileSync(path.join(bare, 'index.html'), '<h1>hi</h1>')
  const loose = await createGoLive({ froamDir: path.join(bare, 'froam'), serveDir: bare, sourceRoot: bare, staticSite: true }).plan()
  assert.match(loose.blocked, /froam publish/)
})

test('publish: a plain HTML site goes to Cloudflare and is checked live; then there is nothing new', async () => {
  const site = path.join(base, 'kiln')
  const hosted = path.join(base, 'kiln-hosted')
  fs.mkdirSync(path.join(site, 'froam'), { recursive: true })
  fs.writeFileSync(path.join(site, 'index.html'), '<html><head><link rel="stylesheet" href="froam/froam.generated.css"><script src="froam/froam.runtime.js"></script></head><body><h1>Pots</h1></body></html>')
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'h1{color:teal}')
  fs.writeFileSync(path.join(site, 'froam', 'froam.runtime.js'), '/* rt */')
  fs.writeFileSync(path.join(site, 'froam.config.json'), JSON.stringify({ publish: { to: 'cloudflare', project: 'kiln' } }))
  // Stands in for npx wrangler: "deploying" copies the folder where the host serves it.
  const stub = path.join(base, 'wrangler-stub.mjs')
  fs.writeFileSync(stub, `
import fs from 'node:fs'
const args = process.argv.slice(2)
const said = args.join(' ')
if (said === 'wrangler whoami') console.log('You are logged in with an OAuth Token.')
else if (said.startsWith('wrangler pages project create')) console.log('already exists')
else if (said.startsWith('wrangler pages deploy')) { fs.cpSync(args[3], ${JSON.stringify(hosted)}, { recursive: true }); console.log('Deployment complete! https://1a2b.kiln.pages.dev') }
else { console.error('unexpected: ' + said); process.exit(1) }
`)
  process.env.FROAM_NPX = `"${process.execPath}" "${stub}"`
  const fetchImpl = async (url) => {
    const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '') || 'index.html'
    const file = path.join(hosted, rel)
    // Cloudflare adds its own script to pages; the check must see past it.
    if (!fs.existsSync(file)) return new Response('', { status: 404 })
    const body = fs.readFileSync(file, 'utf8')
    return new Response(rel.endsWith('.html') ? body.replace('</body>', '<script>/* beacon */</script></body>') : body, { status: 200 })
  }
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, staticSite: true, fetchImpl, checkEveryMs: 10, checkForMs: 3000, log: () => {} })
  const plan = await live.plan()
  assert.equal(plan.mode, 'publish')
  assert.equal(plan.where.host, 'Cloudflare Pages')
  assert.ok(plan.files.some((file) => file.path === 'index.html'))
  assert.ok(!plan.files.some((file) => /rooms|design\.json/.test(file.path)), 'private files are never uploaded')
  await live.start(plan.token)
  const job = await finished(live)
  assert.equal(job.outcome, 'live', job.message)
  assert.equal(job.url, 'https://kiln.pages.dev')
  assert.equal(JSON.parse(fs.readFileSync(path.join(site, 'froam.config.json'), 'utf8')).publish.url, 'https://kiln.pages.dev')
  const again = await live.plan()
  assert.match(again.blocked, /already has everything/)
  delete process.env.FROAM_NPX
})

test('git: a branch the remote has never had — counted right, called new, not "offline", and the other remote named', async () => {
  const { site, remote } = newRepo('runner')
  git(site, 'checkout', '--quiet', '-b', 'feat/redesign')
  for (let i = 1; i <= 25; i += 1) {
    fs.writeFileSync(path.join(site, 'app.js'), `console.log('step ${i}')\n`)
    git(site, ...gitIdentity, 'commit', '--quiet', '-am', `step ${i}`)
  }
  git(site, 'remote', 'add', 'deploy', path.join(base, 'runner-deploy.git'))
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'em { color: teal }\n')
  const plan = await createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote) }).plan()
  assert.equal(plan.earlierCount, 25)
  assert.equal(plan.earlier[0].subject, 'step 25')
  assert.equal(plan.where.newBranch, true)
  assert.equal(plan.offline, false, 'a missing branch read as being offline')
  assert.equal(plan.where.production, false)
  assert.deepEqual(plan.where.remotes.map((other) => other.name).sort(), ['deploy', 'origin'])
  assert.equal(plan.where.remote, 'origin')
  // No upstream for this branch, two remotes, nothing says which a host builds from: ask, don't guess.
  assert.equal(plan.where.needsChoice, true)
})

/* ─── GitHub: what the host says about a push ─── */

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Stands in for api.github.com: repos by "owner/name", each with what a host would have reported. */
function githubStub(repos, calls = []) {
  return async (url, init) => {
    calls.push({ url, auth: init?.headers?.Authorization ?? null })
    const u = new URL(url)
    const match = /^\/repos\/([^/]+)\/([^/]+)(.*)$/.exec(u.pathname)
    const repo = match && repos[`${match[1]}/${match[2]}`]
    if (!repo) return json({ message: 'Not Found' }, 404)
    const rest = match[3]
    if (rest === '') return json(repo.about ?? { homepage: null, default_branch: 'main' })
    if (rest === '/deployments') {
      const sha = u.searchParams.get('sha')
      return json(sha ? (repo.forSha?.(sha) ?? []) : (repo.deployments ?? []))
    }
    const statuses = /^\/deployments\/(\d+)\/statuses$/.exec(rest)
    if (statuses) return json(repo.statuses?.(Number(statuses[1])) ?? [])
    const commit = /^\/commits\/([^/]+)\/status$/.exec(rest)
    if (commit) return json(repo.commitStatus?.(commit[1]) ?? { statuses: [] })
    return json({ message: 'Not Found' }, 404)
  }
}

/** A repo whose origin says github.com/acme/<name>, while git really pushes to the bare repo beside it. */
function newGitHubRepo(name) {
  const made = newRepo(name)
  git(made.site, 'remote', 'set-url', 'origin', `https://github.com/acme/${name}.git`)
  git(made.site, 'config', `url.${made.remote}.insteadOf`, `https://github.com/acme/${name}.git`)
  fs.rmSync(path.join(made.site, 'froam.config.json'))
  git(made.site, 'commit', '--quiet', '-am', 'no address on file')
  git(made.site, 'push', '--quiet')
  return made
}

test('helpers: GitHub remotes are recognised however they are spelled', async () => {
  const { githubRepoOf } = await import('../lib/github-deploys.mjs')
  for (const url of ['https://github.com/acme/site.git', 'https://token@github.com/acme/site', 'git@github.com:acme/site.git', 'ssh://git@github.com/acme/site.git']) {
    assert.deepEqual(githubRepoOf(url), { owner: 'acme', repo: 'site' }, url)
  }
  assert.equal(githubRepoOf('https://gitlab.com/acme/site.git'), null)
})

test('site address: read from what the project already says, never a placeholder', async () => {
  const { findSiteAddress } = await import('../lib/site-address.mjs')
  const dir = path.join(base, 'addresses')
  const at = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text) }
  fs.mkdirSync(dir, { recursive: true })
  assert.equal(findSiteAddress({ top: dir }), null)
  at('index.html', '<link rel="canonical" href="http://localhost:3000/">')
  assert.equal(findSiteAddress({ top: dir }), null, 'localhost is not the site')
  at('index.html', '<head><meta property="og:url" content="https://bakery.ng/menu"></head>')
  assert.deepEqual(findSiteAddress({ top: dir }), { url: 'https://bakery.ng', source: 'the page\'s og:url' })
  at('public/robots.txt', 'User-agent: *\nSitemap: https://www.bakery.ng/sitemap.xml\n')
  fs.rmSync(path.join(dir, 'index.html'))
  assert.equal(findSiteAddress({ top: dir }).url, 'https://www.bakery.ng')
  at('astro.config.mjs', "export default defineConfig({ site: 'https://astro.bakery.ng' })")
  assert.equal(findSiteAddress({ top: dir }).url, 'https://astro.bakery.ng')
  at('package.json', JSON.stringify({ homepage: 'https://pkg.bakery.ng' }))
  assert.equal(findSiteAddress({ top: dir }).url, 'https://pkg.bakery.ng')
  at('public/CNAME', 'www.bakery.ng\n')
  assert.deepEqual(findSiteAddress({ top: dir }), { url: 'https://www.bakery.ng', source: 'the CNAME file' })
})

test('GitHub: the host, its branch and the site address are known before anything is sent; then "Live" is the host\'s word', async () => {
  const { site, remote } = newGitHubRepo('ghshop')
  let polls = 0
  const calls = []
  const github = githubStub({
    'acme/ghshop': {
      about: { homepage: 'https://ghshop.example', default_branch: 'main' },
      deployments: [{ id: 1, environment: 'Production', production_environment: true, ref: 'main', creator: { login: 'vercel[bot]' } }],
      statuses: (id) => (id === 1 ? [{ state: 'success', environment_url: 'https://ghshop-1a2b.vercel.app' }] : [{ state: polls++ < 2 ? 'in_progress' : 'success', environment_url: 'https://ghshop-9z8y.vercel.app' }]),
      forSha: () => [{ id: 2, environment: 'Production', production_environment: true, ref: 'main', creator: { login: 'vercel[bot]' } }],
    },
  }, calls)
  const steps = []
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote, { lag: 0 }), checkEveryMs: 10, checkForMs: 3000, github: { fetchImpl: github, token: 'test-token' }, deployTiming: { everyMs: 5, firstSignMs: 500, timeoutMs: 3000 }, progress: (job) => steps.push(job.message) })
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'h2 { letter-spacing: 0 }\n')
  const plan = await live.plan()
  assert.equal(plan.where.host, 'Vercel')
  assert.equal(plan.where.hostReported, true)
  assert.equal(plan.where.url, 'https://ghshop.example')
  assert.equal(plan.where.urlSource, 'the repo\'s website on GitHub')
  assert.equal(plan.where.production, true)
  assert.equal(plan.where.github.reachable, true)
  assert.ok(!JSON.stringify(plan).includes('test-token'), 'the token reached the plan')
  assert.ok(calls.every((call) => call.url.startsWith('https://api.github.com/') && call.auth === 'Bearer test-token'), 'the token went somewhere other than api.github.com')

  await live.start(plan.token)
  const job = await finished(live)
  assert.equal(job.outcome, 'live', job.message)
  assert.match(job.message, /Vercel finished/)
  assert.equal(job.url, 'https://ghshop.example')
  assert.ok(steps.some((message) => /Vercel is building it/.test(message)), `no building step: ${steps.join(' / ')}`)
})

test('GitHub: a failed build is said plainly, with its log, and is not called live', async () => {
  const { site, remote } = newGitHubRepo('ghfail')
  const github = githubStub({
    'acme/ghfail': {
      deployments: [],
      forSha: () => [{ id: 7, environment: 'Production', production_environment: true, creator: { login: 'netlify[bot]' } }],
      statuses: () => [{ state: 'failure', log_url: 'https://app.netlify.com/sites/ghfail/deploys/7' }],
    },
  })
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote), github: { fetchImpl: github, token: null }, deployTiming: { everyMs: 5, firstSignMs: 500, timeoutMs: 2000 } })
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'h3 { margin: 0 }\n')
  await live.start((await live.plan()).token)
  const job = await finished(live)
  assert.equal(job.ok, false)
  assert.equal(job.outcome, 'failed')
  assert.match(job.message, /Netlify couldn't build it/)
  assert.equal(job.url, 'https://app.netlify.com/sites/ghfail/deploys/7')
  assert.equal(job.linkLabel, 'Open the build log')
})

test('GitHub: of two remotes, the one a host deploys from is picked — and a remote picked by hand is remembered', async () => {
  const { site, remote } = newGitHubRepo('twin')
  const deployRemote = path.join(base, 'twin-web.git')
  git(base, 'init', '--quiet', '--bare', '--initial-branch=main', deployRemote)
  git(site, 'remote', 'add', 'web', 'https://github.com/acme/twin-web.git')
  git(site, 'config', `url.${deployRemote}.insteadOf`, 'https://github.com/acme/twin-web.git')
  git(site, 'push', '--quiet', 'web', 'main')
  git(site, 'checkout', '--quiet', '-b', 'feat/new-look')
  const github = githubStub({
    'acme/twin': { deployments: [] },
    'acme/twin-web': { deployments: [{ id: 3, environment: 'Production', ref: 'main', creator: { login: 'vercel[bot]' } }], statuses: () => [{ state: 'success', environment_url: 'https://twin.vercel.app' }] },
  })
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote), github: { fetchImpl: github, token: null }, deployTiming: { everyMs: 5, firstSignMs: 50, timeoutMs: 500 }, checkEveryMs: 10, checkForMs: 300 })
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'p { color: plum }\n')
  const plan = await live.plan()
  assert.equal(plan.where.remote, 'web', 'the remote Vercel deploys from was not picked')
  assert.equal(plan.where.chosenBy, 'host')
  assert.equal(plan.where.needsChoice, false)
  assert.deepEqual(plan.where.remotes.find((entry) => entry.name === 'web').deploys, 'Vercel')
  assert.equal(plan.where.production, false, 'feat/new-look is not what Vercel builds the site from')

  // The person picks origin instead; once sent there, Go Live remembers it.
  const picked = await live.plan({ remote: 'origin' })
  assert.equal(picked.where.remote, 'origin')
  assert.equal(picked.where.chosenBy, 'you')
  await live.start(picked.token, { remote: 'origin' })
  await finished(live)
  assert.equal(JSON.parse(fs.readFileSync(path.join(site, 'froam.config.json'), 'utf8')).goLive.remote, 'origin')
  assert.equal((await live.plan()).where.chosenBy, 'saved')
})

test('GitHub: a private repo with no sign-in still goes live — and says why it can\'t follow the deploy', async () => {
  const { site, remote } = newGitHubRepo('secret')
  const live = createGoLive({ froamDir: path.join(site, 'froam'), sourceRoot: site, serveDir: site, fetchImpl: hostFor(remote), github: { fetchImpl: githubStub({}), token: null } })
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), 'li { list-style: none }\n')
  const plan = await live.plan()
  assert.equal(plan.where.github.reachable, false)
  assert.match(plan.where.github.reason, /private/)
  assert.equal(plan.blocked, null)
})


/* ─── the Froam folder the site actually loads ─── */

/** A monorepo shaped like Run'Am: an app wired with the Vite plugin, and a stray froam/ at the root. */
function newMonorepo(name) {
  const root = path.join(base, name)
  const app = path.join(root, 'apps', 'web')
  const write = (rel, text) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text) }
  write('package.json', JSON.stringify({ name, private: true, workspaces: ['apps/*'] }))
  write('apps/web/package.json', JSON.stringify({ name: 'web', private: true }))
  write('apps/web/vite.config.ts', "import froamStudio from '@ahmadastic/froam/vite'\nexport default { plugins: [froamStudio()] }\n")
  write('apps/web/src/froam/froam.design.json', '{"version":3,"routes":{}}\n')
  write('apps/web/src/froam/index.ts', "import './froam.generated.css'\nimport design from './froam.design.json'\nexport default design\n")
  write('apps/web/src/components/LiveDesign.tsx', "import design from '../froam'\nexport default design\n")
  write('froam/froam.design.json', '{"version":3,"routes":{}}\n')
  write('froam/froam.generated.css', '/* stray */\n')
  write('froam/froam.runtime.js', '/* stray */\n')
  return { root, app }
}

test('workspace: in a monorepo, the folder the app loads is found, and a stray one is known for what it is', async () => {
  const { findLoadedWorkspaces, workspaceIsLoaded } = await import('../lib/workspace-finder.mjs')
  const { root, app } = newMonorepo('mono')
  const wired = fs.realpathSync.native(path.join(app, 'src', 'froam'))
  assert.deepEqual(findLoadedWorkspaces(root), [wired])
  assert.equal(workspaceIsLoaded(path.join(root, 'froam'), root), false)
  // A plain page linking the stylesheet loads its folder; so does a public copy (shipDir).
  const page = path.join(base, 'page-site')
  fs.mkdirSync(path.join(page, 'froam'), { recursive: true })
  fs.writeFileSync(path.join(page, 'index.html'), '<link rel="stylesheet" href="froam/froam.generated.css">')
  assert.equal(workspaceIsLoaded(path.join(page, 'froam'), page), true)
  const shipped = path.join(base, 'shipped-site')
  fs.mkdirSync(path.join(shipped, 'froam'), { recursive: true })
  fs.mkdirSync(path.join(shipped, 'app'), { recursive: true })
  fs.writeFileSync(path.join(shipped, 'froam.config.json'), JSON.stringify({ dir: 'froam', shipDir: 'public/froam' }))
  fs.writeFileSync(path.join(shipped, 'app', 'layout.tsx'), '<link rel="stylesheet" href="/froam/froam.generated.css" />')
  assert.equal(workspaceIsLoaded(path.join(shipped, 'froam'), shipped), true)
})

test('workspace: froam dev on a monorepo saves where the app reads, not into a stray folder at the root', async () => {
  const { resolveSafeWorkspaceDir } = await import('../lib/launcher.mjs')
  const { root, app } = newMonorepo('mono-dev')
  const chosen = resolveSafeWorkspaceDir({ targetUrl: 'http://localhost:3000', cwd: root, create: false })
  assert.equal(fs.realpathSync.native(chosen), fs.realpathSync.native(path.join(app, 'src', 'froam')))
})

test('Go Live: warns before sending edits from a folder the site never loads, and before a big file', async () => {
  const { root } = newMonorepo('mono-live')
  const bare = path.join(base, 'mono-live.git')
  git(base, 'init', '--quiet', '--bare', '--initial-branch=main', bare)
  git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'config', 'user.name', 'Tester')
  git(root, 'config', 'user.email', 'tester@example.com')
  git(root, 'remote', 'add', 'origin', bare)
  git(root, 'add', '.')
  git(root, 'commit', '--quiet', '-m', 'first')
  git(root, 'push', '--quiet', '-u', 'origin', 'main')
  // Saved into the stray root folder, with a 6 MB picture.
  fs.writeFileSync(path.join(root, 'froam', 'froam.generated.css'), 'h1 { color: red }\n')
  fs.mkdirSync(path.join(root, 'froam', 'media'), { recursive: true })
  const gif = path.join(root, 'froam', 'media', 'hero.gif')
  fs.writeFileSync(gif, '')
  fs.truncateSync(gif, 6 * 1024 * 1024)
  const plan = await createGoLive({ froamDir: path.join(root, 'froam'), sourceRoot: root }).plan()
  assert.equal(plan.blocked, null)
  assert.ok(plan.warnings.some((warning) => /doesn't load this Froam folder \(froam\): it loads apps\/web\/src\/froam/.test(warning)), `no stray-folder warning: ${plan.warnings.join(' | ')}`)
  assert.ok(plan.warnings.some((warning) => /hero\.gif is 6\.0 MB/.test(warning)), `no big-file warning: ${plan.warnings.join(' | ')}`)
  // The wired folder gets neither.
  fs.writeFileSync(path.join(root, 'apps', 'web', 'src', 'froam', 'froam.generated.css'), 'h1 { color: blue }\n')
  const wired = await createGoLive({ froamDir: path.join(root, 'apps', 'web', 'src', 'froam'), sourceRoot: path.join(root, 'apps', 'web') }).plan()
  assert.ok(!wired.warnings.some((warning) => /doesn't load|Nothing in your site loads/.test(warning)), `the wired folder was warned about: ${wired.warnings.join(' | ')}`)
})


test('helpers: remotes are named without credentials; public folders map to site paths', () => {
  assert.equal(describeRemote('https://x-access-token:secret@github.com/you/site.git'), 'github.com/you/site')
  assert.equal(describeRemote('git@github.com:you/site.git'), 'github.com/you/site')
  const top = path.join(base, 'repo')
  assert.equal(servedPath(path.join(top, 'public', 'froam', 'froam.generated.css'), { top }), '/froam/froam.generated.css')
  assert.equal(servedPath(path.join(top, 'src', 'froam', 'froam.generated.css'), { top }), null)
})

let failed = 0
for (const [name, run] of tests) {
  try {
    await run()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}
try { fs.rmSync(base, { recursive: true, force: true }) } catch { /* Windows may hold a file */ }
console.log(`go live: ${tests.length - failed}/${tests.length} passed`)
process.exitCode = failed ? 1 : 0
