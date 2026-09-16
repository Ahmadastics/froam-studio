import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'

import http from 'node:http'

import {
  describeTargetFailure,
  detectLocalProjects,
  findFreePort,
  isFatalTargetFailure,
  isLocalhost,
  looksLikeProjectDir,
  isPortAvailable,
  isSystemDirectory,
  isWritableDirectory,
  normalizeTargetUrl,
  probeTarget,
  promptWebsiteUrl,
  PROMPT_BANNER,
  resolveSafeWorkspaceDir,
  sanitizeWorkspaceName,
} from '../lib/launcher.mjs'

const tests = []
const test = (name, run) => tests.push([name, run])

test('normalizeTargetUrl handles full URLs, shorthand domains, ports, and localhost', () => {
  // Full URLs
  assert.equal(normalizeTargetUrl('https://streamex.hn/').href, 'https://streamex.hn/')
  assert.equal(normalizeTargetUrl('http://localhost:3000').href, 'http://localhost:3000/')

  // Shorthand online domains without scheme default to https://
  assert.equal(normalizeTargetUrl('streamex.hn').href, 'https://streamex.hn/')
  assert.equal(normalizeTargetUrl('www.nickelodeonafrica.com/').href, 'https://www.nickelodeonafrica.com/')
  assert.equal(normalizeTargetUrl('subdomain.example.co.uk/page').href, 'https://subdomain.example.co.uk/page')

  // Port shorthands default to http://localhost:<port>
  assert.equal(normalizeTargetUrl('3000').href, 'http://localhost:3000/')
  assert.equal(normalizeTargetUrl('5173').href, 'http://localhost:5173/')

  // Localhost shorthands without scheme default to http://
  assert.equal(normalizeTargetUrl('localhost:3000').href, 'http://localhost:3000/')
  assert.equal(normalizeTargetUrl('127.0.0.1:8080').href, 'http://127.0.0.1:8080/')
  assert.equal(normalizeTargetUrl('0.0.0.0:4600').href, 'http://0.0.0.0:4600/')
})

test('normalizeTargetUrl rejects invalid, empty, or poisoned inputs', () => {
  assert.throws(() => normalizeTargetUrl(''), /Please provide a website URL/)
  assert.throws(() => normalizeTargetUrl('   '), /Please provide a website URL/)
  assert.throws(() => normalizeTargetUrl(null), /Please provide a website URL/)
  assert.throws(() => normalizeTargetUrl('[https://streamex.hn](https://streamex.hn)'), /Markdown link/)
  assert.throws(() => normalizeTargetUrl('https://keenbean.app/https://www.cosmopolitan.edu.ng/'), /joined URLs/)
})

