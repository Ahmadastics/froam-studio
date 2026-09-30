/**
 * The share service, live — the checks the local share test can't make, run
 * before a release (`npm run smoke:share`, and by `npm run release`):
 *
 * 1. This repo's froam dev, shared through the real service: without a live
 *    invite nothing opens (not the page, not /froam.js), an invite admits,
 *    links can expire, and New links shuts out every pass handed out.
 * 2. The versions people already run — the one on npm now, and 8.9.0, the
 *    last from before the lock — still share the way they always did.
 *
 * Needs a network connection and a Chrome/Chromium (FROAM_E2E_CHROME).
 */
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const OWN = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
process.env.FROAM_SHARES_FILE = path.join(os.tmpdir(), `froam-shares-smoke-${process.pid}.json`)
delete process.env.FROAM_SHARE

let failures = 0
const check = (ok, text) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${text}`); if (!ok) failures += 1 }
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function findBrowser() {
  if (process.env.FROAM_E2E_CHROME) return process.env.FROAM_E2E_CHROME
  try { const bundled = chromium.executablePath(); if (bundled && fs.existsSync(bundled)) return bundled } catch { /* none bundled */ }
  return [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((p) => fs.existsSync(p)) ?? null
}

function siteCopy(label) {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), `froam-smoke-${label}-`))
  fs.cpSync(path.join(ROOT, 'test', 'e2e', 'site'), site, { recursive: true })
  fs.rmSync(path.join(site, 'froam'), { recursive: true, force: true })
  fs.mkdirSync(path.join(site, 'froam'))
  return site
}

/** A visitor with no browser: follows redirects and keeps cookies, like a person on the link would. */
async function openLink(url, jar = new Map()) {
  let target = url
  for (let hop = 0; hop < 4; hop += 1) {
    const headers = jar.size ? { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') } : {}
    const response = await fetch(target, { redirect: 'manual', headers })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const at = pair.indexOf('=')
      jar.set(pair.slice(0, at), pair.slice(at + 1))
    }
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) { target = new URL(location, target).href; continue }
    return { status: response.status, text: await response.text() }
  }
  return { status: 0, text: '' }
}

async function waitForShare(statusUrl) {
  for (let i = 0; i < 120; i += 1) {
    const status = await fetch(statusUrl).then((r) => r.json()).catch(() => null)
    if (status?.online && status.url) return status
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

async function thisRepo(browser) {
  console.log('\nThis froam dev, through the live share service')
  const { createBridgeServer } = await import(new URL('../lib/dev-server.mjs', import.meta.url).href)
  const site = siteCopy('repo')
  const bridge = createBridgeServer({ port: 0, froamDir: path.join(site, 'froam'), serveDir: site, sourceRoot: site })
  await new Promise((resolve) => bridge.server.listen(0, '127.0.0.1', resolve))
  const LOCAL = `http://127.0.0.1:${bridge.server.address().port}`
  const visit = async (context, url) => { const page = await context.newPage(); const response = await page.goto(url, { waitUntil: 'load', timeout: 60000 }); return { page, status: response?.status() ?? 0, text: await page.evaluate(() => document.body?.innerText ?? '') } }
  try {
    await fetch(`${LOCAL}/__froam/share/start`, json({}))
    const status = await waitForShare(`${LOCAL}/__froam/share`)
    check(Boolean(status), `shared through ${status?.url ? new URL(status.url).host : 'nothing'}`)
    if (!status) return
    const share = new URL(status.url)
    const stranger = await browser.newContext()
    const bare = await visit(stranger, status.url)
    check(bare.status === 403 && /needs an invite/i.test(bare.text), `no invite → ${bare.status}`)
    check((await stranger.request.get(`${share.origin}/froam.js`)).status() === 403, 'no invite → not even /froam.js')
    check((await visit(stranger, `${status.url}?froam-room=nope&froam-token=nope`)).status === 403, 'a made-up invite is refused')
    await stranger.close()
    const created = await fetch(`${LOCAL}/api/froam/rooms`, json({ name: 'Smoke' })).then((r) => r.json())
    const invite = `${status.url}?froam-room=${created.room.id}&froam-token=${created.invites.commenter}`
    const guest = await browser.newContext()
    const invited = await visit(guest, invite)
    check(invited.status === 200 && /Discover/.test(invited.text), `an invite opens the page (${invited.status})`)
    check(await invited.page.waitForSelector('.global-chef-button', { timeout: 30000 }).then(() => true).catch(() => false), 'the editor loads for the guest')
    check((await visit(guest, `${share.origin}/`)).status === 200, 'the guest comes back without the invite in the URL')
    const lasting = await fetch(`${LOCAL}/__froam/share/access`, json({ expiresIn: '24h' })).then((r) => r.json())
    check(lasting.expiresAt > Date.now(), 'links can be set to stop in 24 hours')
    await fetch(`${LOCAL}/__froam/share/access`, json({ expiresIn: 'off', reset: true }))
    await new Promise((r) => setTimeout(r, 1500))
    check((await visit(guest, `${share.origin}/`)).status === 403, 'New links shut out the old guest')
    check((await visit(guest, invite)).status === 200, 'a live invite still admits')
    await guest.close()
  } finally {
    bridge.stopShare?.()
    bridge.server.closeAllConnections?.()
    bridge.server.close()
  }
}

