/**
 * Froam share on Cloudflare — local sites, reachable from anywhere.
 *
 *   GET /host/:id?key=…    WebSocket from `froam dev --share` (the owner's computer)
 *   GET /s/:id[/page][?…]  a share link: remembers the share for this browser, opens that page
 *   anything else          with the share remembered: the owner's site, through the socket
 *
 * One Durable Object per share holds the owner's socket. The first computer to
 * connect with a key claims the share; only that key can reconnect, so a link
 * keeps working across restarts and can't be taken over.
 *
 *   npx wrangler deploy
 */
import { SHARE_COOKIE, createShareHub, isShareId, landingPage, sha256Hex, shareFromCookie } from './share.js'

const HOST_PATH = /^\/host\/([A-Za-z0-9_-]{16,64})$/
const LINK_PATH = /^\/s\/([A-Za-z0-9_-]{16,64})(\/[^?#]*)?$/

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = HOST_PATH.exec(url.pathname)
    if (host) return env.SHARES.get(env.SHARES.idFromName(host[1])).fetch(request)

    const link = LINK_PATH.exec(url.pathname)
    if (link) {
      // Remember the share for this browser, then open the page at its own path
      // so the site's /paths resolve exactly as they do on the owner's machine.
      const page = link[2] && link[2] !== '/' ? link[2].replace(/\/{2,}/g, '/') : '/'
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${page}${url.search}`,
          'Set-Cookie': `${SHARE_COOKIE}=${link[1]}; Path=/; Max-Age=604800; Secure; HttpOnly; SameSite=Lax`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const shareId = shareFromCookie(request.headers.get('Cookie'))
    if (!shareId) return landingPage()
    return env.SHARES.get(env.SHARES.idFromName(shareId)).fetch(request)
  },
}

export class FroamShare {
  constructor(state) {
    this.state = state
    this.ready = this.state.storage.get('site').then((site) => {
      this.hub = createShareHub({
        hostSocket: () => this.state.getWebSockets('host')[0] ?? null,
        cache: caches.default,
        site: site ?? null,
        onHello: (next) => { this.state.storage.put('site', next).catch(() => {}) },
      })
    })
  }

  async fetch(request) {
    await this.ready
    const url = new URL(request.url)
    const host = HOST_PATH.exec(url.pathname)
    if (host) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
      const key = url.searchParams.get('key')
      if (!isShareId(key)) return new Response('Forbidden', { status: 403 })
      const hash = await sha256Hex(key)
      const claimed = await this.state.storage.get('keyHash')
      if (claimed && claimed !== hash) return new Response('This share belongs to another computer', { status: 403 })
      if (!claimed) await this.state.storage.put('keyHash', hash)
      // One computer at a time: a reconnect replaces the old socket.
      for (const old of this.state.getWebSockets('host')) { try { old.close(1000, 'Replaced') } catch { /* gone */ } }
      const [client, server] = Object.values(new WebSocketPair())
      this.state.acceptWebSocket(server, ['host'])
      return new Response(null, { status: 101, webSocket: client })
    }
    return this.hub.forward(request)
  }

  async webSocketMessage(_socket, message) {
    await this.ready
    this.hub.fromHost(typeof message === 'string' ? message : new TextDecoder().decode(message))
  }

  async webSocketClose() { await this.ready; this.hub.hostGone() }
  async webSocketError() { await this.ready; this.hub.hostGone() }
}
