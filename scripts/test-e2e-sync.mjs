#!/usr/bin/env node
/**
 * End-to-end across devices: one person editing their site from their
 * computer and their phone, both open at once.
 *
 * `froam dev --serve --host` runs the fixture as users run it. The computer is
 * a desktop browser on localhost; the phone is an emulated iPhone that reaches
 * the bridge over this machine's network address with the pairing link, so
 * the bridge sees another device. It checks that neither device's save can
 * wipe the other's edits, and that a save on one shows up on the other while
 * it is open, without a reload.
 *
 * Needs a network interface (skipped without one) and `npm run build` first.
 */
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = path.join(ROOT, 'test', 'e2e', 'site')
const BIN = path.join(ROOT, 'bin', 'froam.mjs')
const PHONE = devices['iPhone 13']

function findBrowser() {
  if (process.env.FROAM_E2E_CHROME) return process.env.FROAM_E2E_CHROME
  try { const bundled = chromium.executablePath(); if (bundled && fs.existsSync(bundled)) return bundled } catch { /* none */ }
  for (const cache of [path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'), path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')]) {
    if (!fs.existsSync(cache)) continue
    for (const dir of fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        if (fs.existsSync(path.join(cache, dir, rel))) return path.join(cache, dir, rel)
      }
    }
  }
  return ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p)) ?? null
}

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.on('error', reject)
  server.listen(0, () => { const { port } = server.address(); server.close(() => resolve(port)) })
})

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ─── shared state ─── */
let browser
let siteDir
let bridgeLog = ''
let pairLink = ''
let computerLink = ''
const designText = () => { const p = path.join(siteDir, 'froam', 'froam.design.json'); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '' }
const sourceText = () => fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8')
/** Saved anywhere a visitor would get it from: the design, or the page's own HTML. */
const savedAnywhere = (text) => designText().includes(text) || sourceText().includes(text)
const textOf = (page, id) => page.evaluate((id) => document.getElementById(id)?.innerText.trim() ?? null, id)

async function openOnComputer() {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } })
  const page = await context.newPage()
  await page.goto(computerLink)
  await page.waitForSelector('.global-chef-button', { timeout: 20000 })
  await page.keyboard.press('Control+.')
  await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 20000 })
  await page.waitForTimeout(1200)
  return { page, context }
}

async function openOnPhone() {
  const context = await browser.newContext({ ...PHONE })
  const page = await context.newPage()
  await page.goto(pairLink)
  await page.waitForSelector('.global-chef-button', { timeout: 20000 })
  await page.tap('.global-chef-button')
  await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 20000 })
  await page.waitForTimeout(2000)
  return { page, context }
}

/** Select the words and type over them, as a person does it. */
async function writeOver(page, id, text, { touch = false } = {}) {
  await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'instant' }), id)
  await page.waitForTimeout(150)
  const box = await page.locator(`#${id}`).boundingBox()
  const at = [box.x + Math.min(30, box.width / 2), box.y + box.height / 2]
  for (let attempt = 0; attempt < 3 && !(await page.evaluate((id) => document.getElementById(id).isContentEditable, id)); attempt += 1) {
    if (touch) await page.touchscreen.tap(...at)
    else await page.mouse.click(...at)
    await page.waitForTimeout(500)
  }
  assert(await page.evaluate((id) => document.getElementById(id).isContentEditable, id), `#${id} did not start writing`)
  await page.evaluate((id) => {
    const range = document.createRange()
    range.selectNodeContents(document.getElementById(id))
    const selection = getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }, id)
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const written = await textOf(page, id)
  assert(written === text, `typing into #${id} left "${written}"`)
}

/** Save to Repo, then wait until the bridge has it. */
async function saveToRepo(page, expect) {
  const repo = page.locator('.froam-tb__save-btn--repo')
  if (await repo.isVisible()) await repo.click()
  else await page.keyboard.press('Control+Shift+S')
  for (let i = 0; i < 60 && !savedAnywhere(expect); i += 1) await sleep(150)
  assert(savedAnywhere(expect), `"${expect}" was not saved`)
  await sleep(300)
}


