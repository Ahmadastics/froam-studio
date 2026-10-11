#!/usr/bin/env node
/**
 * CI only: run every suite in an npm script (`test`, `test:e2e`) instead of
 * stopping at the first failure, so one run on each system shows everything
 * that is wrong there. Each failing suite's last lines become a GitHub error
 * annotation, readable on the run page and through the public API — logs
 * themselves need repository admin rights to download.
 *
 *   node scripts/ci-run-all.mjs test
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const scriptName = process.argv[2] ?? 'test'
const command = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts[scriptName]
if (!command) throw new Error(`no npm script named ${scriptName}`)

const system = process.env.RUNNER_OS ? `${process.env.RUNNER_OS}, Node ${process.versions.node.split('.')[0]}` : process.platform
const escape = (value) => value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')

function run(suite) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(suite, { cwd: ROOT, shell: true, env: process.env })
    let tail = ''
    const fails = []
    let pending = ''
    const keep = (chunk) => {
      process.stdout.write(chunk)
      tail = (tail + chunk).slice(-20000)
      // Each failing check and the lines that explain it, wherever it falls in
      // a long suite — a tail alone loses the early ones.
      const lines = (pending + chunk).split(/\r?\n/)
      pending = lines.pop()
      for (const line of lines) {
        if (/^\s*(FAIL|✗|not ok)\b/.test(line)) fails.push([line])
        else if (fails.length && fails.at(-1).length < 4 && /^\s{4,}\S/.test(line)) fails.at(-1).push(line)
      }
    }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    child.on('close', (code) => resolve({ code, tail, fails, seconds: Math.round((Date.now() - started) / 1000) }))
  })
}

const failed = []
for (const suite of command.split('&&').map((part) => part.trim()).filter(Boolean)) {
  console.log(`\n▶ ${suite}`)
  const { code, tail, fails, seconds } = await run(suite)
  if (code === 0) continue
  failed.push(suite)
  const lines = tail.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/).filter((line) => line.trim())
  const failures = fails.map((block) => block.join('\n')).join('\n').slice(0, 4000)
  const reason = `${failures ? `${failures}\n── last lines ──\n` : ''}${lines.slice(-30).join('\n')}`.slice(0, 7000)
  console.log(`::error title=${escape(`${suite} (${system}, exit ${code}, ${seconds}s)`).replace(/[:,]/g, ' ')}::${escape(reason)}`)
}

console.log(failed.length ? `\n${failed.length} suite(s) failed:\n  ${failed.join('\n  ')}` : '\nevery suite passed')
process.exit(failed.length ? 1 : 0)