test('normalizeTargetUrl refuses what a tester means as a file, folder, or scheme typo', () => {
  // A scheme Froam cannot proxy must be named, not glued onto https://
  assert.throws(() => normalizeTargetUrl('ftp://example.com'), /only open http:\/\/ or https:\/\//)
  assert.throws(() => normalizeTargetUrl('file:///c:/site/index.html'), /only open http:\/\/ or https:\/\//)

  // Files and paths are not websites
  assert.throws(() => normalizeTargetUrl('index.html'), /looks like a file/)
  assert.throws(() => normalizeTargetUrl('styles.css'), /looks like a file/)
  assert.throws(() => normalizeTargetUrl('./dist'), /folder on your computer/)
  assert.throws(() => normalizeTargetUrl('C:\\Users\\me\\site'), /folder on your computer/)

  // A word is not a host
  assert.throws(() => normalizeTargetUrl('mysite'), /doesn't look like a website address/)
  assert.throws(() => normalizeTargetUrl('not a url at all'), /doesn't look like a website address/)

  // An impossible port is explained, not left to Node's "Invalid URL"
  assert.throws(() => normalizeTargetUrl('99999'), /not a valid port/)
})

test('normalizeTargetUrl keeps machines on a network on http', () => {
  // A LAN dev server has no certificate — defaulting it to https would fail the handshake
  assert.equal(normalizeTargetUrl('192.168.1.50:3000').href, 'http://192.168.1.50:3000/')
  assert.equal(normalizeTargetUrl('10.0.0.8:5173').href, 'http://10.0.0.8:5173/')
  assert.equal(isLocalhost('192.168.1.50:3000'), true)
})

test('isLocalhost correctly identifies local vs remote targets', () => {
  assert.equal(isLocalhost('localhost:3000'), true)
  assert.equal(isLocalhost('http://localhost:5173'), true)
  assert.equal(isLocalhost('http://127.0.0.1:8080'), true)
  assert.equal(isLocalhost('http://0.0.0.0:4600'), true)
  assert.equal(isLocalhost('http://my-app.local:3000'), true)
  assert.equal(isLocalhost('https://streamex.hn'), false)
  assert.equal(isLocalhost('https://www.nickelodeonafrica.com'), false)
  assert.equal(isLocalhost(new URL('https://example.com')), false)
})

test('sanitizeWorkspaceName extracts clean directory names', () => {
  assert.equal(sanitizeWorkspaceName('https://streamex.hn/'), 'streamex.hn')
  assert.equal(sanitizeWorkspaceName('https://www.nickelodeonafrica.com/shows/spongebob'), 'www.nickelodeonafrica.com')
  assert.equal(sanitizeWorkspaceName('http://localhost:3000'), 'localhost')
})

test('isSystemDirectory flags protected Windows and system paths', () => {
  if (process.platform === 'win32') {
    const sysRoot = process.env.SystemRoot || 'C:\\Windows'
    assert.equal(isSystemDirectory(sysRoot), true)
    assert.equal(isSystemDirectory(path.join(sysRoot, 'System32')), true)
  }
  const safeTemp = path.join(os.tmpdir(), 'froam-safe-test')
  assert.equal(isSystemDirectory(safeTemp), false)
})

test('resolveSafeWorkspaceDir routes online sites to ~/Froam/<website> and guards System32', () => {
  const fakeHome = path.join(os.tmpdir(), `froam-home-test-${Date.now()}`)
  fs.mkdirSync(fakeHome, { recursive: true })

  try {
    // 1. Online website target
    const siteDir = resolveSafeWorkspaceDir({
      targetUrl: 'https://streamex.hn/',
      homeDir: fakeHome,
    })
    assert.equal(siteDir, path.join(fakeHome, 'Froam', 'streamex.hn'))
    assert.equal(fs.existsSync(siteDir), true)

    // 2. Custom dir flag takes precedence
    const custom = resolveSafeWorkspaceDir({
      targetUrl: 'https://streamex.hn/',
      customDir: './my-custom-froam',
      cwd: fakeHome,
      homeDir: fakeHome,
    })
    assert.equal(custom, path.resolve(fakeHome, './my-custom-froam'))

    // 3. Unwritable / System directory fallback
    const sysDir = process.platform === 'win32'
      ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')
      : '/usr/bin'
    const fallbackDir = resolveSafeWorkspaceDir({
      targetUrl: 'http://localhost:3000',
      cwd: sysDir,
      homeDir: fakeHome,
    })
    assert.equal(fallbackDir, path.join(fakeHome, 'Froam', 'localhost-3000'))
    assert.equal(fs.existsSync(fallbackDir), true)
  } finally {
    try {
      fs.rmSync(fakeHome, { recursive: true, force: true })
    } catch {}
  }
})

test('findFreePort discovers an open port starting at 4600', async () => {
  const freePort = await findFreePort(4600)
  assert.equal(typeof freePort, 'number')
  assert.ok(freePort >= 4600)

  // Occupy a test port and ensure finder advances past it
  const blocker = net.createServer()
  await new Promise((resolve) => blocker.listen(freePort, '127.0.0.1', resolve))

  try {
    const nextPort = await findFreePort(freePort)
    assert.ok(nextPort > freePort)
  } finally {
    await new Promise((resolve) => blocker.close(resolve))
  }
})

test('resolveSafeWorkspaceDir leaves nothing behind in the project it inspects', () => {
  const project = path.join(os.tmpdir(), `froam-probe-test-${Date.now()}`)
  fs.mkdirSync(project, { recursive: true })

  try {
    const dir = resolveSafeWorkspaceDir({ targetUrl: 'http://localhost:3000', cwd: project })
    assert.equal(dir, path.join(project, 'froam'))
    // froam/ is the only thing created — a stray probe file would trip a dev server's watcher
    assert.deepEqual(fs.readdirSync(project), ['froam'])
  } finally {
    fs.rmSync(project, { recursive: true, force: true })
  }
})

test('findFreePort reports exhaustion instead of handing back a taken port', async () => {
  const blocker = net.createServer()
  const port = await findFreePort(4750)
  await new Promise((resolve) => blocker.listen(port, '127.0.0.1', resolve))

  try {
    await assert.rejects(
      () => findFreePort(port, 1),
      /could not find a free port/,
    )
  } finally {
    await new Promise((resolve) => blocker.close(resolve))
  }
})

test('probeTarget separates a site that answers from one that is not there', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<html></html>')
  })
  const port = await findFreePort(4800)
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))

  try {
    const live = await probeTarget(`http://127.0.0.1:${port}`)
    assert.equal(live.ok, true)
    assert.equal(live.status, 200)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }

  const dead = await probeTarget(`http://127.0.0.1:${port}`)
  assert.equal(dead.ok, false)
  assert.equal(dead.kind, 'refused')

  // A local target that refuses tells the tester to start their project
  const message = describeTargetFailure(dead, new URL(`http://localhost:${port}`))
  assert.match(message, /Nothing is running at/)
  assert.match(message, /npm run dev/)

  const missing = await probeTarget('http://froam-no-such-host.invalid')
  assert.equal(missing.ok, false)
  assert.equal(missing.kind, 'dns')
  assert.match(
    describeTargetFailure(missing, new URL('https://froam-no-such-host.invalid')),
    /could not find froam-no-such-host\.invalid/,
  )
})

