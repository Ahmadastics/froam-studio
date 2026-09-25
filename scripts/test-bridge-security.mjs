/**
 * The local bridge writes the design every production page is generated
 * from, so it has to refuse the web at large. These run the real bridge and
 * attack it the way a hostile page in the developer's browser would: writes
 * from another origin, reads of the project, DNS rebinding, path traversal
 * and dotfiles through --serve, and an unbounded upload. And they check the
 * legitimate paths still work: the page's own origin, the app's dev server
 * on another localhost port, tools with no Origin at all, --allow-origin.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createBridgeServer } from '../lib/dev-server.mjs'
import { isAllowedHost, isAllowedOrigin, isLocalHostname } from '../lib/bridge-security.mjs'

const tests = []
const test = (name, fn) => tests.push([name, fn])

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-bridge-sec-'))
const site = path.join(work, 'site')
const froamDir = path.join(site, 'froam')
fs.mkdirSync(froamDir, { recursive: true })
fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html><head></head><body><h1>Hi</h1></body></html>')
fs.writeFileSync(path.join(site, '.env'), 'SECRET=hunter2')
fs.mkdirSync(path.join(site, '.git'))
fs.writeFileSync(path.join(site, '.git', 'config'), '[remote]')
fs.mkdirSync(path.join(site, '.well-known'))
fs.writeFileSync(path.join(site, '.well-known', 'security.txt'), 'Contact: x')
fs.writeFileSync(path.join(work, 'outside.txt'), 'outside the site')
let symlinked = false
try { fs.symlinkSync(path.join(work, 'outside.txt'), path.join(site, 'escape.txt')); symlinked = true } catch { /* no symlink rights (Windows) */ }

const { server } = createBridgeServer({ froamDir, serveDir: site, allowOrigins: 'http://app.test' })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