/** Select an element and press Bold in the selection bar. */
async function makeBold(page, id, { touch = false } = {}) {
  await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'instant' }), id)
  await page.waitForTimeout(150)
  const box = await page.locator(`#${id}`).boundingBox()
  const at = [box.x + Math.min(30, box.width / 2), box.y + box.height / 2]
  if (touch) await page.touchscreen.tap(...at)
  else await page.mouse.click(...at)
  await page.waitForTimeout(500)
  const bold = page.locator('.froam-floating-bar [aria-label="Bold"]').first()
  if (touch) await bold.tap()
  else await bold.click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  const weight = await page.evaluate((id) => getComputedStyle(document.getElementById(id)).fontWeight, id)
  assert(Number(weight) >= 700, `#${id} is ${weight} after Bold`)
}

/** Save to Repo and wait for the design file to be rewritten. */
async function saveDesign(page) {
  const file = path.join(siteDir, 'froam', 'froam.design.json')
  const stamp = () => (fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0)
  const before = stamp()
  const repo = page.locator('.froam-tb__save-btn--repo')
  if (await repo.isVisible()) await repo.click()
  else await page.keyboard.press('Control+Shift+S')
  for (let i = 0; i < 60 && stamp() === before; i += 1) await sleep(150)
  assert(stamp() !== before, 'Save to Repo did not write the design')
  await sleep(300)
}

/** What a visitor to the production build gets: the page with only the two Froam files. */
async function visitorWeights(ids) {
  const html = sourceText()
    .replace('</head>', '<link rel="stylesheet" href="/froam/froam.generated.css"></head>')
    .replace('</body>', '<script src="/froam/froam.runtime.js" defer></script></body>')
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
    if (rel === 'index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return }
    const file = path.join(siteDir, rel)
    if (!file.startsWith(siteDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } })
  try {
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.waitForTimeout(1000)
    return await page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, Number(getComputedStyle(document.getElementById(id)).fontWeight)])), ids)
  } finally {
    await context.close()
    server.close()
  }
}

/* ─── tests ─── */

/** Poll until `check` holds on the page, riding out a reload in between. */
async function waitUntil(page, check, arg, timeout = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { if (await page.evaluate(check, arg)) return true } catch { /* navigating */ }
    await sleep(150)
  }
  return false
}
const weightOf = (id) => Number(getComputedStyle(document.getElementById(id)).fontWeight)
/** Set on a page so a later check can tell it was never reloaded. */
const mark = (page) => page.evaluate(() => { window.__froamSameVisit = true })
const sameVisit = (page) => page.evaluate(() => window.__froamSameVisit === true)

test('copy written into the page reaches the other open device by itself, and neither save wipes the other', async () => {
  // Both open first, the way people actually have them: neither has seen the other's edit.
  const computer = await openOnComputer()
  const phone = await openOnPhone()
  try {
    await writeOver(computer.page, 'feature-1-title', 'Book from the laptop')
    await saveToRepo(computer.page, 'Book from the laptop')
    // The words are in index.html now; the phone's page reloads itself to show them, editor and all.
    assert(await waitUntil(phone.page, () => document.getElementById('feature-1-title')?.innerText.trim() === 'Book from the laptop'), `the phone still shows "${await textOf(phone.page, 'feature-1-title')}"`)
    await phone.page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 10000 })
    await phone.page.waitForTimeout(1500)

    await writeOver(phone.page, 'subtitle', 'Fixed on the bus', { touch: true })
    await saveToRepo(phone.page, 'Fixed on the bus')
    assert(savedAnywhere('Book from the laptop'), 'the phone\'s save wiped the edit the laptop saved')
    assert(await waitUntil(computer.page, () => document.getElementById('subtitle')?.innerText.trim() === 'Fixed on the bus'), `the laptop still shows "${await textOf(computer.page, 'subtitle')}"`)
    await computer.page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 10000 })
    await computer.page.waitForTimeout(1500)

    await writeOver(computer.page, 'badge', 'Go somewhere new')
    await saveToRepo(computer.page, 'Go somewhere new')
    assert(savedAnywhere('Fixed on the bus'), 'the laptop\'s save wiped the edit the phone saved')
    assert(savedAnywhere('Book from the laptop'), 'the laptop\'s second save lost its own first edit')
  } finally {
    await computer.context.close()
    await phone.context.close()
  }
})

