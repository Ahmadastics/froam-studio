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
 *   GET  /__froam/repo/status    -> { success, exists, dirty, files }
 *   POST /__froam/repo/save      { routeKey, viewportMode, store }
 */
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadDesign, mergeSave, writeArtifacts, VIEWPORTS } from './codegen.mjs'
import { createFroamPublishApi } from './publish-store.mjs'

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

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function send(res, status, payload) {
  cors(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function sendFile(res, filePath, { status = 200 } = {}) {
  cors(res)
  res.statusCode = status
  res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 20_000_000) reject(new Error('Payload too large'))
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
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

function injectEditorTag(html) {
  const tag = '<script src="/froam.js" defer></script>'
  if (html.includes('/froam.js')) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}\n</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}\n</html>`)
  return `${html}\n${tag}\n`
}

function normalizeAppTarget(app) {
  if (!app) return null
  const raw = /^\d+$/.test(String(app)) ? `http://localhost:${app}` : String(app)
  const url = new URL(raw.includes('://') ? raw : `http://${raw}`)
  return url
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
export function createBridgeServer({ port = 4600, froamDir, app = null, serveDir = null, log = () => {} }) {
  const appTarget = normalizeAppTarget(app)
  const designPath = () => path.join(froamDir, 'froam.design.json')
  // Publish works through the bridge with no backend: designs published
  // from the editor land in froam.published.json and every device that
  // loads the page through the bridge picks them up (great with --host).
  const publishApi = createFroamPublishApi({ file: path.join(froamDir, 'froam.published.json'), log })

  async function handleBridgeRoute(req, res, url) {
    if (req.method === 'OPTIONS') {
      cors(res)
      res.statusCode = 204
      return res.end()
    }

    if (url === '/froam.js') {
      if (!fs.existsSync(EDITOR_JS)) {
        return send(res, 503, { success: false, error: 'Editor bundle missing — reinstall froam-studio or run its build.' })
      }
      return sendFile(res, EDITOR_JS)
    }
    if (url === '/froam.css') {
      if (!fs.existsSync(EDITOR_CSS)) return send(res, 404, { success: false, error: 'Editor styles missing.' })
      return sendFile(res, EDITOR_CSS)
    }

    if (url === '/__froam/repo/load' && req.method === 'GET') {
      return send(res, 200, { success: true, design: loadDesign(designPath()) })
    }

    if (url === '/__froam/repo/status' && req.method === 'GET') {
      const status = await gitStatus(froamDir)
      return send(res, 200, { success: true, exists: fs.existsSync(designPath()), dir: froamDir, ...status })
    }

    if (url === '/__froam/repo/save' && req.method === 'POST') {
      const { routeKey, viewportMode, store } = await readJsonBody(req)
      if (typeof routeKey !== 'string' || !VIEWPORTS.includes(viewportMode) || typeof store !== 'object' || store === null) {
        return send(res, 400, { success: false, error: 'Expected { routeKey, viewportMode, store }' })
      }
      fs.mkdirSync(froamDir, { recursive: true })
      const design = mergeSave(loadDesign(designPath()), { routeKey, viewportMode, store })
      const files = writeArtifacts(froamDir, design)
      const status = await gitStatus(froamDir)
      log(`saved ${routeKey} (${viewportMode}) → ${files.join(', ')}`)
      return send(res, 200, { success: true, ...status, files })
    }

    return send(res, 404, { success: false, error: 'Unknown froam endpoint' })
  }

  function proxyRequest(req, res) {
    const headers = { ...req.headers, host: appTarget.host, 'accept-encoding': 'identity' }
    const upstream = http.request(
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
        const outHeaders = { ...upstreamRes.headers }
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
          const html = injectEditorTag(Buffer.concat(chunks).toString('utf8'))
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
      send(res, 502, { success: false, error: `Froam could not reach ${appTarget.origin} — is your app running? (${error.message})` })
    })
    req.pipe(upstream)
  }

  function serveStatic(req, res, url) {
    const safePath = path.normalize(decodeURIComponent(url)).replace(/^([/\\])+/, '').replace(/^(\.\.([/\\]|$))+/, '')
    let filePath = path.join(serveDir, safePath)
    if (!filePath.startsWith(path.resolve(serveDir))) {
      return send(res, 403, { success: false, error: 'Forbidden' })
    }
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
      const html = injectEditorTag(fs.readFileSync(filePath, 'utf8'))
      cors(res)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.end(html)
    }
    return sendFile(res, filePath)
  }

  const server = http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0]
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
        if (appTarget) return proxyRequest(req, res)
        if (req.method === 'GET') return send(res, 200, { success: false })
        return send(res, 501, { success: false, error: 'Only /api/froam/published is available through the froam bridge — use Save to Repo (Ctrl+Shift+S) for everything else.' })
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
      return send(res, 500, { success: false, error: error?.message ?? 'Froam bridge error' })
    }
  })

  // WebSocket passthrough so HMR keeps working through the proxy.
  if (appTarget) {
    server.on('upgrade', (req, socket, head) => {
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

  return { server, appTarget }
}
