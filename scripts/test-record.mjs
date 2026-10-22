/**
 * The record (lib/record.mjs): who changed what, who approved it, and when —
 * kept in the project, linked entry to entry, and committed by Go Live.
 *
 * What an office will ask of it, tested as they'd ask it: does a change by a
 * contributor show who asked and who approved; does editing an old line show;
 * does the record reach the repo with the site; can it be printed.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RECORD_FILE,
  RECORD_GENESIS,
  canonicalJson,
  createFroamRecord,
  describeEntry,
  describeStoreChanges,
  ownerName,
  recordToCsv,
  renderRecordReport,
  verifyRecord,
} from '../lib/record.mjs'
import { createFroamRoomApi } from '../lib/room-store.mjs'
import { createFroamPublishApi } from '../lib/publish-store.mjs'
import { createGoLive } from '../lib/go-live.mjs'
import { createBridgeServer } from '../lib/dev-server.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'froam-test-record-'))
let dirs = 0
const freshDir = () => {
  const dir = path.join(base, `d${(dirs += 1)}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const tests = []
const test = (name, fn) => tests.push([name, fn])

/* ── the chain ─────────────────────────────────────────── */

test('entries are numbered, timed, and each one carries the hash of the one before', () => {
  let clock = Date.UTC(2026, 9, 22, 9, 0)
  const record = createFroamRecord({ froamDir: freshDir(), now: () => (clock += 60_000) })
  const first = record.append({ type: 'saved', by: { name: 'Ahmad Nuhu', role: 'owner', via: 'this computer' }, pages: ['/'], changes: [{ label: 'Words · Heading', before: 'Old', after: 'New' }] })
  const second = record.append({ type: 'request.submitted', by: { name: 'Amina', role: 'contributor' }, title: 'Opening hours', pages: ['/contact'] })
  assert.equal(first.seq, 1)
  assert.equal(first.prev, RECORD_GENESIS)
  assert.equal(second.seq, 2)
  assert.equal(second.prev, first.hash)
  assert.equal(first.at, '2026-10-22T09:01:00.000Z')
  const check = record.verify()
  assert.equal(check.ok, true)
  assert.equal(check.count, 2)
  assert.equal(check.head, second.hash)
  assert.equal(record.head(), second.hash)
  assert.deepEqual(record.read({ limit: 1 }).map((entry) => entry.seq), [2], 'newest first')
  assert.deepEqual(record.read({ before: 2 }).map((entry) => entry.seq), [1], 'paging back')
})

test('changing an old line, deleting one, or reordering them is caught at the line it happened', () => {
  const record = createFroamRecord({ froamDir: freshDir() })
  for (const name of ['A', 'B', 'C', 'D']) record.append({ type: 'saved', by: { name }, changes: [{ label: `Words by ${name}`, after: name }] })
  const lines = fs.readFileSync(record.file, 'utf8').trim().split('\n')

  const edited = [...lines]
  edited[1] = edited[1].replace('Words by B', 'Words by Z')
  const quietEdit = verifyRecord(edited.join('\n'))
  assert.equal(quietEdit.ok, false)
  assert.equal(quietEdit.problem.line, 2)
  assert.match(quietEdit.problem.reason, /changed after it was written/)

  // Editing a line and fixing its own hash still breaks the next link.
  const rehashed = JSON.parse(edited[1])
  rehashed.hash = rehash(rehashed)
  const withHash = [...lines]
  withHash[1] = JSON.stringify(rehashed)
  assert.equal(verifyRecord(withHash.join('\n')).problem.line, 3)

  const deleted = lines.filter((_, index) => index !== 2)
  const gap = verifyRecord(deleted.join('\n'))
  assert.equal(gap.ok, false)
  assert.equal(gap.problem.line, 3)
  assert.match(gap.problem.reason, /missing or out of order/)

  const swapped = [lines[0], lines[2], lines[1], lines[3]]
  assert.equal(verifyRecord(swapped.join('\n')).ok, false)

  const cut = [...lines.slice(0, 3), lines[3].slice(0, 40)]
  assert.equal(verifyRecord(cut.join('\n')).problem.line, 4)
  assert.equal(verifyRecord(lines.join('\n')).ok, true)
})

