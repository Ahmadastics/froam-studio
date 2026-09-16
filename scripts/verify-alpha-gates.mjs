import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PACKAGE_TGZ = path.resolve('ahmadastic-froam-8.2.0.tgz')
const CLI_PATH = path.resolve('bin/froam.mjs')

async function runCli({ args = [], cwd = process.cwd(), input = null, timeoutMs = 4000 }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => {
      stdout += d.toString()
      // If server started, resolve early
      if (stdout.includes('Froam Studio') && stdout.includes('repo')) {
        child.kill()
      }
    })

    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })

    if (input) {
      child.stdin.write(input)
      child.stdin.end()
    }

    const timer = setTimeout(() => {
      child.kill()
    }, timeoutMs)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

console.log('Verifying 5 Alpha 01 Release Gates...\n')

// Gate 1: Zero-argument prompt test
console.log('Gate 1: Zero-argument onboarding prompt...')
{
  const res = await runCli({
    args: [],
    input: 'streamex.hn\n',
  })
  assert.match(res.stdout, /◆ Froam/, 'Must show Froam header')
  assert.match(res.stdout, /Website URL:/, 'Must prompt for Website URL')
  console.log('✔ Gate 1 passed: Zero-argument onboarding prompt works\n')
}

// Gate 2: Execution from System32 (protection against EPERM and System32\froam)
console.log('Gate 2: Safe workspace execution from System32...')
{
  const sysDir = process.platform === 'win32'
    ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')
    : '/usr/bin'

  const res = await runCli({
    args: ['streamex.hn'],
    cwd: sysDir,
  })

  assert.doesNotMatch(res.stderr, /EPERM/, 'Must not trigger EPERM')
  assert.doesNotMatch(res.stderr, /System32\\froam/, 'Must not attempt writing to System32')
  assert.match(res.stdout, /proxy → https:\/\/streamex\.hn/, 'Must proxy to normalized https://streamex.hn')
  assert.match(res.stdout, /Froam[\\/]streamex\.hn/, 'Must save to ~/Froam/streamex.hn workspace')
  console.log('✔ Gate 2 passed: System32 protected and redirected to safe workspace\n')
}

// Gate 3: Bare website like streamex.hn works
console.log('Gate 3: Bare website normalization (streamex.hn)...')
{
  const res = await runCli({
    args: ['streamex.hn'],
  })
  assert.match(res.stdout, /proxy → https:\/\/streamex\.hn/, 'Must normalize bare domain to https')
  console.log('✔ Gate 3 passed: Bare website normalized and proxy configured\n')
}

// Gate 4: Full URL works (https://www.nickelodeonafrica.com/)
console.log('Gate 4: Full URL (https://www.nickelodeonafrica.com/)...')
{
  const res = await runCli({
    args: ['https://www.nickelodeonafrica.com/'],
  })
  assert.match(res.stdout, /proxy → https:\/\/www\.nickelodeonafrica\.com/, 'Must proxy full URL')
  assert.match(res.stdout, /Froam[\\/]www\.nickelodeonafrica\.com/, 'Must save to ~/Froam/www.nickelodeonafrica.com')
  console.log('✔ Gate 4 passed: Full URL handled and isolated\n')
}

// Gate 5: Localhost project writes to project folder rather than ~/Froam
console.log('Gate 5: Localhost project workspace retention...')
{
  const tempProject = path.join(os.tmpdir(), `froam-proj-test-${Date.now()}`)
  fs.mkdirSync(tempProject, { recursive: true })

  try {
    const res = await runCli({
      args: ['localhost:3000'],
      cwd: tempProject,
    })
    assert.doesNotMatch(res.stdout, /~\/Froam/, 'Must not save to ~/Froam for writable localhost project')
    assert.ok(fs.existsSync(path.join(tempProject, 'froam')), 'Must create froam directory in the local project workspace')
    console.log('✔ Gate 5 passed: Localhost projects write to local workspace\n')
  } finally {
    fs.rmSync(tempProject, { recursive: true, force: true })
  }
}

console.log('All 5 Alpha 01 Release Gates PASSED! 🎉')
