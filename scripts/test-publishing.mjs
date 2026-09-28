/**
 * Publishing without a developer, end to end on the server side:
 * approve → undo → revert, requests across pages, style write-back into
 * Tailwind class lists, the GitHub publisher (against a fake GitHub), and
 * notifications.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { approveChangeRequest, revertChangeRequest } from '../lib/codegen.mjs'
import { applyStyleEdits, revertClassLists, rewriteClassList, utilityFor } from '../lib/style-writeback.mjs'
import { applyTextEdits } from '../lib/source-writeback.mjs'
import { createGitHubPublisher, pullRequestBody } from '../lib/github-publisher.mjs'
import { createFroamNotifier, openLink } from '../lib/notifier.mjs'
import { createBridgeServer } from '../lib/dev-server.mjs'
import fs from 'node:fs'
import os from 'node:os'
import nodePath from 'node:path'

const tests = []
const test = (name, fn) => tests.push([name, fn])

const design = (routes) => ({ version: 2, routes })

/* ── approve / undo / revert ── */

test('approving returns how to take it back, per scope', () => {
  const before = design({ '/': { desktop: { 'main:1/h1:1': { text: 'Old headline' }, 'main:1/p:1': { styles: { color: 'red' } } } } })
  const { design: after, undo } = approveChangeRequest(before, {
    scopes: [
      { routeKey: '/', viewport: 'desktop', store: { 'main:1/h1:1': { text: 'New headline' }, 'main:1/h2:1': { text: 'Added' } }, removed: ['main:1/p:1'] },
      { routeKey: '/pricing', viewport: 'mobile', store: { 'main:1/h1:1': { text: 'Cheap' } }, removed: [] },
    ],
  })
  assert.equal(after.routes['/'].desktop['main:1/h1:1'].text, 'New headline')
  assert.equal(after.routes['/'].desktop['main:1/p:1'], undefined)
  assert.equal(after.routes['/pricing'].mobile['main:1/h1:1'].text, 'Cheap')
  assert.equal(undo.scopes.length, 2)
  assert.deepEqual(undo.scopes[0].store['main:1/h1:1'], { text: 'Old headline' })
  assert.deepEqual(undo.scopes[0].removed, ['main:1/h2:1'])

  const { design: back, skipped } = revertChangeRequest(after, undo)
  assert.equal(skipped.length, 0)
  assert.equal(back.routes['/'].desktop['main:1/h1:1'].text, 'Old headline')
  assert.equal(back.routes['/'].desktop['main:1/h2:1'], undefined)
  assert.deepEqual(back.routes['/'].desktop['main:1/p:1'], { styles: { color: 'red' } })
  assert.equal(back.routes['/pricing'].mobile['main:1/h1:1'], undefined)
})

test('reverting leaves alone what someone changed again since', () => {
  const { design: after, undo } = approveChangeRequest(design({}), { routeKey: '/', viewport: 'desktop', store: { 'a:1': { text: 'Mine' }, 'b:1': { text: 'Also mine' } } })
  after.routes['/'].desktop['a:1'] = { text: 'Edited later by the owner' }
  const { design: back, skipped } = revertChangeRequest(after, undo)
  assert.deepEqual(skipped, [{ routeKey: '/', viewport: 'desktop', path: 'a:1' }])
  assert.equal(back.routes['/'].desktop['a:1'].text, 'Edited later by the owner')
  assert.equal(back.routes['/'].desktop['b:1'], undefined)
})

test('copy written into the source is undone in the source', () => {
  const { undo } = approveChangeRequest(design({}), { routeKey: '/', viewport: 'desktop', store: { 'a:1': { text: 'Hello team' } }, textEdits: [{ from: 'Hello world', to: 'Hello team' }, { from: 'Nope', to: 'Not written' }] }, { writtenText: ['Hello team'] })
  assert.deepEqual(undo.textEdits, [{ from: 'Hello team', to: 'Hello world' }])
})

/* ── style write-back ── */

test('style edits become utilities, replacing the ones they conflict with', () => {
  const { classList, written } = rewriteClassList('px-4 py-2 text-sm text-slate-700 bg-white rounded-lg font-medium', {
    color: '#0f172a', fontSize: '18px', backgroundColor: 'rgb(1, 2, 3)', fontWeight: '700', borderRadius: '9999px',
  })
  assert.deepEqual(classList.split(' '), ['px-4', 'py-2', 'text-[color:#0f172a]', 'text-[length:18px]', 'bg-[rgb(1,_2,_3)]', 'font-bold', 'rounded-[9999px]'])
  assert.equal(written.length, 5)
})

