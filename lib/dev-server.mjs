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
 *   GET  /__froam/record         -> { entries, verification, you } (lib/record.mjs)
 *   GET  /__froam/record/report  the whole record as a page to print (?format=csv for a spreadsheet)
 *   POST /__froam/record/name    { name } — the name your own saves are recorded under
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import path from 'node:path'
import tls from 'node:tls'
import { execFile } from 'node:child_process'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { applyCors, guardBridgeRequest, isAllowedHost, isAllowedOrigin, normalizeAllowedOrigins } from './bridge-security.mjs'
import { listSourceFiles, writeTextEdits } from './source-writeback.mjs'
import { dropWrittenBlocks, writeBlocks } from './block-writeback.mjs'
import { revertClassLists, usesTailwind, writeStyleEdits } from './style-writeback.mjs'
import { createGoLive } from './go-live.mjs'
import { approveChangeRequest, loadDesign, mergeSaveWithReport, normalizeRouteKey, revertChangeRequest, writeArtifacts, VIEWPORTS } from './codegen.mjs'
import { createFroamNotifier } from './notifier.mjs'
import { shareIdentity, startShareTunnel, updateShareAccess } from './share-tunnel.mjs'
import { createFroamPublishApi } from './publish-store.mjs'
import { createFroamRoomApi } from './room-store.mjs'
import { createFroamMediaApi } from './media-store.mjs'
import { loadProjectFile, writeProjectFile } from './project-store.mjs'
import { createFroamIntelligenceApi, createProviderFromEnv } from './intelligence-store.mjs'
import { createFroamRecord, createRecordEndpoint, describeStoreChanges, ownerName } from './record.mjs'
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

/**
 * A phone the owner paired: it opened the link `froam dev --host` printed,
 * whose #froam-pair= fragment carries this run's key (a fragment never
 * reaches a server or its logs), and it sends that key back on every request.
 * The key is new each run and only ever printed in the owner's terminal.
 * Nothing that arrives through a share link counts, key or not: people on a
 * link suggest changes for approval, they never write files.
 */
export function isPairedRequest(req, deviceKey) {
  if (!deviceKey || req.headers['x-froam-remote']) return false
  const sent = req.headers['x-froam-device']
  if (typeof sent !== 'string' || sent.length !== deviceKey.length) return false
  return crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(deviceKey))
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

/**
 * The editor's loader, written into the page itself. It runs the moment the
 * parser reaches it and imports the editor without waiting on its own element:
 * an async <script src="/froam.js"> could be removed before it ran by a
 * framework that rebuilds <body> while starting up (Next.js on vercel.com,
 * linear.app), and the Froam button never appeared. The page never waits for
 * the download either. `/froam.js` stays for script-tag mode, and its name in
 * the comment tells an older share service the page already has the editor.
 */
export function editorLoader(projectKey) {
  const safe = String(projectKey ?? '').replace(/[^\w-]/g, '')
  return `<script data-froam-loader data-froam-project="${safe}">/* /froam.js */(function(){if(window.__FROAM_BOOT__)return;window.__FROAM_BOOT__={origin:location.origin,open:false,routes:'*',projectKey:${JSON.stringify(safe)}||null};import(location.origin+'/froam-modules/froam-editor.mjs').catch(function(e){console.error('[froam] could not load the editor',e)})})()</script>`
}

