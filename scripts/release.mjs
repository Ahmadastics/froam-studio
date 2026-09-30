/**
 * One release, start to finish: `npm run release` (after the version bump and
 * commit). Run it yourself — it publishes with your npm login.
 *
 *   1. checks: a committed tree, a version not on npm yet, an npm login
 *   2. the live share checks (scripts/smoke-share-live.mjs)
 *   3. npm publish (which runs the whole test suite first)
 *   4. waits until npm actually serves the new version (it can take minutes —
 *      an E404 from `npm view` right after publishing means "not yet")
 *   5. clears jsDelivr's cache for the editor's files and checks each one
 *   6. pushes the branch and a v<version> tag
 *   7. updates the site's version label, deploys it, and checks it's live
 *
 * Flags: --dry-run (only the checks, nothing published, pushed or deployed),
 *        --skip-smoke, --skip-publish (already published), --no-push,
 *        --skip-site, --site <dir> (default ../froam-dev-site),
 *        --site-url <url> (default https://froam.vercel.app).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name, fallback) => { const at = args.indexOf(name); return at >= 0 && args[at + 1] ? args[at + 1] : fallback }
const DRY = flag('--dry-run')
const OWN = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const VERSION = OWN.version
const SITE = path.resolve(ROOT, option('--site', '../froam-dev-site'))
const SITE_URL = option('--site-url', 'https://froam.vercel.app').replace(/\/$/, '')
const CDN = `https://cdn.jsdelivr.net/npm/${OWN.name}@${VERSION}/dist/standalone`
const PURGE = `https://purge.jsdelivr.net/npm/${OWN.name}@${VERSION}/dist/standalone`

class Stop extends Error {}
const step = (text) => console.log(`\n▸ ${text}`)
const ok = (text) => console.log(`  ✓ ${text}`)
const stop = (text) => { throw new Stop(text) }
/** Before anything happens: a real run stops at the first problem, a dry run lists them all. */
const problems = []
const refuse = (text) => { if (!DRY) stop(text); console.log(`  ✗ ${text}`); problems.push(text) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** A command, shown as it runs. Windows needs a shell for npm; the arguments here are all ours. */
function run(command, cwd = ROOT, { capture = false } = {}) {
  const result = spawnSync(command, { cwd, shell: true, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8' })
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() }
}

async function registryHas(version) {
  const meta = await fetch(`https://registry.npmjs.org/${OWN.name.replace('/', '%2f')}`, { headers: { 'Cache-Control': 'no-cache' } }).then((r) => r.json()).catch(() => null)
  return Boolean(meta?.versions?.[version])
}

function editorFiles() {
  const base = path.join(ROOT, 'dist', 'standalone')
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(path.relative(base, full).split(path.sep).join('/'))
    }
  }
  walk(base)
  return out
}