test('a property set under a variant is left as a Froam edit', () => {
  const { classList, written } = rewriteClassList('p-4 md:p-8 hover:bg-slate-100 text-lg', { padding: '20px', backgroundColor: '#fff', fontSize: '20px' })
  assert.deepEqual(written, ['backgroundColor', 'fontSize'])
  assert.ok(classList.includes('p-4') && classList.includes('md:p-8'))
})

test('values that would break a class list are never written', () => {
  assert.equal(utilityFor('color', 'url("x")'), null)
  assert.equal(utilityFor('padding', '12px 24px'), null)
  assert.equal(utilityFor('display', 'grid'), null)
})

test('style write-back needs a unique class list on the right tag', () => {
  const files = {
    'a.tsx': '<h1 className="text-4xl font-bold text-slate-900">Hi</h1>\n<p className="text-4xl font-bold">x</p>',
    'b.html': '<div class="card shadow">1</div><div class="shadow card">2</div>',
  }
  const read = (file) => files[file]
  const { results, changed } = applyStyleEdits(Object.keys(files), [
    { tag: 'h1', className: 'font-bold text-slate-900 text-4xl', styles: { color: '#e11d48' } },
    { tag: 'div', className: 'card shadow', styles: { color: '#e11d48' } },
    { tag: 'p', className: 'text-4xl font-bold text-slate-900', styles: { color: '#e11d48' } },
  ], { read })
  assert.equal(results[0].status, 'written')
  assert.equal(results[1].status, 'ambiguous')
  assert.equal(results[2].status, 'not-found', 'matched a class list on the wrong tag')
  const out = changed.get('a.tsx')
  assert.ok(out.startsWith('<h1 className="text-4xl font-bold text-[color:#e11d48]">'))

  const back = revertClassLists(['a.tsx'], [{ tag: 'h1', from: results[0].from, to: results[0].to }], { read: (file) => (file === 'a.tsx' ? out : null) })
  assert.equal(back.changed.get('a.tsx'), files['a.tsx'])
})

/* ── a fake GitHub ── */

function fakeGitHub(initialFiles) {
  const blobs = new Map()
  const trees = new Map()
  const commits = new Map()
  const refs = new Map()
  const pulls = []
  const calls = []
  const hash = (value) => createHash('sha1').update(value).digest('hex')
  const blobSha = (content) => { const sha = hash(`blob:${content}`); blobs.set(sha, content); return sha }
  const treeOf = (files) => { const sha = hash(`tree:${JSON.stringify([...files].sort())}`); trees.set(sha, new Map(files)); return sha }
  const commitOf = (tree, parents, message) => { const sha = hash(`commit:${tree}:${parents}:${message}:${commits.size}`); commits.set(sha, { tree, parents, message }); return sha }
  refs.set('main', commitOf(treeOf(Object.entries(initialFiles)), [], 'init'))

  const filesAt = (ref) => trees.get(commits.get(refs.get(ref)).tree)
  const json = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) })

  async function fetchImpl(url, init = {}) {
    const method = init.method ?? 'GET'
    const route = url.replace('https://api.github.com/repos/you/site', '')
    const body = init.body ? JSON.parse(init.body) : null
    calls.push(`${method} ${route.split('?')[0]}`)
    let m
    if (method === 'GET' && (m = /^\/git\/ref\/heads\/(.+)$/.exec(route))) return refs.has(decodeURIComponent(m[1])) ? json(200, { object: { sha: refs.get(decodeURIComponent(m[1])) } }) : json(404, { message: 'Not Found' })
    if (method === 'GET' && (m = /^\/git\/commits\/(\w+)$/.exec(route))) return json(200, { sha: m[1], tree: { sha: commits.get(m[1]).tree } })
    if (method === 'GET' && (m = /^\/git\/trees\/(\w+)/.exec(route))) return json(200, { tree: [...trees.get(m[1])].map(([path, content]) => ({ path, type: 'blob', sha: blobSha(content), size: content.length })) })
    if (method === 'GET' && (m = /^\/git\/blobs\/(\w+)$/.exec(route))) return json(200, { content: Buffer.from(blobs.get(m[1])).toString('base64'), encoding: 'base64' })
    if (method === 'POST' && route === '/git/trees') {
      const base = new Map(trees.get(body.base_tree))
      for (const entry of body.tree) base.set(entry.path, entry.content)
      return json(201, { sha: treeOf([...base]) })
    }
    if (method === 'POST' && route === '/git/commits') { const sha = commitOf(body.tree, body.parents, body.message); return json(201, { sha, html_url: `https://github.com/you/site/commit/${sha}` }) }
    if (method === 'POST' && route === '/git/refs') { refs.set(body.ref.replace('refs/heads/', ''), body.sha); return json(201, {}) }
    if (method === 'PATCH' && (m = /^\/git\/refs\/heads\/(.+)$/.exec(route))) { refs.set(decodeURIComponent(m[1]), body.sha); return json(200, {}) }
    if (method === 'DELETE' && (m = /^\/git\/refs\/heads\/(.+)$/.exec(route))) { refs.delete(decodeURIComponent(m[1])); return json(204) }
    if (method === 'POST' && route === '/pulls') { const pull = { number: pulls.length + 1, ...body, state: 'open', merged_at: null, html_url: `https://github.com/you/site/pull/${pulls.length + 1}` }; pulls.push(pull); return json(201, pull) }
    if ((m = /^\/pulls\/(\d+)(\/merge)?$/.exec(route))) {
      const pull = pulls[Number(m[1]) - 1]
      if (method === 'GET') return json(200, { ...pull, head: { ref: pull.head } })
      if (method === 'PATCH') { Object.assign(pull, body); return json(200, pull) }
      if (method === 'PUT' && m[2]) { refs.set(pull.base, refs.get(pull.head)); pull.state = 'closed'; pull.merged_at = 'now'; return json(200, { merged: true }) }
    }
    return json(404, { message: `fake GitHub has no ${method} ${route}` })
  }
  return { fetchImpl, filesAt, refs, pulls, calls, merge: (number) => { const pull = pulls[number - 1]; refs.set(pull.base, refs.get(pull.head)); pull.state = 'closed'; pull.merged_at = 'now' } }
}