test('style edits: each save shows on the other open device at once, with no reload, and none is wiped', async () => {
  const computer = await openOnComputer()
  const phone = await openOnPhone()
  try {
    await mark(computer.page)
    await mark(phone.page)
    await makeBold(computer.page, 'plan-cell')
    await saveDesign(computer.page)
    assert(await waitUntil(phone.page, weightOf, 'plan-cell', 4000), 'the laptop\'s bold did not show on the open phone')
    assert(await sameVisit(phone.page), 'the phone reloaded to show a style change')

    await makeBold(phone.page, 'subtitle', { touch: true })
    await saveDesign(phone.page)
    assert(await waitUntil(computer.page, (id) => Number(getComputedStyle(document.getElementById(id)).fontWeight) >= 700, 'subtitle', 4000), 'the phone\'s bold did not show on the open laptop')
    assert(await sameVisit(computer.page), 'the laptop reloaded to show a style change')
    let seen = await visitorWeights(['plan-cell', 'subtitle'])
    assert(seen['plan-cell'] >= 700, `the phone's save wiped the laptop's bold (visitors see plan-cell at ${seen['plan-cell']})`)
    assert(seen.subtitle >= 700, `the phone's bold didn't reach visitors (${seen.subtitle})`)

    await makeBold(computer.page, 'email-label')
    await saveDesign(computer.page)
    seen = await visitorWeights(['plan-cell', 'subtitle', 'email-label'])
    assert(seen.subtitle >= 700, `the laptop's save wiped the phone's bold (visitors see subtitle at ${seen.subtitle})`)
    assert(seen['plan-cell'] >= 700 && seen['email-label'] >= 700, `the laptop lost its own bold (${JSON.stringify(seen)})`)
  } finally {
    await computer.context.close()
    await phone.context.close()
  }
})

test('work not yet saved on one device survives the other device\'s save arriving', async () => {
  const computer = await openOnComputer()
  const phone = await openOnPhone()
  try {
    // Unsaved on the phone.
    await makeBold(phone.page, 'small-word', { touch: true })
    // Saved on the laptop, arriving on the phone while that bold is still unsaved.
    await makeBold(computer.page, 'nav-pricing')
    await saveDesign(computer.page)
    assert(await waitUntil(phone.page, (id) => Number(getComputedStyle(document.getElementById(id)).fontWeight) >= 700, 'nav-pricing', 4000), 'the laptop\'s save did not reach the phone')
    const kept = await phone.page.evaluate(() => Number(getComputedStyle(document.getElementById('small-word')).fontWeight))
    assert(kept >= 700, `the phone's unsaved bold was dropped when the laptop's save arrived (${kept})`)
    // And it is still the phone's to save.
    await saveDesign(phone.page)
    const seen = await visitorWeights(['small-word', 'nav-pricing'])
    assert(seen['small-word'] >= 700 && seen['nav-pricing'] >= 700, `after both saves visitors see ${JSON.stringify(seen)}`)
  } finally {
    await computer.context.close()
    await phone.context.close()
  }
})

/** Select an element and press a button in the selection bar (Italic, say). */
async function pressInBar(page, id, label, { touch = false } = {}) {
  await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'instant' }), id)
  await page.waitForTimeout(150)
  const box = await page.locator(`#${id}`).boundingBox()
  const at = [box.x + Math.min(30, box.width / 2), box.y + box.height / 2]
  if (touch) await page.touchscreen.tap(...at)
  else await page.mouse.click(...at)
  await page.waitForTimeout(500)
  const button = page.locator(`.froam-floating-bar [aria-label="${label}"]`).first()
  if (touch) await button.tap()
  else await button.click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
}
const publishedText = () => { const p = path.join(siteDir, 'froam', 'froam.published.json'); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '' }
const italicOf = (id) => getComputedStyle(document.getElementById(id)).fontStyle === 'italic'

