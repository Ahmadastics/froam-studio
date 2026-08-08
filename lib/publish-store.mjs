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
import { DESIGN_VERSION, normalizeRouteKey, VIEWPORTS } from './codegen.mjs'

// Re-exported so `froam-studio/server` is the one import for the whole
// server-side story: store the publish, commit it, and hold the room.
export { createGitHubCommitter } from './github-committer.mjs'
export { createFroamRoomApi, PRESENCE_TTL_MS } from './room-store.mjs'
export { createFroamProjectSyncApi } from './project-sync-store.mjs'

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
 * Reshape the published file into a committable design, so one publish can be
 * handed straight to a committer without the caller reassembling it.
 */
function publishedToDesign(published) {
  const routes = {}
  for (const [routeKey, viewports] of Object.entries(published.routes ?? {})) {
    for (const [viewportMode, entry] of Object.entries(viewports ?? {})) {
      if (!entry?.store) continue
      routes[routeKey] = routes[routeKey] ?? {}
      routes[routeKey][viewportMode] = entry.store
    }
  }
  return {
    version: DESIGN_VERSION,
    updatedAt: published.updatedAt ?? new Date().toISOString(),
    meta: { createdWith: 'froam-studio' },
    routes,
  }
}

/**
 * @param {{
 *   file: string,
 *   authorize?: (req: import('node:http').IncomingMessage) => boolean | Promise<boolean>,
 *   log?: (line: string) => void,
 *   commit?: ((input: { design: object, message: string }) => Promise<unknown>) | null,
 * }} options
 * @returns {(req, res) => Promise<boolean>} handler — resolves true when it
 *   handled the request (only /published requests are handled).
 */
export function createFroamPublishApi({ file, authorize = null, log = () => {}, commit = null }) {
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

      // Optional second leg: put it in the repo too, so the design ships in the
      // build rather than only living behind the API. Deliberately after the
      // publish is safely stored and never allowed to fail the request — a
      // GitHub outage must not lose someone's design.
      let committed = null
      if (commit) {
        try {
          committed = await commit({
            design: publishedToDesign(published),
            message: `Froam: ${routeKey} (${viewportMode})`,
          })
          log(`committed ${routeKey} (${viewportMode}) to the repo`)
        } catch (error) {
          committed = { error: error?.message ?? 'commit failed' }
          log(`commit failed: ${committed.error}`)
        }
      }

      sendJson(res, 200, { success: true, design: { routeKey, viewportMode, publishedAt }, committed })
      return true
    }

    sendJson(res, 405, { success: false, error: 'Method not allowed' })
    return true
  }
}