const REPO_FILES = {
  'src/Hero.tsx': 'export const Hero = () => <h1 className="text-4xl font-bold text-slate-900">Plan a trip</h1>\n',
  'src/froam/froam.design.json': JSON.stringify({ version: 2, routes: { '/': { desktop: { 'main:1/p:1': { text: 'Owner copy' } } } } }),
  'README.md': '# site',
}

const request = (extra = {}) => ({
  id: 'req-123456789',
  title: 'Hero copy for teams',
  note: 'For the spring launch',
  routeKey: '/',
  viewport: 'desktop',
  scopes: [
    { routeKey: '/', viewport: 'desktop', store: { 'main:1/h1:1': { text: 'Plan your escape', styles: { color: '#e11d48' } } }, removed: [] },
    { routeKey: '/', viewport: 'mobile', store: { 'main:1/h1:1': { styles: { fontSize: '28px' } } }, removed: [] },
  ],
  changes: [{ label: 'Heading “Plan a trip”', before: 'Plan a trip', after: 'Plan your escape' }],
  textEdits: [{ from: 'Plan a trip', to: 'Plan your escape' }],
  styleEdits: [{ routeKey: '/', viewport: 'desktop', path: 'main:1/h1:1', tag: 'h1', className: 'text-4xl font-bold text-slate-900', styles: { color: '#e11d48' } }],
  actor: 'a_maya',
  createdBy: 'Maya',
  decidedBy: 'Ahmad',
  status: 'approved',
  ...extra,
})

const ROOM = { id: 'room-1', members: { a_maya: { name: 'Maya', title: 'Marketing' } } }

