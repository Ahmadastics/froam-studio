/**
 * `froam init` against the stacks it wires: that it installs the package
 * before pointing a Vite config at it, leaves the config alone when it can't,
 * prints a mount snippet in the project's own language, and wires the two
 * shipping tags to a public copy that every save keeps current.
 *
 * Offline: the "package" init installs is a stub folder (FROAM_INSTALL_SPEC),
 * and so is the project's vite.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { emptyDesign, findShipDir, writeArtifacts } from '../lib/codegen.mjs'
import { createGitHubCommitter } from '../lib/github-committer.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CLI = path.join(ROOT, 'bin', 'froam.mjs')
const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'froam-test-init-'))

const stub = (name, pkg) => {
  const dir = path.join(base, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg))
  return dir
}
stub('stub-froam', { name: '@ahmadastic/froam', version: '0.0.0-test' })
stub('stub-vite', { name: 'vite', version: '0.0.0-test' })

let count = 0
function project(files) {
  const dir = path.join(base, `p${count += 1}`)
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), typeof content === 'string' ? content : JSON.stringify(content))
  }
  return dir
}

function init(dir, args = [], spec = 'file:../stub-froam') {
  const res = spawnSync(process.execPath, [CLI, 'init', ...args], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, NO_COLOR: '1', FROAM_INSTALL_SPEC: spec, npm_config_offline: 'true', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' },
  })
  return { code: res.status, out: `${res.stdout}${res.stderr}` }
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8')
const json = (dir, rel) => JSON.parse(read(dir, rel))
const viteProject = (extra = {}) => project({
  'package.json': { name: 'site', devDependencies: { vite: 'file:../stub-vite' } },
  'vite.config.js': "import { defineConfig } from 'vite'\nexport default defineConfig({ plugins: [] })\n",
  'index.html': '<!doctype html>\n<html>\n  <head>\n    <title>Site</title>\n  </head>\n  <body></body>\n</html>\n',
  ...extra,
})

const tests = []
const test = (name, run) => tests.push([name, run])

test('Vite: installs the package, then wires the config, the tags and the public copy', () => {
  const dir = viteProject()
  const { code, out } = init(dir)
  assert.equal(code, 0, out)
  assert.ok(fs.existsSync(path.join(dir, 'node_modules/@ahmadastic/froam/package.json')), 'package installed')
  assert.ok(json(dir, 'package.json').devDependencies['@ahmadastic/froam'], 'saved as a devDependency')
  assert.match(read(dir, 'vite.config.js'), /plugins: \[froamStudio\(\{ dir: 'froam' \}\)\]/)
  assert.match(read(dir, 'index.html'), /<link rel="stylesheet" href="\/froam\/froam.generated.css">\n\s+<script src="\/froam\/froam.runtime.js" defer><\/script>\n\s+<\/head>/)
  for (const f of ['froam.generated.css', 'froam.runtime.js']) assert.ok(fs.existsSync(path.join(dir, 'public/froam', f)), `public/froam/${f}`)
  assert.equal(json(dir, 'froam.config.json').shipDir, 'public/froam')
  assert.match(out, /Nothing more to do/)
  assert.match(out, /dev --app http:\/\/localhost:5173/)
})

test('Vite: a failed install leaves the config alone and says what to run', () => {
  const dir = viteProject()
  const before = read(dir, 'vite.config.js')
  const { code, out } = init(dir, [], 'file:../no-such-package')
  assert.equal(code, 1, out)
  assert.equal(read(dir, 'vite.config.js'), before, 'config untouched')
  assert.match(out, /could not install @ahmadastic\/froam/)
  assert.match(out, /1\. npm install --save-dev file:\.\.\/no-such-package/)
})

test('Vite: --no-install wires the config and puts the install first in the steps', () => {
  const dir = viteProject()
  const { code, out } = init(dir, ['--no-install'])
  assert.equal(code, 0, out)
  assert.ok(!fs.existsSync(path.join(dir, 'node_modules')), 'nothing installed')
  assert.match(read(dir, 'vite.config.js'), /froamStudio/)
  assert.match(out, /1\. npm install --save-dev \S+ — before your dev server starts/)
})

test('Vite + Vue: named as such, and the port comes from the dev script', () => {
  const dir = viteProject({ 'package.json': { name: 'site', scripts: { dev: 'vite --port 5199' }, dependencies: { vue: '3' }, devDependencies: { vite: 'file:../stub-vite' } } })
  const { out } = init(dir, ['--no-install'])
  assert.match(out, /detected Vite \+ Vue/)
  assert.match(out, /dev --app http:\/\/localhost:5199/)
})

test('Vite + React in JavaScript: a dependency, index.js glue, a snippet with no types', () => {
  const dir = viteProject({
    'package.json': { name: 'site', dependencies: { react: '19' }, devDependencies: { vite: 'file:../stub-vite' } },
    'src/main.jsx': '',
  })
  const { code, out } = init(dir)
  assert.equal(code, 0, out)
  assert.ok(json(dir, 'package.json').dependencies['@ahmadastic/froam'], 'the runtime ships, so it is a dependency')
  assert.ok(fs.existsSync(path.join(dir, 'src/froam/index.js')) && !fs.existsSync(path.join(dir, 'src/froam/index.ts')))
  assert.match(out, /import \{ FroamGate, FroamRuntime \} from '@ahmadastic\/froam'/)
  assert.doesNotMatch(out, /FroamLocalDesign/)
  assert.match(out, /design=\{froamDesign\}/)
})

test('Vite + React in TypeScript: index.ts glue and the typed snippet', () => {
  const dir = viteProject({
    'package.json': { name: 'site', dependencies: { react: '19' }, devDependencies: { vite: 'file:../stub-vite' } },
    'tsconfig.json': '{}',
    'src/main.tsx': '',
  })
  const { out } = init(dir, ['--no-install'])
  assert.ok(fs.existsSync(path.join(dir, 'src/froam/index.ts')))
  assert.match(out, /type FroamLocalDesign/)
  assert.match(out, /\(src\/main\.tsx\)/)
})

test('Next.js: a root layout with no <head> gets one, in JSX', () => {
  const dir = project({
    'package.json': { name: 'site', dependencies: { next: '16', react: '19' } },
    'app/layout.jsx': 'export default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n',
  })
  const { code, out } = init(dir)
  assert.equal(code, 0, out)
  const layout = read(dir, 'app/layout.jsx')
  assert.match(layout, /<html lang="en">\n\s+<head>\n\s+<link rel="stylesheet" href="\/froam\/froam.generated.css" \/>\n\s+<script src="\/froam\/froam.runtime.js" defer><\/script>\n\s+<\/head>\n\s+<body>/)
  assert.ok(fs.existsSync(path.join(dir, 'public/froam/froam.runtime.js')))
  assert.match(out, /dev --app http:\/\/localhost:3000/)
})

test('Astro: every head gets the tags; a page backup is kept out of routing', () => {
  const dir = project({
    'package.json': { name: 'site', dependencies: { astro: '7' } },
    'src/pages/index.astro': '---\n---\n<html>\n  <head>\n    <title>A</title>\n  </head>\n  <body></body>\n</html>\n',
  })
  const { code, out } = init(dir)
  assert.equal(code, 0, out)
  assert.match(read(dir, 'src/pages/index.astro'), /<script is:inline src="\/froam\/froam.runtime.js" defer><\/script>/)
  assert.ok(fs.existsSync(path.join(dir, 'src/pages/_index.astro.bak')), 'backup prefixed with _')
  assert.match(out, /dev --app http:\/\/localhost:4321/)
})

test('init keeps the settings already in froam.config.json', () => {
  const dir = project({ 'index.html': '<html><head></head><body></body></html>', 'froam.config.json': { notify: { webhook: 'x' }, writeSource: false } })
  init(dir)
  const config = json(dir, 'froam.config.json')
  assert.deepEqual(config.notify, { webhook: 'x' })
  assert.equal(config.writeSource, false)
  assert.equal(config.framework, 'static')
})

test('every save refreshes the public copy, and only for the configured workspace', () => {
  const dir = project({ 'package.json': { name: 'site' }, 'froam.config.json': { dir: 'src/froam', shipDir: 'public/froam' } })
  const froamDir = path.join(dir, 'src/froam')
  fs.mkdirSync(froamDir, { recursive: true })
  assert.equal(findShipDir(froamDir), path.join(dir, 'public/froam'))
  const design = emptyDesign()
  design.routes['/'] = { desktop: { 'h1:1': { styles: { color: 'rgb(1, 2, 3)' } } } }
  writeArtifacts(froamDir, design)
  assert.equal(read(dir, 'public/froam/froam.generated.css'), read(dir, 'src/froam/froam.generated.css'))
  assert.match(read(dir, 'public/froam/froam.generated.css'), /rgb\(1, 2, 3\)/)
  assert.ok(!fs.existsSync(path.join(dir, 'public/froam/froam.design.json')), 'the design itself stays private')
  // Another workspace in the same project is not this config's.
  assert.equal(findShipDir(path.join(dir, 'other/froam')), null)
  // No shipDir, no copy.
  const plain = project({ 'package.json': { name: 'plain' }, 'froam.config.json': { dir: 'froam' } })
  assert.equal(findShipDir(path.join(plain, 'froam')), null)
})

test('a commit from the publish API updates the public copy too', async () => {
  const puts = []
  const fetchImpl = async (url, init = {}) => {
    if ((init.method ?? 'GET') === 'GET') return new Response('', { status: 404 })
    puts.push(new URL(url).pathname.replace('/repos/o/r/contents/', ''))
    return new Response(JSON.stringify({ commit: { sha: 'abc' } }), { status: 200 })
  }
  const commit = createGitHubCommitter({ token: 't', repo: 'o/r', dir: 'src/froam', shipDir: 'public/froam', fetchImpl })
  await commit({ design: emptyDesign() })
  assert.deepEqual(puts, [
    'src/froam/froam.design.json', 'src/froam/froam.generated.css', 'src/froam/froam.runtime.js',
    'public/froam/froam.generated.css', 'public/froam/froam.runtime.js',
  ])
})

let passed = 0
try {
  for (const [name, run] of tests) {
    try {
      await run()
      passed += 1
      process.stdout.write(`  ok   ${name}\n`)
    } catch (error) {
      process.stderr.write(`  FAIL ${name}\n${error.stack}\n`)
      process.exitCode = 1
      break
    }
  }
} finally {
  fs.rmSync(base, { recursive: true, force: true })
}
if (!process.exitCode) process.stdout.write(`\n${passed}/${tests.length} init tests passed\n`)
