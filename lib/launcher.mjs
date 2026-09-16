/**
 * Froam Studio Alpha 01 — Launcher helper library.
 *
 * Provides URL normalization, safe workspace routing, free port discovery,
 * system directory protection, and interactive onboarding for the zero-argument CLI.
 */
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

/** Private / link-local IPv4 ranges — someone's own machine or LAN, never a public site. */
const PRIVATE_IPV4 = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/

/**
 * Extensions that are definitely not TLDs. A tester who pastes `index.html` means
 * a file, not a website, and deserves to be told so instead of watching Froam
 * proxy `https://index.html` into a DNS failure.
 */
const FILE_EXTENSIONS = new Set([
  'html', 'htm', 'js', 'mjs', 'cjs', 'jsx', 'tsx', 'json', 'css', 'scss', 'less',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'txt', 'mp4', 'mov', 'pdf',
  'exe', 'zip', 'tar', 'gz', 'lock', 'yml', 'yaml', 'toml', 'env', 'log',
])

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
  const hostname = host.replace(/^\[|\]$/g, '').split(':')[0].toLowerCase() || host.toLowerCase()
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || hostname === '[::1]'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || PRIVATE_IPV4.test(hostname)
  )
}

/**
 * The message a tester sees when what they pasted is not a web address.
 * One shape for every rejection so the CLI never contradicts itself.
 * @param {string} raw
 * @returns {string}
 */
