/* Image fit: the crop geometry behind "Fit your image", and the styles that
   make the element show the baked result the way it was previewed. */
import assert from 'node:assert/strict'
import {
  aspectRatioCss,
  clampFitState,
  cropRect,
  DEFAULT_IMAGE_FIT,
  enlargement,
  imageFitStyles,
  liveFitStyles,
  positionFor,
  shapeStyles,
  srcsetWidths,
  MAX_IMAGE_FIT_ZOOM,
  MAX_OUTPUT_EDGE,
  outputSize,
  panFit,
  resolveAspectRatio,
  slotSize,
  sourceRect,
  zoomFitAt,
} from '../dist/editor/image-fit.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} expected ${expected}, got ${actual}`)

const portrait = { width: 3000, height: 4000 }
const landscape = { width: 4000, height: 2000 }
const wideSlot = { width: 800, height: 400 }

test('the crop takes the shape of the slot and is as large as the image allows', () => {
  const ratio = resolveAspectRatio('frame', wideSlot, portrait)
  near(ratio, 2)
  const crop = cropRect(portrait, ratio, DEFAULT_IMAGE_FIT)
  near(crop.sw, 3000)
  near(crop.sh, 1500)
  near(crop.sx, 0)
  near(crop.sy, 1250, 'centred vertically')
})

test('an unmeasurable frame falls back to the image’s own shape', () => {
  near(resolveAspectRatio('frame', null, portrait), 0.75)
  near(resolveAspectRatio('frame', { width: 0, height: 300 }, portrait), 0.75)
  near(resolveAspectRatio('original', wideSlot, portrait), 0.75)
  near(resolveAspectRatio('16:9', wideSlot, portrait), 16 / 9)
})

test('the crop never leaves the image, wherever the focus is asked to go', () => {
  for (const [x, y] of [[-3, -3], [5, 5], [0, 1], [Number.NaN, 0.5]]) {
    const crop = cropRect(portrait, 2, { zoom: 2, x, y })
    assert.ok(crop.sx >= -1e-9 && crop.sy >= -1e-9, `inside at ${x},${y}`)
    assert.ok(crop.sx + crop.sw <= portrait.width + 1e-9 && crop.sy + crop.sh <= portrait.height + 1e-9, `inside at ${x},${y}`)
  }
})

test('zoom is held between 1 and the maximum', () => {
  near(clampFitState(portrait, 1, { ...DEFAULT_IMAGE_FIT, zoom: 0.2 }).zoom, 1)
  near(clampFitState(portrait, 1, { ...DEFAULT_IMAGE_FIT, zoom: 99 }).zoom, MAX_IMAGE_FIT_ZOOM)
  near(cropRect(portrait, 1, { zoom: 2, x: 0.5, y: 0.5 }).sw, 1500)
})

test('dragging moves the picture with the pointer', () => {
  // Preview 400px wide showing a 3000px-wide crop: 1 screen px = 7.5 image px.
  const start = { ...DEFAULT_IMAGE_FIT, zoom: 1 }
  const down = panFit(portrait, 2, start, 0, 40, 400)
  // Dragging down shows more of the top: the crop moves up by 40 × 7.5 px.
  near(cropRect(portrait, 2, down).sy, 1250 - 300)
  // Sideways there is nothing more to show at zoom 1.
  near(panFit(portrait, 2, start, 120, 0, 400).x, 0.5)
})

test('zooming keeps the point under the pointer where it is', () => {
  const start = { ...DEFAULT_IMAGE_FIT }
  const before = cropRect(landscape, 1, start)
  const px = 0.25
  const py = 0.75
  const pointBefore = [before.sx + px * before.sw, before.sy + py * before.sh]
  const zoomed = zoomFitAt(landscape, 1, start, 2, px, py)
  const after = cropRect(landscape, 1, zoomed)
  near(after.sx + px * after.sw, pointBefore[0], 'x stays')
  near(after.sy + py * after.sh, pointBefore[1], 'y stays')
  near(zoomed.zoom, 2)
})

