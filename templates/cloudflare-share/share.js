/**
 * Froam share — a site on someone's own computer, reachable from anywhere.
 *
 * `froam dev` opens one outbound WebSocket to the share service (so it works
 * behind any router or firewall, no port forwarding). Someone opens the share
 * link; their browser's requests come in over HTTPS, travel down that socket
 * to `froam dev`, which answers from the local site exactly as it would for
 * the owner — and the answer comes back the same way.
 *
 * This module is the relay's logic, independent of where it runs (a Durable
 * Object in production, plain Node in tests). Frames are JSON:
 *
 *   relay → host   { t: 'req', id, method, path, headers, body }     body: base64 or null
 *   host → relay   { t: 'res', id, status, headers, body, more }     the first part of a response
 *   host → relay   { t: 'chunk', id, body, more }                     the rest, streamed
 *   host → relay   { t: 'hello', version, project, origin }             what's being shared
 *   either way     { t: 'ping' } / { t: 'pong' }
 *
 * Speed comes from sending as little as possible through the owner's
 * computer (a home upload is the slowest link there is):
 *   - the editor itself comes from a global CDN (jsDelivr), for the exact
 *     version the owner runs;
 *   - a public site (the owner is editing a live URL) is fetched by the relay
 *     straight from the site, at the edge — only Froam's own requests (the
 *     room, the bridge) go to the owner's computer;
 *   - a local site's files that say they can be cached are kept at the edge.
 */

/** A request body a browser may send through a share (room messages, profiles, requests). */
export const MAX_REQUEST_BYTES = 700_000
export const SHARE_COOKIE = 'froam_share'
const RESPONSE_TIMEOUT_MS = 30_000
/** How long a request waits for the owner's computer to come back before calling the share offline. */
const RECONNECT_WAIT_MS = 6_000
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer', 'content-length'])

const toBase64 = (bytes) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/** Share ids and host keys: unguessable, URL-safe. */
export const isShareId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value)

/** The share id a browser is visiting, from its cookie. */
export function shareFromCookie(header) {
  const match = new RegExp(`(?:^|;\\s*)${SHARE_COOKIE}=([^;]+)`).exec(header ?? '')
  return match && isShareId(match[1]) ? match[1] : null
}