function injectEditorTag(html, projectKey) {
  if (html.includes('data-froam-loader') || html.includes('/froam.js')) return html
  const tag = editorLoader(projectKey)
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}\n</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}\n</html>`)
  return `${html}\n${tag}\n`
}

/**
 * A site that notices it isn't on its own domain sends the browser there
 * (vercel.com, linear.app: `location.href = 'https://vercel.com/'`), and the
 * page leaves Froam, editor and all. This guard runs before any of the site's
 * scripts and catches navigations to the site's own address: one back to the
 * page being shown is cancelled, one to another of its pages stays in Froam.
 * Uses the Navigation API (Chromium); elsewhere the page behaves as before.
 */
export function navigationGuard(origins) {
  const hosts = [...new Set([...origins].flatMap((o) => {
    try { const { host } = new URL(o); const bare = host.replace(/^www\./, ''); return [bare, `www.${bare}`] } catch { return [] }
  }))]
  return `<script data-froam-guard>(function(){var n=window.navigation,s=${JSON.stringify(hosts)};if(!n||!n.addEventListener)return;n.addEventListener('navigate',function(e){try{var u=new URL(e.destination.url);if(u.origin===location.origin||s.indexOf(u.host)<0||!e.cancelable||e.navigationType==='traverse')return;e.preventDefault();var to=u.pathname+u.search+u.hash;if(u.pathname+u.search===location.pathname+location.search)return;if(e.navigationType==='replace')location.replace(to);else location.assign(to)}catch(_){}})})()</script>`
}

/** The guard goes first in <head>, ahead of every script the site has. */
export function injectNavigationGuard(html, origins) {
  if (html.includes('data-froam-guard')) return html
  const guard = navigationGuard(origins)
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (open) => `${open}${guard}`)
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (open) => `${open}${guard}`)
  return `${guard}${html}`
}

/** A Content-Security-Policy in a <meta> tag blocks the editor exactly as the header does. */
export function withoutMetaCsp(html) {
  return html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy(?:-report-only)?["']?[^>]*>/gi, '')
}

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `https://site.com/x`, `http://site.com/x` and `//site.com/x` → `/x`, for the site's own hosts. */
function siteUrlStripper(origins) {
  // The www and bare names are one site (isSameSite): a page on one links the other.
  const hosts = [...new Set([...origins].flatMap((o) => {
    try {
      const { host } = new URL(o)
      return [host, host.startsWith('www.') ? host.slice(4) : `www.${host}`]
    } catch { return [] }
  }))]
  if (!hosts.length) return (s) => s
  const prefix = new RegExp(`(?:https?:)?//(?:${hosts.map(escapeRe).join('|')})(?=/)`, 'gi')
  return (s) => s.replace(prefix, '')
}

/**
 * The site's own files that the browser fetches in CORS mode — module scripts,
 * fonts, stylesheets (their fonts resolve against them), anything marked
 * crossorigin — load through Froam. Seen from Froam's address, a full
 * `https://site.com/…` URL is another site, the site sends no CORS headers for
 * itself, and the browser blocks it: wordpress.org lost its fonts and its
 * interactive blocks, allbirds.com its scripts and half its page. Pictures and
 * plain scripts keep loading straight from the site.
 */
