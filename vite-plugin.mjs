/**
 * Froam Studio v3 — Vite plugin (Repo Mode bridge)
 *
 * Turns visual edits made in the Froam editor into real, committable
 * files inside the host repo:
 *
 *   <froamDir>/froam.design.json    — canonical design store (source of truth)
 *   <froamDir>/froam.generated.css  — styles compiled to static CSS
 *   <froamDir>/froam.runtime.js     — zero-dependency vanilla runtime
 *   <froamDir>/index.ts             — glue: imports css, exports design
 *
 * All codegen is shared with the `froam` CLI and the universal dev
 * bridge (lib/codegen.mjs) so every integration writes identical files.
 *
 * Dev-server endpoints (never present in production builds):
 *   POST /__froam/repo/save    { routeKey, viewportMode, store }
 *   GET  /__froam/repo/load    -> { success, design }
 *   GET  /__froam/repo/project/load and POST /project/save manage the
 *        additive froam.project.json sidecar without changing generated output.
 *   GET  /__froam/repo/status  -> { success, exists, dirty, files }
 *   GET  /__froam/whoami       -> { success, device } (this computer, or another device)
 *   GET  /__froam/events       live sync between open editors (server-sent events)
 *   /__froam/live              Go Live (lib/go-live.mjs) — this computer only
 *   /__froam/record            who changed what, and the report (lib/record.mjs) — this computer only
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { ensureScaffold, loadDesign, mergeSaveWithReport, normalizeRouteKey, writeArtifacts, VIEWPORTS } from './lib/codegen.mjs'
import { loadProjectFile, writeProjectFile } from './lib/project-store.mjs'
import { createFroamMediaApi } from './lib/media-store.mjs'
import { createGoLive } from './lib/go-live.mjs'
import { createFroamRecord, createRecordEndpoint, describeStoreChanges, ownerName } from './lib/record.mjs'

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

/** This computer. A Vite server started with --host also answers phones on the Wi-Fi; they don't get Go Live. */
function isLoopback(req) {
  const address = String(req.socket?.remoteAddress ?? '')
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address.startsWith('127.')
}

function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
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
 * @param {{ dir?: string }} [options] dir: where froam files live,
 *   relative to the Vite project root. Default: 'src/froam'.
 */
