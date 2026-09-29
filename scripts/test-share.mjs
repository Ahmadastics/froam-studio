/**
 * Sharing a local site: `froam dev` on this machine, the share service's
 * logic (templates/cloudflare-share/share.js) on a local server standing in
 * for Cloudflare, and requests arriving as if from another computer. Then a
 * real browser opens an invite link through the share and gets the editor.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createBridgeServer, isSameSite, keepLinksInside } from '../lib/dev-server.mjs'
import { PASS_COOKIE, SHARE_COOKIE, createShareHub, editorFromCdn, isShareId, sha256Hex, shareFromCookie, signPass } from '../templates/cloudflare-share/share.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)
const { wsServer: WebSocketServer } = require('playwright-core/lib/utilsBundle')

/* ── the share service, in Node ── */
const shares = new Map()
const shareFor = (id) => {
  if (!shares.has(id)) {
    const entry = { socket: null, keyHash: null, passSecret: null }
    // As for a version not on the CDN yet: the editor comes through the tunnel.
    // Plain http here, so the pass cookie can't insist on https.
    entry.hub = createShareHub({ hostSocket: () => entry.socket, passSecret: () => entry.passSecret, secureCookies: false, fetchImpl: (url, init) => (String(url).startsWith('https://cdn.jsdelivr.net/') ? Promise.resolve(new Response('not found', { status: 404 })) : fetch(url, init)) })
    shares.set(id, entry)
  }
  return shares.get(id)
}
const relay = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://relay')
  const link = /^\/s\/([\w-]{16,64})(\/[^?#]*)?$/.exec(url.pathname)
  if (link) {
    const page = link[2] && link[2] !== '/' ? link[2].replace(/\/{2,}/g, '/') : '/'
    res.writeHead(302, { Location: `${page}${url.search}`, 'Set-Cookie': `${SHARE_COOKIE}=${link[1]}; Path=/; HttpOnly; SameSite=Lax` })
    return res.end()
  }
  const id = shareFromCookie(req.headers.cookie)
  if (!id) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('landing') }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = chunks.length ? Buffer.concat(chunks) : null
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(name, value)
  const response = await shareFor(id).hub.forward(new Request(`http://relay${req.url}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }))
  const out = {}
  response.headers.forEach((value, name) => { if (name !== 'set-cookie') out[name] = value })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) out['set-cookie'] = cookies
  res.writeHead(response.status, out)
  if (!response.body) return res.end()
  const reader = response.body.getReader()
  req.on('close', () => reader.cancel().catch(() => {}))
  for (;;) {
    const { done, value } = await reader.read().catch(() => ({ done: true }))
    if (done) break
    res.write(value)
  }
  res.end()
})
const wss = new WebSocketServer({ noServer: true })
relay.on('upgrade', async (req, socket, head) => {
  const url = new URL(req.url, 'http://relay')
  const id = /^\/host\/([\w-]{16,64})$/.exec(url.pathname)?.[1]
  const key = url.searchParams.get('key')
  if (!id || !isShareId(key)) { socket.destroy(); return }
  const entry = shareFor(id)
  const hash = await sha256Hex(key)
  if (entry.keyHash && entry.keyHash !== hash) { socket.destroy(); return }
  entry.keyHash = hash
  entry.passSecret ??= await sha256Hex(`froam-pass:${key}`)
  wss.handleUpgrade(req, socket, head, (ws) => {
    entry.socket = ws
    ws.on('message', (data) => entry.hub.fromHost(String(data)))
    ws.on('close', () => { if (entry.socket === ws) { entry.socket = null; entry.hub.hostGone() } })
  })
})
await new Promise((resolve) => relay.listen(0, '127.0.0.1', resolve))
const RELAY = `http://127.0.0.1:${relay.address().port}`
process.env.FROAM_SHARE_URL = RELAY
process.env.FROAM_SHARES_FILE = path.join(os.tmpdir(), `froam-shares-test-${process.pid}.json`)

/* ── froam dev, serving the e2e site ── */
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-share-site-'))
fs.cpSync(path.join(ROOT, 'test', 'e2e', 'site'), site, { recursive: true })
fs.rmSync(path.join(site, 'froam'), { recursive: true, force: true })
const froamDir = path.join(site, 'froam')
fs.mkdirSync(froamDir)
const bridge = createBridgeServer({ port: 0, froamDir, serveDir: site, sourceRoot: site })
await new Promise((resolve) => bridge.server.listen(0, '127.0.0.1', resolve))
const LOCAL = `http://127.0.0.1:${bridge.server.address().port}`

const tests = []
const test = (name, fn) => tests.push([name, fn])
const cookies = new Map()
/** A browser somewhere else: talks only to the share service, keeps its cookies. */
async function remote(pathname, init = {}) {
  const jar = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  const response = await fetch(`${RELAY}${pathname}`, { ...init, redirect: 'manual', headers: { ...(init.headers ?? {}), ...(jar ? { Cookie: jar } : {}), Origin: RELAY } })
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';')
    const at = pair.indexOf('=')
    cookies.set(pair.slice(0, at), pair.slice(at + 1))
  }
  return response
}
const local = (pathname, init = {}) => fetch(`${LOCAL}${pathname}`, init)
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const state = {}

test('a live site that moves to its www twin is followed, and its links stay in Froam', () => {
  assert.equal(isSameSite('dominos.ng', 'www.dominos.ng'), true)
  assert.equal(isSameSite('www.shop.com', 'shop.com'), true)
  assert.equal(isSameSite('shop.com', 'othershop.com'), false)
  const html = keepLinksInside(
    '<a href="https://www.shop.com/menu?x=1">m</a><a class=a href="https://www.shop.com">h</a>'
      + "<form action='https://www.shop.com/s'></form><img src=\"https://www.shop.com/a.png\">"
      + '<a href="https://www.shop.com.example.org/">x</a>',
    new Set(['https://www.shop.com']),
  )
  assert.equal(html,
    '<a href="/menu?x=1">m</a><a class=a href="/">h</a>'
      + "<form action='/s'></form><img src=\"https://www.shop.com/a.png\">"
      + '<a href="https://www.shop.com.example.org/">x</a>')
})

test('the editor and its modules come from the CDN, for the exact version', async () => {
  const asked = []
  const fake = async (url) => { asked.push(url); return new Response('ok', { status: 200 }) }
  for (const path of ['/froam.js', '/froam.css', '/froam-modules/froam-editor.mjs', '/froam-modules/chunks/GlobalChefEditor-ABC123.mjs']) assert.ok(await editorFromCdn(path, '8.8.1', fake), path)
  assert.deepEqual(asked.map((u) => u.replace('https://cdn.jsdelivr.net/npm/@ahmadastic/froam@8.8.1/dist/standalone/', '')), ['froam-editor.js', 'froam-editor.css', 'modules/froam-editor.mjs', 'modules/chunks/GlobalChefEditor-ABC123.mjs'])
  const chunk = await editorFromCdn('/froam-modules/chunks/x-1.mjs', '8.8.1', fake)
  assert.match(chunk.headers.get('cache-control'), /immutable/)
  assert.match(chunk.headers.get('content-type'), /javascript/)
  assert.equal(await editorFromCdn('/froam-modules/../../etc.mjs', '8.8.1', fake), null)
  assert.equal(await editorFromCdn('/froam.js', 'latest; rm -rf', fake), null)
})

test('locked means locked: even the editor’s files wait for an invite', async () => {
  // The CDN has every file; a locked share still hands out none of them.
  const hub = createShareHub({ hostSocket: () => null, site: { version: '9.0.0', gate: { epoch: 'e1', expiresAt: null } }, passSecret: () => 'secret', fetchImpl: async () => new Response('editor', { status: 200 }) })
  for (const pathname of ['/froam.js', '/froam.css', '/froam-modules/froam-editor.mjs']) {
    assert.equal((await hub.forward(new Request(`https://share.test${pathname}`))).status, 403, pathname)
  }
  const pass = await signPass('secret', String(Date.now() + 60_000), 'e1')
  const allowed = await hub.forward(new Request('https://share.test/froam.js', { headers: { cookie: `${PASS_COOKIE}=${pass}` } }))
  assert.equal(allowed.status, 200)
  assert.equal(await allowed.text(), 'editor')
})

test('FROAM_SHARE=off keeps every invite link on this machine', async () => {
  assert.equal((await local('/__froam/share').then((r) => r.json())).available, true)
  process.env.FROAM_SHARE = 'off'
  try {
    assert.equal((await local('/__froam/share').then((r) => r.json())).available, false)
    const start = await local('/__froam/share/start', json({}))
    assert.equal(start.status, 403)
    assert.match((await start.json()).error, /FROAM_SHARE=off/)
    assert.equal((await local('/__froam/share').then((r) => r.json())).active, false)
  } finally {
    delete process.env.FROAM_SHARE
  }
})

test('a share link can open a page, and never another site (the real worker)', async () => {
  const { default: worker } = await import('../templates/cloudflare-share/worker.js')
  const env = { SHARES: { idFromName: (name) => name, get: () => ({ fetch: async () => new Response('site') }) } }
  const open = (pathname) => worker.fetch(new Request(`https://share.test${pathname}`), env)
  assert.equal((await open('/s/abcdefghijklmnopqrst?froam-room=r')).headers.get('location'), '/?froam-room=r')
  assert.equal((await open('/s/abcdefghijklmnopqrst/pricing?froam-room=r')).headers.get('location'), '/pricing?froam-room=r')
  assert.equal((await open('/s/abcdefghijklmnopqrst//elsewhere.example/x')).headers.get('location'), '/elsewhere.example/x')
  assert.match((await open('/s/abcdefghijklmnopqrst/pricing')).headers.get('set-cookie'), /froam_share=abcdefghijklmnopqrst; Path=\/;.*HttpOnly/)
})

test('the owner starts sharing from the editor; the link is stable', async () => {
  const started = await local('/__froam/share/start', json({})).then((r) => r.json())
  assert.equal(started.success, true)
  assert.ok(started.url.startsWith(`${RELAY}/s/`), started.url)
  const deadline = Date.now() + 5000
  let status
  do { status = await local('/__froam/share').then((r) => r.json()) } while (!status.online && Date.now() < deadline && await new Promise((r) => setTimeout(r, 100)) === undefined)
  assert.equal(status.online, true)
  assert.equal(status.viewer, 'owner')
  state.url = status.url
})

test('without an invite, the share opens nothing — not a page, not a file', async () => {
  const hop = await remote(new URL(state.url).pathname)
  assert.equal(hop.status, 302)
  assert.ok(cookies.has(SHARE_COOKIE))
  for (const pathname of ['/', '/index.html', '/froam.js', '/api/froam/rooms', '/__froam/share']) {
    const refused = await remote(pathname)
    assert.equal(refused.status, 403, `${pathname} answered ${refused.status}`)
  }
  assert.match(await (await remote('/')).text(), /needs an invite/)
  // A made-up token is refused too.
  assert.equal((await remote('/?froam-room=nope&froam-token=nope')).status, 403)
  assert.equal(cookies.has(PASS_COOKIE), false)
})

test('someone elsewhere opens an invite link and gets the site, with the editor', async () => {
  const created = await local('/api/froam/rooms', json({ name: 'Ahmad' })).then((r) => r.json())
  state.room = { id: created.room.id, created }
  const invited = await remote(`/?froam-room=${created.room.id}&froam-token=${created.invites.commenter}`)
  assert.equal(invited.status, 200)
  assert.ok(cookies.has(PASS_COOKIE), 'no pass for a real invite')
  const page = await remote('/')
  const html = await page.text()
  assert.equal(page.status, 200)
  assert.match(html, /Discover/)
  assert.match(html, /<script src="\/froam\.js"/)
  const loader = await remote('/froam.js')
  assert.equal(loader.status, 200)
  assert.match(await loader.text(), /froam-modules\/froam-editor\.mjs/)
  const boot = await remote('/froam-modules/froam-editor.mjs')
  assert.equal(boot.status, 200)
  assert.match(boot.headers.get('content-type') ?? '', /javascript/)
  assert.ok((await boot.arrayBuffer()).byteLength > 100_000, 'the editor came through short')
})

test('through the link, this machine’s files can’t be written', async () => {
  for (const pathname of ['/__froam/repo/save', '/__froam/source/text', '/__froam/share/stop', '/api/froam/published']) {
    const refused = await remote(pathname, json({ routeKey: '/', viewportMode: 'desktop', store: {} }))
    assert.equal(refused.status, 403, `${pathname} answered ${refused.status}`)
  }
  const status = await remote('/__froam/share').then((r) => r.json())
  assert.equal(status.viewer, 'remote')
  const who = await remote('/__froam/whoami').then((r) => r.json())
  assert.equal(who.name, null)
})

test('a contributor joins and submits through the link; the owner approves at home', async () => {
  const { created } = state.room
  const id = created.room.id
  const joined = await remote(`/api/froam/rooms/${id}/join`, json({ token: created.invites.contributor, name: 'Maya' })).then((r) => r.json())
  assert.equal(joined.you.role, 'contributor')
  const maya = { token: created.invites.contributor, actor: joined.you.actor, session: joined.you.session }
  const submitted = await remote(`/api/froam/rooms/${id}/requests`, json({
    ...maya, title: 'Subtitle', routeKey: '/', viewport: 'desktop',
    store: { 'main:1/section:1/p:1': { text: 'Shared from anywhere.' } },
    changes: [{ label: 'Subtitle', before: 'Extraordinary places. Unforgettable experiences.', after: 'Shared from anywhere.' }],
    textEdits: [{ from: 'Extraordinary places. Unforgettable experiences.', to: 'Shared from anywhere.' }],
  })).then((r) => r.json())
  assert.equal(submitted.request.status, 'pending')
  const owner = { token: created.invites.owner, actor: created.you.actor, session: created.you.session }
  const approved = await local(`/api/froam/rooms/${id}/requests/${submitted.request.id}/decision`, json({ ...owner, decision: 'approved' })).then((r) => r.json())
  assert.equal(approved.request.status, 'approved')
  assert.ok(fs.readFileSync(path.join(site, 'index.html'), 'utf8').includes('Shared from anywhere.'))
})

test('the room’s live stream comes through the link as it happens', async () => {
  const { id, created } = state.room
  const controller = new AbortController()
  const response = await remote(`/api/froam/rooms/${id}/stream?token=${created.invites.owner}`, { signal: controller.signal })
  assert.equal(response.status, 200)
  const reader = response.body.getReader()
  const first = await Promise.race([reader.read(), new Promise((_, reject) => setTimeout(() => reject(new Error('no event in 3s')), 3000))])
  assert.match(new TextDecoder().decode(first.value), /event: ready/)
  controller.abort()
})

test('a real browser opens an invite link through the share and gets the editor', async () => {
  const { chromium } = require('playwright-core')
  const chrome = [process.env.FROAM_E2E_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => fs.existsSync(p))
  if (!chrome) return
  const browser = await chromium.launch({ executablePath: chrome })
  try {
    const page = await browser.newPage()
    const { id, created } = state.room
    await page.goto(`${state.url}?froam-room=${id}&froam-token=${created.invites.contributor}`)
    await page.waitForSelector('.global-chef-button', { timeout: 20000 })
    await page.keyboard.press('Control+.')
    await page.waitForSelector('input[aria-label="Your name"]', { timeout: 20000 })
    assert.ok(page.url().startsWith(RELAY), page.url())
  } finally {
    await browser.close()
  }
})

test('links can expire, and new links end every pass handed out', async () => {
  const lasting = await local('/__froam/share/access', json({ expiresIn: '24h' })).then((r) => r.json())
  assert.ok(lasting.expiresAt > Date.now() && lasting.expiresAt <= Date.now() + 24 * 3600_000 + 1000)
  assert.equal((await local('/__froam/share').then((r) => r.json())).expiresAt, lasting.expiresAt)
  await local('/__froam/share/access', json({ reset: true, expiresIn: 'off' }))
  await new Promise((resolve) => setTimeout(resolve, 300))
  assert.equal((await remote('/')).status, 403, 'an old pass still works after new links')
  const { id, created } = state.room
  const again = await remote(`/?froam-room=${id}&froam-token=${created.invites.commenter}`)
  assert.equal(again.status, 200)
  assert.equal((await remote('/')).status, 200)
})

test('when froam dev stops sharing, the link says the site is offline', async () => {
  await local('/__froam/share/stop', json({}))
  await new Promise((resolve) => setTimeout(resolve, 200))
  const page = await remote('/')
  assert.equal(page.status, 502)
  assert.match(await page.text(), /This share is offline/)
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}`)
    console.log(`       ${String(error?.message ?? error).split('\n').slice(0, 4).join('\n       ')}`)
  }
}
bridge.stopShare()
bridge.server.closeAllConnections?.()
bridge.server.close()
relay.closeAllConnections?.()
relay.close()
wss.close()
console.log(`\nshare: ${tests.length - failed}/${tests.length} passed`)
setTimeout(() => process.exit(failed ? 1 : 0), 100)
