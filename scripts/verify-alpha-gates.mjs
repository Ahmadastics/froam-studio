/**
 * Alpha 01 release gates.
 *
 * Every gate is something a tester will actually do in their first two minutes.
 * These drive the real CLI end to end, so they need a network and a few seconds
 * each — that is the point. Run before publishing, and again against the packed
 * tarball:
 *
 *   node scripts/verify-alpha-gates.mjs
 *   FROAM_CLI="<extracted-tarball>/package/bin/froam.mjs" node scripts/verify-alpha-gates.mjs
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const CLI_PATH = process.env.FROAM_CLI ?? path.resolve('bin/froam.mjs')
const LIVE_SITE = process.env.FROAM_TEST_SITE ?? 'example.com'
const READY = 'Ctrl+C to stop'

/**
 * Run the CLI and stop it as soon as the bridge is up, so a gate measures
 * "did Froam start" rather than "did the test wait long enough".
 */
function runCli({ args = [], cwd = process.cwd(), input = null, timeoutMs = 25_000 }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (stdout.includes(READY)) setTimeout(() => child.kill(), 250)
    })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    if (input !== null) child.stdin.write(input)
    child.stdin.end()

    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, started: stdout.includes(READY) })
    })
  })
}

/**
 * Windows can keep a handle on a killed child's folder for a while. Tidying up
 * is housekeeping, not something a gate should fail on — the assertions have
 * already run by the time we get here.
 */
function removeDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  } catch {
    console.log(`  note: could not remove ${dir} yet (Windows still holds it)`)
  }
}

/** A folder that reads as "my project", the way a tester's would. */
function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-gate-'))
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"gate-project"}')
  return dir
}

function startLocalProject() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<html><body><h1>local project</h1></body></html>')
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

const gates = []
const gate = (name, run) => gates.push([name, run])

gate('a tester with no arguments is asked for a website, and gets an editor', async () => {
  const project = makeProject()
  const { server, port } = await startLocalProject()
  try {
    const res = await runCli({ args: [], cwd: project, input: `localhost:${port}\n` })
    assert.match(res.stdout, /◆ Froam/, 'shows the Froam prompt')
    assert.match(res.stdout, /Website URL/, 'asks for a website')
    assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)
  } finally {
    server.close()
    removeDir(project)
  }
})

gate('a bare domain opens without flags, ports, or a scheme', async () => {
  const res = await runCli({ args: [LIVE_SITE] })
  assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)
  assert.match(res.stdout, new RegExp(`proxy → https://${LIVE_SITE.replace('.', '\\.')}`), 'normalises to https')
})

gate('a full URL opens and is isolated in its own workspace', async () => {
  const res = await runCli({ args: [`https://${LIVE_SITE}/`] })
  assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)
  assert.match(res.stdout, new RegExp(`Froam[\\\\/]${LIVE_SITE.replace('.', '\\.')}`), 'saves to the Froam workspace')
})

gate('running from a protected system directory still works', async () => {
  const systemDir = process.platform === 'win32'
    ? path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32')
    : '/usr/bin'

  const res = await runCli({ args: [LIVE_SITE], cwd: systemDir })
  assert.doesNotMatch(res.stderr, /EPERM|EACCES/, 'never surfaces a filesystem error')
  assert.doesNotMatch(res.stdout, /System32[\\/]froam/, 'never writes into System32')
  assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)
})

gate('a local project keeps its edits in the project (Repo Mode)', async () => {
  const project = makeProject()
  const { server, port } = await startLocalProject()
  try {
    const res = await runCli({ args: [`localhost:${port}`], cwd: project })
    assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)
    assert.ok(fs.existsSync(path.join(project, 'froam')), 'writes froam/ into the project')
    assert.doesNotMatch(res.stdout, /Froam[\\/]localhost/, 'does not divert the project to ~/Froam')
    assert.deepEqual(fs.readdirSync(project).sort(), ['froam', 'package.json'], 'leaves nothing else behind')
  } finally {
    server.close()
    removeDir(project)
  }
})

gate('a running local project is offered by number, and its edits land in it', async () => {
  // Port 3000 is what a tester's project is most likely to be on
  const site = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<html><head><title>My Portfolio</title></head><body>hi</body></html>')
  })
  const listening = await new Promise((resolve) => {
    site.once('error', () => resolve(false))
    site.listen(3000, '127.0.0.1', () => resolve(true))
  })
  if (!listening) {
    console.log('  skip (port 3000 is already in use on this machine)')
    return
  }

  const project = makeProject()
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-elsewhere-'))
  try {
    // A tester in a folder that is not their project: pick 1, then say where it lives
    const res = await runCli({ args: [], cwd: elsewhere, input: `1\n${project}\n` })
    assert.match(res.stdout, /Already running on this computer/, 'lists what is running')
    assert.match(res.stdout, /1\s+localhost:3000\s+My Portfolio/, 'names the project')
    assert.match(res.stdout, /Where is this project on your computer\?/, 'asks where it lives')
    assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)
    assert.ok(fs.existsSync(path.join(project, 'froam')), 'edits land in the project')
    assert.deepEqual(fs.readdirSync(elsewhere), [], 'nothing is written where the terminal happened to be')
  } finally {
    site.close()
    removeDir(project)
    removeDir(elsewhere)
  }
})

