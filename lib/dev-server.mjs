/**
 * Froam Studio v3 — universal dev bridge.
 *
 * One small server that brings the Froam editor to ANY project:
 *
 *   froam dev                     bridge only (script-tag mode)
 *   froam dev --app <url|port>    proxy an existing dev server and
 *                                 auto-inject the editor into every
 *                                 HTML page (Next, Nuxt, Rails, PHP,
 *                                 anything that serves HTML)
 *   froam dev --serve [dir]       serve a static folder with the
 *                                 editor injected into every .html
 *
 * Endpoints (all CORS-enabled):
 *   GET  /froam.js               standalone editor bundle (React inside)
 *   GET  /froam.css              editor styles
 *   GET  /__froam/repo/load      -> { success, design }
 *   GET  /__froam/repo/project/load -> { success, project }
 *   GET  /__froam/repo/status    -> { success, exists, dirty, files }
 *   POST /__froam/repo/save      { routeKey, viewportMode, store }
 *   POST /__froam/repo/project/save  project envelope sidecar
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { applyCors, guardBridgeRequest, isAllowedHost, isAllowedOrigin, normalizeAllowedOrigins } from './bridge-security.mjs'
import { writeTextEdits } from './source-writeback.mjs'
import { applyChangeRequest, loadDesign, mergeSave, writeArtifacts, VIEWPORTS } from './codegen.mjs'
import { createFroamPublishApi } from './publish-store.mjs'
import { createFroamRoomApi } from './room-store.mjs'
import { loadProjectFile, writeProjectFile } from './project-store.mjs'
import { createFroamIntelligenceApi, createOpenAICompatibleProvider } from './intelligence-store.mjs'
import { normalizeTargetUrl } from './launcher.mjs'

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EDITOR_JS = path.join(PACKAGE_ROOT, 'dist', 'standalone', 'froam-editor.js')
const EDITOR_CSS = path.join(PACKAGE_ROOT, 'dist', 'standalone', 'froam-editor.css')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
}

function isLoopbackAddress(address) {
  const value = String(address ?? '')
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1' || value.startsWith('127.')
}

/** CORS only for the origin guardBridgeRequest allowed (see bridge-security.mjs). */
function cors(res) {
  applyCors(res)
}

