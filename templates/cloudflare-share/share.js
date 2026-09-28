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
 *   either way     { t: 'ping' } / { t: 'pong' }
 */

/** A request body a browser may send through a share (room messages, profiles, requests). */
export const MAX_REQUEST_BYTES = 700_000
export const SHARE_COOKIE = 'froam_share'
const RESPONSE_TIMEOUT_MS = 30_000
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
export function createShareHub({ hostSocket, now = () => Date.now() }) {
  const pending = new Map()
  let nextId = 1

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

    /** A browser's request → the owner's computer → a Response. */
    async forward(request) {
      const socket = hostSocket()
      if (!socket) return offlinePage()
      const url = new URL(request.url)
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

/** The page someone sees at the share service's own address. */
export function landingPage() {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Froam share</title>
<body style="font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0f1115;color:#e5e7eb">
<main style="max-width:420px;padding:24px;text-align:center"><h1 style="font-size:20px">Froam share</h1>
<p style="color:#9ca3af">Open the link someone sent you to see the site they’re working on.</p></main></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