/** What someone covering their tracks would do: recompute the edited line's own hash. */
function rehash(entry) {
  const { hash: _hash, ...rest } = entry
  return createHash('sha256').update(canonicalJson(rest)).digest('hex')
}

test('line endings and key order don\'t matter — git on Windows may rewrite both', () => {
  const record = createFroamRecord({ froamDir: freshDir() })
  record.append({ type: 'saved', by: { name: 'A', role: 'owner' }, pages: ['/'] })
  record.append({ type: 'saved', by: { name: 'B', role: 'owner' }, pages: ['/about'] })
  const text = fs.readFileSync(record.file, 'utf8')
  assert.equal(verifyRecord(text.replace(/\n/g, '\r\n')).ok, true, 'CRLF broke the chain')
  const reordered = text.trim().split('\n').map((line) => {
    const entry = JSON.parse(line)
    return JSON.stringify(Object.fromEntries(Object.entries(entry).reverse()))
  }).join('\n')
  assert.equal(verifyRecord(reordered).ok, true, 'key order broke the chain')
  // Appending after a CRLF rewrite carries on the chain.
  fs.writeFileSync(record.file, text.replace(/\n/g, '\r\n'))
  record.append({ type: 'saved', by: { name: 'C' } })
  assert.equal(record.verify().ok, true)
  assert.equal(record.verify().count, 3)
})

test('what goes in is cleaned: names and notes clipped, no unknown fields, no stray refs', () => {
  const record = createFroamRecord({ froamDir: freshDir() })
  const entry = record.append({
    type: 'saved',
    by: { name: `  ${'x'.repeat(200)}  `, role: 'owner', email: 'someone@example.com', token: 'secret' },
    changes: Array.from({ length: 90 }, (_, index) => ({ label: `Change ${index}`, after: 'y'.repeat(500) })),
    count: 90,
    refs: { commit: 'abc123', 'bad key': 'x', nested: { no: true } },
    password: 'nope',
  })
  assert.equal(entry.by.name.length, 60)
  assert.equal(entry.by.email, undefined)
  assert.equal(entry.by.token, undefined)
  assert.equal(entry.password, undefined)
  assert.equal(entry.changes.length, 40)
  assert.equal(entry.count, 90)
  assert.ok(entry.changes[0].after.length <= 160)
  assert.deepEqual(entry.refs, { commit: 'abc123' })
  assert.throws(() => record.append({ by: { name: 'A' } }), /needs a type/)
})