export default function froamStudio(options = {}) {
  const relDir = options.dir ?? 'src/froam'
  let froamDir = ''
  let root = ''

  function designPath() {
    return path.join(froamDir, 'froam.design.json')
  }

  function projectPath() {
    return path.join(froamDir, 'froam.project.json')
  }

  return {
    name: 'froam-studio',
    apply: 'serve',

    configResolved(config) {
      froamDir = path.resolve(config.root, relDir)
      root = config.root
    },

    configureServer(server) {
      ensureScaffold(froamDir, { glue: true })

      // Placed media lives in <dir>/media and is served from here while editing.
      const mediaApi = createFroamMediaApi({ getFroamDir: () => froamDir, send })

      // Live sync between open editors, as under froam dev (lib/dev-server.mjs).
      const listeners = new Set()
      let revision = 0
      const broadcast = (change) => {
        revision += 1
        const frame = `event: change\ndata: ${JSON.stringify({ revision, from: null, device: 'computer', at: Date.now(), ...change })}\n\n`
        for (const listener of listeners) {
          try { listener.write(frame) } catch { listeners.delete(listener) }
        }
      }
      const announce = (req, change) => {
        const id = String(req.headers['x-froam-client'] ?? '')
        broadcast({ from: /^[A-Za-z0-9_-]{6,64}$/.test(id) ? id : null, device: isLoopback(req) ? 'computer' : 'other', ...change })
      }
      const logLine = (line) => server.config.logger.info(`[froam] ${line}`)
      // The record (lib/record.mjs): saves and Go Live, under the owner's name, next to the design.
      const record = createFroamRecord({ froamDir, log: logLine })
      const configPath = path.join(root, 'froam.config.json')
      let knownOwner = null
      const you = () => {
        if (!knownOwner || Date.now() - knownOwner.at > 60_000) knownOwner = { at: Date.now(), name: ownerName({ configPath, cwd: root }) }
        return knownOwner.name
      }
      const personOf = (req) => (isLoopback(req)
        ? { name: you(), role: 'owner', via: 'this computer' }
        : { name: 'A device on your network', role: 'device', via: 'local network' })
      const recordEndpoint = createRecordEndpoint({ record, configPath, you, readBody: readJsonBody, send, onName: () => { knownOwner = null } })
      // Go Live: the design goes into the app's own bundle, so a push is what ships it.
      const goLive = createGoLive({ froamDir, sourceRoot: root, log: logLine, record, progress: (job) => broadcast({ kind: 'live', job }) })

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith('/__froam/')) return next()

        try {
          if ((url === '/__froam/media' || url.startsWith('/__froam/media/')) && await mediaApi(req, res, url)) return
          if (url === '/__froam/whoami' && req.method === 'GET') {
            return send(res, 200, { success: true, name: null, device: isLoopback(req) ? 'computer' : 'other' })
          }
          if (url === '/__froam/live' || url.startsWith('/__froam/live/')) {
            res.setHeader('Cache-Control', 'no-store')
            if (!isLoopback(req)) return send(res, 403, { success: false, error: 'Only the computer running the dev server can put the site live.' })
            if (url === '/__froam/live' && req.method === 'GET') return send(res, 200, { success: true, plan: await goLive.plan({ remote: new URL(req.url ?? '/', 'http://froam.local').searchParams.get('remote') || undefined }), job: goLive.job() })
            if (url === '/__froam/live' && req.method === 'POST') {
              const { token, remote } = await readJsonBody(req).catch(() => ({}))
              const started = await goLive.start(typeof token === 'string' ? token : '', { remote: typeof remote === 'string' ? remote : undefined, by: personOf(req) })
              if (!started.ok) return send(res, started.status, { success: false, error: started.error, plan: started.plan ?? null, job: started.job ?? null })
              return send(res, 202, { success: true, job: started.job })
            }
            if (url === '/__froam/live/job' && req.method === 'GET') return send(res, 200, { success: true, job: goLive.job() })
            if (url === '/__froam/live/site' && req.method === 'POST') {
              const { url: address } = await readJsonBody(req).catch(() => ({}))
              try { return send(res, 200, { success: true, url: goLive.setSiteUrl(address) }) } catch (error) { return send(res, 400, { success: false, error: error.message }) }
            }
            return send(res, 404, { success: false, error: 'Unknown froam endpoint' })
          }
          if (url === '/__froam/record' || url.startsWith('/__froam/record/')) {
            if (!isLoopback(req)) return send(res, 403, { success: false, error: 'Only the computer running the dev server can read the record.' })
            return void await recordEndpoint(req, res, url)
          }
          if (url === '/__froam/repo/load' && req.method === 'GET') {
            return send(res, 200, { success: true, design: loadDesign(designPath()) })
          }
          // Open editors (two tabs, two windows) hear about each other's saves.
          if (url === '/__froam/events' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
            res.write(`retry: 2000\nevent: ready\ndata: ${JSON.stringify({ revision })}\n\n`)
            listeners.add(res)
            const beat = setInterval(() => { try { res.write(': beat\n\n') } catch { /* closed */ } }, 25_000)
            req.on('close', () => { clearInterval(beat); listeners.delete(res) })
            return
          }
          if (url === '/__froam/repo/project/load' && req.method === 'GET') {
            return send(res, 200, { success: true, project: loadProjectFile(projectPath()) })
          }
          if (url === '/__froam/repo/project/save' && req.method === 'POST') {
            try {
              writeProjectFile(projectPath(), await readJsonBody(req))
              return send(res, 200, { success: true, file: 'froam.project.json' })
            } catch (error) {
              return send(res, 400, { success: false, error: error instanceof Error ? error.message : 'Invalid project' })
            }
          }

          if (url === '/__froam/repo/status' && req.method === 'GET') {
            const status = await gitStatus(froamDir)
            return send(res, 200, {
              success: true,
              exists: fs.existsSync(designPath()),
              projectExists: fs.existsSync(projectPath()),
              dir: froamDir,
              ...status,
            })
          }

          if (url === '/__froam/repo/save' && req.method === 'POST') {
            const { routeKey, viewportMode, store, base } = await readJsonBody(req)
            if (typeof routeKey !== 'string' || !VIEWPORTS.includes(viewportMode) || typeof store !== 'object' || store === null) {
              return send(res, 400, { success: false, error: 'Expected { routeKey, viewportMode, store }' })
            }

            const current = loadDesign(designPath())
            const page = normalizeRouteKey(routeKey)
            const before = current.routes?.[page]?.[viewportMode] ?? {}
            // With `base`, only what this editor changed is taken (lib/draft-merge.mjs).
            const saved = mergeSaveWithReport(current, { routeKey, viewportMode, store, base })
            const files = writeArtifacts(froamDir, saved.design)
            const changes = describeStoreChanges(before, saved.store, { routeKey: page })
            if (changes.length) record.note({ type: 'saved', by: personOf(req), pages: [page], viewport: viewportMode, changes, count: changes.length })
            goLive.recordSave(routeKey)
            announce(req, { kind: 'design', routeKey, viewport: viewportMode })

            const status = await gitStatus(froamDir)
            return send(res, 200, {
              success: true,
              ...status,
              files: files.map((f) => path.join(relDir, f)),
              revision,
              store: saved.store,
              conflicts: saved.conflicts,
            })
          }

          return send(res, 404, { success: false, error: 'Unknown froam endpoint' })
        } catch (error) {
          return send(res, 500, { success: false, error: error?.message ?? 'Froam repo bridge error' })
        }
      })
    },
  }
}