test('plain Save: a laptop and an unpaired phone each pressing Save keep each other\'s edits, and the laptop sees the phone\'s live', async () => {
  const computer = await openOnComputer()
  // A phone on the Wi-Fi that was never paired: its Save goes to the computer, not the code.
  const context = await browser.newContext({ ...PHONE })
  const page = await context.newPage()
  // Its live line is down (asleep, a patchy signal): it never hears the laptop's Save, and saves anyway.
  await page.route('**/__froam/events', (route) => route.abort())
  await page.goto(pairLink.split('#')[0])
  await page.waitForSelector('.global-chef-button', { timeout: 20000 })
  await page.tap('.global-chef-button')
  await page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 20000 })
  await page.waitForTimeout(2000)
  try {
    await mark(computer.page)
    await pressInBar(computer.page, 'plan-cell', 'Italic')
    await computer.page.keyboard.press('Control+s')
    for (let i = 0; i < 40 && !/italic/.test(publishedText()); i += 1) await sleep(150)
    assert(/italic/.test(publishedText()), 'the laptop\'s Save did not reach froam.published.json')

    await pressInBar(page, 'subtitle', 'Italic', { touch: true })
    await page.locator('.froam-tb__save-btn:not(.froam-tb__save-btn--repo)').first().tap()
    for (let i = 0; i < 40 && (publishedText().match(/italic/g) ?? []).length < 2; i += 1) await sleep(150)
    const saved = JSON.parse(publishedText()).routes['/'].desktop.store
    const italics = Object.values(saved).filter((draft) => draft?.styles?.fontStyle === 'italic').length
    assert(italics === 2, `after both Saves, ${italics} italic edit${italics === 1 ? ' is' : 's are'} kept — the phone's Save wiped the laptop's`)

    assert(await waitUntil(computer.page, italicOf, 'subtitle', 5000), 'the phone\'s Save did not show on the open laptop')
    assert(await waitUntil(computer.page, italicOf, 'plan-cell', 1000), 'the laptop lost its own italic when the phone\'s Save arrived')
    assert(await sameVisit(computer.page), 'the laptop reloaded to show a Save')
  } finally {
    await computer.context.close()
    await context.close()
  }
})


test('an invite link opened on a phone asks for a name at once, and the computer sees them arrive', async () => {
  const computer = await openOnComputer()
  const context = await browser.newContext({ ...PHONE })
  try {
    const opened = await computer.page.evaluate(async () => (await fetch('/api/froam/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Owner' }) })).json())
    await computer.page.evaluate((o) => {
      localStorage.setItem('froam-room-owner:v1', JSON.stringify({ roomId: o.room.id, invites: o.invites, createdAt: Date.now() }))
      localStorage.setItem(`froam-room:${o.room.id}`, JSON.stringify(o.you))
    }, opened)
    await computer.page.reload()
    await computer.page.waitForSelector('.global-chef-button', { timeout: 20000 })
    // The phone opens the link and does nothing else: the name box must find them.
    const phone = await context.newPage()
    await phone.goto(`${computerLink}?froam-room=${opened.room.id}&froam-token=${opened.invites.editor}`)
    const name = await phone.waitForSelector('input[aria-label="Your name"]', { timeout: 20000 }).catch(() => null)
    assert(name, 'an editor invite opened on a phone showed no name box, so they never joined')
    await name.fill('Phone friend')
    await phone.keyboard.press('Enter')
    // The computer, editor closed, sees them in the room.
    const seen = await computer.page.waitForFunction(() => /Phone friend is here/.test(document.querySelector('.froam-presence__rail')?.textContent ?? ''), null, { timeout: 15000 }).then(() => true, () => false)
    assert(seen, 'the computer never showed the phone in the room')
    // And the phone sees the owner.
    const back = await phone.waitForFunction(() => /Owner is here/.test(document.querySelector('.froam-presence__rail')?.textContent ?? ''), null, { timeout: 15000 }).then(() => true, () => false)
    assert(back, 'the phone never showed the owner in the room')
  } finally { await context.close(); await computer.context.close() }
})