test('fit mode bakes the whole image', () => {
  const rect = sourceRect(portrait, 2, { ...DEFAULT_IMAGE_FIT, mode: 'fit', zoom: 3 })
  assert.deepEqual(rect, { sx: 0, sy: 0, sw: 3000, sh: 4000 })
})

test('the baked image is sized for the slot, never upscaled, never huge', () => {
  // A 3000×1500 crop for an 800×400 slot: 2× the slot is under the floor, so 1600 wide.
  assert.deepEqual(outputSize({ width: 3000, height: 1500 }, wideSlot), { width: 1600, height: 800 })
  // A big slot asks for 2×, capped.
  const big = outputSize({ width: 8000, height: 4000 }, { width: 1600, height: 800 })
  assert.equal(big.width, MAX_OUTPUT_EDGE)
  // A small source is left at its own size.
  assert.deepEqual(outputSize({ width: 640, height: 320 }, wideSlot), { width: 640, height: 320 })
})

test('a new shape keeps the slot’s width and changes its height', () => {
  assert.deepEqual(slotSize(wideSlot, 'frame', 2), wideSlot)
  assert.deepEqual(slotSize(wideSlot, '1:1', 1), { width: 800, height: 800 })
  assert.equal(slotSize(null, '1:1', 1), null)
})

test('a crop smaller than its slot reports that it will be enlarged', () => {
  const small = { width: 600, height: 300 }
  assert.ok(enlargement(small, 2, DEFAULT_IMAGE_FIT, wideSlot) > 1)
  assert.ok(enlargement(portrait, 2, DEFAULT_IMAGE_FIT, wideSlot) < 1)
  // Zooming in on a big image eventually makes it soft too.
  assert.ok(enlargement(portrait, 2, { ...DEFAULT_IMAGE_FIT, zoom: 5 }, { width: 1600, height: 800 }) > 1)
})

test('a picked shape becomes an aspect-ratio; the frame shape changes nothing', () => {
  assert.equal(aspectRatioCss('frame', portrait), null)
  assert.equal(aspectRatioCss('16:9', portrait), '16 / 9')
  assert.equal(aspectRatioCss('original', { width: 3000.4, height: 4000 }), '3000 / 4000')
})

test('styles for an <img>: cover or contain, and a new shape when one was picked', () => {
  const fill = imageFitStyles({ kind: 'img', state: DEFAULT_IMAGE_FIT, url: 'data:image/jpeg;base64,x', aspectCss: null })
  assert.deepEqual(fill, { objectFit: 'cover', objectPosition: '50% 50%' })
  const square = imageFitStyles({ kind: 'img', state: DEFAULT_IMAGE_FIT, url: 'x', aspectCss: '1 / 1' })
  assert.equal(square.aspectRatio, '1 / 1')
  assert.equal(square.height, 'auto')
  assert.equal(square.minHeight, '0px')
  // Fit keeps an auto-height <img> in its measured shape instead of taking the photo's.
  const fit = imageFitStyles({ kind: 'img', state: { ...DEFAULT_IMAGE_FIT, mode: 'fit' }, url: 'x', aspectCss: null, frameRatio: 2 })
  assert.equal(fit.objectFit, 'contain')
  assert.equal(fit.aspectRatio, '2')
  assert.equal(fit.height, undefined, 'a height the site sets is left alone')
})

