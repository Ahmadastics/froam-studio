#!/usr/bin/env node
/**
 * Froam Studio Alpha 01 Launcher.
 *
 * Provides a zero-argument onboarding experience:
 *   npx @ahmadastic/froam
 *   npx @ahmadastic/froam https://streamex.hn/
 *
 * Automatically routes online sites to safe ~/Froam/<website> workspaces,
 * binds free ports dynamically, and launches the visual editor immediately.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ensureScaffold } from '../lib/codegen.mjs'
import { createBridgeServer } from '../lib/dev-server.mjs'
import {
  findFreePort,
  normalizeTargetUrl,
  promptWebsiteUrl,
  resolveSafeWorkspaceDir,
} from '../lib/launcher.mjs'

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CLI_ENTRY = fileURLToPath(import.meta.url)
const EDITOR_BUNDLE = path.join(PACKAGE_ROOT, 'dist', 'standalone', 'froam-editor.js')

function packageVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version ?? '?'
  } catch {
    return '?'
  }
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') execFileSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' })
    else if (process.platform === 'darwin') execFileSync('open', [url], { stdio: 'ignore' })
    else execFileSync('xdg-open', [url], { stdio: 'ignore' })
  } catch { /* best-effort */ }
}

function lanAddresses() {
  const addresses = []
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address)
    }
  }
  return addresses
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text))
const bold = paint('1')
const dim = paint('2')
const teal = paint('96')
const green = paint('92')
const red = paint('91')
const OK = green('✔')
const BAD = red('✖')

function log(msg = '') { process.stdout.write(msg + '\n') }
function fail(msg) { process.stderr.write(`${BAD} froam: ${msg}\n`); process.exit(1) }

function useWindowsSystemCertificates(targetUrl) {
  if (
    process.platform !== 'win32'
    || !targetUrl
    || !/^https:\/\//i.test(targetUrl)
    || process.execArgv.includes('--use-system-ca')
    || process.env.NODE_USE_SYSTEM_CA === '1'
    || process.env.FROAM_SYSTEM_CA_REEXEC === '1'
    || !process.allowedNodeEnvironmentFlags?.has('--use-system-ca')
  ) return

  const result = spawnSync(process.execPath, ['--use-system-ca', CLI_ENTRY, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: { ...process.env, FROAM_SYSTEM_CA_REEXEC: '1' },
    stdio: 'inherit',
  })
  if (result.error) fail(`could not enable Windows system certificates: ${result.error.message}`)
  process.exit(result.status ?? 1)
}

export async function runLauncher(targetInput = process.argv[2]) {
  let rawUrl = targetInput
  if (!rawUrl) {
    rawUrl = await promptWebsiteUrl()
    if (!rawUrl) {
      log('\nNo URL provided. Exiting.')
      process.exit(0)
    }
  }

  let normalizedUrl
  try {
    normalizedUrl = normalizeTargetUrl(rawUrl)
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Invalid website URL')
  }

  useWindowsSystemCertificates(normalizedUrl.href)

  if (!fs.existsSync(EDITOR_BUNDLE)) {
    fail('Editor bundle missing (dist/standalone/froam-editor.js) — run `npm run build` inside @ahmadastic/froam')
  }

  const froamDir = resolveSafeWorkspaceDir({ targetUrl: normalizedUrl })
  ensureScaffold(froamDir, { glue: false })

  const port = await findFreePort(4600)

  const { server, appTarget } = createBridgeServer({
    port,
    froamDir,
    app: normalizedUrl.href,
    serveDir: null,
    log: (line) => log(`${dim(new Date().toLocaleTimeString())} ${OK} ${line}`),
  })

  server.on('error', (error) => {
    fail(`Bridge server error: ${error.message}`)
  })

  server.listen(port, '127.0.0.1', () => {
    log()
    log(`${teal('◆')} ${bold('Froam Studio')} ${dim(`v${packageVersion()} · Alpha 01`)}`)
    log()
    log(`  ${bold('mode')}     proxy → ${teal(appTarget.origin)} ${dim('(editor injected into every page)')}`)
    log(`  ${bold('local')}    ${teal(`http://localhost:${port}`)}`)
    for (const address of lanAddresses()) {
      log(`  ${bold('network')}  ${teal(`http://${address}:${port}`)} ${dim('← open on phone/device')}`)
    }
    log(`  ${bold('repo')}     ${froamDir} ${dim('← Save to Repo (Ctrl+Shift+S) writes here')}`)
    log()
    log(dim('  Ctrl+C to stop'))
    log()

    openBrowser(`http://localhost:${port}`)
  })
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirectExecution) {
  runLauncher().catch((err) => {
    fail(err?.message ?? err)
  })
}