test('Go Live from the phone: one confirm, only Froam\'s files are committed and pushed, and it says Live once the site has it', async () => {
  // The site in git, with a bare repo for GitHub and a host that serves what main holds.
  const remote = path.join(path.dirname(siteDir), `${path.basename(siteDir)}-remote.git`)
  const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  run(path.dirname(siteDir), 'init', '--quiet', '--bare', '--initial-branch=main', remote)
  run(siteDir, 'init', '--quiet', '--initial-branch=main')
  run(siteDir, 'config', 'user.name', 'Tester')
  run(siteDir, 'config', 'user.email', 'tester@example.com')
  fs.writeFileSync(path.join(siteDir, '.gitignore'), 'froam/froam.rooms.json\nfroam/froam.published.json\nfroam/froam.project.json\n.froam/\n')
  run(siteDir, 'add', '.')
  run(siteDir, 'commit', '--quiet', '-m', 'the site so far')
  run(siteDir, 'remote', 'add', 'origin', remote)
  run(siteDir, 'push', '--quiet', '-u', 'origin', 'main')
  const host = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
    try {
      const body = execFileSync('git', ['show', `main:${rel}`], { cwd: remote, stdio: ['ignore', 'pipe', 'ignore'] })
      res.writeHead(200, { 'Content-Type': rel.endsWith('.css') ? 'text/css' : rel.endsWith('.js') ? 'text/javascript' : 'text/html' })
      res.end(body)
    } catch { res.writeHead(404); res.end() }
  })
  await new Promise((r) => host.listen(0, '127.0.0.1', r))
  fs.writeFileSync(path.join(siteDir, 'froam.config.json'), JSON.stringify({ siteUrl: `http://127.0.0.1:${host.address().port}` }))
  run(siteDir, 'add', 'froam.config.json')
  run(siteDir, 'commit', '--quiet', '-m', 'where it lives')
  run(siteDir, 'push', '--quiet')
  // Someone's own unfinished work: it must not ride along.
  fs.writeFileSync(path.join(siteDir, 'draft-notes.txt'), 'half an idea\n')

  const computer = await openOnComputer()
  const phone = await openOnPhone()
  try {
    await writeOver(phone.page, 'email-label', 'Your email address', { touch: true })
    await phone.page.locator('.froam-tb__live-btn').tap()
    await phone.page.waitForSelector('.froam-golive__card', { timeout: 10000 })
    // The sheet says where and what before anything moves.
    assert(await waitUntil(phone.page, () => Boolean(document.querySelector('.froam-golive__files')), null, 20000), `no plan: ${await phone.page.locator('.froam-golive__body').innerText().catch(() => '')}`)
    const sheet = await phone.page.locator('.froam-golive__body').innerText()
    assert(/main/.test(sheet), `the sheet doesn't say which branch: ${sheet}`)
    assert(/Page: index\.html|index\.html/.test(sheet), `the sheet doesn't list the page: ${sheet}`)
    assert(/stays? as/.test(sheet), `the sheet doesn't say other work stays out: ${sheet}`)
    assert(run(remote, 'rev-list', '--count', 'main') === '2', 'something was pushed before Put it live')
    // FROAM_E2E_SHOTS=<folder>: keep pictures of the sheet, to look at.
    const shot = async (page, name) => { if (process.env.FROAM_E2E_SHOTS) await page.screenshot({ path: path.join(process.env.FROAM_E2E_SHOTS, `${name}.png`) }) }
    await shot(phone.page, 'golive-phone-confirm')

    await phone.page.locator('.froam-golive__primary').tap()
    assert(await waitUntil(phone.page, () => /^Live/.test(document.querySelector('#froam-golive-title')?.textContent ?? ''), null, 60000), `the phone never said Live: ${await phone.page.locator('.froam-golive__body').innerText().catch(() => '')}`)
    await shot(phone.page, 'golive-phone-live')
    const pushed = run(remote, 'show', '--name-only', '--format=%s', 'main').split('\n').filter(Boolean)
    assert(/^Froam:/.test(pushed[0]), `the commit is called "${pushed[0]}"`)
    assert(pushed.includes('index.html'), `the page isn't in the commit: ${pushed.join(', ')}`)
    assert(!pushed.includes('draft-notes.txt') && !pushed.some((file) => /rooms|published|project\.json/.test(file)), `the commit took more than Froam's files: ${pushed.join(', ')}`)
    assert(run(remote, 'show', 'main:index.html').includes('Your email address'), 'the pushed page doesn\'t have the new words')
    assert(/\?\? draft-notes\.txt/.test(run(siteDir, 'status', '--porcelain')), 'the unfinished work was touched')
    // The laptop, open the whole time, heard it went live.
    assert(await waitUntil(computer.page, () => document.querySelector('.froam-tb__live-btn')?.getAttribute('data-state') === 'live', null, 5000), 'the laptop wasn\'t told it went live')
    // A laptop that reloads (a saved page reloads open editors) still knows: it may have been mid-reload when the news went out.
    await computer.page.reload()
    await computer.page.waitForSelector('.global-chef-button', { timeout: 20000 })
    if (!(await computer.page.locator('#froam-editor-portal .froam-chrome').count())) await computer.page.keyboard.press('Control+.')
    await computer.page.waitForSelector('#froam-editor-portal .froam-chrome', { timeout: 20000 })
    assert(await waitUntil(computer.page, () => document.querySelector('.froam-tb__live-btn')?.getAttribute('data-state') === 'live', null, 10000), 'after a reload the laptop forgot it went live')
    if (process.env.FROAM_E2E_SHOTS) {
      // The laptop's own look at the sheet, for the record.
      await computer.page.locator('.froam-tb__live-btn').click()
      await waitUntil(computer.page, () => Boolean(document.querySelector('.froam-golive__foot')), null, 15000)
      await computer.page.waitForTimeout(800)
      await shot(computer.page, 'golive-laptop')
    }
  } finally {
    await computer.context.close()
    await phone.context.close()
    host.close()
  }
})