/** The visitor's cookie header without the share's own cookie — the local site never sees it. */
function withoutShareCookie(header) {
  return (header ?? '').split(/;\s*/).filter((part) => part && !part.startsWith(`${SHARE_COOKIE}=`)).join('; ')
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const offlinePage = () => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>This share is offline</title>
<body style="font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0f1115;color:#e5e7eb">
<main style="max-width:420px;padding:24px;text-align:center"><h1 style="font-size:20px">This share is offline</h1>
<p style="color:#9ca3af">The site lives on its owner's computer, and Froam isn't running there right now. Ask them to start it again — the same link will work.</p></main></body>`, { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

/**
 * @param {{ hostSocket: () => { send: (text: string) => void } | null, now?: () => number }} options
 */
export function createShareHub({ hostSocket, now = () => Date.now(), fetchImpl = (...args) => fetch(...args), cache = null, onHello = null, site: initialSite = null }) {
  const pending = new Map()
  let nextId = 1
  /** What the owner's computer said it's sharing: { version, project, origin }. */
  let site = initialSite

  function fail(id, response) {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    clearTimeout(entry.timer)
    if (entry.controller) { try { entry.controller.error(new Error('The share went offline')) } catch { /* closed */ } }
    else entry.resolve(response)
  }

  return {
    get online() { return Boolean(hostSocket()) },

    get site() { return site },

    /** A browser's request → the fastest place that can answer it. */
    async forward(request) {
      const url = new URL(request.url)
      const froamOwn = FROAM_PATH.test(url.pathname)
      const editorAsked = Boolean(editorFile(url.pathname))
      if (request.method === 'GET' && editorAsked) {
        const editor = await editorFromCdn(url.pathname, site?.version, fetchImpl)
        if (editor) return editor
      }
      if (site?.origin && !froamOwn && !editorAsked) {
        try { return await fromSite(request, site, fetchImpl) } catch { /* fall back to the owner's computer */ }
        if (!hostSocket()) return offlinePage()
      }
      // v2: copies are kept decompressed (see below); v1 copies are never read.
      const cacheKey = cache && request.method === 'GET' && !froamOwn ? new Request(`https://froam-share.cache/v2/${site?.project ?? 'share'}${url.pathname}${url.search}`) : null
      if (cacheKey) {
        const hit = await cache.match(cacheKey).catch(() => null)
        if (hit) return hit
      }
      const response = await this.tunnel(request, url)
      // A local site's file that says it can be kept (hashed build output) is kept at the edge.
      const control = response.headers.get('cache-control') ?? ''
      if (cacheKey && response.status === 200 && response.body && (/immutable/.test(control) || Number(/max-age=(\d+)/.exec(control)?.[1] ?? 0) >= 3600) && !/no-store|private/.test(control)) {
        // Kept decompressed: a cached copy that still carried the owner's gzip
        // came back without saying so, and a browser can't run gzip as script.
        // Cloudflare compresses it again on the way out.
        const encoding = (response.headers.get('content-encoding') ?? '').toLowerCase()
        if (!encoding || encoding === 'gzip' || encoding === 'deflate') {
          const [toVisitor, toCache] = response.body.tee()
          const headers = new Headers(response.headers)
          headers.delete('content-encoding')
          headers.delete('content-length')
          const stored = encoding ? toCache.pipeThrough(new DecompressionStream(encoding)) : toCache
          cache.put(cacheKey, new Response(stored, { status: 200, headers })).catch(() => {})
          return new Response(toVisitor, { status: response.status, headers: response.headers, ...(encoding ? { encodeBody: 'manual' } : {}) })
        }
      }
      return response
    },

    /** Down the socket to the owner's computer, and back. */
    async tunnel(request, url) {
      // Mid-reconnect (a blip, a restart): wait a moment rather than fail.
      for (let waited = 0; !hostSocket() && waited < RECONNECT_WAIT_MS; waited += 250) await new Promise((resolve) => setTimeout(resolve, 250))
      const socket = hostSocket()
      if (!socket) return offlinePage()
      const body = request.method === 'GET' || request.method === 'HEAD' ? null : new Uint8Array(await request.arrayBuffer())
      if (body && body.length > MAX_REQUEST_BYTES) return new Response('Too large to send through a share', { status: 413 })
      const headers = []
      for (const [name, value] of request.headers) {
        const key = name.toLowerCase()
        if (HOP_BY_HOP.has(key) || key === 'host' || key.startsWith('cf-')) continue
        if (key === 'cookie') { const kept = withoutShareCookie(value); if (kept) headers.push([key, kept]); continue }
        headers.push([key, value])
      }
      const id = String(nextId++)
      return new Promise((resolve) => {
        const timer = setTimeout(() => fail(id, new Response('The owner’s computer took too long to answer', { status: 504 })), RESPONSE_TIMEOUT_MS)
        pending.set(id, { resolve, timer, controller: null, startedAt: now() })
        try {
          socket.send(JSON.stringify({ t: 'req', id, method: request.method, path: url.pathname + url.search, headers, body: body ? toBase64(body) : null }))
        } catch {
          fail(id, offlinePage())
        }
      })
    },

    /** A frame from the owner's computer. */
    fromHost(text) {
      let frame
      try { frame = JSON.parse(text) } catch { return }
      if (frame?.t === 'ping') { try { hostSocket()?.send(JSON.stringify({ t: 'pong' })) } catch { /* gone */ } return }
      if (frame?.t === 'hello') {
        const origin = typeof frame.origin === 'string' && /^https:\/\/[^/]+$/i.test(frame.origin) ? frame.origin : null
        site = { version: typeof frame.version === 'string' ? frame.version.slice(0, 40) : null, project: typeof frame.project === 'string' ? frame.project.slice(0, 80) : null, origin }
        onHello?.(site)
        return
      }
      const entry = pending.get(String(frame?.id))
      if (!entry) return
      if (frame.t === 'res') {
        clearTimeout(entry.timer)
        const headers = new Headers()
        for (const [name, value] of Array.isArray(frame.headers) ? frame.headers : []) {
          if (!HOP_BY_HOP.has(String(name).toLowerCase())) headers.append(name, value)
        }
        const first = frame.body ? fromBase64(frame.body) : null
        const noBody = frame.status === 204 || frame.status === 304 || frame.status < 200
        // Already compressed on the owner's machine: Cloudflare must pass it
        // through as-is (encodeBody), not compress it again.
        const init = { status: frame.status, headers, ...(headers.get('content-encoding') ? { encodeBody: 'manual' } : {}) }
        if (!frame.more) {
          pending.delete(String(frame.id))
          entry.resolve(new Response(noBody ? null : first, init))
          return
        }
        const stream = new ReadableStream({
          start(controller) {
            entry.controller = controller
            if (first) controller.enqueue(first)
          },
        })
        entry.resolve(new Response(stream, init))
      } else if (frame.t === 'chunk' && entry.controller) {
        if (frame.body) entry.controller.enqueue(fromBase64(frame.body))
        if (!frame.more) {
          pending.delete(String(frame.id))
          entry.controller.close()
        }
      }
    },

    /** The owner's computer went away: everything waiting on it fails now, not in 30 seconds. */
    hostGone() {
      for (const id of [...pending.keys()]) fail(id, offlinePage())
    },
  }
}

const FROAM_PATH = /^\/(?:__froam\/|api\/froam\/)/
const EDITOR_FILES = { '/froam.js': 'froam-editor.js', '/froam.css': 'froam-editor.css' }
/** The split editor's modules (8.8.1 and later), under /froam-modules/. */
const EDITOR_MODULE = /^\/froam-modules\/((?:chunks\/)?[\w.-]+\.mjs)$/
const editorFile = (pathname) => EDITOR_FILES[pathname] ?? (EDITOR_MODULE.exec(pathname) ? `modules/${EDITOR_MODULE.exec(pathname)[1]}` : null)
/** Files that are the same for everyone: scripts, styles, images, fonts, media. */
const STATIC_FILE = /\.(?:js|mjs|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|json|map)$/i
const STRIP_FROM_SITE = ['content-security-policy', 'content-security-policy-report-only', 'x-frame-options', 'strict-transport-security', 'clear-site-data']

