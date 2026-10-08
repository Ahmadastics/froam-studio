/**
 * Media the editor places — photos, GIFs, SVGs, videos — kept as files.
 *
 * A picture used to travel inside the design as a data URL: a phone photo
 * became megabytes of base64 in froam.design.json, in localStorage after every
 * edit, in every collaboration op, inlined in the generated CSS (which blocks
 * a visitor's first paint) and in the runtime script. A video could not travel
 * at all.
 *
 * Now each file is stored once in the workspace, `<froamDir>/media/`, named by
 * its content (`<sha256>.<ext>`: the same photo uploaded twice is one file),
 * and the design refers to it as `froam-media:<name>`. The editor shows it
 * from the bridge (`/__froam/media/<name>`); the generated CSS and runtime
 * load it from `media/` next to themselves, copied there on every save.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

export const MEDIA_DIR = 'media'
export const MEDIA_REF_PREFIX = 'froam-media:'
/** `<32 hex>.<ext>` — what a media file is called, on disk and in a reference. */
export const MEDIA_NAME = /^[a-f0-9]{32}\.(?:jpg|png|webp|avif|gif|svg|bmp|mp4|webm|mov|ogv)$/
const MEDIA_REF_GLOBAL = /froam-media:([a-f0-9]{32}\.(?:jpg|png|webp|avif|gif|svg|bmp|mp4|webm|mov|ogv))/g

export const MEDIA_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
}

/** A photo past this is not a web image; a video past the other is not a web video. */
export const MAX_IMAGE_BYTES = 40 * 1024 * 1024
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024

const isVideoExt = (ext) => ['mp4', 'webm', 'mov', 'ogv'].includes(ext)

/**
 * What the bytes are, read from the bytes — never from a file name or a
 * header someone sent. Anything else is refused.
 */
export function sniffMediaType(buffer) {
  const b = buffer
  const ascii = (start, end) => b.subarray(start, end).toString('latin1')
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png'
  if (b.length >= 6 && ascii(0, 4) === 'GIF8') return 'gif'
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (b.length >= 2 && ascii(0, 2) === 'BM') return 'bmp'
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm'
  if (b.length >= 4 && ascii(0, 4) === 'OggS') return 'ogv'
  if (b.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    if (brand === 'avif' || brand === 'avis') return 'avif'
    if (brand === 'qt  ') return 'mov'
    return 'mp4'
  }
  const head = ascii(0, Math.min(b.length, 2048)).replace(/^﻿/, '').trimStart()
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'svg'
  return null
}

/** The name a file is stored under: its content, so storing it twice is free. */
export function mediaNameFor(buffer, ext) {
  return `${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32)}.${ext}`
}

/** Store bytes in the workspace. Returns `{ name, ref, bytes, type }`, or throws with a message for a person. */
export function storeMediaBuffer(froamDir, buffer) {
  const ext = sniffMediaType(buffer)
  if (!ext) throw new Error('That file is not an image or video Froam can place (JPEG, PNG, WebP, AVIF, GIF, SVG, MP4, WebM, MOV, Ogg)')
  const limit = isVideoExt(ext) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (buffer.length > limit) throw new Error(`That file is ${Math.round(buffer.length / 1048576)} MB — the limit is ${Math.round(limit / 1048576)} MB`)
  const name = mediaNameFor(buffer, ext)
  const dir = path.join(froamDir, MEDIA_DIR)
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true })
    // Written beside, then renamed: a reader never sees half a file.
    const temp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(temp, buffer)
    fs.renameSync(temp, file)
  }
  return { name, ref: `${MEDIA_REF_PREFIX}${name}`, bytes: buffer.length, type: MEDIA_TYPES[ext] }
}

/** Every media file a design refers to, by name. */
export function mediaNamesIn(value) {
  const names = new Set()
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  for (const match of text.matchAll(MEDIA_REF_GLOBAL)) names.add(match[1])
  return names
}

/**
 * The media a visitor's browser needs: everything the design shows, not the
 * originals kept so a crop can be redone (those stay in the workspace).
 */
export function shippedMediaNames(design) {
  const names = new Set()
  for (const viewports of Object.values(design?.routes ?? {})) {
    for (const store of Object.values(viewports ?? {})) {
      for (const draft of Object.values(store ?? {})) {
        if (!draft || typeof draft !== 'object') continue
        for (const name of mediaNamesIn(draft.text ?? '')) names.add(name)
        for (const name of mediaNamesIn(draft.imageUrl ?? '')) names.add(name)
        for (const name of mediaNamesIn(draft.styles ?? {})) names.add(name)
        if (typeof draft.media === 'string') {
          let media = null
          try { media = JSON.parse(draft.media) } catch { /* not ours */ }
          if (media && typeof media === 'object') {
            const shown = { ...media }
            delete shown.source
            for (const name of mediaNamesIn(shown)) names.add(name)
          }
        }
      }
    }
  }
  return names
}

/** Copy the media a design shows into the folder the site serves (beside the shipped CSS and runtime). */
export function shipMedia(froamDir, shipDir, design) {
  const shipped = []
  const from = path.join(froamDir, MEDIA_DIR)
  const to = path.join(shipDir, MEDIA_DIR)
  for (const name of shippedMediaNames(design)) {
    const source = path.join(from, name)
    const target = path.join(to, name)
    if (!fs.existsSync(source) || fs.existsSync(target)) continue
    fs.mkdirSync(to, { recursive: true })
    fs.copyFileSync(source, target)
    shipped.push(target)
  }
  return shipped
}

