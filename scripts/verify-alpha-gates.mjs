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
/**
 * Somewhere harmless to run from.
 *
 * Never the repo: Froam treats a folder with a package.json as a project and
 * would write a workspace into it, which for this repository means overwriting
 * the committed src/froam design files.
 */
const NEUTRAL_CWD = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-gate-cwd-'))

function runCli({ args = [], cwd = NEUTRAL_CWD, input = null, timeoutMs = 25_000 }) {
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

/**
 * Start a dev server the way a tester's really runs: a separate process, owned
 * by its own project folder.
 *
 * It must not be served from inside this script. Froam now traces a port back to
 * the project that owns it, and an in-process server would trace back to the
 * froam-studio repo — making the gates pass for the wrong reason and writing a
 * froam/ workspace into this repository.
 */
async function startLocalProject({ port = 0, title = 'local project' } = {}) {
  const project = makeProject()
  const binDir = path.join(project, 'node_modules', 'devserver', 'bin')
  fs.mkdirSync(binDir, { recursive: true })

  const chosen = port || 4000 + Math.floor(Math.random() * 900)
  const entry = path.join(binDir, 'serve.cjs')
  fs.writeFileSync(entry, `require('node:http').createServer((q, s) => {
    s.writeHead(200, { 'content-type': 'text/html' })
    s.end('<html><head><title>${title}</title></head><body><h1>hi</h1></body></html>')
  }).listen(${chosen}, '127.0.0.1')`)

  const child = spawn(process.execPath, [entry], { stdio: 'ignore' })
  await new Promise((resolve) => setTimeout(resolve, 1200))

  return {
    port: chosen,
    project,
    server: {
      // Takes an optional callback so it can stand in for an http.Server,
      // whose close(cb) callers await.
      close(done) {
        child.kill()
        removeDir(project)
        if (typeof done === 'function') done()
      },
    },
  }
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

gate('a running project is offered by number, and its folder is found and confirmed', async () => {
  // Port 3000 is where a tester's project most likely is, and what they will press 1 for
  let running
  try {
    running = await startLocalProject({ port: 3000, title: 'My Portfolio' })
  } catch {
    console.log('  skip (port 3000 is already in use on this machine)')
    return
  }

  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-elsewhere-'))
  try {
    // A tester standing in a folder that is not their project: pick, then Enter.
    const res = await runCli({ args: [], cwd: elsewhere, input: '1\n\n' })
    assert.match(res.stdout, /Already running on this computer/, 'lists what is running')
    assert.match(res.stdout, /1\s+localhost:3000\s+My Portfolio/, 'names the project')
    assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)

    // It works the folder out, but says so before writing into someone's repo
    assert.match(res.stdout, /Froam will save your edits here/, 'shows the folder first')
    assert.match(
      res.stdout,
      new RegExp(running.project.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')),
      'the folder it offers is the one that owns the port',
    )
    assert.match(res.stdout, /\[Y\/n\]/, 'one keystroke accepts it')
    assert.ok(
      fs.existsSync(path.join(running.project, 'froam')),
      'edits land in the project that owns the port',
    )
    assert.deepEqual(fs.readdirSync(elsewhere), [], 'nothing is written where the terminal happened to be')
  } finally {
    running.server.close()
    removeDir(elsewhere)
  }
})

gate('declining the folder keeps a tester out of their own repo', async () => {
  let running
  try {
    running = await startLocalProject({ port: 3000, title: 'My Portfolio' })
  } catch {
    console.log('  skip (port 3000 is already in use on this machine)')
    return
  }

  try {
    const res = await runCli({ args: [], input: '1\nn\n' })
    assert.ok(res.started, `bridge never started:\n${res.stdout}\n${res.stderr}`)
    assert.match(res.stdout, /Froam[\\/]localhost-3000/, 'n sends the edits to the Froam folder')
    assert.ok(
      !fs.existsSync(path.join(running.project, 'froam')),
      'n must leave the project untouched',
    )
  } finally {
    running.server.close()
  }
})

gate('a project Froam cannot trace still gets asked for, not guessed at', async () => {
  // Nothing is listening, so there is no owning process and no folder to find
  const project = makeProject()
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-elsewhere-'))
  try {
    const res = await runCli({ args: [], cwd: elsewhere, input: 'localhost:39918\n\n' })
    assert.match(res.stderr + res.stdout, /Nothing is running at/, 'says the project is not up')
    assert.doesNotMatch(res.stdout, /found this project at/, 'never claims a folder it did not find')
  } finally {
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
  const spare = await startLocalProject()
  const bridgePort = spare.port
  spare.server.close()
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