test('approving on GitHub opens one pull request with copy, classes and the design', async () => {
  const gh = fakeGitHub(REPO_FILES)
  const publisher = createGitHubPublisher({ token: 't', repo: 'you/site', dir: 'src/froam', siteUrl: 'https://site.test', tailwind: true, fetchImpl: gh.fetchImpl })
  const result = await publisher.onApproveRequest({ room: ROOM, request: request() })
  assert.equal(result.number, 1)
  assert.match(result.detail, /Opened pull request #1/)
  assert.equal(result.link, 'https://github.com/you/site/pull/1')
  assert.equal(gh.pulls[0].head, 'froam/hero-copy-for-teams-req-12')
  assert.match(gh.pulls[0].body, /Maya\*\* \(Marketing\) suggested this/)
  assert.match(gh.pulls[0].body, /\| Heading “Plan a trip” \| Plan a trip \| Plan your escape \|/)
  assert.match(gh.pulls[0].body, /froam-open=request%3Areq-123456789/)
  assert.doesNotMatch(gh.pulls[0].body, /token/i)

  const onBranch = gh.filesAt(gh.pulls[0].head)
  assert.equal(onBranch.get('src/Hero.tsx'), 'export const Hero = () => <h1 className="text-4xl font-bold text-[color:#e11d48]">Plan your escape</h1>\n')
  const written = JSON.parse(onBranch.get('src/froam/froam.design.json'))
  // Copy and the class went into the source; the owner's work and the mobile size stay drafts.
  assert.equal(written.routes['/'].desktop['main:1/p:1'].text, 'Owner copy')
  assert.equal(written.routes['/'].desktop['main:1/h1:1'], undefined)
  assert.equal(written.routes['/'].mobile['main:1/h1:1'].styles.fontSize, '28px')
  assert.ok(onBranch.get('src/froam/froam.generated.css').includes('28px'))
  assert.equal(gh.filesAt('main').get('src/Hero.tsx'), REPO_FILES['src/Hero.tsx'], 'main changed before anyone merged')
  assert.equal(result.undo.classLists.length, 1)
})

test('revert before merging closes the pull request and its branch', async () => {
  const gh = fakeGitHub(REPO_FILES)
  const publisher = createGitHubPublisher({ token: 't', repo: 'you/site', dir: 'src/froam', tailwind: true, fetchImpl: gh.fetchImpl })
  const approved = await publisher.onApproveRequest({ room: ROOM, request: request() })
  const reverted = await publisher.onRevertRequest({ room: ROOM, request: request({ published: approved }), undo: approved.undo })
  assert.match(reverted.detail, /Closed pull request #1/)
  assert.equal(gh.pulls[0].state, 'closed')
  assert.equal(gh.refs.has(gh.pulls[0].head), false)
})

test('revert after merging opens a pull request that takes it back, source included', async () => {
  const gh = fakeGitHub(REPO_FILES)
  const publisher = createGitHubPublisher({ token: 't', repo: 'you/site', dir: 'src/froam', tailwind: true, fetchImpl: gh.fetchImpl })
  const approved = await publisher.onApproveRequest({ room: ROOM, request: request() })
  gh.merge(approved.number)
  const reverted = await publisher.onRevertRequest({ room: ROOM, request: request({ published: approved }), undo: approved.undo })
  assert.equal(reverted.number, 2)
  assert.match(gh.pulls[1].title, /^Revert “Hero copy for teams”/)
  const back = gh.filesAt(gh.pulls[1].head)
  assert.equal(back.get('src/Hero.tsx'), REPO_FILES['src/Hero.tsx'])
  const backDesign = JSON.parse(back.get('src/froam/froam.design.json'))
  assert.equal(backDesign.routes['/'].mobile?.['main:1/h1:1'], undefined)
  assert.equal(backDesign.routes['/'].desktop['main:1/p:1'].text, 'Owner copy')
})

test('commit mode publishes straight onto the branch', async () => {
  const gh = fakeGitHub(REPO_FILES)
  const publisher = createGitHubPublisher({ token: 't', repo: 'you/site', dir: 'src/froam', mode: 'commit', fetchImpl: gh.fetchImpl })
  const result = await publisher.onApproveRequest({ room: ROOM, request: request({ styleEdits: [] }) })
  assert.match(result.detail, /Committed to main/)
  assert.equal(gh.pulls.length, 0)
  assert.ok(gh.filesAt('main').get('src/Hero.tsx').includes('Plan your escape'))
})

test('the pull request body reads without Froam', () => {
  const body = pullRequestBody({ request: request({ note: 'Line one\nLine two', changes: [{ label: 'A | B', before: null, after: 'x' }] }), room: ROOM, siteUrl: null })
  assert.match(body, /> Line one\n> Line two/)
  assert.match(body, /\| A \\\| B \| — \| x \|/)
  assert.match(body, /\*\*Where:\*\* Home, Home \(mobile\)/)
})

test('copy search on repo files follows the same rules as local', () => {
  const files = { 'a.tsx': '<p>Hello world</p>', 'b.tsx': '<p>Hello world</p>' }
  const { results } = applyTextEdits(Object.keys(files), [{ from: 'Hello world', to: 'Hi' }], { read: (file) => files[file] })
  assert.equal(results[0].status, 'ambiguous')
  assert.deepEqual(results[0].files, ['a.tsx', 'b.tsx'])
})

/* ── notifications ── */

function recorder(status = 200) {
  const sent = []
  const fetchImpl = async (url, init) => { sent.push({ url, init, body: JSON.parse(init.body) }); return { ok: status < 400, status } }
  return { sent, fetchImpl }
}

const submitted = { type: 'request.submitted', room: { id: 'room-1' }, actor: { name: 'Maya', title: 'Marketing' }, request: request({ status: 'pending' }) }

test('Slack gets a message with a Review button that opens the request', async () => {
  const { sent, fetchImpl } = recorder()
  const notify = createFroamNotifier({ siteUrl: 'https://site.test/', webhooks: ['https://hooks.slack.com/services/x'], fetchImpl })
  await notify(submitted)
  const { body } = sent[0]
  assert.equal(body.text, 'Maya sent “Hero copy for teams” for approval')
  assert.match(body.blocks[0].text.text, /Maya \(Marketing\) changed 1 thing on the home page — “For the spring launch”/)
  const button = body.blocks[1].elements[0]
  assert.equal(button.text.text, 'Review')
  assert.equal(button.url, 'https://site.test/?froam-room-id=room-1&froam-open=request%3Areq-123456789')
})

test('Discord, plain webhooks and email each get their own shape', async () => {
  const { sent, fetchImpl } = recorder()
  const notify = createFroamNotifier({
    siteUrl: 'https://site.test',
    webhooks: ['https://discord.com/api/webhooks/1/abc', 'https://example.test/hook'],
    email: { resendApiKey: 're_x', from: 'Froam <f@site.test>', to: ['owner@site.test'] },
    fetchImpl,
  })
  await notify(submitted)
  assert.equal(sent.length, 3)
  assert.equal(sent[0].body.embeds[0].title, 'Maya sent “Hero copy for teams” for approval')
  assert.equal(sent[1].body.type, 'request.submitted')
  assert.equal(sent[1].body.requestId, 'req-123456789')
  assert.equal(sent[2].url, 'https://api.resend.com/emails')
  assert.equal(sent[2].init.headers.Authorization, 'Bearer re_x')
  assert.match(sent[2].body.html, /Plan a trip/)
})

test('an approval links to the pull request; a mention quotes the message', async () => {
  const { sent, fetchImpl } = recorder()
  const notify = createFroamNotifier({ webhooks: ['https://example.test/hook'], fetchImpl })
  await notify({ type: 'request.decided', room: { id: 'r' }, actor: { name: 'Ahmad' }, request: request({ published: { detail: 'Opened pull request #1', link: 'https://github.com/you/site/pull/1' } }) })
  assert.equal(sent[0].body.subject, '“Hero copy for teams” is live')
  assert.equal(sent[0].body.link, 'https://github.com/you/site/pull/1')
  await notify({ type: 'chat.mention', room: { id: 'r' }, actor: { name: 'Maya' }, message: { id: 'm1', body: '@Ahmad can you look?' }, mentioned: [{ name: 'Ahmad' }] })
  assert.equal(sent[1].body.subject, 'Maya mentioned Ahmad in Froam')
  assert.equal(sent[1].body.text, '“@Ahmad can you look?”')
})

test('events nobody asked for are not sent; a failing hook throws only when all fail', async () => {
  const { sent, fetchImpl } = recorder(500)
  const notify = createFroamNotifier({ webhooks: ['https://example.test/hook'], events: ['request.submitted'], fetchImpl })
  assert.deepEqual(await notify({ type: 'chat.mention', room: { id: 'r' }, message: { id: 'm', body: 'x' } }), [])
  assert.equal(sent.length, 0)
  await assert.rejects(() => notify(submitted), /webhook answered 500/)
})

test('links never carry a token', () => {
  const link = openLink('https://site.test', { room: { id: 'r1' }, request: { id: 'q1' } })
  assert.equal(link, 'https://site.test/?froam-room-id=r1&froam-open=request%3Aq1')
})

/* ── the local bridge, end to end, on a Tailwind project ── */

async function tailwindProject() {
  const root = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'froam-tw-'))
  fs.writeFileSync(nodePath.join(root, 'package.json'), JSON.stringify({ name: 'site', devDependencies: { tailwindcss: '^4.0.0' } }))
  fs.mkdirSync(nodePath.join(root, 'src'))
  fs.writeFileSync(nodePath.join(root, 'src', 'Hero.tsx'), 'export const Hero = () => (\n  <section>\n    <h1 className="text-4xl font-bold text-slate-900">Plan a trip</h1>\n    <a className="px-4 py-2 rounded-lg bg-blue-600 text-white" href="/go">Book now</a>\n  </section>\n)\n')
  const froamDir = nodePath.join(root, 'froam')
  fs.mkdirSync(froamDir)
  const { server } = createBridgeServer({ port: 0, froamDir, sourceRoot: root })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
  const get = (path) => fetch(`${base}${path}`).then((r) => r.json())
  const hero = () => fs.readFileSync(nodePath.join(root, 'src', 'Hero.tsx'), 'utf8')
  return { root, froamDir, server, post, get, hero }
}