test('styles for a background: the baked url, centred, no tiling', () => {
  const styles = imageFitStyles({ kind: 'background', state: DEFAULT_IMAGE_FIT, url: 'data:image/jpeg;base64,abc', aspectCss: null })
  assert.deepEqual(styles, {
    backgroundImage: 'url("data:image/jpeg;base64,abc")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  })
  const frame = imageFitStyles({ kind: 'background', state: { ...DEFAULT_IMAGE_FIT, mode: 'fit' }, url: 'u', aspectCss: '4 / 5', isImageFrame: true })
  assert.equal(frame.backgroundSize, 'contain')
  assert.equal(frame.minHeight, '0px', 'the placeholder cannot hold the frame open')
  const section = imageFitStyles({ kind: 'background', state: DEFAULT_IMAGE_FIT, url: 'u', aspectCss: '4 / 5' })
  assert.equal(section.minHeight, undefined, 'a section with copy may still grow to fit it')
})

test('srcset widths cover the slot at 1×, 1.5× and 2×, never past the crop, no near-duplicates', () => {
  assert.deepEqual(srcsetWidths(3000, { width: 420, height: 236 }, 1600), [420, 630, 840, 1600])
  assert.deepEqual(srcsetWidths(700, { width: 420, height: 236 }, 700), [420, 630, 700].filter((w, i, all) => i === 0 || w > all[i - 1] * 1.15))
  assert.ok(srcsetWidths(5000, { width: 1800, height: 900 }, 2560).every((width) => width <= MAX_OUTPUT_EDGE))
})

test('a cover position puts the visible part where the crop asked', () => {
  near(positionFor(0.5, 0.4), 0.5, 'centred')
  near(positionFor(0.2, 0.4), 0, 'clamped at the start')
  near(positionFor(0.8, 0.4), 1, 'clamped at the end')
  near(positionFor(0.6, 1), 0.5, 'nothing to move when all of it shows')
})

test('live fill on a background: zoom becomes background-size, the crop centre its position', () => {
  const image = { width: 1600, height: 900 }
  const slot = { width: 800, height: 450 }
  const styles = liveFitStyles({ kind: 'background', state: { ...DEFAULT_IMAGE_FIT, zoom: 2, x: 0.25, y: 0.5 }, image, slot, url: 'froam-media:x.gif', aspectCss: null })
  assert.equal(styles.backgroundImage, 'url("froam-media:x.gif")')
  assert.equal(styles.backgroundSize, '200% auto')
  // Half of the image shows; its centre at 25% puts the left edge at 0.
  assert.equal(styles.backgroundPosition, '0% 50%')
})

test('live fill on a page <img>: no zoom, and the slot keeps its shape', () => {
  const styles = liveFitStyles({ kind: 'element', state: { ...DEFAULT_IMAGE_FIT, zoom: 3, x: 0.9 }, image: { width: 400, height: 200 }, slot: { width: 420, height: 236 }, aspectCss: null, frameRatio: 420 / 236 })
  assert.equal(styles.objectFit, 'cover')
  assert.equal(styles.transform, undefined, 'a page element is never transformed')
  assert.equal(styles.aspectRatio, String(Math.round((420 / 236) * 10000) / 10000), 'an SVG of another shape must not reshape the card')
})

test('live fill inside a Froam frame zooms by scaling around the crop', () => {
  const styles = liveFitStyles({ kind: 'contained', state: { ...DEFAULT_IMAGE_FIT, zoom: 2 }, image: { width: 1600, height: 900 }, slot: { width: 800, height: 450 }, aspectCss: null })
  assert.equal(styles.transform, 'scale(2)')
  assert.equal(styles.transformOrigin, '50% 50%')
  const reset = liveFitStyles({ kind: 'contained', state: DEFAULT_IMAGE_FIT, image: { width: 1600, height: 900 }, slot: { width: 800, height: 450 }, aspectCss: null })
  assert.equal(reset.transform, '', 'zooming back out clears the scale')
})

test('a picked shape for a box', () => {
  assert.deepEqual(shapeStyles(null, true), {})
  assert.deepEqual(shapeStyles('16 / 9', true), { aspectRatio: '16 / 9', height: 'auto', minHeight: '0px' })
  assert.deepEqual(shapeStyles('16 / 9', false), { aspectRatio: '16 / 9', height: 'auto' })
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`) }
  catch (error) { console.error(`✗ ${name}`); throw error }
}
console.log(`\n${passed}/${tests.length} image-fit tests passed`)
