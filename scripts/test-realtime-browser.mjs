/**
 * Realtime in real browsers: a hosted-style room server (no event stream,
 * heartbeats rarely stored), a relay on a local WebSocket server, and two
 * pages running the shipped room client. Measures what people feel: how long
 * a cursor and a message take to reach the other person.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createFroamRoomApi } from '../lib/room-store.mjs'
import { createRealtimeRelayClient } from '../lib/realtime.mjs'
import { createRelay, verifyTicket } from '../templates/cloudflare-realtime/relay.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const { wsServer: WebSocketServer } = require('playwright-core/lib/utilsBundle')
const SECRET = 'browser-test-secret-0123456789'

function findBrowser() {
  const candidates = [process.env.FROAM_E2E_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

/* ── the relay: the template's logic on a local WebSocket server ── */
const relays = new Map()
const relayFor = (roomId) => {
  if (!relays.has(roomId)) {
    const sockets = new Set()
    relays.set(roomId, { sockets, relay: createRelay({ sockets: () => sockets, actorOf: (socket) => socket.actor, send: (socket, text) => { try { socket.send(text) } catch { /* gone */ } } }) })
  }
  return relays.get(roomId)
}
const relayServer = http.createServer(async (req, res) => {
  const match = /^\/rooms\/([\w-]+)\/publish$/.exec(req.url)
  if (match && req.method === 'POST' && req.headers.authorization === `Bearer ${SECRET}`) {
    let body = ''
    for await (const chunk of req) body += chunk
    relayFor(match[1]).relay.wake(JSON.parse(body || '{}').sequence)
    res.statusCode = 204
    return res.end()
  }
  res.statusCode = 404
  res.end()
})
const wss = new WebSocketServer({ noServer: true })
relayServer.on('upgrade', async (req, socket, head) => {
  const url = new URL(req.url, 'http://relay')
  const roomId = /^\/rooms\/([\w-]+)$/.exec(url.pathname)?.[1]
  const claims = roomId ? await verifyTicket(SECRET, url.searchParams.get('ticket')) : null
  if (!claims || claims.roomId !== roomId) { socket.destroy(); return }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.actor = claims.actor
    const { sockets, relay } = relayFor(roomId)
    sockets.add(ws)
    ws.on('message', (data) => relay.message(ws, String(data)))
    ws.on('close', () => { relay.left(ws); sockets.delete(ws) })
  })
})
await new Promise((resolve) => relayServer.listen(0, '127.0.0.1', resolve))
const relayUrl = `http://127.0.0.1:${relayServer.address().port}`

/* ── the room server: hosted-style, no event stream ── */
const rooms = new Map()
let writes = 0
const api = createFroamRoomApi({
  storage: { get: (id) => (rooms.has(id) ? JSON.parse(rooms.get(id)) : null), put: (room) => { writes += 1; rooms.set(room.id, JSON.stringify(room)) } },
  realtime: createRealtimeRelayClient({ url: relayUrl, secret: SECRET }),
  presenceWriteMs: 60_000,
})
const appServer = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/froam/rooms')) {
    if (req.url.includes('/stream')) { res.statusCode = 204; return res.end() }
    if (req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      req.body = JSON.parse(body || '{}')
    }
    const handled = await api(req, res)
    if (!handled) { res.statusCode = 404; res.end() }
    return
  }
  if (req.url === '/room.js') {
    res.setHeader('Content-Type', 'text/javascript')
    return res.end(fs.readFileSync(path.join(ROOT, 'dist', 'collab', 'room.js')))
  }
  res.setHeader('Content-Type', 'text/html')
  res.end(`<!doctype html><title>room</title><script type="module">
    import { createRoomClient } from '/room.js'
    const transport = {
      get: (p) => fetch(p).then((r) => r.json()),
      post: (p, body) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()),
    }
    window.start = async (roomId, token, name) => {
      const client = createRoomClient({ roomId, token, transport, isHidden: () => false })
      window.client = client
      window.heard = []
      client.onEvents((events) => { for (const e of events) window.heard.push({ type: e.type, at: performance.now(), body: e.message?.body }) })
      await client.join(name)
      client.startLive(60_000)
      await new Promise((resolve) => { const t = setInterval(() => { if (client.live) { clearInterval(t); resolve() } }, 20) })
      return client.identity.actor
    }
  </script>`)
})
await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve))
const appUrl = `http://127.0.0.1:${appServer.address().port}/`

const tests = []
const test = (name, fn) => tests.push([name, fn])
const browserPath = findBrowser()
if (!browserPath) { console.log('realtime browser: no Chrome found — skipped'); process.exit(0) }
const browser = await chromium.launch({ executablePath: browserPath })
const created = await new Promise((resolve) => {
  const req = { method: 'POST', url: '/api/froam/rooms', body: { name: 'Owner' } }
  const res = { statusCode: 0, setHeader() {}, end(text) { resolve(JSON.parse(text)) } }
  void api(req, res)
})
const pageFor = async () => { const page = await (await browser.newContext()).newPage(); await page.goto(appUrl); await page.waitForFunction(() => typeof window.start === 'function'); return page }
const ana = await pageFor()
const ben = await pageFor()
const anaActor = await ana.evaluate(([id, token]) => window.start(id, token, 'Ana'), [created.room.id, created.invites.editor])
await ben.evaluate(([id, token]) => window.start(id, token, 'Ben'), [created.room.id, created.invites.editor])

test('both browsers are on the relay', async () => {
  assert.equal(await ana.evaluate(() => window.client.live), true)
  assert.equal(await ben.evaluate(() => window.client.live), true)
})

test('a cursor reaches the other person in well under a second, and isn’t stored', async () => {
  const before = writes
  await ben.evaluate(() => { window.client.on((room) => { const ana = room?.members.find((m) => m.name === 'Ana'); if (ana?.cursor?.x === 321 && !window.sawAt) window.sawAt = performance.now() }) })
  const start = Date.now()
  await ana.evaluate(() => { void window.client.beat({ routeKey: '/', viewport: 'desktop', cursor: { x: 321, y: 42 }, action: 'Typing a message' }) })
  await ben.waitForFunction(() => window.sawAt, null, { timeout: 3000 })
  const took = Date.now() - start
  const action = await ben.evaluate(() => window.client.room.members.find((m) => m.name === 'Ana').action)
  assert.ok(took < 1000, `the cursor took ${took}ms`)
  assert.equal(action, 'Typing a message')
  assert.ok(writes - before <= 1, `${writes - before} storage writes for one cursor move`)
})

test('a message arrives by wake-up, not by waiting for a poll', async () => {
  const start = Date.now()
  await ana.evaluate(() => window.client.sendChat('Live, not polled'))
  await ben.waitForFunction(() => window.heard.some((e) => e.body === 'Live, not polled'), null, { timeout: 5000 })
  const took = Date.now() - start
  // The live timer is 60s here: anything this quick came through the relay.
  assert.ok(took < 2000, `the message took ${took}ms`)
})

test('closing a tab tells the room at once', async () => {
  await ana.context().close()
  await ben.waitForFunction((actor) => window.client.room.members.find((m) => m.actor === actor)?.here === false, anaActor, { timeout: 3000 })
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
await browser.close()
relayServer.close()
appServer.close()
wss.close()
console.log(`\nrealtime browser: ${tests.length - failed}/${tests.length} passed`)
process.exit(failed ? 1 : 0)