/* ─── run ─── */

const lan = (() => {
  const VIRTUAL = /warp|vpn|tun|tap|utun|vethernet|wsl|docker|virtualbox|vmware|vbox|hyper-?v|zerotier|tailscale|wireguard|^br-|^veth/i
  const all = Object.entries(os.networkInterfaces()).flatMap(([name, nets]) => (nets ?? []).filter((n) => n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')).map((n) => ({ name, address: n.address })))
  return (all.find((n) => !VIRTUAL.test(n.name)) ?? all[0])?.address
})()
if (!lan) {
  console.log('e2e sync: skipped — no network interface to reach the bridge as another device')
  process.exit(0)
}
if (!fs.existsSync(path.join(ROOT, 'dist', 'standalone', 'froam-editor.js'))) {
  console.log('e2e sync: dist/standalone is missing — run `npm run build` first')
  process.exit(1)
}
const browserPath = findBrowser()
if (!browserPath) {
  console.log('e2e sync: no Chrome or Chromium found — set FROAM_E2E_CHROME')
  process.exit(1)
}

siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-e2e-sync-'))
fs.cpSync(FIXTURE, siteDir, { recursive: true })
const port = await freePort()
const bridge = spawn(process.execPath, [BIN, 'dev', '--serve', '.', '--port', String(port), '--host'], { cwd: siteDir, env: { ...process.env, FROAM_SHARE: 'off', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
bridge.stdout.on('data', (d) => { bridgeLog += d })
bridge.stderr.on('data', (d) => { bridgeLog += d })
let passed = 0
try {
  for (let i = 0; i < 150 && !/froam-pair=/.test(bridgeLog); i += 1) await sleep(150)
  const key = bridgeLog.match(/#froam-pair=([A-Za-z0-9_-]+)/)?.[1]
  if (!key) throw new Error(`froam dev --host printed no pairing link:\n${bridgeLog.slice(-600)}`)
  computerLink = `http://127.0.0.1:${port}/`
  pairLink = `http://${lan}:${port}/#froam-pair=${key}`
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(computerLink)).ok) break } catch { /* not yet */ } await sleep(150) }
  browser = await chromium.launch({ executablePath: browserPath, headless: !process.env.FROAM_E2E_HEADED })
  console.log('sync')
  // FROAM_E2E_ONLY=<words> runs the tests whose names have them; each gets three minutes at most.
  const only = process.env.FROAM_E2E_ONLY
  for (const t of only ? tests.filter((entry) => entry.name.includes(only)) : tests) {
    try {
      let timer
      await Promise.race([t.fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out after 3 minutes')), 180_000) })]).finally(() => clearTimeout(timer))
      passed += 1
      console.log(`  ok  ${t.name}`)
    } catch (error) {
      console.log(`  FAIL ${t.name}\n       ${error.message}`)
    }
  }
} catch (error) {
  console.log(`e2e sync: setup failed — ${error.message}`)
} finally {
  await browser?.close().catch(() => {})
  bridge.kill()
  await sleep(300)
  if (process.env.FROAM_E2E_KEEP) console.log(`kept ${siteDir}`)
  else try { fs.rmSync(siteDir, { recursive: true, force: true }) } catch { /* Windows may still hold a file */ }
}
console.log(`e2e sync: ${passed}/${process.env.FROAM_E2E_ONLY ? tests.filter((entry) => entry.name.includes(process.env.FROAM_E2E_ONLY)).length : tests.length} passed`)
process.exitCode = passed === tests.length ? 0 : 1
