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
import { SHARE_COOKIE, createShareHub, editorFromCdn, isShareId, sha256Hex, shareFromCookie } from '../templates/cloudflare-share/share.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)
const { wsServer: WebSocketServer } = require('playwright-core/lib/utilsBundle')

/* ── the share service, in Node ── */
const shares = new Map()
const shareFor = (id) => {
  if (!shares.has(id)) {
    const entry = { socket: null, keyHash: null }
    // As for a version not on the CDN yet: the editor comes through the tunnel.
    entry.hub = createShareHub({ hostSocket: () => entry.socket, fetchImpl: (url, init) => (String(url).startsWith('https://cdn.jsdelivr.net/') ? Promise.resolve(new Response('not found', { status: 404 })) : fetch(url, init)) })
    shares.set(id, entry)
  }
  return shares.get(id)
}
const relay = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://relay')
  const link = /^\/s\/([\w-]{16,64})\/?$/.exec(url.pathname)
  if (link) {
    res.writeHead(302, { Location: `/${url.search}`, 'Set-Cookie': `${SHARE_COOKIE}=${link[1]}; Path=/; HttpOnly; SameSite=Lax` })
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
  response.headers.forEach((value, name) => { out[name] = value })
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
let jar = ''
/** A browser somewhere else: talks only to the share service, keeps its cookie. */
async function remote(pathname, init = {}) {
  const response = await fetch(`${RELAY}${pathname}`, { ...init, redirect: 'manual', headers: { ...(init.headers ?? {}), ...(jar ? { Cookie: jar } : {}), Origin: RELAY } })
  const cookie = response.headers.get('set-cookie')
  if (cookie) jar = cookie.split(';')[0]
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

test('someone elsewhere opens the link and gets the site, with the editor', async () => {
  const hop = await remote(new URL(state.url).pathname)
  assert.equal(hop.status, 302)
  assert.ok(jar.startsWith(`${SHARE_COOKIE}=`))
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
  const created = await local('/api/froam/rooms', json({ name: 'Ahmad' })).then((r) => r.json())
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
  state.room = { id, created }
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