/** A version from npm, shared through the same service, behaving as that version always did. */
async function publishedVersion(version) {
  const locks = Number(version.split('.')[0]) >= 9
  console.log(`\n${version} from npm (${locks ? 'locked to invites' : 'from before the lock: open, as it always was'})`)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-smoke-published-'))
  execSync(`npm install --no-save --no-audit --no-fund ${OWN.name}@${version}`, { cwd: dir, stdio: 'ignore' })
  const bin = path.join(dir, 'node_modules', ...OWN.name.split('/'), 'bin', 'froam.mjs')
  const site = siteCopy('published')
  const port = 4700 + Math.floor(Math.random() * 90)
  const child = spawn(process.execPath, [bin, 'dev', '--serve', site, '--share', '--port', String(port)], { cwd: site, env: { ...process.env } })
  child.stdout.resume()
  child.stderr.resume()
  try {
    const status = await waitForShare(`http://127.0.0.1:${port}/__froam/share`)
    check(Boolean(status), `${version} shared`)
    if (!status) return
    const bare = await openLink(status.url)
    check(locks ? bare.status === 403 : bare.status === 200 && bare.text.includes('Discover'), `without an invite → ${bare.status} (${locks ? 'refused' : 'open'}, as ${version} should be)`)
    const created = await fetch(`http://127.0.0.1:${port}/api/froam/rooms`, json({ name: 'Smoke' })).then((r) => r.json())
    const invited = await openLink(`${status.url}?froam-room=${created.room.id}&froam-token=${created.invites.commenter}`)
    check(invited.status === 200 && invited.text.includes('Discover'), `an invite opens the page (${invited.status})`)
  } finally {
    child.kill()
  }
}

const executablePath = findBrowser()
if (!executablePath) { console.error('No Chrome/Chromium found — set FROAM_E2E_CHROME.'); process.exit(1) }
const browser = await chromium.launch({ executablePath })
try {
  await thisRepo(browser)
  const meta = await fetch(`https://registry.npmjs.org/${OWN.name.replace('/', '%2f')}`).then((r) => r.json())
  for (const version of new Set([meta['dist-tags']?.latest, '8.9.0'].filter(Boolean))) await publishedVersion(version)
} catch (error) {
  console.error(`  FAIL ${error.message}`)
  failures += 1
} finally {
  await browser.close()
}
console.log(failures ? `\nlive share: ${failures} failed` : '\nlive share: all checks passed')
setTimeout(() => process.exit(failures ? 1 : 0), 300)