test('the bridge knows a Tailwind project and writes saved styles into class lists', async () => {
  const project = await tailwindProject()
  try {
    const who = await project.get('/__froam/whoami')
    assert.equal(who.tailwind, true)
    const saved = await project.post('/__froam/source/styles', { edits: [{ tag: 'a', className: 'px-4 py-2 rounded-lg bg-blue-600 text-white', styles: { backgroundColor: '#e11d48', padding: '14px' } }] })
    assert.equal(saved.results[0].status, 'written')
    assert.deepEqual(saved.results[0].written, ['backgroundColor', 'padding'])
    assert.ok(project.hero().includes('<a className="rounded-lg text-white bg-[#e11d48] p-[14px]" href="/go">'))
  } finally {
    project.server.closeAllConnections?.()
    project.server.close()
  }
})

test('approving under froam dev writes copy and classes; reverting puts both back', async () => {
  const project = await tailwindProject()
  const original = project.hero()
  try {
    const created = await project.post('/api/froam/rooms', { name: 'Ahmad' })
    const room = created.room.id
    const owner = { token: created.invites.owner, actor: created.you.actor, session: created.you.session }
    const joined = await project.post(`/api/froam/rooms/${room}/join`, { token: created.invites.contributor, name: 'Maya' })
    const maya = { token: created.invites.contributor, actor: joined.you.actor, session: joined.you.session }
    const submitted = await project.post(`/api/froam/rooms/${room}/requests`, {
      ...maya,
      title: 'Warmer hero',
      scopes: [
        { routeKey: '/', viewport: 'desktop', store: { 'section:1/h1:1': { text: 'Plan your escape', styles: { color: '#e11d48' }, fingerprint: { tag: 'h1', className: 'text-4xl font-bold text-slate-900' } } }, removed: [] },
        { routeKey: '/', viewport: 'mobile', store: { 'section:1/h1:1': { styles: { fontSize: '28px' } } }, removed: [] },
      ],
      changes: [{ label: 'Heading', before: 'Plan a trip', after: 'Plan your escape' }],
      textEdits: [{ from: 'Plan a trip', to: 'Plan your escape' }],
      styleEdits: [{ routeKey: '/', viewport: 'desktop', path: 'section:1/h1:1', tag: 'h1', className: 'text-4xl font-bold text-slate-900', styles: { color: '#e11d48' } }],
    })
    const approved = await project.post(`/api/froam/rooms/${room}/requests/${submitted.request.id}/decision`, { ...owner, decision: 'approved' })
    assert.equal(approved.request.status, 'approved')
    assert.match(approved.request.published.detail, /written into src\/Hero\.tsx/)
    assert.ok(project.hero().includes('<h1 className="text-4xl font-bold text-[color:#e11d48]">Plan your escape</h1>'), project.hero() + ' // ' + approved.request.published.detail)
    const design = JSON.parse(fs.readFileSync(nodePath.join(project.froamDir, 'froam.design.json'), 'utf8'))
    assert.equal(design.routes['/'].desktop?.['section:1/h1:1'], undefined, 'copy and colour went into the source but stayed as drafts too')
    assert.equal(design.routes['/'].mobile['section:1/h1:1'].styles.fontSize, '28px')

    const reverted = await project.post(`/api/froam/rooms/${room}/requests/${submitted.request.id}/revert`, { ...owner })
    assert.equal(reverted.request.status, 'reverted')
    assert.equal(project.hero(), original)
    const after = JSON.parse(fs.readFileSync(nodePath.join(project.froamDir, 'froam.design.json'), 'utf8'))
    assert.equal(after.routes['/'].mobile?.['section:1/h1:1'], undefined)
  } finally {
    project.server.closeAllConnections?.()
    project.server.close()
  }
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}`)
    console.log(`       ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n       ')}`)
  }
}
console.log(`\npublishing: ${tests.length - failed}/${tests.length} passed`)
process.exit(failed ? 1 : 0)