/** Same site: one host is the other with or without "www.". */
const sameSite = (a, b) => String(a).toLowerCase().replace(/^www\./, '') === String(b).toLowerCase().replace(/^www\./, '')

/** The editor tag, exactly as froam dev adds it (lib/dev-server.mjs). */
export function injectEditor(html, project) {
  if (html.includes('/froam.js')) return html
  const tag = `<script src="/froam.js" async${project ? ` data-froam-project="${String(project).replace(/[^\w-]/g, '')}"` : ''}></script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}\n</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}\n</html>`)
  return `${html}\n${tag}\n`
}

/** Links to the site's own pages stay on the share; its files keep loading straight from the site. */
export function keepLinksInside(html, origin) {
  const bare = origin.replace(/^(https?:\/\/)www\./i, '$1')
  const withWww = bare.replace(/^(https?:\/\/)/i, '$1www.')
  let out = html
  for (const candidate of new Set([origin, bare, withWww])) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(<(?:a|area|form)\\b[^>]*?\\s(?:href|action)\\s*=\\s*)(["'])${escaped}(?=([/"'?#]))`, 'gi'), (_m, lead, quote, next) => `${lead}${quote}${next === quote ? '/' : ''}`)
  }
  return out
}

/** The editor from the CDN, for this exact version; null if that version isn't published there. */
export async function editorFromCdn(pathname, version, fetchImpl = fetch) {
  const file = editorFile(pathname)
  if (!file || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(String(version ?? ''))) return null
  try {
    const response = await fetchImpl(`https://cdn.jsdelivr.net/npm/@ahmadastic/froam@${version}/dist/standalone/${file}`, { cf: { cacheTtl: 86400, cacheEverything: true } })
    if (!response.ok) return null
    const headers = new Headers({
      'Content-Type': /\.m?js$/.test(file) ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8',
      // Hashed chunks never change; the rest is versioned by the page that asks
      // (froam dev tells us the version), so it can be kept a while.
      'Cache-Control': file.startsWith('modules/chunks/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    })
    return new Response(response.body, { status: 200, headers })
  } catch {
    return null
  }
}

/** A public site, fetched at the edge, with the editor added and links kept on the share. */
export async function fromSite(request, site, fetchImpl = fetch) {
  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, site.origin)
  const headers = new Headers()
  for (const [name, value] of request.headers) {
    const key = name.toLowerCase()
    if (key === 'host' || key.startsWith('cf-') || key.startsWith('x-forwarded') || key === 'x-real-ip' || HOP_BY_HOP.has(key)) continue
    if (key === 'cookie') { const kept = withoutShareCookie(value); if (kept) headers.set('cookie', kept); continue }
    if (key === 'origin') { headers.set('origin', site.origin); continue }
    if (key === 'referer') { try { const ref = new URL(value); headers.set('referer', new URL(ref.pathname + ref.search, site.origin).toString()) } catch { /* drop */ } continue }
    headers.set(name, value)
  }
  // A site's static files are kept at the edge for an hour: the first visitor
  // fetches them from the site, everyone after (and every reload) nearby.
  const staticFile = request.method === 'GET' && STATIC_FILE.test(target.pathname)
  const response = await fetchImpl(target.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
    ...(staticFile ? { cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 3600, '300-599': 0 } } } : {}),
  })
  const out = new Headers(response.headers)
  for (const name of STRIP_FROM_SITE) out.delete(name)
  // The site's cookies belong to the share's address now.
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  if (cookies.length) {
    out.delete('set-cookie')
    for (const cookie of cookies) out.append('set-cookie', cookie.replace(/;\s*domain=[^;]*/gi, ''))
  }
  const location = response.headers.get('location')
  if (location && response.status >= 300 && response.status < 400) {
    try {
      const next = new URL(location, target)
      if (sameSite(next.hostname, target.hostname)) {
        if (next.origin !== site.origin) site.origin = next.origin
        out.set('location', `${next.pathname}${next.search}${next.hash}` || '/')
      }
    } catch { /* leave it */ }
  }
  const type = String(response.headers.get('content-type') ?? '')
  if (!type.includes('text/html') || request.method === 'HEAD' || response.status === 204 || response.status === 304) {
    return new Response(response.body, { status: response.status, headers: out })
  }
  const html = keepLinksInside(injectEditor(await response.text(), site.project), site.origin)
  out.delete('content-length')
  out.delete('content-encoding')
  out.set('cache-control', 'no-store')
  return new Response(html, { status: response.status, headers: out })
}

/** The page someone sees at the share service's own address. */
export function landingPage() {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Froam share</title>
<body style="font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0f1115;color:#e5e7eb">
<main style="max-width:420px;padding:24px;text-align:center"><h1 style="font-size:20px">Froam share</h1>
<p style="color:#9ca3af">Open the link someone sent you to see the site they’re working on.</p></main></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