function request({ method = 'GET', url = '/', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers: { host: `localhost:${port}`, ...headers } }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', (error) => resolve({ status: 0, error: error.code || error.message }))
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

const save = (headers = {}, text = 'Hello') => request({
  method: 'POST',
  url: '/__froam/repo/save',
  headers: { 'content-type': 'application/json', ...headers },
  body: { routeKey: '/', viewportMode: 'desktop', store: { 'body:1/h1:1': { text } } },
})
const designText = () => {
  const file = path.join(froamDir, 'froam.design.json')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

/* ─── rules ─── */

test('local names, IP literals and mDNS names are local; public domains are not', () => {
  for (const name of ['localhost', 'app.localhost', '127.0.0.1', '192.168.1.20', '[::1]', 'laptop.local']) assert.ok(isLocalHostname(name), name)
  for (const name of ['evil.example', 'localhost.evil.example', '127.0.0.1.nip.io', '']) assert.ok(!isLocalHostname(name), name)
  assert.ok(isAllowedOrigin('http://localhost:5173'))
  assert.ok(!isAllowedOrigin('https://evil.example'))
  assert.ok(!isAllowedOrigin('null'))
  assert.ok(isAllowedOrigin('http://app.test', ['http://app.test']))
  assert.ok(isAllowedHost('app.test:4600', ['http://app.test']))
})

/* ─── the attacks ─── */

test('another site cannot write the design', async () => {
  const before = designText()
  const res = await save({ origin: 'https://evil.example' }, 'pwned')
  assert.equal(res.status, 403)
  assert.equal(designText(), before, 'the design changed')
})

test('a cross-site write with no Origin header is refused too', async () => {
  const res = await save({ 'sec-fetch-site': 'cross-site' }, 'pwned')
  assert.equal(res.status, 403)
  assert.ok(!designText().includes('pwned'))
})

test('another site gets no CORS grant to read the project', async () => {
  const res = await request({ url: '/__froam/repo/status', headers: { origin: 'https://evil.example' } })
  assert.equal(res.headers['access-control-allow-origin'], undefined)
  const preflight = await request({ method: 'OPTIONS', url: '/__froam/repo/save', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } })
  assert.equal(preflight.headers['access-control-allow-origin'], undefined)
})

test('DNS rebinding — a public hostname pointed at this machine — is refused', async () => {
  const res = await request({ url: '/__froam/repo/load', headers: { host: `rebind.evil.example:${port}` } })
  assert.equal(res.status, 403)
})

test('--serve never leaves the folder, whatever the encoding', async () => {
  for (const url of ['/../outside.txt', '/%2e%2e/outside.txt', '/%2e%2e%2foutside.txt', '/..%5coutside.txt', '/foo/../../outside.txt']) {
    const res = await request({ url })
    assert.ok(!res.body.includes('outside the site'), `${url} served a file outside the site`)
  }
})

test('--serve never serves dotfiles (.env, .git) — only .well-known', async () => {
  for (const url of ['/.env', '/.git/config', '/%2eenv', '/foo/../.env']) {
    const res = await request({ url })
    assert.ok(!res.body.includes('hunter2') && !res.body.includes('[remote]'), `${url} leaked a dotfile`)
  }
  const wellKnown = await request({ url: '/.well-known/security.txt' })
  assert.equal(wellKnown.status, 200)
})

test('a symlink inside the folder cannot lead out of it', async () => {
  if (!symlinked) return
  const res = await request({ url: '/escape.txt' })
  assert.ok(!res.body.includes('outside the site'))
})

test('an oversized body is cut off, not buffered', async () => {
  const res = await request({ method: 'POST', url: '/__froam/repo/save', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(21_000_000) })
  assert.notEqual(res.status, 200)
})

/* ─── what must keep working ─── */

test('the page itself (same origin) and the app dev server (another localhost port) can save', async () => {
  assert.equal((await save({ origin: `http://localhost:${port}` }, 'same origin')).status, 200)
  const cross = await save({ origin: 'http://localhost:5173' }, 'dev server')
  assert.equal(cross.status, 200)
  assert.equal(cross.headers['access-control-allow-origin'], 'http://localhost:5173')
  assert.ok(designText().includes('dev server'))
})

test('tools with no Origin (curl, the CLI) can still save', async () => {
  assert.equal((await save({}, 'from curl')).status, 200)
})

test('--allow-origin lets a custom dev domain in', async () => {
  const res = await save({ origin: 'http://app.test', host: `app.test:${port}` }, 'custom domain')
  assert.equal(res.status, 200)
  assert.equal(res.headers['access-control-allow-origin'], 'http://app.test')
})

test('over the network (--host), the repo cannot be written directly — only through an approved request', async () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((net) => net && net.family === 'IPv4' && !net.internal)?.address
  if (!lan) return // no network interface here (some CI sandboxes)
  const exposed = createBridgeServer({ froamDir, serveDir: site })
  await new Promise((resolve) => exposed.server.listen(0, '0.0.0.0', resolve))
  const exposedPort = exposed.server.address().port
  const viaLan = (url, body) => new Promise((resolve) => {
    const req = http.request({ host: lan, port: exposedPort, method: 'POST', path: url, headers: { host: `${lan}:${exposedPort}`, 'content-type': 'application/json' } }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    })
    req.on('error', () => resolve(0))
    req.end(JSON.stringify(body))
  })
  const before = designText()
  const statuses = [
    await viaLan('/__froam/repo/save', { routeKey: '/', viewportMode: 'desktop', store: { 'body:1/h1:1': { text: 'from the LAN' } } }),
    await viaLan('/__froam/repo/project/save', {}),
    await viaLan('/__froam/source/text', { edits: [{ from: 'Hello there', to: 'from the LAN' }] }),
  ]
  exposed.server.close()
  assert.deepEqual(statuses, [403, 403, 403])
  assert.equal(designText(), before)
})

test('--serve still serves the site', async () => {
  const res = await request({ url: '/' })
  assert.equal(res.status, 200)
  assert.ok(res.body.includes('<h1>Hi</h1>'))
})

let failed = 0
for (const [name, fn] of tests) {
  try { await fn(); console.log(`  ok   ${name}`) } catch (error) {
    failed += 1; console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}
server.close()
fs.rmSync(work, { recursive: true, force: true })
console.log(`\nbridge security: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
