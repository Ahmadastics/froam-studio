/**
 * `froam publish`: the clean copy it uploads, the hosts it hands it to, and
 * remembering the answer. The hosts' own tools are stood in for by a script
 * (FROAM_NPX) that answers the way wrangler and vercel do and records how it
 * was called, so this runs offline and never touches anyone's account.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { buildPublishFolder, findSiteUrl } from '../lib/publish.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CLI = path.join(ROOT, 'bin', 'froam.mjs')
const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'froam-test-publish-'))
const calls = path.join(base, 'calls.log')

// Stands in for `npx wrangler …` and `npx vercel …`.
const stub = path.join(base, 'host-tool.mjs')
fs.writeFileSync(stub, `
import fs from 'node:fs'
const args = process.argv.slice(2)
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n')
const said = args.join(' ')
if (said === 'wrangler whoami') console.log('You are logged in with an OAuth Token, associated with the email tester@example.com.')
else if (said.startsWith('wrangler pages project create')) console.log("Successfully created the '" + args[4] + "' project. It will be available at https://" + args[4] + "-9xk.pages.dev/ once you create your first deployment.")
else if (said.startsWith('wrangler pages deploy')) console.log('Uploaded 4 files\\nDeployment complete! Take a peek over at https://1a2b3c4d.' + args[5] + '-9xk.pages.dev')
else if (said === 'vercel whoami') console.log('tester')
else if (said.startsWith('vercel deploy')) { console.log('https://kiln-abc123-tester.vercel.app'); console.error('Aliased: https://kiln.vercel.app [2s]') }
else { console.error('unexpected: ' + said); process.exit(1) }
`)

function froam(args, cwd) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd, encoding: 'utf8', timeout: 60000, input: '',
    env: { ...process.env, NO_COLOR: '1', FROAM_NPX: `"${process.execPath}" "${stub}"` },
  })
  return { code: res.status, out: `${res.stdout}${res.stderr}` }
}
const readCalls = () => (fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [])

function newSite(name) {
  const made = froam(['new', name, '--kind', 'business', '--no-open'], base)
  assert.equal(made.code, 0, made.out)
  const dir = path.join(base, name)
  fs.mkdirSync(path.join(dir, 'froam', 'media'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'froam', 'media', `${'b'.repeat(32)}.webp`), 'img')
  fs.writeFileSync(path.join(dir, 'froam', 'froam.rooms.json'), '{}')
  fs.writeFileSync(path.join(dir, 'about.html'), '<h1>About</h1>')
  fs.writeFileSync(path.join(dir, 'index.html.bak'), 'old')
  return dir
}

const tests = []
const test = (name, run) => tests.push([name, run])

test('the upload holds the pages and what visitors load, never the editor’s files', () => {
  const dir = newSite('clean')
  const out = path.join(dir, '.froam', 'publish', 'clean')
  fs.mkdirSync(path.join(out, '.vercel'), { recursive: true })
  fs.writeFileSync(path.join(out, 'stale.html'), 'old upload')
  const { files, warnings } = buildPublishFolder(dir, out)
  assert.deepEqual([...files].sort(), ['about.html', 'froam/froam.generated.css', 'froam/froam.runtime.js', `froam/media/${'b'.repeat(32)}.webp`, 'index.html'])
  assert.deepEqual(warnings, [])
  assert.ok(fs.existsSync(path.join(out, '.vercel')), "a host's link folder survives")
  assert.ok(!fs.existsSync(path.join(out, 'stale.html')), 'the last upload is cleared')
})

test('a page that does not load Froam’s files is warned about', () => {
  const dir = path.join(base, 'plain')
  fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Plain</h1>')
  const { warnings } = buildPublishFolder(dir, path.join(dir, '.froam', 'publish', 'plain'))
  assert.match(warnings[0], /froam init/)
})

test('addresses are read the way each host prints them', () => {
  assert.equal(findSiteUrl('available at https://kiln-9xk.pages.dev/ once\nTake a peek over at https://1a2b.kiln-9xk.pages.dev', 'cloudflare'), 'https://kiln-9xk.pages.dev')
  // Publishing again names only the preview, which is that one deployment forever; the site is the address under it.
  assert.equal(findSiteUrl('Take a peek over at https://1a2b.kiln.pages.dev', 'cloudflare'), 'https://kiln.pages.dev')
  assert.equal(findSiteUrl('https://kiln-abc.vercel.app\nAliased: https://kiln.vercel.app [2s]', 'vercel'), 'https://kiln.vercel.app')
  assert.equal(findSiteUrl('nothing here', 'vercel'), null)
})

test('Cloudflare: creates the project, uploads the clean copy, prints the address and remembers', () => {
  fs.rmSync(calls, { force: true })
  const dir = newSite('kiln')
  const { code, out } = froam(['publish', '--to', 'cloudflare', '--no-open'], dir)
  assert.equal(code, 0, out)
  assert.match(out, /Your site is live: https:\/\/kiln-9xk\.pages\.dev/)
  const [whoami, create, deploy] = readCalls()
  assert.deepEqual(whoami, ['wrangler', 'whoami'])
  assert.deepEqual(create, ['wrangler', 'pages', 'project', 'create', 'kiln', '--production-branch', 'main'])
  assert.equal(deploy[2], 'deploy')
  assert.equal(path.resolve(deploy[3]), path.join(dir, '.froam', 'publish', 'kiln'))
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'froam.config.json'), 'utf8'))
  assert.deepEqual(config.publish, { to: 'cloudflare', project: 'kiln', url: 'https://kiln-9xk.pages.dev' })
  assert.equal(config.framework, 'static', 'the rest of the config is kept')
})

test('publishing again needs no answers: same host, same project', () => {
  fs.rmSync(calls, { force: true })
  const dir = path.join(base, 'kiln')
  const { code, out } = froam(['publish', '--no-open'], dir)
  assert.equal(code, 0, out)
  assert.ok(readCalls().some((args) => args[0] === 'wrangler' && args[2] === 'deploy'))
})

test('Vercel: deploys to production and reports the lasting address, not the preview', () => {
  fs.rmSync(calls, { force: true })
  const dir = newSite('kiln-v')
  const { code, out } = froam(['publish', '--to', 'vercel', '--no-open'], dir)
  assert.equal(code, 0, out)
  assert.match(out, /Your site is live: https:\/\/kiln\.vercel\.app/)
  const deploy = readCalls().find((args) => args[1] === 'deploy')
  // Vercel names the project after the folder it uploads, so the folder is named after the site.
  assert.equal(path.resolve(deploy[2]), path.join(dir, '.froam', 'publish', 'kiln-v'))
  assert.deepEqual(deploy.slice(3), ['--prod', '--yes'])
})

test('no terminal and no host chosen: the folder, and how to upload it', () => {
  const dir = newSite('folder-only')
  const { code, out } = froam(['publish', '--no-open'], dir)
  assert.equal(code, 0, out)
  assert.match(out, /Your site is in: .*folder-only/)
  assert.ok(fs.existsSync(path.join(dir, '.froam', 'publish', 'folder-only', 'index.html')))
})

test('a framework app is pointed at its usual deploy, not uploaded raw', () => {
  const dir = path.join(base, 'app')
  fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '15' } }))
  const { code, out } = froam(['publish', '--to', 'cloudflare'], dir)
  assert.equal(code, 1)
  assert.match(out, /plain HTML sites online, and this is a Next\.js/)
})

test('an unknown host is refused with the list', () => {
  const { code, out } = froam(['publish', '--to', 'ftp'], path.join(base, 'kiln'))
  assert.equal(code, 1)
  assert.match(out, /cloudflare, netlify, vercel, folder/)
})

let passed = 0
for (const [name, run] of tests) {
  try {
    await run()
    passed += 1
    process.stdout.write(`  ok   ${name}\n`)
  } catch (error) {
    process.stderr.write(`  FAIL ${name}\n${error.stack}\n`)
  }
}
fs.rmSync(base, { recursive: true, force: true })
process.stdout.write(`\npublish: ${passed}/${tests.length} passed\n`)
if (passed !== tests.length) process.exit(1)
