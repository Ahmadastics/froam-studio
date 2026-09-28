/**
 * Share a local site — the `froam dev` half of templates/cloudflare-share.
 *
 * One outbound WebSocket to the share service; every request someone makes
 * to the share link arrives on it, is answered by this machine's `froam dev`
 * (the proxied app or served folder, the editor, the room API) and goes back
 * the same way. Outbound only, so it works behind any router or firewall.
 *
 * Every request that comes through is marked `x-froam-remote`: the bridge
 * treats it as someone else's browser — it can join the room, talk, suggest
 * and view, and can never write this project's files. Only the owner's own
 * approval, on this machine, does that.
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import zlib from 'node:zlib'

export const DEFAULT_SHARE_SERVICE = 'https://froam-share.ahmadastic.workers.dev'
const CHUNK = 512 * 1024
const PING_MS = 25_000
/** Text worth compressing before it crosses the internet (the editor bundle is most of a first load). */
const COMPRESSIBLE = /^(?:text\/(?!event-stream)|application\/(?:javascript|json|xml|wasm|manifest\+json)|image\/svg)/i
const DROP_REQUEST_HEADERS = new Set(['host', 'connection', 'keep-alive', 'upgrade', 'transfer-encoding', 'content-length', 'accept-encoding', 'origin', 'referer', 'sec-fetch-site', 'x-froam-remote', 'x-forwarded-for', 'x-real-ip'])

/** The same link every time for the same project: an id to share and a key that proves it's this machine. */
export function shareIdentity(projectKey, { file = process.env.FROAM_SHARES_FILE || path.join(os.homedir(), '.froam', 'shares.json') } = {}) {
  let all = {}
  try { all = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* first share */ }
  if (!all[projectKey]?.id || !all[projectKey]?.key) {
    all[projectKey] = { id: randomBytes(18).toString('base64url'), key: randomBytes(24).toString('base64url'), createdAt: new Date().toISOString() }
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(all, null, 2), { mode: 0o600 })
    } catch { /* an unsaved identity still works, for this run */ }
  }
  return { id: all[projectKey].id, key: all[projectKey].key }
}

/**
 * @param {{
 *   port: number,                 the local froam dev port
 *   service?: string,             the share service (FROAM_SHARE_URL)
 *   id: string, key: string,      from shareIdentity()
 *   log?: (line: string) => void,
 *   WebSocketImpl?: typeof WebSocket,
 * }} options
 */
export function startShareTunnel({ port, service = process.env.FROAM_SHARE_URL || DEFAULT_SHARE_SERVICE, id, key, log = () => {}, WebSocketImpl = globalThis.WebSocket }) {
  if (!WebSocketImpl) throw new Error('Sharing needs Node 22 or newer (for WebSocket)')
  const base = service.replace(/\/+$/, '')
  const url = `${base}/s/${id}`
  const localOrigin = `http://127.0.0.1:${port}`
  let socket = null
  let stopped = false
  let online = false
  let attempts = 0
  let retry = null
  let ping = null
  const listeners = new Set()
  const announce = () => { for (const listener of listeners) listener({ online, url }) }

  const send = (frame) => { try { socket?.send(JSON.stringify(frame)) } catch { /* reconnecting */ } }

  function answer(frame) {
    const acceptsGzip = (frame.headers ?? []).some(([name, value]) => String(name).toLowerCase() === 'accept-encoding' && /\bgzip\b/.test(String(value)))
    const headers = { host: `127.0.0.1:${port}`, 'x-froam-remote': '1', 'accept-encoding': 'identity' }
    for (const [name, value] of frame.headers ?? []) {
      if (!DROP_REQUEST_HEADERS.has(String(name).toLowerCase())) headers[name] = value
    }
    // The bridge only takes changes from its own origin; the remote mark is what limits them.
    const hadOrigin = (frame.headers ?? []).some(([name]) => String(name).toLowerCase() === 'origin')
    if (hadOrigin) headers.origin = localOrigin
    const body = frame.body ? Buffer.from(frame.body, 'base64') : null
    if (body) headers['content-length'] = String(body.length)

    const request = http.request({ host: '127.0.0.1', port, method: frame.method, path: frame.path, headers }, (response) => {
      const raw = response.rawHeaders
      const out = []
      const type = String(response.headers['content-type'] ?? '')
      const gzip = acceptsGzip && !response.headers['content-encoding'] && COMPRESSIBLE.test(type) && frame.method !== 'HEAD'
      for (let i = 0; i < raw.length; i += 2) {
        if (gzip && raw[i].toLowerCase() === 'content-length') continue
        let value = raw[i + 1]
        // A redirect to this machine must stay on the share.
        if (raw[i].toLowerCase() === 'location') value = value.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i, '') || '/'
        out.push([raw[i], value])
      }
      if (gzip) out.push(['Content-Encoding', 'gzip'], ['Vary', 'Accept-Encoding'])
      const source = gzip ? response.pipe(zlib.createGzip({ level: 6 })) : response
      let started = false
      let buffered = []
      let size = 0
      const flush = (more) => {
        const bodyChunk = buffered.length ? Buffer.concat(buffered).toString('base64') : null
        buffered = []
        size = 0
        if (!started) {
          started = true
          send({ t: 'res', id: frame.id, status: response.statusCode ?? 502, headers: out, body: bodyChunk, more })
        } else {
          send({ t: 'chunk', id: frame.id, body: bodyChunk, more })
        }
      }
      source.on('data', (chunk) => {
        buffered.push(chunk)
        size += chunk.length
        // Stream as it comes: a live event stream must not wait for the end.
        if (size >= CHUNK || /text\/event-stream/.test(type)) flush(true)
      })
      source.on('end', () => flush(false))
      source.on('error', () => flush(false))
    })
    request.on('error', () => send({ t: 'res', id: frame.id, status: 502, headers: [['content-type', 'text/plain']], body: Buffer.from('froam dev could not answer').toString('base64'), more: false }))
    if (body) request.write(body)
    request.end()
  }

  function connect() {
    if (stopped) return
    const current = new WebSocketImpl(`${base.replace(/^http/, 'ws')}/host/${id}?key=${encodeURIComponent(key)}`)
    socket = current
    current.onopen = () => {
      attempts = 0
      online = true
      log(`shared at ${url}`)
      announce()
      clearInterval(ping)
      ping = setInterval(() => send({ t: 'ping' }), PING_MS)
    }
    current.onmessage = (event) => {
      let frame
      try { frame = JSON.parse(String(event.data)) } catch { return }
      if (frame?.t === 'req') answer(frame)
    }
    current.onclose = () => {
      if (socket === current) socket = null
      clearInterval(ping)
      if (online) { online = false; announce(); log('share connection dropped — reconnecting') }
      if (stopped) return
      attempts += 1
      retry = setTimeout(connect, Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5)))
    }
    current.onerror = () => { /* onclose follows */ }
  }

  connect()
  return {
    url,
    get online() { return online },
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    stop() {
      stopped = true
      clearTimeout(retry)
      clearInterval(ping)
      try { socket?.close() } catch { /* closed */ }
      socket = null
      if (online) { online = false; announce() }
    },
  }
}