function notAWebAddress(raw) {
  return `That doesn't look like a website address: "${raw}"\n`
    + '  Try something like:\n'
    + '    example.com\n'
    + '    https://example.com\n'
    + '    localhost:3000'
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
  if (/^\d{1,5}$/.test(raw)) {
    const port = Number(raw)
    if (port < 1 || port > 65535) {
      throw new Error(`${raw} is not a valid port. Ports run from 1 to 65535 — a dev server is usually 3000, 5173, or 8080.`)
    }
    return new URL(`http://localhost:${port}`)
  }

  // Handle double joined URLs
  if (/^https?:\/\/[^/]+\/https?:\/\//i.test(raw)) {
    throw new Error('App target contains two joined URLs — pass only one URL')
  }

  // A scheme Froam cannot proxy must be rejected, not silently glued onto https://
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(raw)
  if (schemeMatch && !/^https?$/i.test(schemeMatch[1])) {
    throw new Error(`Froam can only open http:// or https:// addresses (got "${schemeMatch[1]}://").`)
  }

  let withProto = raw
  if (!schemeMatch) {
    if (/[\\]/.test(raw) || /^[.~]?\//.test(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) {
      throw new Error(`"${raw}" looks like a folder on your computer, not a website.\n`
        + '  To edit a folder of HTML files, run Froam from inside it.')
    }
    if (isLocalhost(raw) || /^:\d+/.test(raw)) {
      withProto = `http://${raw.replace(/^:/, 'localhost:')}`
    } else {
      const label = raw.split(/[/?#]/)[0].split(':')[0]
      // A bare IPv4 host is a machine on a network, not a public site: plain http.
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(label)) {
        return new URL(`http://${raw}`)
      }
      const lastDot = label.lastIndexOf('.')
      if (lastDot <= 0 || lastDot === label.length - 1) {
        throw new Error(notAWebAddress(raw))
      }
      const suffix = label.slice(lastDot + 1).toLowerCase()
      if (FILE_EXTENSIONS.has(suffix)) {
        throw new Error(`"${raw}" looks like a file, not a website.\n`
          + '  Paste the address of a site that is already running, for example example.com or localhost:3000')
      }
      if (!/^[a-z]{2,}$/i.test(suffix)) {
        throw new Error(notAWebAddress(raw))
      }
      withProto = `https://${raw}`
    }
  }

  let parsed
  try {
    parsed = new URL(withProto)
  } catch {
    throw new Error(notAWebAddress(raw))
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
    const probeTarget = fs.existsSync(abs) ? abs : path.dirname(abs)
    if (!fs.existsSync(probeTarget) || isSystemDirectory(probeTarget)) return false
    fs.accessSync(probeTarget, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Create the workspace, or report that we could not.
 *
 * Windows lies about writability (`fs.access` only reflects the read-only
 * attribute), so the only honest test is the mkdir itself. Doing it here rather
 * than probing with a throwaway file keeps Froam from dropping stray files into
 * a tester's project, where a dev server's file watcher would see them.
 *
 * @param {string} dir
 * @returns {boolean} true when the directory exists and is usable afterwards
 */
function tryCreateDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    return true
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
      if (tryCreateDir(targetDir)) return targetDir
      return createFallbackWorkspace(folderName)
    }

    // Localhost target: stay with the project when the project can hold it.
    const projectDir = projectWorkspaceDir(cwd)
    if (projectDir) return projectDir

    // Unwritable cwd fallback for localhost
    const portSuffix = urlObj?.port ? `-${urlObj.port}` : ''
    const name = `localhost${portSuffix}`
    const targetDir = path.join(baseFroamDir, name)
    if (tryCreateDir(targetDir)) return targetDir
    return createFallbackWorkspace(name)
  }

  // No target URL provided (e.g. static serve or generic dev)
  const projectDir = projectWorkspaceDir(cwd)
  if (projectDir) return projectDir

  const targetDir = path.join(baseFroamDir, 'default')
  if (tryCreateDir(targetDir)) return targetDir
  return createFallbackWorkspace('default')

  /** The froam/ folder belonging to the project in `dir`, or null if it cannot hold one. */
  function projectWorkspaceDir(dir) {
    if (!isWritableDirectory(dir)) return null
    const srcDir = path.join(dir, 'src')
    const candidate = fs.existsSync(path.join(srcDir, 'froam')) ? path.join(srcDir, 'froam')
      : fs.existsSync(path.join(dir, 'froam')) ? path.join(dir, 'froam')
        : fs.existsSync(srcDir) ? path.join(srcDir, 'froam') : path.join(dir, 'froam')
    return tryCreateDir(candidate) ? candidate : null
  }

  /** Last resort when even the home directory is not writable (locked-down machines). */
  function createFallbackWorkspace(name) {
    const tmpDir = path.join(os.tmpdir(), 'froam', name)
    if (tryCreateDir(tmpDir)) return tmpDir
    throw new Error('Froam could not create a folder to save your edits in.\n'
      + `  It tried ${baseFroamDir} and ${path.join(os.tmpdir(), 'froam')}.`)
  }
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
  throw new Error(`Froam could not find a free port between ${startPort} and ${startPort + maxAttempts - 1}.\n`
    + '  Close some running dev servers and try again.')
}

/**
 * Ask the target whether it is actually there, before Froam claims to be ready.
 *
 * An unreachable target is the single most likely first run failure — a typo'd
 * domain, or a local project the tester has not started yet. Without this the
 * CLI prints success and the browser shows a raw JSON error.
 *
 * @param {string | URL} target
 * @param {{ timeoutMs?: number }} options
 * @returns {Promise<{ ok: boolean, status?: number, kind?: string, code?: string, message?: string }>}
 */
export function probeTarget(target, { timeoutMs = 6000 } = {}) {
  return new Promise((resolve) => {
    let url
    try {
      url = target instanceof URL ? target : normalizeTargetUrl(target)
    } catch (error) {
      resolve({ ok: false, kind: 'invalid', message: error.message })
      return
    }

    const transport = url.protocol === 'https:' ? https : http
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { accept: 'text/html,*/*', 'user-agent': 'Froam' },
      },
      (response) => {
        request.destroy()
        resolve({ ok: true, status: response.statusCode })
      },
    )

    request.setTimeout(timeoutMs, () => {
      request.destroy()
      resolve({ ok: false, kind: 'timeout', message: `No response after ${Math.round(timeoutMs / 1000)}s` })
    })

    request.on('error', (error) => {
      // destroy() after a successful response also surfaces here — already resolved.
      resolve({ ok: false, kind: classifyNetworkError(error), code: error.code, message: error.message })
    })

    request.end()
  })
}

