/**
 * Froam Studio Alpha 01 — Launcher helper library.
 *
 * Provides URL normalization, safe workspace routing, free port discovery,
 * system directory protection, and interactive onboarding for the zero-argument CLI.
 */
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

/**
 * Check if an address / hostname is a local dev target.
 * @param {string | URL} target
 * @returns {boolean}
 */
export function isLocalhost(target) {
  if (!target) return false
  const host = typeof target === 'string'
    ? target.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0]
    : target.hostname
  const hostname = host.split(':')[0].toLowerCase()
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || hostname === '[::1]'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
  )
}

/**
 * Normalizes user input into a validated URL object.
 * Defaults online domains (e.g. "streamex.hn") to https://
 * Defaults local dev targets (e.g. "localhost:3000", "3000") to http://
 * @param {string} input
 * @returns {URL}
 */
export function normalizeTargetUrl(input) {
  if (input === undefined || input === null) {
    throw new Error('Please provide a website URL to edit.')
  }
  const raw = String(input).trim()
  if (!raw) {
    throw new Error('Please provide a website URL to edit.')
  }
  if (/^\[[^\]]+\]\([^)]+\)$/.test(raw)) {
    throw new Error('App target looks like a Markdown link — pass only the URL, for example https://example.com')
  }

  // Pure port number shorthand: "3000" -> "http://localhost:3000"
  if (/^\d{2,5}$/.test(raw)) {
    return new URL(`http://localhost:${raw}`)
  }

  // Handle double joined URLs
  if (/^https?:\/\/[^/]+\/https?:\/\//i.test(raw)) {
    throw new Error('App target contains two joined URLs — pass only one URL')
  }

  let withProto = raw
  if (!/^https?:\/\//i.test(raw)) {
    if (isLocalhost(raw) || /^:\d+/.test(raw)) {
      withProto = `http://${raw.replace(/^:/, 'localhost:')}`
    } else {
      withProto = `https://${raw}`
    }
  }

  let parsed
  try {
    parsed = new URL(withProto)
  } catch {
    throw new Error(`Invalid website URL: "${raw}". Example: https://streamex.hn or http://localhost:3000`)
  }

  if (/^\/https?:\/\//i.test(parsed.pathname)) {
    throw new Error(`App target contains two joined URLs — use only ${parsed.pathname.slice(1)}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Website URL must use http:// or https:// (received: ${parsed.protocol})`)
  }

  return parsed
}

/**
 * Sanitize a domain or URL hostname for use as a folder name on Windows/macOS/Linux.
 * @param {string | URL} urlOrDomain
 * @returns {string}
 */