/* ─── the bridge's /__froam/media endpoints ─── */

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let done = false
    req.on('data', (chunk) => {
      if (done) return
      size += chunk.length
      if (size > limit) {
        done = true
        reject(new Error(`That file is over ${Math.round(limit / 1048576)} MB`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)) } })
    req.on('error', (error) => { if (!done) { done = true; reject(error) } })
  })
}

/** Fetch someone else's picture or video, so it can be cropped like an upload. */
function download(url, limit, redirects = 3) {
  return new Promise((resolve, reject) => {
    let target
    try { target = new URL(url) } catch { reject(new Error('That is not a link Froam can open')); return }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') { reject(new Error('Only http and https links can be imported')); return }
    const transport = target.protocol === 'https:' ? https : http
    const request = transport.get(target, { headers: { 'user-agent': 'Mozilla/5.0 (Froam media import)', accept: 'image/*,video/*;q=0.9,*/*;q=0.1' }, timeout: 20_000 }, (response) => {
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400 && response.headers.location && redirects > 0) {
        response.resume()
        resolve(download(new URL(response.headers.location, target).href, limit, redirects - 1))
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new Error(`The site answered ${status} for that file`))
        return
      }
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > limit) {
          request.destroy()
          reject(new Error(`That file is over ${Math.round(limit / 1048576)} MB`))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    })
    request.on('timeout', () => request.destroy(new Error('The site took too long to send that file')))
    request.on('error', reject)
  })
}

function serveMedia(req, res, file, ext, cors) {
  const stat = fs.statSync(file)
  cors(res)
  res.setHeader('Content-Type', MEDIA_TYPES[ext] ?? 'application/octet-stream')
  // Named by content: a name never changes what it points at.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // An SVG opened on its own is a document: it must not run anything.
  if (ext === 'svg') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''))
  if (range && (range[1] || range[2])) {
    // Videos seek by asking for a slice; without this they can't skip ahead.
    let start = range[1] ? Number(range[1]) : stat.size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1
    start = Math.max(0, start)
    end = Math.min(stat.size - 1, end)
    if (start > end || start >= stat.size) {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${stat.size}`)
      return res.end()
    }
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
    res.setHeader('Content-Length', String(end - start + 1))
    if (req.method === 'HEAD') return res.end()
    return fs.createReadStream(file, { start, end }).pipe(res)
  }
  res.statusCode = 200
  res.setHeader('Content-Length', String(stat.size))
  if (req.method === 'HEAD') return res.end()
  return fs.createReadStream(file).pipe(res)
}

/**
 * `GET  /__froam/media/<name>`     the file (ranges for video)
 * `POST /__froam/media`            raw bytes → `{ ref, url, name, bytes, type }`
 * `POST /__froam/media/import`     `{ url }` → the same, fetched by the bridge
 *
 * Writing is for the computer running froam dev only (`isLocalRequest`): a
 * person on a share link suggests changes, they don't put files on it.
 */
export function createFroamMediaApi({ getFroamDir, isLocalRequest = () => true, send, cors = () => {}, log = () => {} }) {
  return async function handleMedia(req, res, url) {
    if (url === '/__froam/media' || url === '/__froam/media/') {
      if (req.method !== 'POST') return false
      if (!isLocalRequest(req)) { send(res, 403, { success: false, error: 'Only the computer running froam dev can add files — upload it there, or send the owner the file' }); return true }
      try {
        const body = await readBody(req, MAX_VIDEO_BYTES)
        const stored = storeMediaBuffer(getFroamDir(), body)
        log(`media ← ${stored.name} (${Math.round(stored.bytes / 1024)} KB)`)
        send(res, 200, { success: true, ...stored, url: `/__froam/media/${stored.name}` })
      } catch (error) {
        send(res, 400, { success: false, error: error instanceof Error ? error.message : 'Could not store that file' })
      }
      return true
    }

    if (url === '/__froam/media/import') {
      if (req.method !== 'POST') return false
      if (!isLocalRequest(req)) { send(res, 403, { success: false, error: 'Only the computer running froam dev can import files' }); return true }
      try {
        const chunks = await readBody(req, 64 * 1024)
        const { url: source } = JSON.parse(chunks.toString('utf8') || '{}')
        const buffer = await download(String(source ?? ''), MAX_VIDEO_BYTES)
        const stored = storeMediaBuffer(getFroamDir(), buffer)
        log(`media ← ${stored.name} (imported)`)
        send(res, 200, { success: true, ...stored, url: `/__froam/media/${stored.name}` })
      } catch (error) {
        send(res, 400, { success: false, error: error instanceof Error ? error.message : 'Could not import that file' })
      }
      return true
    }

    if (url.startsWith('/__froam/media/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const name = url.slice('/__froam/media/'.length)
      if (!MEDIA_NAME.test(name)) { send(res, 404, { success: false, error: 'Not found' }); return true }
      const file = path.join(getFroamDir(), MEDIA_DIR, name)
      if (!fs.existsSync(file)) { send(res, 404, { success: false, error: 'Not found' }); return true }
      serveMedia(req, res, file, name.split('.').pop(), cors)
      return true
    }
    return false
  }
}
