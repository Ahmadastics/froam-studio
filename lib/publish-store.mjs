/**
 * Froam Studio — publish store.
 *
 * The cloud half of Froam's publish path, as a tiny reusable handler:
 *
 *   GET  /api/froam/published?routeKey=/&viewportMode=desktop
 *        -> { success: true, design: { routeKey, viewportMode, store,
 *             publishedAt } | null }
 *   POST /api/froam/published  { routeKey, viewportMode, store }
 *        -> { success: true, design: { routeKey, viewportMode, publishedAt } }
 *
 * `froam dev` mounts this automatically (file-backed, saved next to the
 * design as froam.published.json) so publish works on any project with
 * no backend at all — edit on the laptop, refresh on the phone (--host).
 *
 * Any Node backend can mount the same contract for production:
 *
 *   import { createFroamPublishApi } from 'froam-studio/server'
 *   const froamApi = createFroamPublishApi({
 *     file: 'froam/froam.published.json',
 *     authorize: async (req) => isAdmin(req),   // gate POSTs
 *   })
 *   app.use('/api/froam', (req, res) => froamApi(req, res))
 *
 * Or implement the two endpoints yourself against any store (see
 * runam's Prisma-backed version for a full example with versioning).
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeRouteKey, VIEWPORTS } from './codegen.mjs'

const MAX_BODY_BYTES = 20_000_000

function emptyPublished() {
  return { version: 1, updatedAt: null, routes: {} }
}

export function loadPublished(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (parsed && typeof parsed === 'object' && typeof parsed.routes === 'object' && parsed.routes !== null) {
      return parsed
    }
  } catch {
    /* fall through to empty */
  }
  return emptyPublished()
}

function savePublished(file, published) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(published, null, 2) + '\n')
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  // Express with a JSON body-parser already did the work.
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) reject(new Error('Payload too large'))
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

/**
 * @param {{
 *   file: string,
 *   authorize?: (req: import('node:http').IncomingMessage) => boolean | Promise<boolean>,
 *   log?: (line: string) => void,
 * }} options
 * @returns {(req, res) => Promise<boolean>} handler — resolves true when it
 *   handled the request (only /published requests are handled).
 */
export function createFroamPublishApi({ file, authorize = null, log = () => {} }) {
  return async function handlePublishRequest(req, res) {
    const url = new URL(req.url ?? '/', 'http://froam.local')
    if (!url.pathname.endsWith('/published')) return false

    if (req.method === 'GET') {
      const routeKey = normalizeRouteKey(url.searchParams.get('routeKey') ?? '/')
      const viewportMode = url.searchParams.get('viewportMode') ?? 'desktop'
      if (!VIEWPORTS.includes(viewportMode)) {
        sendJson(res, 400, { success: false, error: 'Invalid viewportMode' })
        return true
      }
      const entry = loadPublished(file).routes[routeKey]?.[viewportMode] ?? null
      sendJson(res, 200, {
        success: true,
        design: entry
          ? { routeKey, viewportMode, store: entry.store, publishedAt: entry.publishedAt ?? null }
          : null,
      })
      return true
    }

    if (req.method === 'POST') {
      if (authorize && !(await authorize(req))) {
        sendJson(res, 403, { success: false, error: 'Not authorized to publish' })
        return true
      }
      let body
      try {
        body = await readJsonBody(req)
      } catch {
        sendJson(res, 400, { success: false, error: 'Invalid JSON body' })
        return true
      }
      const routeKey = normalizeRouteKey(body?.routeKey ?? '')
      const viewportMode = body?.viewportMode
      const store = body?.store
      if (!VIEWPORTS.includes(viewportMode) || typeof store !== 'object' || store === null) {
        sendJson(res, 400, { success: false, error: 'Expected { routeKey, viewportMode, store }' })
        return true
      }
      const published = loadPublished(file)
      const publishedAt = new Date().toISOString()
      published.routes[routeKey] = published.routes[routeKey] ?? {}
      published.routes[routeKey][viewportMode] = { store, publishedAt }
      published.updatedAt = publishedAt
      savePublished(file, published)
      log(`published ${routeKey} (${viewportMode}) → ${path.basename(file)}`)
      sendJson(res, 200, { success: true, design: { routeKey, viewportMode, publishedAt } })
      return true
    }

    sendJson(res, 405, { success: false, error: 'Method not allowed' })
    return true
  }
}
