import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { createBridgeProjectKey, createBridgeServer, normalizeAppTarget } from '../lib/dev-server.mjs'
import { froamProjectId, froamStorageKey } from '../dist/project/storage-scope.js'
import { loadOpLog, saveOpLog } from '../dist/collab/persist.js'

const tests = []
const test = (name, run) => tests.push([name, run])

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

function fakeStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test('bridge project keys are stable, port-independent, and workspace-isolated', () => {
  const target = normalizeAppTarget('https://www.wwe.com/')
  const a = createBridgeProjectKey({ froamDir: path.join(os.tmpdir(), 'froam-a'), appTarget: target })
  const again = createBridgeProjectKey({ froamDir: path.join(os.tmpdir(), 'froam-a'), appTarget: target })
  const b = createBridgeProjectKey({ froamDir: path.join(os.tmpdir(), 'froam-b'), appTarget: target })
  assert.equal(a, again)
  assert.notEqual(a, b)
  assert.match(a, /^bridge-[a-f0-9]{20}$/)
})

test('joined and Markdown URLs fail with a useful error', () => {
  assert.throws(() => normalizeAppTarget('https://keenbean.app/https://www.cosmopolitan.edu.ng/'), /two joined URLs/)
  assert.throws(() => normalizeAppTarget('[https://wwe.com](https://wwe.com)'), /Markdown link/)
})

test('CLI scaffolding and guidance use the public scoped package name', () => {
  const cli = fs.readFileSync(new URL('../bin/froam.mjs', import.meta.url), 'utf8')
  const server = fs.readFileSync(new URL('../lib/dev-server.mjs', import.meta.url), 'utf8')

  assert.match(cli, /from '@ahmadastic\/froam\/vite'/)
  assert.match(cli, /npx @ahmadastic\/froam dev --serve \./)
  assert.doesNotMatch(cli, /from 'froam-studio\/vite'/)
  assert.doesNotMatch(cli, /npx froam(?:\s|`)/)
  assert.doesNotMatch(cli, /for any project|wire everything/)
  assert.doesNotMatch(server, /reinstall froam-studio/)
})

test('storage and project documents cannot cross project keys', () => {
  assert.notEqual(froamStorageKey('froam-assets-v1', 'keenbean'), froamStorageKey('froam-assets-v1', 'cosmo'))
  assert.notEqual(froamProjectId('keenbean'), froamProjectId('cosmo'))

  const storage = fakeStorage()
  const previousWindow = globalThis.window
  globalThis.window = { localStorage: storage }
  try {
    const op = { id: 'keenbean-op', kind: 'edit', actor: 'a', clock: 1, ts: 1, routeKey: '/', viewport: 'desktop', path: 'main', field: 'text', after: 'Keenbean' }
    saveOpLog([op], 'keenbean')
    assert.equal(loadOpLog('keenbean')[0].id, 'keenbean-op')
    assert.deepEqual(loadOpLog('cosmo'), [])
  } finally {
    globalThis.window = previousWindow
  }
})

test('proxy injects its project key and disables cross-site caching', async () => {
  let assetRequestHeaders = null
  const upstream = http.createServer((req, res) => {
    if (req.url === '/asset.js') {
      assetRequestHeaders = req.headers
      res.writeHead(200, {
        'content-type': 'application/javascript',
        'cache-control': 'public, max-age=86400',
        etag: 'old-site-etag',
        'last-modified': 'Wed, 02 Sep 2026 12:00:00 GMT',
      })
      return res.end('window.target = "fresh"')
    }
    res.writeHead(200, { 'content-type': 'text/html', etag: 'old-html' })
    res.end('<!doctype html><html><body><main>Target</main><script src="/asset.js"></script></body></html>')
  })

  const upstreamPort = await listen(upstream)
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-isolation-'))
  const froamDir = path.join(temporaryRoot, 'froam')
  fs.mkdirSync(froamDir)
  const bridge = createBridgeServer({ froamDir, app: `http://127.0.0.1:${upstreamPort}` })
  const bridgePort = await listen(bridge.server)

  try {
    const base = `http://127.0.0.1:${bridgePort}`
    const config = await fetch(`${base}/__froam/config`).then((response) => response.json())
    assert.equal(config.projectKey, bridge.projectKey)

    const page = await fetch(base)
    const html = await page.text()
    assert.match(html, new RegExp(`data-froam-project="${bridge.projectKey}"`))
    assert.match(page.headers.get('cache-control') ?? '', /no-store/)
    assert.equal(page.headers.get('clear-site-data'), '"cache"')
    assert.equal(page.headers.get('etag'), null)

    const asset = await fetch(`${base}/asset.js`, { headers: { 'if-none-match': 'stale', 'if-modified-since': 'yesterday' } })
    await asset.text()
    assert.match(asset.headers.get('cache-control') ?? '', /no-store/)
    assert.equal(asset.headers.get('etag'), null)
    assert.equal(asset.headers.get('last-modified'), null)
    assert.equal(assetRequestHeaders['if-none-match'], undefined)
    assert.equal(assetRequestHeaders['if-modified-since'], undefined)
  } finally {
    await close(bridge.server)
    await close(upstream)
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

let passed = 0
for (const [name, run] of tests) {
  await run()
  passed += 1
  console.log(`  ok   ${name}`)
}
console.log(`\n${passed}/${tests.length} project isolation tests passed`)
