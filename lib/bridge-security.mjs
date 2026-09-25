/**
 * Who the local Froam bridge answers to.
 *
 * `froam dev` runs a server on this machine whose endpoints write files —
 * the design, the project, and the generated runtime every production page
 * loads. Any page open in the developer's browser can send requests to it,
 * so without these checks a malicious site could rewrite the design (and
 * with it, what ships to production), read the project, or spend the
 * developer's AI key through the intelligence endpoint.
 *
 *   Host   — only this machine's names and IP literals. DNS rebinding needs
 *            a domain name that resolves to 127.0.0.1; that name is refused.
 *   Origin — CORS is granted to local origins (localhost, loopback and LAN
 *            IPs on any port — the app's own dev server) and to origins
 *            passed with --allow-origin; never `*`.
 *   Writes — a browser request from any other origin cannot change state.
 *            Tools that send no Origin (curl, the CLI) still can.
 */

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

/** This machine, an address someone typed, or an mDNS name — never a public domain. */
export function isLocalHostname(hostname) {
  const name = String(hostname || '').toLowerCase().replace(/\.$/, '')
  if (!name) return false
  if (name === 'localhost' || name.endsWith('.localhost')) return true
  if (name.endsWith('.local')) return true
  if (IPV4.test(name)) return true
  if (name.startsWith('[') && name.endsWith(']')) return true // IPv6 literal
  return false
}

function hostnameOf(value) {
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname
  } catch {
    return ''
  }
}

export function normalizeAllowedOrigins(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',')
  return list.map((item) => String(item).trim().replace(/\/+$/, '')).filter(Boolean)
}

export function isAllowedHost(hostHeader, allowOrigins = []) {
  const hostname = hostnameOf(String(hostHeader || ''))
  if (isLocalHostname(hostname)) return true
  return allowOrigins.some((origin) => hostnameOf(origin) === hostname)
}

export function isAllowedOrigin(origin, allowOrigins = []) {
  if (!origin || origin === 'null') return false
  const clean = String(origin).replace(/\/+$/, '')
  if (allowOrigins.includes(clean)) return true
  let url
  try { url = new URL(clean) } catch { return false }
  return (url.protocol === 'http:' || url.protocol === 'https:') && isLocalHostname(url.hostname)
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function refuse(res, message) {
  res.statusCode = 403
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ success: false, error: message }))
  return false
}

/**
 * Runs before any route. Returns false (having answered 403) for a request
 * the bridge must not serve; otherwise records on `res` which origin, if
 * any, CORS may be granted to.
 */
export function guardBridgeRequest(req, res, { allowOrigins = [] } = {}) {
  const host = req.headers.host
  if (host && !isAllowedHost(host, allowOrigins)) {
    return refuse(res, `This Froam bridge only answers to localhost. "${hostnameOf(host)}" is not this machine — use --allow-origin to add a dev domain.`)
  }
  const origin = req.headers.origin
  const allowed = origin && isAllowedOrigin(origin, allowOrigins) ? String(origin).replace(/\/+$/, '') : null
  res.__froamCorsOrigin = allowed
  if (!SAFE_METHODS.has(req.method ?? 'GET')) {
    const crossSite = req.headers['sec-fetch-site'] === 'cross-site'
    if ((origin && !allowed) || (!origin && crossSite)) {
      return refuse(res, `Froam won't accept changes from ${origin || 'another site'}. Open the editor from localhost, or allow your dev domain with --allow-origin.`)
    }
  }
  return true
}

/** CORS headers for the origin guardBridgeRequest allowed (none otherwise). */
export function applyCors(res) {
  const origin = res.__froamCorsOrigin
  if (!origin) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
}