export function sanitizeWorkspaceName(urlOrDomain) {
  let hostname = ''
  if (urlOrDomain instanceof URL) {
    hostname = urlOrDomain.hostname
  } else {
    try {
      const parsed = normalizeTargetUrl(urlOrDomain)
      hostname = parsed.hostname
    } catch {
      hostname = String(urlOrDomain).replace(/^https?:\/\//i, '').split('/')[0].split(':')[0]
    }
  }
  const clean = hostname.replace(/[\\/:*?"<>|\s]/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return clean || 'website'
}

/**
 * Check if a directory is a protected Windows / system directory.
 * @param {string} dir
 * @returns {boolean}
 */
export function isSystemDirectory(dir) {
  if (!dir) return false
  const abs = path.resolve(dir)
  if (process.platform === 'win32') {
    const winDir = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows'
    const progFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    const roots = [winDir, progFiles, progFilesX86]
    for (const root of roots) {
      if (root && (abs.toLowerCase() === root.toLowerCase() || abs.toLowerCase().startsWith(root.toLowerCase() + path.sep))) {
        return true
      }
    }
    // Also guard against root drive paths like C:\ directly if unconfigured
    if (/^[a-zA-Z]:\\?$/.test(abs)) {
      return true
    }
  } else {
    const systemRoots = ['/usr', '/bin', '/sbin', '/etc', '/var', '/System', '/Library']
    for (const root of systemRoots) {
      if (abs === root || abs.startsWith(root + '/')) {
        return true
      }
    }
  }
  return false
}

/**
 * Test whether a directory can be safely written to.
 * @param {string} dir
 * @returns {boolean}
 */
export function isWritableDirectory(dir) {
  if (!dir) return false
  if (isSystemDirectory(dir)) return false
  try {
    const abs = path.resolve(dir)
    if (!fs.existsSync(abs)) {
      // Check if parent directory is writable
      const parent = path.dirname(abs)
      if (!fs.existsSync(parent) || isSystemDirectory(parent)) return false
      fs.accessSync(parent, fs.constants.W_OK)
      return true
    }
    fs.accessSync(abs, fs.constants.W_OK)
    // Perform a safe probe write to guarantee EPERM is avoided
    const probe = path.join(abs, `.froam_probe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
    try {
      fs.writeFileSync(probe, 'ok')
      fs.unlinkSync(probe)
      return true
    } catch {
      return false
    }
  } catch {
    return false
  }
}

/**
 * Resolve a safe workspace folder for Froam design artifacts.
 *
 * Rules:
 * 1. Explicit `customDir` (via --dir) is always respected.
 * 2. Online websites (e.g. https://streamex.hn) are stored in ~/Froam/<website>/.
 * 3. Localhost targets use current working directory (cwd) if writable and safe.
 * 4. Unwritable/system directories (like C:\Windows\System32) fall back to safe ~/Froam workspace.
 *
 * @param {{
 *   targetUrl?: string | URL | null,
 *   customDir?: string | null,
 *   cwd?: string,
 *   homeDir?: string,
 * }} options
 * @returns {string} Absolute path to the safe Froam workspace directory.
 */
export function resolveSafeWorkspaceDir({
  targetUrl = null,
  customDir = null,
  cwd = process.cwd(),
  homeDir = os.homedir(),
} = {}) {
  if (customDir) {
    return path.resolve(cwd, customDir)
  }

  const baseFroamDir = path.join(homeDir, 'Froam')

  if (targetUrl) {
    let urlObj = null
    try {
      urlObj = targetUrl instanceof URL ? targetUrl : normalizeTargetUrl(targetUrl)
    } catch {
      // If parsing fails, fall back to safe workspace
    }

    if (urlObj && !isLocalhost(urlObj)) {
      // Online site: store in ~/Froam/<website>
      const folderName = sanitizeWorkspaceName(urlObj)
      const targetDir = path.join(baseFroamDir, folderName)
      fs.mkdirSync(targetDir, { recursive: true })
      return targetDir
    }

    // Localhost target
    if (isWritableDirectory(cwd)) {
      const srcDir = path.join(cwd, 'src')
      if (fs.existsSync(path.join(srcDir, 'froam'))) return path.join(srcDir, 'froam')
      if (fs.existsSync(path.join(cwd, 'froam'))) return path.join(cwd, 'froam')
      return fs.existsSync(srcDir) ? path.join(srcDir, 'froam') : path.join(cwd, 'froam')
    }

    // Unwritable cwd fallback for localhost
    const portSuffix = urlObj?.port ? `-${urlObj.port}` : ''
    const targetDir = path.join(baseFroamDir, `localhost${portSuffix}`)
    fs.mkdirSync(targetDir, { recursive: true })
    return targetDir
  }

  // No target URL provided (e.g. static serve or generic dev)
  if (isWritableDirectory(cwd)) {
    const srcDir = path.join(cwd, 'src')
    if (fs.existsSync(path.join(srcDir, 'froam'))) return path.join(srcDir, 'froam')
    if (fs.existsSync(path.join(cwd, 'froam'))) return path.join(cwd, 'froam')
    return fs.existsSync(srcDir) ? path.join(srcDir, 'froam') : path.join(cwd, 'froam')
  }

  const targetDir = path.join(baseFroamDir, 'default')
  fs.mkdirSync(targetDir, { recursive: true })
  return targetDir
}

/**
 * Checks if a specific port is available on localhost / all interfaces.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => {
      resolve(false)
    })
    server.listen(port, '127.0.0.1', () => {
      server.close(() => {
        resolve(true)
      })
    })
  })
}

/**
 * Find the first available TCP port starting from startPort (default 4600).
 * @param {number} startPort
 * @param {number} maxAttempts
 * @returns {Promise<number>}
 */
export async function findFreePort(startPort = 4600, maxAttempts = 50) {
  for (let port = startPort; port < startPort + maxAttempts; port += 1) {
    if (await isPortAvailable(port)) {
      return port
    }
  }
  return startPort
}

export const PROMPT_BANNER = `
◆ Froam
  Paste the website you want to edit.
  For your own project, start it first and paste its localhost URL.
`

/**
 * Prompt the user interactively in the terminal for the target website URL.
 * @param {{
 *   input?: NodeJS.ReadableStream,
 *   output?: NodeJS.WritableStream,
 * }} options
 * @returns {Promise<string>}
 */
export function promptWebsiteUrl({
  input = process.stdin,
  output = process.stdout,
} = {}) {
  return new Promise((resolve) => {
    output.write(PROMPT_BANNER.trimStart())
    output.write('\n  Website URL: ')

    const rl = readline.createInterface({
      input,
      output,
      terminal: Boolean(input.isTTY),
    })

    let answered = false

    rl.on('line', (line) => {
      if (!answered) {
        answered = true
        rl.close()
        resolve(line.trim())
      }
    })

    rl.on('close', () => {
      if (!answered) {
        answered = true
        resolve('')
      }
    })
  })
}