test('a slow site warns but still opens, while a missing one stops Froam', async () => {
  // Accept the connection and never answer — a slow network looks exactly like this
  const stalled = net.createServer(() => {})
  const port = await findFreePort(4850)
  await new Promise((resolve) => stalled.listen(port, '127.0.0.1', resolve))

  try {
    const probe = await probeTarget(`http://127.0.0.1:${port}`, { timeoutMs: 300 })
    assert.equal(probe.ok, false)
    assert.equal(probe.kind, 'timeout')
    assert.equal(isFatalTargetFailure(probe), false, 'a slow site must not stop a tester on a bad connection')
    assert.match(describeTargetFailure(probe, new URL(`http://127.0.0.1:${port}`)), /starting anyway/)
  } finally {
    stalled.close()
  }

  assert.equal(isFatalTargetFailure({ ok: true }), false)
  assert.equal(isFatalTargetFailure({ kind: 'dns' }), true)
  assert.equal(isFatalTargetFailure({ kind: 'refused' }), true)
  assert.equal(isFatalTargetFailure({ kind: 'tls' }), true)
  assert.equal(isFatalTargetFailure({ kind: 'other' }), false)
})

test('describeTargetFailure explains an intercepted certificate without blaming the tester', () => {
  const message = describeTargetFailure(
    { kind: 'tls', message: 'unable to verify the first certificate' },
    new URL('https://streamex.hn'),
  )
  assert.match(message, /security certificate/)
  assert.match(message, /antivirus|company network/)
  assert.doesNotMatch(message, /UNABLE_TO_VERIFY/)
})

test('detectLocalProjects finds a running dev server and labels it by page title', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<html><head><title>My Portfolio</title></head><body>hi</body></html>')
  })
  const port = await findFreePort(4900)
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))

  try {
    const found = await detectLocalProjects({ ports: [port, port + 1] })
    assert.equal(found.length, 1, 'only reports what is actually listening')
    assert.equal(found[0].port, port)
    assert.equal(found[0].href, `http://localhost:${port}`)
    assert.equal(found[0].title, 'My Portfolio', 'a tester recognises their project by name')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }

  assert.deepEqual(await detectLocalProjects({ ports: [port] }), [], 'nothing running, nothing offered')
})

test('looksLikeProjectDir tells a project apart from wherever a terminal opened', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-notproj-'))
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-proj-'))
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"x"}')

  try {
    assert.equal(looksLikeProjectDir(project), true)
    assert.equal(looksLikeProjectDir(empty), false, 'an empty folder is not somewhere to write a repo')
    if (process.platform === 'win32') {
      assert.equal(looksLikeProjectDir(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')), false)
    }
  } finally {
    fs.rmSync(empty, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    fs.rmSync(project, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})

test('promptWebsiteUrl outputs the Alpha 01 prompt banner and reads URL input', async () => {
  let outputText = ''
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString()
      callback()
    },
  })

  const mockInput = new Readable({
    read() {
      this.push('https://streamex.hn/\n')
      this.push(null)
    },
  })

  const answer = await promptWebsiteUrl({ input: mockInput, output: mockOutput })
  assert.equal(answer, 'https://streamex.hn/')
  assert.match(outputText, /◆ Froam/)
  assert.match(outputText, /Paste the website you want to edit\./)
  assert.match(outputText, /Website URL:/)
})

let passed = 0
for (const [name, run] of tests) {
  try {
    await run()
    passed += 1
    process.stdout.write(`  ok   ${name}\n`)
  } catch (error) {
    process.stderr.write(`  FAIL ${name}\n`)
    process.stderr.write(`${error.stack}\n`)
    process.exit(1)
  }
}
process.stdout.write(`\n${passed}/${tests.length} Alpha 01 launcher tests passed\n`)
