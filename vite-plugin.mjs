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
 *   GET  /__froam/repo/status  -> { success, exists, dirty, files }
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { ensureScaffold, loadDesign, mergeSave, writeArtifacts, VIEWPORTS } from './lib/codegen.mjs'

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

  function designPath() {
    return path.join(froamDir, 'froam.design.json')
  }

  return {
    name: 'froam-studio',
    apply: 'serve',

    configResolved(config) {
      froamDir = path.resolve(config.root, relDir)
    },

    configureServer(server) {
      ensureScaffold(froamDir, { glue: true })

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith('/__froam/')) return next()

        try {
          if (url === '/__froam/repo/load' && req.method === 'GET') {
            return send(res, 200, { success: true, design: loadDesign(designPath()) })
          }

          if (url === '/__froam/repo/status' && req.method === 'GET') {
            const status = await gitStatus(froamDir)
            return send(res, 200, {
              success: true,
              exists: fs.existsSync(designPath()),
              dir: froamDir,
              ...status,
            })
          }

          if (url === '/__froam/repo/save' && req.method === 'POST') {
            const { routeKey, viewportMode, store } = await readJsonBody(req)
            if (typeof routeKey !== 'string' || !VIEWPORTS.includes(viewportMode) || typeof store !== 'object' || store === null) {
              return send(res, 400, { success: false, error: 'Expected { routeKey, viewportMode, store }' })
            }

            const design = mergeSave(loadDesign(designPath()), { routeKey, viewportMode, store })
            const files = writeArtifacts(froamDir, design)

            const status = await gitStatus(froamDir)
            return send(res, 200, {
              success: true,
              ...status,
              files: files.map((f) => path.join(relDir, f)),
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