gate('a busy port is stepped over instead of crashing', async () => {
  const blockers = []
  try {
    for (let port = 4600; port < 4603; port += 1) {
      const blocker = http.createServer()
      await new Promise((resolve, reject) => {
        blocker.once('error', reject)
        blocker.listen(port, '127.0.0.1', resolve)
      }).catch(() => {})
      blockers.push(blocker)
    }

    const res = await runCli({ args: [LIVE_SITE] })
    assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)
    assert.doesNotMatch(res.stderr, /EADDRINUSE/, 'never surfaces EADDRINUSE')
    const chosen = /http:\/\/localhost:(\d+)/.exec(res.stdout)
    assert.ok(chosen, 'prints the port it chose')
    assert.ok(Number(chosen[1]) >= 4603, `picked a free port, got ${chosen[1]}`)
  } finally {
    for (const blocker of blockers) blocker.close()
  }
})

gate('a site that is not there is explained, not proxied', async () => {
  const res = await runCli({ args: ['froam-no-such-host-xyz.invalid'] })
  assert.equal(res.code, 1, 'exits with a failure')
  assert.ok(!res.started, 'never claims to be ready')
  assert.match(res.stderr, /could not find/, 'says what went wrong')
  assert.doesNotMatch(res.stderr, /ENOTFOUND|EAI_AGAIN|at Object|at async/, 'no error codes or stack traces')
})

gate('a local project that has not been started is explained', async () => {
  const res = await runCli({ args: ['localhost:39917'] })
  assert.equal(res.code, 1, 'exits with a failure')
  assert.match(res.stderr, /Nothing is running at/, 'says the project is not up')
  assert.match(res.stderr, /npm run dev/, 'says what to do about it')
  assert.doesNotMatch(res.stderr, /ECONNREFUSED/, 'no error codes')
})

gate('a typo is re-asked, not fatal', async () => {
  const { server, port } = await startLocalProject()
  try {
    const res = await runCli({ args: [], input: `not a url\nlocalhost:${port}\n` })
    assert.match(res.stdout, /doesn't look like a website address/, 'explains the typo')
    assert.match(res.stdout, /Try another address/, 'asks again')
    assert.ok(res.started, `never recovered:\n${res.stdout}\n${res.stderr}`)
  } finally {
    server.close()
  }
})

gate('the advanced CLI still works', async () => {
  const help = await runCli({ args: ['--help'] })
  for (const command of ['init', 'dev', 'build', 'status', 'check', 'doctor', 'migrate', 'version']) {
    assert.match(help.stdout, new RegExp(`\\n\\s+${command}\\s{2,}`), `help still lists ${command}`)
  }
  assert.match(help.stdout, /froam <url>/, 'help leads with the shorthand')

  const version = await runCli({ args: ['version'] })
  assert.match(version.stdout, /froam v\d+\.\d+\.\d+/, 'version prints')

  const project = makeProject()
  const { server, port } = await startLocalProject()
  // Claim a port, then hand it over, so --port is tested against one that is free here
  const { server: spare, port: bridgePort } = await startLocalProject()
  await new Promise((resolve) => spare.close(resolve))
  try {
    const explicit = await runCli({
      args: ['dev', '--app', `http://localhost:${port}`, '--port', String(bridgePort), '--dir', 'custom-froam'],
      cwd: project,
    })
    assert.ok(explicit.started, `explicit dev failed:\n${explicit.stdout}\n${explicit.stderr}`)
    assert.match(explicit.stdout, new RegExp(`http://localhost:${bridgePort}`), 'honours --port')
    assert.ok(fs.existsSync(path.join(project, 'custom-froam')), 'honours --dir')
  } finally {
    server.close()
    removeDir(project)
  }
})

console.log(`Alpha 01 release gates — ${CLI_PATH}\n`)
let passed = 0
for (const [name, run] of gates) {
  try {
    await run()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    console.error(`  FAIL ${name}`)
    console.error(`${error.stack}\n`)
    process.exit(1)
  }
}
console.log(`\n${passed}/${gates.length} Alpha 01 release gates passed`)
