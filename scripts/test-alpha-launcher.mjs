import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'

import {
  findFreePort,
  isLocalhost,
  isPortAvailable,
  isSystemDirectory,
  isWritableDirectory,
  normalizeTargetUrl,
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