test('the owner\'s name: the one set in froam.config.json, then git\'s', () => {
  const dir = freshDir()
  execFileSync('git', ['init', '--quiet'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Git Name'], { cwd: dir })
  const configPath = path.join(dir, 'froam.config.json')
  assert.equal(ownerName({ configPath, cwd: dir }), 'Git Name')
  fs.writeFileSync(configPath, JSON.stringify({ record: { name: 'Ahmad Nuhu' } }))
  assert.equal(ownerName({ configPath, cwd: dir }), 'Ahmad Nuhu')
})

/* ── what changed, in words ────────────────────────────── */

test('a save is described the way a person would say it', () => {
  const before = {
    'main:1/h1:1': { text: 'Plan a trip', fingerprint: { text: 'Plan a trip' } },
    'main:1/a:1': { href: '/old' },
    'main:1/p:2': { styles: { color: 'red' } },
    '__froam_injection__:hero-2': { html: '<section>' },
  }
  const after = {
    'main:1/h1:1': { text: 'Plan your trip', fingerprint: { text: 'Plan a trip' }, styles: { fontSize: '40px' } },
    'main:1/a:1': { href: 'https://wa.me/2349000000000' },
    'main:1/img:1': { imageUrl: 'data:image/png;base64,AAAA' },
  }
  const changes = describeStoreChanges(before, after, { routeKey: '/about' })
  const labels = changes.map((change) => change.label)
  assert.ok(labels.includes('Words · Heading “Plan a trip”'), labels.join(' | '))
  assert.ok(labels.includes('Look · Heading “Plan a trip”'))
  assert.ok(labels.includes('Link · Link'))
  assert.ok(labels.includes('Picture · Image'))
  assert.ok(labels.includes('Reset · Paragraph'))
  assert.ok(labels.includes('Took out an added section'))
  const words = changes.find((change) => change.label.startsWith('Words'))
  assert.equal(words.before, 'Plan a trip')
  assert.equal(words.after, 'Plan your trip')
  assert.equal(words.routeKey, '/about')
  const picture = changes.find((change) => change.label.startsWith('Picture'))
  assert.equal(picture.after, 'new picture', 'a picture\'s data went into the record')
  assert.match(changes.find((change) => change.label.startsWith('Look')).after, /font-size: 40px/)
  assert.deepEqual(describeStoreChanges(after, after), [], 'nothing changed, nothing said')
})

/* ── rooms: asked for, approved, sent back, taken back ── */

function res() {
  return { statusCode: 0, headers: {}, body: '', setHeader(key, value) { this.headers[key] = value }, end(text) { this.body = text } }
}
async function call(api, method, url, body) {
  const out = res()
  await api({ method, url, body }, out)
  return { status: out.statusCode, ...JSON.parse(out.body || '{}') }
}

test('a room keeps the record: who opened it, who joined as what, who asked, who approved, who took it back', async () => {
  const record = createFroamRecord({ froamDir: freshDir() })
  const api = createFroamRoomApi({
    file: path.join(freshDir(), 'froam.rooms.json'),
    record: (event) => { record.append(event) },
    onApproveRequest: async () => ({ detail: 'Published to the design files', undo: { drafts: [] } }),
    onRevertRequest: async () => ({ detail: 'Reverted' }),
  })
  const created = await call(api, 'POST', '/api/froam/rooms', { name: 'Ahmad Nuhu' })
  const roomId = created.room.id
  const owner = { token: created.invites.owner, actor: created.you.actor, session: created.you.session }
  const joined = await call(api, 'POST', `/api/froam/rooms/${roomId}/join`, { token: created.invites.contributor, name: 'Amina Bello' })
  const amina = { token: created.invites.contributor, actor: joined.you.actor, session: joined.you.session }
  const submit = (title) => call(api, 'POST', `/api/froam/rooms/${roomId}/requests`, {
    ...amina, routeKey: '/contact', viewport: 'desktop', title,
    store: { 'main:1/p:1': { text: 'Mon–Fri, 8am–5pm' } },
    changes: [{ label: 'Opening hours', before: 'Mon–Fri, 9am–4pm', after: 'Mon–Fri, 8am–5pm' }],
    note: 'From the March circular',
  })
  const first = await submit('New opening hours')
  const decided = await call(api, 'POST', `/api/froam/rooms/${roomId}/requests/${first.request.id}/decision`, { ...owner, decision: 'approved', note: 'Confirmed with admin' })
  assert.equal(decided.request.status, 'approved')
  const second = await submit('Holiday notice')
  await call(api, 'POST', `/api/froam/rooms/${roomId}/requests/${second.request.id}/decision`, { ...owner, decision: 'changes-requested', note: 'Wait for the date' })
  await call(api, 'POST', `/api/froam/rooms/${roomId}/requests/${first.request.id}/revert`, { ...owner, note: 'Hours changed again' })

  const entries = record.all()
  assert.deepEqual(entries.map((entry) => entry.type), ['room.opened', 'room.joined', 'request.submitted', 'request.approved', 'request.submitted', 'request.sent-back', 'request.reverted'])
  const [opened, join, asked, approved, , sentBack, reverted] = entries
  assert.deepEqual(opened.by, { name: 'Ahmad Nuhu', role: 'owner', via: 'review room' })
  assert.deepEqual(join.by, { name: 'Amina Bello', role: 'contributor', via: 'invite link' })
  assert.equal(asked.by.name, 'Amina Bello')
  assert.equal(asked.title, 'New opening hours')
  assert.deepEqual(asked.pages, ['/contact'])
  assert.equal(asked.changes[0].after, 'Mon–Fri, 8am–5pm')
  assert.equal(asked.note, 'From the March circular')
  assert.equal(approved.by.name, 'Ahmad Nuhu')
  assert.deepEqual(approved.author, { name: 'Amina Bello', role: 'contributor' })
  assert.equal(approved.note, 'Confirmed with admin')
  assert.equal(approved.result, 'Published to the design files')
  assert.equal(approved.refs.request, first.request.id)
  assert.equal(sentBack.note, 'Wait for the date')
  assert.equal(sentBack.changes, undefined, 'nothing went live, so no changes are listed')
  assert.equal(reverted.note, 'Hours changed again')
  assert.equal(describeEntry(approved), 'Ahmad Nuhu approved “New opening hours” from Amina Bello')
  assert.equal(describeEntry(asked), 'Amina Bello asked for “New opening hours”: 1 change on /contact')
  assert.equal(record.verify().ok, true)
})

test('a record that can\'t be written never blocks an approval', async () => {
  const logs = []
  const api = createFroamRoomApi({
    file: path.join(freshDir(), 'froam.rooms.json'),
    record: () => { throw new Error('disk full') },
    log: (line) => logs.push(line),
  })
  const created = await call(api, 'POST', '/api/froam/rooms', { name: 'Owner' })
  assert.equal(created.status, 200)
  assert.ok(logs.some((line) => /record failed: disk full/.test(line)))
})

test('the plain Save is recorded with what changed on the page', async () => {
  const seen = []
  const api = createFroamPublishApi({ file: path.join(freshDir(), 'froam.published.json'), onPublished: (input) => { seen.push(input) } })
  const post = (store) => {
    const out = res()
    const req = Object.assign(new (http.IncomingMessage)(null), { method: 'POST', url: '/api/froam/published' })
    const done = api(req, out)
    req.push(JSON.stringify({ routeKey: '/', viewportMode: 'desktop', store }))
    req.push(null)
    return done
  }
  await post({ 'main:1/h1:1': { text: 'One' } })
  await post({ 'main:1/h1:1': { text: 'Two' } })
  assert.equal(seen.length, 2)
  assert.deepEqual(seen[1].before, { 'main:1/h1:1': { text: 'One' } })
  assert.deepEqual(seen[1].after, { 'main:1/h1:1': { text: 'Two' } })
  assert.equal(describeStoreChanges(seen[1].before, seen[1].after)[0].after, 'Two')
})

/* ── Go Live: the record goes with the site ────────────── */

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

function newRepo(name, { ignoreRecord = false } = {}) {
  const remote = path.join(base, `${name}.git`)
  const site = path.join(base, name)
  git(base, 'init', '--quiet', '--bare', '--initial-branch=main', remote)
  fs.mkdirSync(path.join(site, 'froam'), { recursive: true })
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html><body><h1>Hello</h1></body></html>\n')
  fs.writeFileSync(path.join(site, 'froam', 'froam.design.json'), '{"version":3,"routes":{}}\n')
  fs.writeFileSync(path.join(site, 'froam', 'froam.generated.css'), '/* nothing yet */\n')
  fs.writeFileSync(path.join(site, 'froam', 'froam.runtime.js'), '/* runtime */\n')
  fs.writeFileSync(path.join(site, '.gitignore'), ignoreRecord ? `froam/${RECORD_FILE}\n` : '')
  git(site, 'init', '--quiet', '--initial-branch=main')
  git(site, 'config', 'user.name', 'Tester')
  git(site, 'config', 'user.email', 'tester@example.com')
  git(site, 'remote', 'add', 'origin', remote)
  git(site, 'add', '.')
  git(site, 'commit', '--quiet', '-m', 'first')
  git(site, 'push', '--quiet', '-u', 'origin', 'main')
  return { site, remote }
}

async function finished(live) {
  for (let i = 0; i < 400; i += 1) {
    const job = live.job()
    if (job?.done) return job
    await sleep(25)
  }
  throw new Error(`still going: ${JSON.stringify(live.job())}`)
}

test('Go Live commits the record with the site, and the commit names its newest hash', async () => {
  const { site, remote } = newRepo('golive')
  const froamDir = path.join(site, 'froam')
  const record = createFroamRecord({ froamDir })
  record.append({ type: 'saved', by: { name: 'Ahmad Nuhu', role: 'owner' }, pages: ['/'], changes: [{ label: 'Look · Heading', after: 'color: navy' }] })
  fs.writeFileSync(path.join(froamDir, 'froam.generated.css'), 'h1 { color: navy !important; }\n')
  const live = createGoLive({ froamDir, sourceRoot: site, serveDir: site, record, checkEveryMs: 10, checkForMs: 200 })
  live.recordSave('/')
  const plan = await live.plan()
  assert.equal(plan.blocked, null)
  assert.equal(plan.recording, true)
  assert.deepEqual(plan.files.map((file) => file.path), ['froam/froam.generated.css'], 'the record rides along; it is not listed as a change of its own')
  const started = await live.start(plan.token, { by: { name: 'Ahmad Nuhu', role: 'owner', via: 'this computer' } })
  assert.equal(started.ok, true, started.error)
  const job = await finished(live)
  assert.equal(job.ok, true, job.message)

  const pushed = git(remote, 'show', '--name-only', '--format=%B', 'main')
  assert.match(pushed, new RegExp(`froam/${RECORD_FILE.replace('.', '\\.')}`))
  const trailer = /Froam-Record: ([0-9a-f]{64})/.exec(pushed)?.[1]
  assert.ok(trailer, pushed)
  const committed = git(remote, 'show', `main:froam/${RECORD_FILE}`)
  assert.equal(verifyRecord(committed).ok, true)
  assert.equal(verifyRecord(committed).head, trailer, 'the commit vouches for the record it carries')
  const entries = record.all()
  assert.equal(entries[1].type, 'live.started')
  assert.equal(entries[1].by.name, 'Ahmad Nuhu')
  assert.equal(entries.at(-1).type, 'live.finished')
  assert.match(entries.at(-1).refs.commit, /^[0-9a-f]{7,}$/)

  // What happened after the commit waits for the next one; on its own it isn't something to put live.
  const next = await live.plan()
  assert.match(next.blocked ?? '', /Nothing new to put live/)
})

test('Go Live leaves the record out when it is git-ignored or turned off — and still goes', async () => {
  for (const [name, setup] of [['ignored', { ignoreRecord: true }], ['off', {}]]) {
    const { site, remote } = newRepo(`golive-${name}`, setup)
    if (name === 'off') fs.writeFileSync(path.join(site, 'froam.config.json'), JSON.stringify({ record: { commit: false } }))
    const froamDir = path.join(site, 'froam')
    const record = createFroamRecord({ froamDir })
    fs.writeFileSync(path.join(froamDir, 'froam.generated.css'), 'h1 { color: red !important; }\n')
    const live = createGoLive({ froamDir, sourceRoot: site, serveDir: site, record, checkEveryMs: 10, checkForMs: 200 })
    const plan = await live.plan()
    await live.start(plan.token, { by: { name: 'Owner', role: 'owner' } })
    const job = await finished(live)
    assert.equal(job.ok, true, `${name}: ${job.message}`)
    const pushed = git(remote, 'show', '--name-only', '--format=%B', 'main')
    assert.doesNotMatch(pushed, /froam\.record\.jsonl|Froam-Record/, name)
    assert.ok(record.exists(), `${name}: the record is still kept on this computer`)
  }
})

/* ── froam dev: saves, the endpoints, the report ───────── */

test('froam dev records saves, answers /__froam/record, and prints a report', async () => {
  const site = freshDir()
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><html><body><h1>Hi</h1></body></html>')
  fs.writeFileSync(path.join(site, 'froam.config.json'), JSON.stringify({ record: { name: 'Ahmad Nuhu' } }))
  const froamDir = path.join(site, 'froam')
  const { server } = createBridgeServer({ froamDir, serveDir: site })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const request = (method, url, body) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers: { host: `localhost:${port}`, 'content-type': 'application/json' } }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    if (body !== undefined) req.write(JSON.stringify(body))
    req.end()
  })
  try {
    const save = (text) => request('POST', '/__froam/repo/save', { routeKey: '/', viewportMode: 'desktop', store: { 'body/main:1/h1:1': { text, fingerprint: { text: 'Hi' } } } })
    assert.equal((await save('Welcome to the agency')).status, 200)
    assert.equal((await save('Welcome to the agency')).status, 200, 'saving again')
    assert.equal((await save('Welcome')).status, 200)

    const listed = JSON.parse((await request('GET', '/__froam/record')).body)
    assert.equal(listed.success, true)
    assert.equal(listed.you, 'Ahmad Nuhu')
    assert.equal(listed.entries.length, 2, 'a save that changed nothing was recorded')
    assert.equal(listed.entries[0].summary, 'Ahmad Nuhu saved 1 change on /')
    assert.equal(listed.entries[0].by.via, 'this computer')
    assert.equal(listed.entries[0].changes[0].before, 'Welcome to the agency')
    assert.equal(listed.verification.ok, true)

    const report = await request('GET', '/__froam/record/report')
    assert.equal(report.status, 200)
    assert.match(report.headers['content-type'], /text\/html/)
    assert.match(report.headers['content-security-policy'], /default-src 'none'/)
    assert.match(report.body, /The record checks out/)
    assert.match(report.body, /Welcome to the agency/)
    const csv = await request('GET', '/__froam/record/report?format=csv')
    assert.match(csv.headers['content-disposition'], /froam-record\.csv/)
    assert.equal(csv.body.trim().split('\r\n').length, 3)

    const renamed = JSON.parse((await request('POST', '/__froam/record/name', { name: '  Ahmad  Modibbo ' })).body)
    assert.equal(renamed.you, 'Ahmad Modibbo')
    assert.equal(JSON.parse(fs.readFileSync(path.join(site, 'froam.config.json'), 'utf8')).record.name, 'Ahmad Modibbo')
    const whoami = JSON.parse((await request('GET', '/__froam/whoami')).body)
    assert.equal(whoami.name, 'Ahmad Modibbo', 'rooms and the record agree on the owner\'s name')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('the report and spreadsheet escape what people typed', () => {
  const record = createFroamRecord({ froamDir: freshDir() })
  record.append({ type: 'request.submitted', by: { name: '<script>alert(1)</script>', role: 'contributor' }, title: 'Hi, "there"', changes: [{ label: 'Words', before: '<b>', after: '=SUM(A1)' }] })
  const html = renderRecordReport(record.all(), record.verify(), { site: 'agency.gov.example' })
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  const csv = recordToCsv(record.all())
  assert.match(csv, /"Hi, ""there"""/)
})

/* ── froam record ──────────────────────────────────────── */

test('froam record --verify passes a clean record and fails an edited one', () => {
  const site = freshDir()
  const record = createFroamRecord({ froamDir: path.join(site, 'froam') })
  record.append({ type: 'saved', by: { name: 'A' } })
  record.append({ type: 'saved', by: { name: 'B' } })
  const cli = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'froam.mjs'), 'record', ...args], { cwd: site, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } })
  const ok = cli('--verify')
  assert.equal(ok.status, 0, ok.stderr)
  assert.match(ok.stdout, /checks out: 2 entries/)
  const listed = cli()
  assert.match(listed.stdout, /#2 .* B saved 0 changes/)
  const report = cli('--report', 'out.html')
  assert.equal(report.status, 0, report.stderr)
  assert.ok(fs.existsSync(path.join(site, 'out.html')))
  fs.writeFileSync(record.file, fs.readFileSync(record.file, 'utf8').replace('"name":"A"', '"name":"Z"'))
  const bad = cli('--verify')
  assert.equal(bad.status, 1)
  assert.match(bad.stdout, /doesn't check out at line 1/)
})

let failed = 0
for (const [name, run] of tests) {
  try {
    await run()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.stack ?? error.message}`)
  }
}
try { fs.rmSync(base, { recursive: true, force: true }) } catch { /* Windows may hold a file */ }
console.log(`record: ${tests.length - failed}/${tests.length} passed`)
process.exitCode = failed ? 1 : 0