function send(res, status, payload) {
  cors(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

/**
 * Report an upstream failure in the language of whoever asked.
 *
 * A page request is a person looking at a browser window, and raw JSON tells
 * them nothing; an asset or fetch request is code, and gets the JSON it expects.
 */
function sendUpstreamError(req, res, appTarget, error) {
  if (res.headersSent) return res.end()
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(appTarget.hostname)
  const reason = error?.code === 'ENOTFOUND'
    ? `Froam could not find ${appTarget.hostname}. Check the spelling, or check that you are online.`
    : isLocal
      ? `Nothing is running at ${appTarget.origin}. Start your project, then reload this page.`
      : `${appTarget.origin} did not answer. It may be down or blocking this network.`

  if (!String(req.headers.accept ?? '').includes('text/html')) {
    return send(res, 502, { success: false, error: `${reason} (${error?.message ?? 'network error'})` })
  }

  cors(res)
  res.statusCode = 502
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><meta charset="utf-8"><title>Froam — site unreachable</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0d;color:#e9e9ee;
       font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:34rem;padding:2rem}
  h1{font-size:1.25rem;margin:0 0 .75rem}
  p{margin:0 0 .75rem;color:#b6b6c2}
  code{background:#1a1a20;padding:.15rem .4rem;border-radius:.25rem;font-size:.9em}
</style>
<main>
  <h1>◆ Froam couldn't load this site</h1>
  <p>${escapeHtml(reason)}</p>
  <p>Once it is up, reload this page. To edit a different site, stop Froam with <code>Ctrl+C</code> and run it again.</p>
</main>`)
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]
  ))
}

function sendFile(res, filePath, { status = 200 } = {}) {
  cors(res)
  res.statusCode = status
  res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
}

const MAX_BODY_BYTES = 20_000_000

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let done = false
    req.on('data', (chunk) => {
      if (done) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        // Stop reading: an oversized body must not be buffered to the end.
        done = true
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (done) return
      done = true
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', (error) => { if (!done) { done = true; reject(error) } })
  })
}

function gitStatus(dir) {
  return new Promise((resolve) => {
    execFile('git', ['status', '--porcelain', '--', dir], { cwd: dir }, (err, stdout) => {
      if (err) return resolve({ dirty: null, files: [] })
      const files = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
      resolve({ dirty: files.length > 0, files })
    })
  })
}

function injectEditorTag(html, projectKey) {
  const tag = `<script src="/froam.js" defer data-froam-project="${projectKey}"></script>`
  if (html.includes('/froam.js')) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}\n</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}\n</html>`)
  return `${html}\n${tag}\n`
}

export function normalizeAppTarget(app) {
  if (!app) return null
  return normalizeTargetUrl(app)
}

export function createBridgeProjectKey({ froamDir, appTarget = null, serveDir = null }) {
  const identity = JSON.stringify({
    froamDir: path.resolve(froamDir),
    target: appTarget?.origin ?? null,
    serveDir: serveDir ? path.resolve(serveDir) : null,
  })
  return `bridge-${crypto.createHash('sha256').update(identity).digest('hex').slice(0, 20)}`
}

function preventProxyCache(headers, { clearBrowserCache = false } = {}) {
  for (const name of ['etag', 'last-modified', 'expires', 'age']) delete headers[name]
  headers['cache-control'] = 'no-store, no-cache, must-revalidate, max-age=0'
  headers.pragma = 'no-cache'
  if (clearBrowserCache) headers['clear-site-data'] = '"cache"'
  return headers
}

const WELCOME_PAGE = (port) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Froam Bridge</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0c12; color: #f0f4f8; font: 15px/1.6 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 620px; padding: 48px 28px; }
  h1 { font-size: 28px; letter-spacing: -0.02em; margin: 0 0 4px; background: linear-gradient(135deg, #5eead4, #ff6c4f); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  p { color: rgba(226,232,240,0.72); }
  code, pre { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; font-family: ui-monospace, monospace; font-size: 13px; }
  code { padding: 2px 7px; }
  pre { padding: 14px 16px; overflow-x: auto; }
  .ok { display: inline-flex; align-items: center; gap: 8px; color: #5eead4; font-weight: 600; font-size: 13px; }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: #5eead4; box-shadow: 0 0 10px #5eead4; }
  h2 { font-size: 15px; margin-top: 28px; color: rgba(226,232,240,0.9); }
</style></head><body><main>
  <span class="ok"><span class="dot"></span>Froam Bridge is running on port ${port}</span>
  <h1>Froam Studio</h1>
  <p>Your visual editor is ready. Three ways to use it:</p>
  <h2>1 · Overlay any dev server (recommended)</h2>
  <pre>froam dev --app http://localhost:3000</pre>
  <p>Then open <code>http://localhost:${port}</code> — your app, with Froam on top.</p>
  <h2>2 · Serve a static folder</h2>
  <pre>froam dev --serve .</pre>
  <h2>3 · One script tag in your own dev page</h2>
  <pre>&lt;script src="http://localhost:${port}/froam.js" defer&gt;&lt;/script&gt;</pre>
</main></body></html>`

/**
 * @param {{
 *   port?: number,
 *   froamDir: string,
 *   app?: string | null,
 *   serveDir?: string | null,
 *   log?: (line: string) => void,
 * }} options
 */
export function createBridgeServer({ port = 4600, froamDir, app = null, serveDir = null, allowOrigins: allowOriginsOption, sourceRoot = null, log = () => {} }) {
  // Extra origins (a custom dev domain like http://app.test) that may use the bridge.
  const allowOrigins = normalizeAllowedOrigins(allowOriginsOption ?? process.env.FROAM_ALLOW_ORIGINS)
  const appTarget = normalizeAppTarget(app)
  const projectKey = createBridgeProjectKey({ froamDir, appTarget, serveDir })
  const designPath = () => path.join(froamDir, 'froam.design.json')
  const projectPath = () => path.join(froamDir, 'froam.project.json')
  // Publish works through the bridge with no backend: designs published
  // from the editor land in froam.published.json and every device that
  // loads the page through the bridge picks them up (great with --host).
  const publishApi = createFroamPublishApi({ file: path.join(froamDir, 'froam.published.json'), log })
  // Rooms too, for the same reason: a review session should work on any
  // project before anyone has stood up a backend for it.
  /**
   * An approved change request goes live the way Save to Repo does: copy into
   * the source where it can be placed, then only the changed paths merged
   * onto the current design (never the contributor's whole snapshot — the
   * owner may have saved other work since) and the artifacts regenerated.
   */
  async function publishApprovedRequest({ request }) {
    const written = sourceRoot && request.textEdits.length ? writeTextEdits(sourceRoot, request.textEdits) : []
    // The source says those words now; a text override would only overrule it later.
    const writtenText = written.map((result, index) => (result.status === 'written' ? request.textEdits[index].to : null)).filter(Boolean)
    fs.mkdirSync(froamDir, { recursive: true })
    writeArtifacts(froamDir, applyChangeRequest(loadDesign(designPath()), request, { writtenText }))
    const files = [...new Set(written.filter((result) => result.status === 'written').map((result) => result.file))]
    log(`published "${request.title}" by ${request.createdBy}${files.length ? ` (copy → ${files.join(', ')})` : ''}`)
    return { detail: files.length ? `Published · copy written into ${files.join(', ')}` : 'Published to the design files' }
  }

  const roomApi = createFroamRoomApi({ file: path.join(froamDir, 'froam.rooms.json'), onApproveRequest: publishApprovedRequest, log })

  // Intelligence endpoint — optional. Froam accepts its own provider variables
  // and the conventional OPENAI_* aliases; local editor intelligence remains
  // available when no remote provider is configured.
  const aiApiKey = process.env.FROAM_AI_API_KEY || process.env.OPENAI_API_KEY
  const aiModel = process.env.FROAM_AI_MODEL || process.env.OPENAI_MODEL
  const aiBaseUrl = process.env.FROAM_AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const intelligenceProvider = aiApiKey && aiModel && aiBaseUrl
    ? createOpenAICompatibleProvider({ baseUrl: aiBaseUrl, apiKey: aiApiKey, model: aiModel })
    : null
  const intelligenceApi = createFroamIntelligenceApi({ provider: intelligenceProvider, log })

  async function handleBridgeRoute(req, res, url) {
    if (req.method === 'OPTIONS') {
      cors(res)
      res.statusCode = 204
      return res.end()
    }

    if (url === '/froam.js') {
      if (!fs.existsSync(EDITOR_JS)) {
        return send(res, 503, { success: false, error: 'Editor bundle missing — reinstall @ahmadastic/froam or run its build.' })
      }
      return sendFile(res, EDITOR_JS)
    }

    if (url === '/__froam/config' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store')
      return send(res, 200, { success: true, projectKey })
    }
    if (url === '/froam.css') {
      if (!fs.existsSync(EDITOR_CSS)) return send(res, 404, { success: false, error: 'Editor styles missing.' })
      return sendFile(res, EDITOR_CSS)
    }

    if (url === '/__froam/repo/load' && req.method === 'GET') {
      return send(res, 200, { success: true, design: loadDesign(designPath()) })
    }

    if (url === '/__froam/repo/project/load' && req.method === 'GET') {
      return send(res, 200, { success: true, project: loadProjectFile(projectPath()) })
    }

    // The repo is written only from this machine. Anyone joining over the
    // network (--host, a tunnel) changes it through a request the owner
    // approves — the room API — never by writing files directly.
    const writesRepo = req.method === 'POST' && (url === '/__froam/repo/save' || url === '/__froam/repo/project/save' || url === '/__froam/source/text')
    if (writesRepo && !isLoopbackAddress(req.socket?.remoteAddress)) {
      return send(res, 403, { success: false, error: 'Only the computer running froam dev can write the repo — submit your changes for approval instead.' })
    }

    if (url === '/__froam/repo/project/save' && req.method === 'POST') {
      const project = await readJsonBody(req)
      try {
        writeProjectFile(projectPath(), project)
        const status = await gitStatus(froamDir)
        return send(res, 200, { success: true, file: 'froam.project.json', ...status })
      } catch (error) {
        return send(res, 400, { success: false, error: error instanceof Error ? error.message : 'Invalid project' })
      }
    }

    if (url === '/__froam/repo/status' && req.method === 'GET') {
      const status = await gitStatus(froamDir)
      return send(res, 200, { success: true, exists: fs.existsSync(designPath()), projectExists: fs.existsSync(projectPath()), dir: froamDir, sourceWriteBack: Boolean(sourceRoot), ...status })
    }

    // Copy edits into the project's own source (see source-writeback.mjs).
    if (url === '/__froam/source/text' && req.method === 'POST') {
      if (!sourceRoot) return send(res, 200, { success: false, disabled: true })
      const { edits } = await readJsonBody(req)
      if (!Array.isArray(edits) || edits.length > 500) return send(res, 400, { success: false, error: 'Expected { edits: [{ from, to }] }' })
      const results = writeTextEdits(sourceRoot, edits)
      const written = results.filter((result) => result.status === 'written')
      if (written.length) log(`copy → source: ${written.map((result) => `${result.file}:${result.line}`).join(', ')}`)
      return send(res, 200, { success: true, results })
    }

    if (url === '/__froam/repo/save' && req.method === 'POST') {
      const { routeKey, viewportMode, store, brandFonts, rootScope } = await readJsonBody(req)
      if (typeof routeKey !== 'string' || !VIEWPORTS.includes(viewportMode) || typeof store !== 'object' || store === null) {
        return send(res, 400, { success: false, error: 'Expected { routeKey, viewportMode, store }' })
      }
      if (brandFonts !== undefined && !Array.isArray(brandFonts)) {
        return send(res, 400, { success: false, error: 'brandFonts must be an array when present' })
      }
      fs.mkdirSync(froamDir, { recursive: true })
      const design = mergeSave(loadDesign(designPath()), { routeKey, viewportMode, store, brandFonts, rootScope })
      const files = writeArtifacts(froamDir, design)
      const status = await gitStatus(froamDir)
      log(`saved ${routeKey} (${viewportMode}) → ${files.join(', ')}`)
      return send(res, 200, { success: true, ...status, files })
    }

    if (url === '/__froam/intelligence/plan') {
      // Rewrite url so the handler matches /plan
      const fakeReq = Object.assign(Object.create(req), { url: '/plan' })
      if (await intelligenceApi(fakeReq, res)) return
    }

    return send(res, 404, { success: false, error: 'Unknown froam endpoint' })
  }

  function proxyRequest(req, res) {
    const headers = { ...req.headers, host: appTarget.host, 'accept-encoding': 'identity' }
    delete headers['if-none-match']
    delete headers['if-modified-since']
    // A live site is https; only a local dev server is plain http. Picking the
    // transport by protocol is what lets Froam sit in front of a production URL.
    const transport = appTarget.protocol === 'https:' ? https : http
    const upstream = transport.request(
      {
        protocol: appTarget.protocol,
        hostname: appTarget.hostname,
        port: appTarget.port || (appTarget.protocol === 'https:' ? 443 : 80),
        path: req.url,
        method: req.method,
        headers,
      },
      (upstreamRes) => {
        const contentType = String(upstreamRes.headers['content-type'] ?? '')
        const isHtml = contentType.includes('text/html')
        const outHeaders = preventProxyCache({ ...upstreamRes.headers }, { clearBrowserCache: isHtml })
        // Dev-only: CSP would block the injected editor script.
        delete outHeaders['content-security-policy']
        delete outHeaders['content-security-policy-report-only']

        if (!isHtml) {
          res.writeHead(upstreamRes.statusCode ?? 502, outHeaders)
          return upstreamRes.pipe(res)
        }

        const chunks = []
        upstreamRes.on('data', (chunk) => chunks.push(chunk))
        upstreamRes.on('end', () => {
          const html = injectEditorTag(Buffer.concat(chunks).toString('utf8'), projectKey)
          const body = Buffer.from(html, 'utf8')
          delete outHeaders['content-length']
          delete outHeaders['transfer-encoding']
          outHeaders['content-length'] = String(body.byteLength)
          res.writeHead(upstreamRes.statusCode ?? 200, outHeaders)
          res.end(body)
        })
      },
    )
    upstream.on('error', (error) => {
      sendUpstreamError(req, res, appTarget, error)
    })
    req.pipe(upstream)
  }

  function serveStatic(req, res, url) {
    let decoded
    try {
      decoded = decodeURIComponent(url)
    } catch {
      return send(res, 400, { success: false, error: 'Malformed URL' })
    }
    const root = path.resolve(serveDir)
    // Resolve as a URL path (always rooted), then insist the result stays in the folder.
    let filePath = path.resolve(root, '.' + path.posix.normalize('/' + decoded.replace(/\\/g, '/')))
    const relative = path.relative(root, filePath)
    if (relative.startsWith('..') || path.isAbsolute(relative) || decoded.includes('\0')) {
      return send(res, 403, { success: false, error: 'Forbidden' })
    }
    // Dotfiles (.env, .git, .npmrc) are never served — only the public .well-known.
    if (relative.split(path.sep).some((segment) => segment.startsWith('.') && segment !== '.well-known')) {
      return send(res, 404, { success: false, error: 'Not found' })
    }
    // A symlink inside the folder must not lead out of it.
    try {
      if (fs.existsSync(filePath) && path.relative(fs.realpathSync(root), fs.realpathSync(filePath)).startsWith('..')) {
        return send(res, 403, { success: false, error: 'Forbidden' })
      }
    } catch { /* unreadable → falls through to 404 */ }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
      const withHtml = `${filePath}.html`
      if (fs.existsSync(withHtml)) filePath = withHtml
    }
    if (!fs.existsSync(filePath)) {
      cors(res)
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.end('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px"><h1>404</h1><p>Froam static server: file not found.</p></body>')
    }
    if (['.html', '.htm'].includes(path.extname(filePath).toLowerCase())) {
      const html = injectEditorTag(fs.readFileSync(filePath, 'utf8'), projectKey)
      cors(res)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.end(html)
    }
    return sendFile(res, filePath)
  }

  const server = http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0]
    if (!guardBridgeRequest(req, res, { allowOrigins })) return
    try {
      if (url === '/froam.js' || url === '/froam.css' || url.startsWith('/__froam/')) {
        return await handleBridgeRoute(req, res, url)
      }
      // The bridge IS the publish backend (even in proxy mode): /published
      // persists to froam.published.json; other cloud-API probes get benign
      // answers so the editor falls back to repo/local drafts without noise.
      if (url.startsWith('/api/froam/')) {
        cors(res)
        if (await publishApi(req, res)) return
        if (await roomApi(req, res)) return
        if (appTarget) return proxyRequest(req, res)
        if (req.method === 'GET') return send(res, 200, { success: false })
        return send(res, 501, { success: false, error: 'Only /api/froam/published and /api/froam/rooms are available through the froam bridge — use Save to Repo (Ctrl+Shift+S) for everything else.' })
      }
      if (appTarget) return proxyRequest(req, res)
      if (serveDir) return serveStatic(req, res, url)
      if (url === '/') {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.end(WELCOME_PAGE(port))
      }
      return send(res, 404, { success: false, error: 'Not found — bridge mode only serves /froam.js and /__froam/*' })
    } catch (error) {
      log(`bridge error: ${error?.message ?? error}`)
      return send(res, 500, { success: false, error: 'Internal Froam bridge error' })
    }
  })

  // WebSocket passthrough so HMR keeps working through the proxy.
  if (appTarget) {
    server.on('upgrade', (req, socket, head) => {
      // Same rules as HTTP: this machine's names only, and no other site's pages.
      const origin = req.headers.origin
      if (!isAllowedHost(req.headers.host, allowOrigins) || (origin && !isAllowedOrigin(origin, allowOrigins))) {
        socket.destroy()
        return
      }
      const upstream = net.connect(
        Number(appTarget.port) || (appTarget.protocol === 'https:' ? 443 : 80),
        appTarget.hostname,
        () => {
          const lines = [`${req.method} ${req.url} HTTP/1.1`]
          const headers = { ...req.headers, host: appTarget.host }
          for (const [name, value] of Object.entries(headers)) {
            for (const v of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${v}`)
          }
          upstream.write(lines.join('\r\n') + '\r\n\r\n')
          if (head?.length) upstream.write(head)
          upstream.pipe(socket)
          socket.pipe(upstream)
        },
      )
      const drop = () => {
        socket.destroy()
        upstream.destroy()
      }
      upstream.on('error', drop)
      socket.on('error', drop)
    })
  }

  return { server, appTarget, projectKey }
}
