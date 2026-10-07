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
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { applyCors, guardBridgeRequest, isAllowedHost, isAllowedOrigin, normalizeAllowedOrigins } from './bridge-security.mjs'
import { listSourceFiles, writeTextEdits } from './source-writeback.mjs'
import { revertClassLists, usesTailwind, writeStyleEdits } from './style-writeback.mjs'
import { approveChangeRequest, loadDesign, mergeSave, revertChangeRequest, writeArtifacts, VIEWPORTS } from './codegen.mjs'
import { createFroamNotifier } from './notifier.mjs'
import { shareIdentity, startShareTunnel, updateShareAccess } from './share-tunnel.mjs'
import { createFroamPublishApi } from './publish-store.mjs'
import { createFroamRoomApi } from './room-store.mjs'
import { loadProjectFile, writeProjectFile } from './project-store.mjs'
import { createFroamIntelligenceApi, createProviderFromEnv } from './intelligence-store.mjs'
import { normalizeTargetUrl } from './launcher.mjs'

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EDITOR_JS = path.join(PACKAGE_ROOT, 'dist', 'standalone', 'froam-editor.js')
const EDITOR_CSS = path.join(PACKAGE_ROOT, 'dist', 'standalone', 'froam-editor.css')
/** The split editor the /froam.js loader imports (scripts/build-standalone.mjs). */
const EDITOR_MODULES = path.join(PACKAGE_ROOT, 'dist', 'standalone', 'modules')
const PACKAGE_VERSION = (() => { try { return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version } catch { return null } })()

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

/**
 * Someone at this machine — not another browser, and not one reaching this
 * machine through a share link (share-tunnel.mjs marks every such request).
 */