export function keepAssetsInside(html, origins) {
  const strip = siteUrlStripper(origins)
  let out = html.replace(/<(script|link|img|source|video|audio)\b[^>]*>/gi, (tag, name) => {
    const lower = tag.toLowerCase()
    const kind = name.toLowerCase()
    const cors = /\scrossorigin\b/.test(lower)
      || (kind === 'script' && /\stype\s*=\s*["']?module\b/.test(lower))
      || (kind === 'link' && /\srel\s*=\s*["']?[^"'>]*\b(?:stylesheet|modulepreload)\b/.test(lower))
      || (kind === 'link' && /\sas\s*=\s*["']?(?:font|fetch|style)\b/.test(lower))
    return cors ? tag.replace(/(\s(?:src|href)\s*=\s*)(["']?)([^"'\s>]+)/gi, (_m, lead, quote, url) => `${lead}${quote}${strip(url)}`) : tag
  })
  // An import map names module URLs; inline styles name fonts and @imports.
  out = out.replace(/(<script\b[^>]*\btype\s*=\s*["']?importmap\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, body, close) => `${open}${strip(body)}${close}`)
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, body, close) => `${open}${strip(body)}${close}`)
  return out
}

/** A stylesheet's own fonts and @imports, by full URL, load through Froam too. */
export function keepCssInside(css, origins) {
  const strip = siteUrlStripper(origins)
  return css.replace(/(url\(\s*["']?|@import\s+["'])((?:https?:)?\/\/[^"')\s]+)/gi, (_m, lead, url) => `${lead}${strip(url)}`)
}

/**
 * A bot check (Cloudflare's "Just a moment…") answers Froam's proxy instead of
 * the page: the request comes from Node, not a browser, so it never passes.
 */
export function isBotChallenge(status, headers, html = '') {
  if (String(headers['cf-mitigated'] ?? '').toLowerCase() === 'challenge') return true
  if (status !== 403 && status !== 503 && status !== 429) return false
  return /challenges\.cloudflare\.com|cf-chl|Just a moment\.\.\.|Attention Required! \| Cloudflare|_Incapsula_|px-captcha|Access Denied/i.test(html)
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

/** Set-Cookie values with their Domain attribute taken out (see proxyRequest). */
export function withoutCookieDomain(cookies) {
  const list = Array.isArray(cookies) ? cookies : [cookies]
  return list.map((cookie) => String(cookie).replace(/;\s*domain=[^;]*/gi, ''))
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

export function createBridgeServer({ port = 4600, froamDir, app = null, serveDir = null, allowOrigins: allowOriginsOption, sourceRoot = null, writeBlocksToSource = false, notify: notifyConfig = null, log = () => {} }) {
  // Sections into the .html files themselves: only a plain static site being served (block-writeback.mjs).
  const blockWriteBack = Boolean(writeBlocksToSource && serveDir && sourceRoot)
  // Tailwind projects can take base style edits into class lists (style-writeback.mjs).
  const tailwind = Boolean(sourceRoot && usesTailwind(sourceRoot))
  // Extra origins (a custom dev domain like http://app.test) that may use the bridge.
  const allowOrigins = normalizeAllowedOrigins(allowOriginsOption ?? process.env.FROAM_ALLOW_ORIGINS)
  let appTarget = normalizeAppTarget(app)
  const projectKey = createBridgeProjectKey({ froamDir, appTarget, serveDir })
  // Every origin this site has answered from (dominos.ng, then www.dominos.ng).
  const siteOrigins = new Set(appTarget ? [appTarget.origin] : [])
  let warnedBotCheck = false
  const designPath = () => path.join(froamDir, 'froam.design.json')
  const projectPath = () => path.join(froamDir, 'froam.project.json')
  // Publish works through the bridge with no backend: designs published
  // from the editor land in froam.published.json and every device that
  // loads the page through the bridge picks them up (great with --host).
  /*
   * The record (lib/record.mjs): who changed what, who approved it, when.
   * Everything below that changes the site writes to it — saves from this
   * computer or a paired phone, change requests and their decisions in rooms,
   * Go Live — and it is kept in the project, next to the design.
   */
  const record = createFroamRecord({ froamDir, log })
  // Where go-live.mjs keeps its settings: the site's folder.
  const configPath = path.join(serveDir ?? sourceRoot ?? path.dirname(froamDir), 'froam.config.json')
  let knownOwner = null
  const ownerNameNow = () => {
    // git is asked at most once a minute: saves can come several a second.
    if (!knownOwner || Date.now() - knownOwner.at > 60_000) knownOwner = { at: Date.now(), name: ownerName({ configPath, cwd: sourceRoot ?? path.dirname(froamDir) }) }
    return knownOwner.name
  }
  /** Who a request to this bridge is, for the record. Only the owner's devices write the project. */
  const personOf = (req) => {
    const device = deviceOf(req)
    if (device === 'other') return { name: 'A device on your network', role: 'device', via: 'local network' }
    return { name: ownerNameNow(), role: 'owner', via: device === 'paired' ? 'paired phone' : 'this computer' }
  }
  const recordEndpoint = createRecordEndpoint({ record, configPath, you: ownerNameNow, readBody: readJsonBody, send, cors, onName: () => { knownOwner = null } })
  const publishApi = createFroamPublishApi({
    file: path.join(froamDir, 'froam.published.json'),
    log,
    // The plain Save: what every device on this bridge sees.
    onPublished: ({ req, routeKey, viewportMode, before, after }) => {
      const changes = describeStoreChanges(before, after, { routeKey })
      if (changes.length) record.note({ type: 'saved', by: personOf(req), pages: [routeKey], viewport: viewportMode, changes, count: changes.length, result: 'Saved for every device that opens the site through Froam' })
    },
  })
  // This run's pairing key (see isPairedRequest). URL-safe: it travels in a link.
  const deviceKey = crypto.randomBytes(18).toString('base64url')
  /** This computer, or a phone it paired: the devices that may write the project. */
  const canWriteRepo = (req) => isLocalRequest(req) || isPairedRequest(req, deviceKey)

  /*
   * Live sync between the owner's own devices. Every open editor listens on
   * /__froam/events; each write to the project is announced there, and the
   * others read it and merge it in (src/editor/chef/draft-merge.ts) — so a
   * phone's save shows on the laptop in a moment, without a reload. Events
   * carry no content, only that something changed and on which device; the
   * design is read with the same request a fresh editor makes.
   */
  const listeners = new Set()
  let revision = 0
  const deviceOf = (req) => (isLocalRequest(req) ? 'computer' : isPairedRequest(req, deviceKey) ? 'paired' : 'other')
  const clientOf = (req) => {
    const id = String(req.headers['x-froam-client'] ?? '')
    return /^[A-Za-z0-9_-]{6,64}$/.test(id) ? id : null
  }
  /** Tell every open editor. `reload`: the page's own files changed and nothing else will reload it (a plain static site). */
  function announce(req, change) {
    broadcast({ from: clientOf(req), device: deviceOf(req), ...change })
  }
  function broadcast(change) {
    revision += 1
    const frame = `event: change\ndata: ${JSON.stringify({ revision, from: null, device: 'computer', at: Date.now(), ...change })}\n\n`
    for (const res of listeners) {
      try { res.write(frame) } catch { listeners.delete(res) }
    }
  }

  // Go Live (go-live.mjs): saved work onto the real site, from the editor. Its progress is everyone's to see.
  const goLive = createGoLive({ froamDir, sourceRoot, serveDir, staticSite: blockWriteBack, log, record, progress: (job) => broadcast({ kind: 'live', job }) })
  const sourcePath = (file, base = sourceRoot) => (base ? path.resolve(base, file) : null)
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
    goLive.recordSource(files.map((file) => sourcePath(file)), writtenText)
    for (const scope of request.scopes?.length ? request.scopes : [request]) goLive.recordSave(scope.routeKey)
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
    record: (event) => { record.append(event) },
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
  // Photos, GIFs, SVGs and videos placed in the editor, kept as files (media-store.mjs).
  const mediaApi = createFroamMediaApi({ getFroamDir: () => froamDir, isLocalRequest, send, cors, log })

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

    if (url === '/__froam/events' && req.method === 'GET') {
      cors(res)
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      // An editor that connects, or comes back after a reload, learns where Go Live stands: it may have missed the news.
      const live = goLive.job()
      const recent = live && (!live.done || Date.now() - (live.updatedAt ?? live.startedAt ?? 0) < 10 * 60_000)
      res.write(`retry: 2000\nevent: ready\ndata: ${JSON.stringify({ revision, ...(recent ? { live } : {}) })}\n\n`)
      listeners.add(res)
      // A comment now and then keeps proxies and phones from dropping a quiet line.
      const beat = setInterval(() => { try { res.write(': beat\n\n') } catch { /* closed */ } }, 25_000)
      req.on('close', () => { clearInterval(beat); listeners.delete(res) })
      return
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
      const device = isLocalRequest(req) ? 'computer' : isPairedRequest(req, deviceKey) ? 'paired' : 'other'
      if (device === 'other') return send(res, 200, { success: true, name: null, device })
      // The name set for the record wins; then git's. Never the computer's account name: the editor asks instead.
      let named = null
      try { named = JSON.parse(fs.readFileSync(configPath, 'utf8'))?.record?.name ?? null } catch { /* no config */ }
      return send(res, 200, { success: true, name: (typeof named === 'string' && named.trim().slice(0, 60)) || await gitUserName(sourceRoot ?? froamDir), tailwind, device })
    }

    /* ── the record: only the owner's own devices read it or set their name ── */
    if (url === '/__froam/record' || url.startsWith('/__froam/record/')) {
      if (!canWriteRepo(req)) return send(res, 403, { success: false, code: 'not-paired', error: 'Only the computer running froam dev, or a phone it paired, can read the record.' })
      return void await recordEndpoint(req, res, url)
    }

    /* ── Go Live: the computer, or a phone it paired; nobody on a link ── */
    if (url === '/__froam/live' || url.startsWith('/__froam/live/')) {
      res.setHeader('Cache-Control', 'no-store')
      if (!canWriteRepo(req)) return send(res, 403, { success: false, code: 'not-paired', error: 'Only the computer running froam dev, or a phone it paired, can put the site live.' })
      if (url === '/__froam/live' && req.method === 'GET') {
        try {
          // ?remote= : the remote picked in the sheet, when the repo has more than one.
          const remote = new URL(req.url ?? '/', 'http://froam.local').searchParams.get('remote') || undefined
          return send(res, 200, { success: true, plan: await goLive.plan({ remote }), job: goLive.job() })
        } catch (error) {
          return send(res, 500, { success: false, error: error instanceof Error ? error.message : 'Could not work out what would go live' })
        }
      }
      if (url === '/__froam/live' && req.method === 'POST') {
        const { token, remote } = await readJsonBody(req).catch(() => ({}))
        const started = await goLive.start(typeof token === 'string' ? token : '', { remote: typeof remote === 'string' ? remote : undefined, by: personOf(req) })
        if (!started.ok) return send(res, started.status, { success: false, error: started.error, plan: started.plan ?? null, job: started.job ?? null })
        log(`going live (${started.job.mode})`)
        return send(res, 202, { success: true, job: started.job })
      }
      if (url === '/__froam/live/job' && req.method === 'GET') return send(res, 200, { success: true, job: goLive.job() })
      if (url === '/__froam/live/site' && req.method === 'POST') {
        const { url: address } = await readJsonBody(req).catch(() => ({}))
        try {
          return send(res, 200, { success: true, url: goLive.setSiteUrl(address) })
        } catch (error) {
          return send(res, 400, { success: false, error: error instanceof Error ? error.message : 'Not an address' })
        }
      }
      return send(res, 404, { success: false, error: 'Unknown froam endpoint' })
    }

    const writesRepo = req.method === 'POST' && (url === '/__froam/repo/save' || url === '/__froam/repo/project/save' || url === '/__froam/source/text' || url === '/__froam/source/styles' || url === '/__froam/source/blocks')
    if (writesRepo && !canWriteRepo(req)) {
      return send(res, 403, { success: false, code: 'not-paired', error: 'Only the computer running froam dev, or a phone it paired, can write the repo — submit your changes for approval instead.' })
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
      return send(res, 200, { success: true, exists: fs.existsSync(designPath()), projectExists: fs.existsSync(projectPath()), dir: froamDir, sourceWriteBack: Boolean(sourceRoot), blockWriteBack, ...status })
    }

    // Copy edits into the project's own source (see source-writeback.mjs).
    if (url === '/__froam/source/text' && req.method === 'POST') {
      if (!sourceRoot) return send(res, 200, { success: false, disabled: true })
      const { edits } = await readJsonBody(req)
      if (!Array.isArray(edits) || edits.length > 500) return send(res, 400, { success: false, error: 'Expected { edits: [{ from, to }] }' })
      const results = writeTextEdits(sourceRoot, edits)
      const written = results.filter((result) => result.status === 'written')
      if (written.length) {
        log(`copy → source: ${written.map((result) => `${result.file}:${result.line}`).join(', ')}`)
        const changes = results.map((result, index) => (result.status === 'written' ? { label: `Words in ${result.file}`, before: edits[index]?.from, after: edits[index]?.to } : null)).filter(Boolean)
        record.note({ type: 'saved.source', by: personOf(req), changes, count: changes.length })
        goLive.recordSource(written.map((result) => sourcePath(result.file)), results.map((result, index) => (result.status === 'written' ? edits[index]?.to : null)))
        announce(req, { kind: 'source', reload: Boolean(serveDir) })
      }
      return send(res, 200, { success: true, results })
    }

    // Base style edits into Tailwind class lists (see style-writeback.mjs).
    if (url === '/__froam/source/styles' && req.method === 'POST') {
      if (!sourceRoot || !tailwind) return send(res, 200, { success: false, disabled: true })
      const { edits } = await readJsonBody(req)
      if (!Array.isArray(edits) || edits.length > 500) return send(res, 400, { success: false, error: 'Expected { edits: [{ tag, className, styles }] }' })
      const results = writeStyleEdits(sourceRoot, edits)
      const written = results.filter((result) => result.status === 'written')
      if (written.length) {
        log(`styles → source: ${written.map((result) => `${result.file}:${result.line}`).join(', ')}`)
        record.note({ type: 'saved.source', by: personOf(req), changes: written.map((result) => ({ label: `Look in ${result.file}, line ${result.line}` })), count: written.length })
        goLive.recordSource(written.map((result) => sourcePath(result.file)))
        announce(req, { kind: 'source', reload: Boolean(serveDir) })
      }
      return send(res, 200, { success: true, results })
    }

    // Sections into the page's .html file (see block-writeback.mjs).
    if (url === '/__froam/source/blocks' && req.method === 'POST') {
      if (!blockWriteBack) return send(res, 200, { success: false, disabled: true })
      const { routeKey, rootScope, blocks } = await readJsonBody(req)
      const valid = typeof routeKey === 'string' && Array.isArray(blocks) && blocks.length <= 200
        && blocks.every((block) => block && typeof block.key === 'string' && block.key.startsWith('__froam_injection__:') && typeof block.parentPath === 'string' && Number.isInteger(block.order) && typeof block.html === 'string')
      if (!valid) return send(res, 400, { success: false, error: 'Expected { routeKey, blocks: [{ key, parentPath, order, html }] }' })
      const results = writeBlocks({ serveDir, froamDir, routeKey, rootScope, blocks })
      const written = results.filter((result) => result.status === 'written')
      if (written.length) {
        // Gone from every size, or a phone would get the HTML's copy and the runtime's.
        if (fs.existsSync(designPath())) writeArtifacts(froamDir, dropWrittenBlocks(loadDesign(designPath()), routeKey, written.map((result) => result.key)))
        log(`sections → source: ${written.map((result) => `${result.file}:${result.line}`).join(', ')}`)
        record.note({ type: 'saved.source', by: personOf(req), pages: [routeKey], changes: written.map((result) => ({ label: `Section written into ${result.file}`, page: routeKey })), count: written.length })
        goLive.recordSource(written.map((result) => sourcePath(result.file, serveDir)))
        goLive.recordSave(routeKey)
        announce(req, { kind: 'source', reload: Boolean(serveDir) })
      }
      return send(res, 200, { success: true, results })
    }

    if (url === '/__froam/repo/save' && req.method === 'POST') {
      const { routeKey, viewportMode, store, brandFonts, brandFontsBase, rootScope, base } = await readJsonBody(req)
      if (typeof routeKey !== 'string' || !VIEWPORTS.includes(viewportMode) || typeof store !== 'object' || store === null) {
        return send(res, 400, { success: false, error: 'Expected { routeKey, viewportMode, store }' })
      }
      if (brandFonts !== undefined && !Array.isArray(brandFonts)) {
        return send(res, 400, { success: false, error: 'brandFonts must be an array when present' })
      }
      fs.mkdirSync(froamDir, { recursive: true })
      const current = loadDesign(designPath())
      const before = current.routes?.[normalizeRouteKey(routeKey)]?.[viewportMode] ?? {}
      // With `base`, only what this device changed is taken (lib/draft-merge.mjs).
      const saved = mergeSaveWithReport(current, { routeKey, viewportMode, store, brandFonts, brandFontsBase, rootScope, base })
      const changes = describeStoreChanges(before, saved.store, { routeKey: normalizeRouteKey(routeKey) })
      if (changes.length) record.note({ type: 'saved', by: personOf(req), pages: [normalizeRouteKey(routeKey)], viewport: viewportMode, changes, count: changes.length })
      const files = writeArtifacts(froamDir, saved.design)
      const status = await gitStatus(froamDir)
      const clashes = saved.conflicts.length
      log(`saved ${routeKey} (${viewportMode}) → ${files.join(', ')}${clashes ? ` (${clashes} spot${clashes === 1 ? '' : 's'} also changed on another device; this save's kept)` : ''}`)
      goLive.recordSave(routeKey)
      announce(req, { kind: 'design', routeKey, viewport: viewportMode })
      // A plain HTML site goes live with froam publish, not a git push. The
      // merged page comes back, so the saving device is current at once.
      return send(res, 200, { success: true, ...status, files, nextStep: blockWriteBack ? 'publish' : 'push', revision, store: saved.store, brandFonts: saved.design.brandFonts ?? [], conflicts: saved.conflicts })
    }

    if (url === '/__froam/media' || url.startsWith('/__froam/media/')) {
      if (await mediaApi(req, res, url)) return
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
        // A cookie for the site's domain (Domain=.example.com) is refused on
        // localhost, so a cookie banner, a login or a remembered choice never
        // sticks through Froam. Without Domain it belongs to the page's host.
        if (outHeaders['set-cookie'] && !local) outHeaders['set-cookie'] = withoutCookieDomain(outHeaders['set-cookie'])

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

        const isCss = contentType.includes('text/css')
        if (!isHtml && !isCss) {
          res.writeHead(status, outHeaders)
          return upstreamRes.pipe(res)
        }

        const chunks = []
        upstreamRes.on('data', (chunk) => chunks.push(chunk))
        upstreamRes.on('end', () => {
          const raw = decodeBody(Buffer.concat(chunks), upstreamRes.headers['content-encoding'])
          let text = raw.toString('utf8')
          if (isCss) {
            text = keepCssInside(text, siteOrigins)
          } else {
            if (isBotChallenge(status, upstreamRes.headers, text) && !warnedBotCheck) {
              warnedBotCheck = true
              log(`${target.host} answered with a bot check instead of its page (${status}). It stops any proxy, Froam's included — edit your own copy of the site (localhost or staging) instead.`)
            }
            text = injectNavigationGuard(keepLinksInside(keepAssetsInside(withoutMetaCsp(injectEditorTag(text, projectKey)), siteOrigins), siteOrigins), siteOrigins)
          }
          const body = Buffer.from(text, 'utf8')
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
        if (await publishApi(req, res)) {
          if (req.method === 'POST' && res.statusCode === 200) announce(req, { kind: 'published' })
          return
        }
        if (await roomApi(req, res)) {
          // Approving or reverting a request writes the design and the page's files.
          if (req.method === 'POST' && res.statusCode === 200 && /\/requests\/[^/]+\/(?:decision|revert)$/.test(url)) announce(req, { kind: 'source', reload: Boolean(serveDir) })
          return
        }
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
      // A live site is https: its sockets are wss, so the upstream leg is TLS.
      // Plain TCP to port 443 never got past the handshake.
      const secure = appTarget.protocol === 'https:'
      const port = Number(appTarget.port) || (secure ? 443 : 80)
      const onConnect = () => {
        const lines = [`${req.method} ${req.url} HTTP/1.1`]
        // The site checks Origin on its sockets; it should see itself, as it
        // does when the page is opened directly.
        const headers = { ...req.headers, host: appTarget.host, ...(origin && !isLocalTarget(appTarget) ? { origin: appTarget.origin } : {}) }
        for (const [name, value] of Object.entries(headers)) {
          for (const v of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${v}`)
        }
        upstream.write(lines.join('\r\n') + '\r\n\r\n')
        if (head?.length) upstream.write(head)
        upstream.pipe(socket)
        socket.pipe(upstream)
      }
      const upstream = secure
        ? tls.connect({ host: appTarget.hostname, port, servername: appTarget.hostname }, onConnect)
        : net.connect(port, appTarget.hostname, onConnect)
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

  return { server, appTarget, projectKey, deviceKey, startShare, stopShare, get share() { return tunnel } }
}
