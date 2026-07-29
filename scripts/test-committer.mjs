/**
 * Froam Studio — GitHub committer tests.
 *
 * No network: a fake fetch records what would have been sent. What's being
 * checked is the contract with GitHub — correct method, correct sha handling,
 * correct encoding — because getting those wrong silently corrupts someone's
 * repo rather than failing loudly.
 */
import assert from 'node:assert/strict'

const { createGitHubCommitter } = await import('../lib/github-committer.mjs')

const DESIGN = {
  version: 3,
  updatedAt: '2026-07-29T00:00:00.000Z',
  routes: { '/': { desktop: { 'h1:1': { text: 'Run’Am — ship it', styles: { color: '#12c877' } } } } },
}

/** Fake GitHub. `existing` maps path -> sha for files already in the repo. */
function fakeGitHub({ existing = {}, failOn = null } = {}) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    const path = decodeURIComponent(new URL(url).pathname)
    calls.push({ method, path, body: init.body ? JSON.parse(init.body) : null, headers: init.headers })

    if (failOn && path.includes(failOn)) {
      return { ok: false, status: 500, text: async () => JSON.stringify({ message: 'boom' }) }
    }
    if (method === 'GET') {
      const file = path.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, '')
      const sha = existing[file]
      if (!sha) return { ok: false, status: 404, text: async () => JSON.stringify({ message: 'Not Found' }) }
      return { ok: true, status: 200, text: async () => JSON.stringify({ sha }) }
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ commit: { sha: 'commit-' + calls.length } }) }
  }
  return { fetchImpl, calls, puts: () => calls.filter((c) => c.method === 'PUT') }
}

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('commits the three files the bridge writes', async () => {
  const gh = fakeGitHub()
  const commit = createGitHubCommitter({ token: 't', repo: 'ahmad/site', dir: 'src/froam', fetchImpl: gh.fetchImpl })
  const result = await commit({ design: DESIGN, message: 'Design update' })

  const paths = gh.puts().map((c) => c.path.split('/contents/')[1])
  assert.deepEqual(paths, [
    'src/froam/froam.design.json',
    'src/froam/froam.generated.css',
    'src/froam/froam.runtime.js',
  ])
  assert.equal(result.written.length, 3)
})

test('omits sha for a new file and sends it for an existing one', async () => {
  const gh = fakeGitHub({ existing: { 'froam/froam.design.json': 'sha-abc' } })
  const commit = createGitHubCommitter({ token: 't', repo: 'ahmad/site', fetchImpl: gh.fetchImpl })
  await commit({ design: DESIGN })

  const byPath = Object.fromEntries(gh.puts().map((c) => [c.path.split('/contents/')[1], c.body]))
  assert.equal(byPath['froam/froam.design.json'].sha, 'sha-abc', 'overwriting needs the current sha')
  assert.equal(byPath['froam/froam.generated.css'].sha, undefined, 'a new file must not send a sha')
})

test('content round-trips through base64 with non-ASCII intact', async () => {
  const gh = fakeGitHub()
  const commit = createGitHubCommitter({ token: 't', repo: 'ahmad/site', fetchImpl: gh.fetchImpl })
  await commit({ design: DESIGN })

  const designPut = gh.puts().find((c) => c.path.endsWith('froam.design.json'))
  const decoded = Buffer.from(designPut.body.content, 'base64').toString('utf8')
  assert.ok(decoded.includes('Run’Am — ship it'), 'curly quotes and dashes must survive')
  assert.deepEqual(JSON.parse(decoded).routes['/'].desktop['h1:1'].styles.color, '#12c877')
})

test('writes to the branch it was given', async () => {
  const gh = fakeGitHub()
  const commit = createGitHubCommitter({ token: 't', repo: 'ahmad/site', branch: 'design', fetchImpl: gh.fetchImpl })
  await commit({ design: DESIGN })
  assert.ok(gh.puts().every((c) => c.body.branch === 'design'))
})

test('authenticates every request', async () => {
  const gh = fakeGitHub()
  const commit = createGitHubCommitter({ token: 'secret-token', repo: 'ahmad/site', fetchImpl: gh.fetchImpl })
  await commit({ design: DESIGN })
  assert.ok(gh.calls.every((c) => c.headers.Authorization === 'Bearer secret-token'))
})

test('a GitHub failure surfaces instead of reporting success', async () => {
  const gh = fakeGitHub({ failOn: 'froam.generated.css' })
  const commit = createGitHubCommitter({ token: 't', repo: 'ahmad/site', fetchImpl: gh.fetchImpl })
  await assert.rejects(() => commit({ design: DESIGN }), /GitHub .* failed \(500\).*boom/s)
})

test('misconfiguration fails at construction, not mid-commit', () => {
  assert.throws(() => createGitHubCommitter({ repo: 'ahmad/site' }), /token/)
  assert.throws(() => createGitHubCommitter({ token: 't', repo: 'site' }), /owner\/name/)
})

/* ─── the two legs together ─── */

const { createFroamPublishApi } = await import('../lib/publish-store.mjs')
const os = await import('node:os')
const fsp = await import('node:fs/promises')
const nodePath = await import('node:path')

function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k] = v },
    end(text) { this.body = text },
  }
}

test('one publish stores the design AND commits it', async () => {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-commit-'))
  const file = nodePath.join(dir, 'froam.published.json')
  const gh = fakeGitHub()
  const api = createFroamPublishApi({
    file,
    commit: createGitHubCommitter({ token: 't', repo: 'ahmad/site', fetchImpl: gh.fetchImpl }),
  })

  const res = fakeRes()
  await api({ method: 'POST', url: '/api/froam/published', body: { routeKey: '/', viewportMode: 'desktop', store: { 'h1:1': { text: 'From the phone' } } } }, res)

  const payload = JSON.parse(res.body)
  assert.equal(payload.success, true)
  assert.equal(payload.committed.written.length, 3, 'the repo leg should have run')

  // Stored locally...
  const stored = JSON.parse(await fsp.readFile(file, 'utf8'))
  assert.equal(stored.routes['/'].desktop.store['h1:1'].text, 'From the phone')

  // ...and the committed design carries the same edit.
  const designPut = gh.puts().find((c) => c.path.endsWith('froam.design.json'))
  const committed = JSON.parse(Buffer.from(designPut.body.content, 'base64').toString('utf8'))
  assert.equal(committed.routes['/'].desktop['h1:1'].text, 'From the phone')
})

test('a failed commit does not fail the publish', async () => {
  const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'froam-commit-'))
  const file = nodePath.join(dir, 'froam.published.json')
  const gh = fakeGitHub({ failOn: 'contents' })
  const api = createFroamPublishApi({
    file,
    commit: createGitHubCommitter({ token: 't', repo: 'ahmad/site', fetchImpl: gh.fetchImpl }),
  })

  const res = fakeRes()
  await api({ method: 'POST', url: '/api/froam/published', body: { routeKey: '/', viewportMode: 'desktop', store: { 'h1:1': { text: 'Still safe' } } } }, res)

  const payload = JSON.parse(res.body)
  assert.equal(payload.success, true, 'GitHub being down must not lose the design')
  assert.ok(payload.committed.error, 'but the caller should be told the commit failed')
  const stored = JSON.parse(await fsp.readFile(file, 'utf8'))
  assert.equal(stored.routes['/'].desktop.store['h1:1'].text, 'Still safe')
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}`)
    console.log(`       ${error.message.split('\n').join('\n       ')}`)
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`)
process.exit(failed ? 1 : 0)
