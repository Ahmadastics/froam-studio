/* Media kept as files: the bridge's store, what ships, and what the
   generated CSS and runtime make of a design that places pictures and videos. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { generateCss, generateRuntimeJs, shipArtifacts, writeArtifacts } from '../lib/codegen.mjs'
import { createFroamMediaApi, mediaNamesIn, shippedMediaNames, sniffMediaType, storeMediaBuffer } from '../lib/media-store.mjs'

const tests = []
const test = (name, fn) => tests.push([name, fn])

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const SVG = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 1"></svg>')
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)])
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'froam-media-'))

test('files are recognised by their bytes, not their names', () => {
  assert.equal(sniffMediaType(JPEG), 'jpg')
  assert.equal(sniffMediaType(PNG), 'png')
  assert.equal(sniffMediaType(SVG), 'svg')
  assert.equal(sniffMediaType(MP4), 'mp4')
  assert.equal(sniffMediaType(WEBM), 'webm')
  assert.equal(sniffMediaType(Buffer.from('<html><script>alert(1)</script>')), null, 'HTML is not media')
  assert.equal(sniffMediaType(Buffer.from('undefined')), null)
})

test('a file is stored once, under its content hash', () => {
  const dir = tempDir()
  const first = storeMediaBuffer(dir, JPEG)
  const again = storeMediaBuffer(dir, JPEG)
  assert.match(first.name, /^[a-f0-9]{32}\.jpg$/)
  assert.equal(first.ref, `froam-media:${first.name}`)
  assert.equal(again.name, first.name)
  assert.deepEqual(fs.readdirSync(path.join(dir, 'media')), [first.name])
})

test('what is not an image or video is refused', () => {
  assert.throws(() => storeMediaBuffer(tempDir(), Buffer.from('<html></html>')), /not an image or video/)
})

const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32), D = 'd'.repeat(32), E = 'e'.repeat(32)
const design = {
  version: 2,
  routes: {
    '/': {
      desktop: {
        'main:1/img:1': {
          imageUrl: `froam-media:${A}.webp`,
          media: JSON.stringify({ kind: 'image', method: 'baked', srcset: `froam-media:${A}.webp 420w, froam-media:${B}.webp 840w`, sizes: '420px', source: `froam-media:${C}.jpg`, fit: { mode: 'fill', aspect: 'frame', zoom: 1, x: 0.5, y: 0.5 } }),
          styles: { objectFit: 'cover' },
        },
        'main:1/section:1': { styles: { backgroundImage: `url("froam-media:${D}.gif")`, backgroundSize: '200% auto' } },
        '__froam_injection__:x': { text: JSON.stringify({ parentPath: 'main:1/section:2', parentId: 'gone-after-reload', order: 0, html: `<froam-backdrop data-froam-injected="true" data-froam-bg-video="true"><video data-froam-video="true" src="froam-media:${E}.webm" autoplay muted loop playsinline></video></froam-backdrop>` }) },
      },
    },
  },
}

test('every reference in a design is found; the originals kept for re-cropping do not ship', () => {
  assert.deepEqual([...mediaNamesIn(design)].sort(), [`${A}.webp`, `${B}.webp`, `${C}.jpg`, `${D}.gif`, `${E}.webm`].sort())
  const shipped = shippedMediaNames(design)
  assert.ok(shipped.has(`${A}.webp`) && shipped.has(`${B}.webp`) && shipped.has(`${D}.gif`) && shipped.has(`${E}.webm`))
  assert.ok(!shipped.has(`${C}.jpg`), 'the original stays in the workspace')
})

test('generated CSS loads media from beside itself', () => {
  const css = generateCss(design)
  assert.match(css, new RegExp(`background-image: url\\("media/${D}\\.gif"\\) !important;`))
  assert.doesNotMatch(css, /froam-media:/)
})

test('the runtime carries what shows, resolves it beside itself, and leaves the original out', () => {
  const js = generateRuntimeJs(design)
  new Function(js)
  assert.ok(js.includes(`${B}.webp 840w`), 'srcset ships')
  assert.ok(!js.includes(C), 'the original does not ship')
  assert.match(js, /new URL\('media\/'/)
  assert.match(js, /function applyImage/)
  assert.match(js, /setAttr\(sources\[s\], 'srcset'/, 'a <picture>\'s sources are pointed at the new image')
  assert.match(js, /prefers-reduced-motion/)
  assert.match(js, /mediaUrl\(blocks\[i\]\.html/)
  // A block's parent is found by path when its session id is gone.
  assert.ok(js.includes('(blocks[i].parentId && root.querySelector(') && js.includes('|| (blocks[i].parentPath === ROOT_PARENT_KEY'))
})

test('saving ships the shown media next to the CSS and runtime', () => {
  const root = tempDir()
  const froamDir = path.join(root, 'froam')
  const shipDir = path.join(root, 'public', 'froam')
  fs.mkdirSync(path.join(froamDir, 'media'), { recursive: true })
  for (const name of [`${A}.webp`, `${B}.webp`, `${C}.jpg`, `${D}.gif`, `${E}.webm`]) fs.writeFileSync(path.join(froamDir, 'media', name), 'x')
  writeArtifacts(froamDir, design)
  shipArtifacts(froamDir, shipDir, design)
  const shipped = fs.readdirSync(path.join(shipDir, 'media')).sort()
  assert.deepEqual(shipped, [`${A}.webp`, `${B}.webp`, `${D}.gif`, `${E}.webm`].sort())
})

async function withBridge(fn) {
  const dir = tempDir()
  const send = (res, status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)) }
  const api = createFroamMediaApi({ getFroamDir: () => dir, send })
  const server = http.createServer(async (req, res) => { if (!(await api(req, res, req.url.split('?')[0]))) send(res, 404, { success: false }) })
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    await fn(`http://127.0.0.1:${server.address().port}`, dir)
  } finally {
    server.close()
  }
}

test('the bridge stores an upload and serves it back, in ranges for video seeking', () => withBridge(async (base) => {
  const body = Buffer.concat([MP4, Buffer.alloc(1000, 7)])
  const stored = await (await fetch(`${base}/__froam/media`, { method: 'POST', body })).json()
  assert.equal(stored.success, true)
  assert.match(stored.ref, /^froam-media:[a-f0-9]{32}\.mp4$/)
  const whole = await fetch(`${base}${stored.url}`)
  assert.equal(whole.headers.get('content-type'), 'video/mp4')
  assert.match(whole.headers.get('cache-control'), /immutable/)
  assert.equal((await whole.arrayBuffer()).byteLength, body.length)
  const slice = await fetch(`${base}${stored.url}`, { headers: { range: 'bytes=10-19' } })
  assert.equal(slice.status, 206)
  assert.equal(slice.headers.get('content-range'), `bytes 10-19/${body.length}`)
  assert.equal((await slice.arrayBuffer()).byteLength, 10)
}))

test('the bridge refuses what is not media, and never serves outside its folder', () => withBridge(async (base) => {
  const refused = await fetch(`${base}/__froam/media`, { method: 'POST', body: 'undefined' })
  assert.equal(refused.status, 400)
  assert.equal((await fetch(`${base}/__froam/media/..%2F..%2Fetc%2Fpasswd`)).status, 404)
  assert.equal((await fetch(`${base}/__froam/media/probe`)).headers.get('content-type'), 'application/json')
}))

test('an SVG served on its own cannot run script', () => withBridge(async (base) => {
  const stored = await (await fetch(`${base}/__froam/media`, { method: 'POST', body: SVG })).json()
  const response = await fetch(`${base}${stored.url}`)
  assert.equal(response.headers.get('content-type'), 'image/svg+xml')
  assert.match(response.headers.get('content-security-policy'), /sandbox/)
}))

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`) }
  catch (error) { console.error(`✗ ${name}`); throw error }
}
console.log(`\n${passed}/${tests.length} media tests passed`)