function isLocalRequest(req) {
  return isLoopbackAddress(req.socket?.remoteAddress) && !req.headers['x-froam-remote']
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

/** `git config user.name`, or null. */
function gitUserName(dir) {
  return new Promise((resolve) => {
    execFile('git', ['config', 'user.name'], { cwd: dir, timeout: 3000 }, (err, stdout) => {
      const name = err ? '' : String(stdout).trim()
      resolve(name ? name.slice(0, 60) : null)
    })
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
  // async, not defer: the page never waits for the editor to download (defer
  // would hold DOMContentLoaded until the whole bundle arrived).
  const tag = `<script src="/froam.js" async data-froam-project="${projectKey}"></script>`
  if (html.includes('/froam.js')) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}\n</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}\n</html>`)
  return `${html}\n${tag}\n`
}

/**
 * Two hosts are the same site when one is the other with or without "www." —
 * the redirect nearly every live site does. Following it keeps the visitor in
 * Froam; passing it on sends them to the real site, without the editor.
 */
export function isSameSite(a, b) {
  const bare = (host) => String(host ?? '').toLowerCase().replace(/^www\./, '')
  return Boolean(a && b) && bare(a) === bare(b)
}

/** A site on this machine (a dev server) — never cached, so every edit to its code shows. */
const isLocalTarget = (target) => /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|.+\.localhost|.+\.local)$/i.test(target.hostname)

/** Connections to the site are reused: a secure handshake per file is most of a slow load. */
const upstreamAgents = {
  'http:': new http.Agent({ keepAlive: true, maxSockets: 48 }),
  'https:': new https.Agent({ keepAlive: true, maxSockets: 48 }),
}

/** A compressed HTML body, readable. */
function decodeBody(buffer, encoding) {
  try {
    switch (String(encoding ?? '').toLowerCase()) {
      case 'gzip': case 'x-gzip': return zlib.gunzipSync(buffer)
      case 'deflate': return zlib.inflateSync(buffer)
      case 'br': return zlib.brotliDecompressSync(buffer)
      default: return buffer
    }
  } catch {
    return buffer
  }
}

/**
 * Links to the site's own pages stay inside Froam: an absolute link to the
 * site would otherwise leave for the real one. Scripts, images and styles
 * keep their absolute URLs — they load straight from the site, which is faster.
 */
export function keepLinksInside(html, origins) {
  let out = html
  for (const origin of origins) {
    const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // A link to the bare origin is the home page: "/", never "".
    out = out.replace(new RegExp(`(<(?:a|area|form)\\b[^>]*?\\s(?:href|action)\\s*=\\s*)(["'])${escaped}(?=([/"'?#]))`, 'gi'), (_m, lead, quote, next) => `${lead}${quote}${next === quote ? '/' : ''}`)
  }
  return out
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
/**
 * Notifications from the environment or froam.config.json's "notify":
 *   FROAM_NOTIFY_WEBHOOK   one or more webhook URLs (Slack, Discord, any), comma-separated
 *   FROAM_SITE_URL         where links in them should open
 *   RESEND_API_KEY + FROAM_NOTIFY_EMAIL_FROM + FROAM_NOTIFY_EMAIL_TO   email
 */
function notifierFrom(config = {}) {
  const env = process.env
  const webhooks = [...(Array.isArray(config.webhooks) ? config.webhooks : []), ...String(env.FROAM_NOTIFY_WEBHOOK ?? '').split(',').map((url) => url.trim()).filter(Boolean)]
  const emailTo = config.email?.to ?? String(env.FROAM_NOTIFY_EMAIL_TO ?? '').split(',').map((to) => to.trim()).filter(Boolean)
  const email = (config.email?.resendApiKey ?? env.RESEND_API_KEY) && (config.email?.from ?? env.FROAM_NOTIFY_EMAIL_FROM) && emailTo.length
    ? { resendApiKey: config.email?.resendApiKey ?? env.RESEND_API_KEY, from: config.email?.from ?? env.FROAM_NOTIFY_EMAIL_FROM, to: emailTo }
    : null
  if (!webhooks.length && !email) return null
  return createFroamNotifier({ siteUrl: config.siteUrl ?? env.FROAM_SITE_URL ?? null, webhooks, email, events: config.events })
}

export function createBridgeServer({ port = 4600, froamDir, app = null, serveDir = null, allowOrigins: allowOriginsOption, sourceRoot = null, notify: notifyConfig = null, log = () => {} }) {
  // Tailwind projects can take base style edits into class lists (style-writeback.mjs).
  const tailwind = Boolean(sourceRoot && usesTailwind(sourceRoot))
  // Extra origins (a custom dev domain like http://app.test) that may use the bridge.
  const allowOrigins = normalizeAllowedOrigins(allowOriginsOption ?? process.env.FROAM_ALLOW_ORIGINS)
  let appTarget = normalizeAppTarget(app)
  const projectKey = createBridgeProjectKey({ froamDir, appTarget, serveDir })
  // Every origin this site has answered from (dominos.ng, then www.dominos.ng).
  const siteOrigins = new Set(appTarget ? [appTarget.origin] : [])
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
    const styled = tailwind && request.styleEdits?.length ? writeStyleEdits(sourceRoot, request.styleEdits) : []
    const withoutStyles = styled.some((result) => result.status === 'written') ? dropWrittenStyles(request, styled) : request
    fs.mkdirSync(froamDir, { recursive: true })
    const { design, undo } = approveChangeRequest(loadDesign(designPath()), withoutStyles, { writtenText })
    writeArtifacts(froamDir, design)
    const files = [...new Set([...written, ...styled].filter((result) => result.status === 'written').map((result) => result.file))]
    log(`published "${request.title}" by ${request.createdBy}${files.length ? ` (source → ${files.join(', ')})` : ''}`)
    return {
      detail: files.length ? `Published · written into ${files.join(', ')}` : 'Published to the design files',
      undo: { ...undo, classLists: styled.filter((result) => result.status === 'written').map(({ tag, from, to }) => ({ tag, from, to })) },
    }
  }

  /** Style properties placed in class lists leave the request's drafts. */
  function dropWrittenStyles(request, styled) {
    const bySpot = new Map()
    request.styleEdits.forEach((edit, index) => {
      if (styled[index]?.status === 'written') bySpot.set(`${edit.routeKey}@@${edit.viewport ?? 'desktop'}@@${edit.path}`, styled[index].written)
    })
    const scopes = (request.scopes?.length ? request.scopes : [{ routeKey: request.routeKey, viewport: request.viewport, store: request.store, removed: request.removed }]).map((scope) => ({
      ...scope,
      store: Object.fromEntries(Object.entries(scope.store ?? {}).map(([key, draft]) => {
        const written = bySpot.get(`${scope.routeKey}@@${scope.viewport}@@${key}`)
        if (!written || !draft?.styles) return [key, draft]
        const styles = { ...draft.styles }
        for (const property of written) delete styles[property]
        return [key, { ...draft, styles }]
      })),
    }))
    return { ...request, scopes }
  }

  /** Take an approved request back: the design, the copy and the class lists. */
  async function revertApprovedRequest({ request, undo }) {
    if (!undo) throw new Error('This change was approved before Froam could revert it — undo it in git instead')
    const text = sourceRoot && undo.textEdits?.length ? writeTextEdits(sourceRoot, undo.textEdits) : []
    let classes = []
    if (sourceRoot && undo.classLists?.length) {
      const files = listSourceFiles(sourceRoot).filter((file) => !file.endsWith('.json'))
      const reverted = revertClassLists(files, undo.classLists, { read: (file) => { try { return fs.readFileSync(file, 'utf8') } catch { return null } } })
      for (const [file, content] of reverted.changed) fs.writeFileSync(file, content)
      classes = reverted.results
    }
    const { design, skipped } = revertChangeRequest(loadDesign(designPath()), undo)
    writeArtifacts(froamDir, design)
    const leftInSource = [...text, ...classes].filter((result) => result.status !== 'written' && result.status !== 'reverted').length
    log(`reverted "${request.title}"${skipped.length ? ` (${skipped.length} changed since, kept)` : ''}`)
    const kept = skipped.length + leftInSource
    return { detail: kept ? `Reverted · ${kept} spot${kept === 1 ? '' : 's'} changed since were kept` : 'Reverted', skipped }
  }

  const roomApi = createFroamRoomApi({
    file: path.join(froamDir, 'froam.rooms.json'),
    onApproveRequest: publishApprovedRequest,
    onRevertRequest: revertApprovedRequest,
    notify: notifierFrom(notifyConfig ?? {}),
    log,
  })

  // Intelligence endpoint — optional. Froam accepts its own provider variables
  // and the conventional OPENAI_* aliases; local editor intelligence remains
  // available when no remote provider is configured.
  // ANTHROPIC_API_KEY alone means Claude, natively (see createProviderFromEnv).
  let configuredAi = null
  try { configuredAi = createProviderFromEnv(process.env) } catch (error) { log(`AI not set up: ${error.message}`) }
  const intelligenceProvider = configuredAi?.provider ?? null
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

    // The editor's modules: hashed chunks never change, so they're kept; the
    // entry is asked for afresh (it names this version's chunks).
    if (url.startsWith('/froam-modules/') && req.method === 'GET') {
      const rel = url.slice('/froam-modules/'.length)
      // The storage worker is asked for next to whichever chunk holds the
      // project store; there is one, unhashed (scripts/build-standalone.mjs).
      const worker = /^(?:chunks\/)?storage-worker\.js$/.test(rel)
      if (!worker && !/^(?:chunks\/)?[\w.-]+\.mjs$/.test(rel)) return send(res, 404, { success: false, error: 'Not found' })
      const file = path.join(EDITOR_MODULES, worker ? 'storage-worker.js' : rel)
      if (!fs.existsSync(file)) return send(res, 404, { success: false, error: 'Not found' })
      res.setHeader('Cache-Control', rel.startsWith('chunks/') && !worker ? 'public, max-age=31536000, immutable' : 'no-cache')
      return sendFile(res, file)
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
    /* ── sharing this local site with anyone (share-tunnel.mjs) ── */
    if (url === '/__froam/share' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store')
      const access = isLocalRequest(req) ? shareIdentity(projectKey) : null
      return send(res, 200, { success: true, available: shareAllowed(), active: Boolean(tunnel), online: Boolean(tunnel?.online), url: tunnel?.url ?? null, viewer: isLocalRequest(req) ? 'owner' : 'remote', ...(access ? { expiresAt: access.expiresAt } : {}) })
    }
    // The share service asks before letting someone in: is this invite live?
    if (url === '/__froam/share/admit' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store')
      const query = new URL(req.url ?? '/', 'http://froam.local').searchParams
      const access = shareIdentity(projectKey)
      if (access.expiresAt && Date.now() >= access.expiresAt) return send(res, 403, { ok: false, expired: true })
      const verdict = await roomApi.checkToken(query.get('room'), query.get('token'))
      return send(res, verdict.status, { ok: verdict.ok, expiresAt: verdict.ok ? Math.min(verdict.expiresAt ?? Infinity, access.expiresAt ?? Infinity) : null })
    }
    // Who may come in: how long links work, or new links (every pass ends).
    if (url === '/__froam/share/access' && req.method === 'POST') {
      if (!isLocalRequest(req)) return send(res, 403, { success: false, error: 'Only the computer running froam dev can change who may see it' })
      const body = await readJsonBody(req).catch(() => ({}))
      const lasting = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 }
      const expiresAt = body?.expiresIn === undefined ? undefined : lasting[body.expiresIn] ? Date.now() + lasting[body.expiresIn] : null
      const access = updateShareAccess(projectKey, { expiresAt, reset: Boolean(body?.reset) })
      tunnel?.refresh()
      return send(res, 200, { success: true, expiresAt: access.expiresAt })
    }
    if ((url === '/__froam/share/start' || url === '/__froam/share/stop') && req.method === 'POST') {
      if (!isLocalRequest(req)) return send(res, 403, { success: false, error: 'Only the computer running froam dev can share it' })
      if (url.endsWith('/start') && !shareAllowed()) return send(res, 403, { success: false, error: 'Public links are off here (FROAM_SHARE=off) — invite links open on this network only' })
      try {
        if (url.endsWith('/start')) await startShare()
        else stopShare()
      } catch (error) {
        return send(res, 500, { success: false, error: error instanceof Error ? error.message : 'Could not share' })
      }
      // The first connection takes a moment; say where the link will be either way.
      return send(res, 200, { success: true, active: Boolean(tunnel), online: Boolean(tunnel?.online), url: tunnel?.url ?? null })
    }

    // Who is at this machine, so the owner shows up as themselves, not "Froam".
    if (url === '/__froam/whoami' && req.method === 'GET') {
      if (!isLocalRequest(req)) return send(res, 200, { success: true, name: null })
      return send(res, 200, { success: true, name: await gitUserName(sourceRoot ?? froamDir), tailwind })
    }

    const writesRepo = req.method === 'POST' && (url === '/__froam/repo/save' || url === '/__froam/repo/project/save' || url === '/__froam/source/text' || url === '/__froam/source/styles')
    if (writesRepo && !isLocalRequest(req)) {
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

    // Base style edits into Tailwind class lists (see style-writeback.mjs).
    if (url === '/__froam/source/styles' && req.method === 'POST') {
      if (!sourceRoot || !tailwind) return send(res, 200, { success: false, disabled: true })
      const { edits } = await readJsonBody(req)
      if (!Array.isArray(edits) || edits.length > 500) return send(res, 400, { success: false, error: 'Expected { edits: [{ tag, className, styles }] }' })
      const results = writeStyleEdits(sourceRoot, edits)
      const written = results.filter((result) => result.status === 'written')
      if (written.length) log(`styles → source: ${written.map((result) => `${result.file}:${result.line}`).join(', ')}`)
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

    // Is there an AI to hand requests to? Named for the owner; nobody else may use it.
    if (url === '/__froam/intelligence' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store')
      if (!isLocalRequest(req)) return send(res, 200, { success: true, configured: false })
      return send(res, 200, { success: true, configured: Boolean(intelligenceProvider), model: configuredAi?.model ?? null, provider: configuredAi?.host ?? null })
    }
    if (url === '/__froam/intelligence/plan') {
      // The key is the owner's, and so is the bill: people on a share link don't spend it.
      if (!isLocalRequest(req)) return send(res, 403, { success: false, error: 'Only the computer running froam dev can use its AI' })
      // Rewrite url so the handler matches /plan
      const fakeReq = Object.assign(Object.create(req), { url: '/plan' })
      if (await intelligenceApi(fakeReq, res)) return
    }

    return send(res, 404, { success: false, error: 'Unknown froam endpoint' })
  }

  function proxyRequest(req, res) {
    const target = appTarget
    const local = isLocalTarget(target)
    // Compressed on the way in, like any browser gets it; only HTML is opened
    // (to add the editor). A local dev server is always asked afresh.
    const headers = { ...req.headers, host: target.host, 'accept-encoding': 'gzip, deflate, br' }
    if (local) {
      delete headers['if-none-match']
      delete headers['if-modified-since']
    }
    delete headers['x-froam-remote']
    // A live site is https; only a local dev server is plain http. Picking the
    // transport by protocol is what lets Froam sit in front of a production URL.
    const transport = target.protocol === 'https:' ? https : http
    const upstream = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: req.url,
        method: req.method,
        headers,
        agent: upstreamAgents[target.protocol],
      },
      (upstreamRes) => {
        const status = upstreamRes.statusCode ?? 502
        const contentType = String(upstreamRes.headers['content-type'] ?? '')
        const isHtml = contentType.includes('text/html')
        const outHeaders = { ...upstreamRes.headers }
        // HTML carries the editor, so it's never cached. A live site's files
        // keep the site's own caching; a local dev server's never do.
        if (isHtml || local) preventProxyCache(outHeaders, { clearBrowserCache: isHtml && local })
        // CSP would block the injected editor script.
        delete outHeaders['content-security-policy']
        delete outHeaders['content-security-policy-report-only']

        // The site sends itself somewhere: its own pages stay in Froam, and a
        // move to its www (or bare) twin becomes where Froam proxies from now.
        const location = upstreamRes.headers.location
        if (location && status >= 300 && status < 400) {
          let next = null
          try { next = new URL(location, target.origin) } catch { /* leave it */ }
          if (next && (next.origin === target.origin || isSameSite(next.hostname, target.hostname))) {
            if (next.origin !== target.origin) {
              appTarget = next.protocol === target.protocol || next.protocol === 'https:' ? new URL(next.origin) : appTarget
              siteOrigins.add(appTarget.origin)
              log(`following ${target.origin} → ${appTarget.origin}`)
              tunnel?.refresh()
            }
            outHeaders.location = `${next.pathname}${next.search}${next.hash}` || '/'
          }
        }

        if (!isHtml) {
          res.writeHead(status, outHeaders)
          return upstreamRes.pipe(res)
        }

        const chunks = []
        upstreamRes.on('data', (chunk) => chunks.push(chunk))
        upstreamRes.on('end', () => {
          const raw = decodeBody(Buffer.concat(chunks), upstreamRes.headers['content-encoding'])
          const html = keepLinksInside(injectEditorTag(raw.toString('utf8'), projectKey), siteOrigins)
          const body = Buffer.from(html, 'utf8')
          delete outHeaders['content-encoding']
          delete outHeaders['content-length']
          delete outHeaders['transfer-encoding']
          outHeaders['content-length'] = String(body.byteLength)
          res.writeHead(status, outHeaders)
          res.end(body)
        })
      },
    )
    upstream.on('error', (error) => {
      sendUpstreamError(req, res, target, error)
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
    // Through a share link, someone else's browser may look, and may take part
    // in the room — nothing else it sends changes this machine.
    if (req.headers['x-froam-remote'] && !['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? 'GET') && !url.startsWith('/api/froam/rooms')) {
      return send(res, 403, { success: false, error: 'Through a share link you can suggest changes and talk — the owner saves them' })
    }
    try {
      if (url === '/froam.js' || url === '/froam.css' || url.startsWith('/__froam/') || url.startsWith('/froam-modules/')) {
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

  /* the share link: one tunnel per froam dev, started on request */
  let tunnel = null
  /** FROAM_SHARE=off keeps every invite link on this machine or network. */
  const shareAllowed = () => !/^(0|off|false|no)$/i.test(String(process.env.FROAM_SHARE ?? ''))
  async function startShare() {
    if (tunnel) return tunnel
    const address = server.address()
    const localPort = typeof address === 'object' && address ? address.port : port
    const identity = shareIdentity(projectKey)
    tunnel = startShareTunnel({
      port: localPort,
      id: identity.id,
      key: identity.key,
      log,
      // A public site is fetched by the share service itself, near the site —
      // only Froam's own requests travel to this machine. The gate locks the
      // share to people with a live invite (read fresh: links can be reset).
      describe: () => {
        const access = shareIdentity(projectKey)
        return { version: PACKAGE_VERSION, project: projectKey, origin: appTarget && !isLocalTarget(appTarget) && appTarget.protocol === 'https:' ? appTarget.origin : null, gate: { epoch: access.epoch, expiresAt: access.expiresAt } }
      },
    })
    return tunnel
  }
  function stopShare() {
    tunnel?.stop()
    tunnel = null
  }
  server.on('close', stopShare)

  return { server, appTarget, projectKey, startShare, stopShare, get share() { return tunnel } }
}