/**
 * @param {NodeJS.ErrnoException} error
 * @returns {'dns' | 'refused' | 'timeout' | 'tls' | 'other'}
 */
function classifyNetworkError(error) {
  const code = String(error?.code ?? '')
  const message = String(error?.message ?? '')
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns'
  if (code === 'ECONNREFUSED') return 'refused'
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') return 'timeout'
  if (
    /^(UNABLE_TO_|SELF_SIGNED|CERT_|DEPTH_ZERO|ERR_TLS)/.test(code)
    || /certificate|self.signed/i.test(message)
  ) return 'tls'
  return 'other'
}

/** Where dev servers actually live. Ordered so the likeliest is offered first. */
const COMMON_DEV_PORTS = [3000, 5173, 8080, 3001, 4200, 8000, 4321, 5174, 5000, 1313, 8081, 3002]

/**
 * Is something listening on this local port?
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function isPortOpen(port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    const done = (answer) => {
      socket.destroy()
      resolve(answer)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

/**
 * The <title> of a local page, used to label a detected project.
 * @returns {Promise<string | null>}
 */
function pageTitle(url, timeoutMs) {
  return new Promise((resolve) => {
    const request = http.get(url, { headers: { accept: 'text/html' } }, (response) => {
      if (!String(response.headers['content-type'] ?? '').includes('text/html')) {
        request.destroy()
        return resolve(null)
      }
      let body = ''
      response.on('data', (chunk) => {
        body += chunk
        // The title is in the head; no need to download a whole app for it.
        if (body.length > 8000) request.destroy()
      })
      const finish = () => {
        const match = /<title[^>]*>([^<]*)<\/title>/i.exec(body)
        resolve(match ? match[1].trim().slice(0, 40) || null : null)
      }
      response.on('end', finish)
      response.on('close', finish)
    })
    request.setTimeout(timeoutMs, () => request.destroy())
    request.on('error', () => resolve(null))
  })
}

/**
 * Find the dev servers already running on this machine.
 *
 * A tester editing their own project should not have to know which port their
 * framework picked. Scanning the handful of ports frameworks actually use turns
 * "paste a localhost URL" into "press 1".
 *
 * @param {{ ports?: number[], timeoutMs?: number }} options
 * @returns {Promise<Array<{ port: number, href: string, title: string | null }>>}
 */
export async function detectLocalProjects({ ports = COMMON_DEV_PORTS, timeoutMs = 400 } = {}) {
  const open = await Promise.all(ports.map(async (port) => (
    (await isPortOpen(port, timeoutMs)) ? port : null
  )))

  const live = open.filter((port) => port !== null)
  return Promise.all(live.map(async (port) => ({
    port,
    href: `http://localhost:${port}`,
    title: await pageTitle(`http://localhost:${port}`, timeoutMs * 4),
  })))
}

/**
 * Does this folder look like something a tester would call "my project"?
 * @param {string} dir
 * @returns {boolean}
 */
export function looksLikeProjectDir(dir) {
  if (!dir || !isWritableDirectory(dir)) return false
  return ['package.json', '.git', 'index.html', 'froam', 'src']
    .some((marker) => fs.existsSync(path.join(dir, marker)))
}

/**
 * Should a failed probe stop Froam, or only warn?
 *
 * "No such host" and "connection refused" are answers: the target is not there,
 * and starting would only produce a broken editor. A timeout is not an answer —
 * a slow connection looks exactly like a dead one, and refusing to start would
 * punish the testers on the worst networks. Those get a warning and a proxy that
 * will try again when the browser asks.
 *
 * @param {{ ok?: boolean, kind?: string }} probe
 * @returns {boolean}
 */