async function release() {
console.log(`Releasing ${OWN.name}@${VERSION}${DRY ? ' — dry run: checks only' : ''}`)

step('Checks')
const dirty = run('git status --porcelain --untracked-files=no', ROOT, { capture: true }).out
if (dirty) refuse(`uncommitted changes — commit the release first (${dirty.split('\n').length} files)`)
else ok('everything is committed')
const branch = run('git rev-parse --abbrev-ref HEAD', ROOT, { capture: true }).out
ok(`on ${branch}`)
const published = await registryHas(VERSION)
if (published && !flag('--skip-publish')) refuse(`${VERSION} is already on npm — bump the version, or pass --skip-publish to finish its release`)
else ok(published ? `${VERSION} is on npm already (finishing its release)` : `${VERSION} isn't on npm yet`)
const who = run('npm whoami', ROOT, { capture: true })
if (!who.ok && !flag('--skip-publish')) refuse('not logged in to npm — run `npm login`, then this again')
else if (who.ok) ok(`npm login: ${who.out.split('\n').pop()}`)
if (!fs.existsSync(path.join(ROOT, 'dist', 'standalone'))) refuse('no dist/standalone — run `npm run build`')
if (!flag('--skip-site') && !fs.existsSync(path.join(SITE, 'package.json'))) refuse(`no site at ${SITE} — pass --site <dir> or --skip-site`)
else if (!flag('--skip-site')) ok(`site: ${SITE}`)

if (DRY) {
  console.log(problems.length ? `\n${problems.length} to fix before releasing.` : '\nReady to release.')
  console.log('Dry run: nothing published, pushed or deployed. Without --dry-run this would:')
  for (const line of [
    !flag('--skip-smoke') && 'run the live share checks',
    !flag('--skip-publish') && `npm publish ${OWN.name}@${VERSION}`,
    `wait for npm, then clear jsDelivr's cache for ${fs.existsSync(path.join(ROOT, 'dist', 'standalone')) ? editorFiles().length : 'the'} editor files`,
    !flag('--no-push') && `push ${branch} and tag v${VERSION}`,
    !flag('--skip-site') && `set the site's label to v${VERSION}, deploy ${SITE} and check ${SITE_URL}`,
  ].filter(Boolean)) console.log(`  · ${line}`)
  if (problems.length) process.exitCode = 1
  return
}

if (!flag('--skip-smoke')) {
  step('Live share checks')
  if (!run('node scripts/smoke-share-live.mjs').ok) stop('The live share checks failed — nothing was published')
}

if (!flag('--skip-publish')) {
  step(`npm publish (the full test suite runs first)`)
  if (!run('npm publish --access public').ok) stop('npm publish failed — see above. Nothing else was done.')
}

step('Waiting for npm to serve it')
let served = false
for (let i = 0; i < 60 && !served; i += 1) {
  served = await registryHas(VERSION)
  if (!served) await sleep(15_000)
}
if (!served) stop(`npm still doesn't list ${VERSION} after 15 minutes — check https://www.npmjs.com/package/${OWN.name}, then rerun with --skip-publish`)
ok(`${OWN.name}@${VERSION} is on npm`)

step("jsDelivr: clearing its cache and checking the editor's files")
const files = editorFiles()
const missing = []
for (const file of files) {
  await fetch(`${PURGE}/${file}`).catch(() => null)
  let status = 0
  for (let attempt = 0; attempt < 6 && status !== 200; attempt += 1) {
    status = await fetch(`${CDN}/${file}`, { method: 'HEAD' }).then((r) => r.status).catch(() => 0)
    if (status !== 200) await sleep(5_000)
  }
  if (status !== 200) missing.push(`${file} (${status})`)
}
if (missing.length) console.log(`  ! not served yet: ${missing.join(', ')} — share links fall back to your computer for these`)
else ok(`all ${files.length} files served`)

if (!flag('--no-push')) {
  step('Git: branch and tag')
  if (!run(`git push -u origin ${branch}`).ok) stop('git push failed')
  const tagged = run(`git rev-parse -q --verify refs/tags/v${VERSION}`, ROOT, { capture: true }).ok
  if (!tagged && !run(`git tag v${VERSION}`).ok) stop('git tag failed')
  if (!run(`git push origin v${VERSION}`).ok) stop('git push of the tag failed')
  ok(`${branch} and v${VERSION} pushed`)
}

if (!flag('--skip-site')) {
  step('The site')
  const demo = path.join(SITE, 'src', 'components', 'TerminalDemo.tsx')
  if (fs.existsSync(demo)) {
    const source = fs.readFileSync(demo, 'utf8')
    const next = source.replace(/ v\d+\.\d+\.\d+ · dev/, ` v${VERSION} · dev`)
    if (next !== source) { fs.writeFileSync(demo, next); ok(`version label set to v${VERSION}`) }
  }
  if (!run('npm run deploy', SITE).ok) stop('The site deploy failed — see above')
  let live = false
  for (let attempt = 0; attempt < 6 && !live; attempt += 1) {
    const html = await fetch(`${SITE_URL}/?v=${Date.now()}`).then((r) => r.text()).catch(() => '')
    for (const src of html.match(/\/assets\/[^"']+\.js/g) ?? []) {
      const js = await fetch(`${SITE_URL}${src}`).then((r) => r.text()).catch(() => '')
      if (js.includes(`v${VERSION} · dev`)) { live = true; break }
    }
    if (!live) await sleep(5_000)
  }
  if (live) ok(`${SITE_URL} shows v${VERSION}`)
  else console.log(`  ! deployed, but ${SITE_URL} doesn't show v${VERSION} yet — check it in a minute`)
}

console.log(`\nReleased ${OWN.name}@${VERSION}.`)
}

// No process.exit: on Windows, exiting while fetch still holds a socket crashes Node.
release().catch((error) => {
  console.error(`  ✗ ${error instanceof Stop ? error.message : error.stack}`)
  process.exitCode = 1
})