export function isFatalTargetFailure(probe) {
  if (probe?.ok) return false
  return probe?.kind === 'dns' || probe?.kind === 'refused' || probe?.kind === 'invalid' || probe?.kind === 'tls'
}

/**
 * Turn a failed probe into something a tester can act on.
 * @param {{ kind?: string, message?: string }} probe
 * @param {URL} url
 * @returns {string}
 */
export function describeTargetFailure(probe, url) {
  const where = url.host
  switch (probe.kind) {
    case 'invalid':
      return probe.message ?? notAWebAddress(String(url))
    case 'dns':
      return `Froam could not find ${where}.\n`
        + '  Check the spelling, or check that you are online.'
    case 'refused':
      return isLocalhost(url)
        ? `Nothing is running at ${url.origin}.\n`
          + '  Start your project first (for example `npm run dev`), then run Froam again\n'
          + '  and paste the address your project prints.'
        : `${where} refused the connection.\n`
          + '  The site may be down, or blocking this network.'
    case 'timeout':
      return `${where} is slow to answer — starting anyway.\n`
        + '  If the page stays blank, the site may be unreachable from this network.'
    case 'tls':
      return `Froam could not verify the security certificate for ${where}.\n`
        + '  This is usually antivirus or a company network inspecting HTTPS traffic.\n'
        + '  Ask whoever manages this machine to allow Node.js, or try another network.'
    default:
      return `Froam could not reach ${url.origin}.\n  ${probe.message ?? 'Unknown network error'}`
  }
}

export const PROMPT_BANNER = `
◆ Froam
  Paste the website you want to edit.
`

/** The "start your own project first" hint, shown only when we found nothing running. */
const NO_PROJECTS_HINT = '  Editing your own project? Start it first, then paste its address.\n'

/**
 * Prompt the user interactively in the terminal for the target website URL.
 * @param {{
 *   input?: NodeJS.ReadableStream,
 *   output?: NodeJS.WritableStream,
 *   repeat?: boolean,
 * }} options
 * @returns {Promise<string>}
 */
export function promptWebsiteUrl(options = {}) {
  const prompter = createPrompter(options)
  return prompter.ask(options).finally(() => prompter.close())
}

/**
 * A prompt that can be asked more than once.
 *
 * One readline interface has to serve every attempt: closing and reopening one
 * over the same stdin drops whatever has already been buffered, so a tester who
 * pastes a correction — or any non-interactive input — would lose it.
 *
 * @param {{ input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream }} options
 * @returns {{ ask: (options?: { repeat?: boolean }) => Promise<string>, close: () => void }}
 */
export function createPrompter({ input = process.stdin, output = process.stdout } = {}) {
  const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY) })
  const waiting = []
  const buffered = []
  let closed = false

  const nextLine = () => {
    if (buffered.length) return Promise.resolve(buffered.shift())
    if (closed) return Promise.resolve('')
    return new Promise((resolve) => waiting.push(resolve))
  }

  rl.on('line', (line) => {
    const answer = line.trim()
    const resolve = waiting.shift()
    if (resolve) resolve(answer)
    else buffered.push(answer)
  })

  rl.on('close', () => {
    closed = true
    while (waiting.length) waiting.shift()('')
  })

  return {
    ask({ repeat = false, projects = [] } = {}) {
      if (!repeat) {
        output.write(PROMPT_BANNER.trimStart())
        if (projects.length) {
          output.write('\n  Already running on this computer:\n')
          projects.forEach((project, index) => {
            const label = project.title ? `  ${project.title}` : ''
            output.write(`    ${index + 1}  localhost:${project.port}${label}\n`)
          })
        } else {
          output.write(NO_PROJECTS_HINT)
        }
      }
      output.write(projects.length ? '\n  Website URL, or a number: ' : '\n  Website URL: ')
      return nextLine()
    },
    askLine(text) {
      output.write(text)
      return nextLine()
    },
    close() {
      rl.close()
    },
  }
}
