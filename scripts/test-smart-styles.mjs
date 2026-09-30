/**
 * Smart Quick Edits (src/editor/smart-styles.ts): the numbers behind them —
 * contrast that really passes WCAG on the background it sits on, a fluid size
 * that lands exactly on its phone and desktop sizes, gradients and glows in
 * the site's own colour — and the phrases that reach each one.
 */
import assert from 'node:assert/strict'

const { smartStyleEdit, smartEditFor, readableShade } = await import('../dist/editor/smart-styles.js')
const { contrast, parseColor } = await import('../dist/editor/library/site-theme.js')
const { explainLocalFroamIntent } = await import('../dist/editor/froam-intent-model.js')

const tests = []
const test = (name, fn) => tests.push([name, fn])
const color = (value) => parseColor(value)
const ratioOf = (fg, bg) => contrast(color(fg), color(bg))
const hueOf = (hex) => {
  const { r, g, b } = color(hex)
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B); const min = Math.min(R, G, B); const d = max - min
  if (!d) return 0
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return h * 60
}
const valueOf = (edit, property) => edit.changes.find((change) => change.property === property)?.value
const heading = (visual = {}, page = {}) => ({ visual: { color: 'rgb(148, 163, 184)', fontSize: '48px', fontWeight: '700', backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '0px', ...visual }, layout: {}, tag: 'h2', page: { behind: '#ffffff', accent: '#2563eb', text: true, tag: 'h2', ...page } })
const paragraph = (visual = {}, page = {}) => ({ visual: { color: 'rgb(148, 163, 184)', fontSize: '16px', fontWeight: '400', backgroundColor: 'rgba(0, 0, 0, 0)', ...visual }, layout: {}, tag: 'p', page: { behind: '#ffffff', accent: '#2563eb', text: true, tag: 'p', ...page } })
const button = (visual = {}, page = {}) => ({ visual: { color: 'rgb(255, 255, 255)', fontSize: '16px', backgroundColor: 'rgb(17, 24, 39)', borderRadius: '10px', ...visual }, layout: { padding: '12px 18px' }, tag: 'button', page: { surface: '#111827', behind: '#ffffff', accent: '#2563eb', text: false, tag: 'button', ...page } })

test('each phrase reaches its edit — and plain edits stay plain', () => {
  const cases = [
    ['Fix the contrast', 'contrast'], ['Give it more contrast', 'contrast'], ['make it legible', 'contrast'],
    ['Make the size fluid', 'fluid'], ['responsive font size', 'fluid'], ['scale with the screen', 'fluid'],
    ['Make it frosted glass', 'glass'], ['glassmorphism please', 'glass'],
    ['Add a gradient in the brand colour', 'gradient'], ['gradient text', 'gradient'],
    ['Make it glow in the brand colour', 'glow'], ['neon', 'glow'],
    ['Balance the lines', 'balance'], ['no orphans', 'balance'],
    ['Match the others like it', 'match'], ['make it consistent', 'match'],
    ['Use the brand colour', 'brand'], ['make it on-brand', 'brand'], ['in our brand color', 'brand'],
    ['Make it pop', 'pop'],
  ]
  for (const [phrase, id] of cases) assert.equal(smartEditFor(phrase), id, phrase)
  for (const phrase of ['Make the text bolder', 'Add more space', 'Set font size to 24px', 'Make it rounder']) assert.equal(smartEditFor(phrase), null, phrase)
})

test('Fix the contrast: grey body text on white comes out passing AA, in the same hue', () => {
  const edit = smartStyleEdit('Fix the contrast', paragraph())
  const next = valueOf(edit, 'color')
  assert.ok(ratioOf('#94a3b8', '#ffffff') < 4.5, 'the fixture starts failing')
  assert.ok(ratioOf(next, '#ffffff') >= 4.5, `${next} is ${ratioOf(next, '#ffffff')}:1`)
  assert.ok(Math.abs(hueOf(next) - hueOf('#94a3b8')) < 8, `hue moved from ${hueOf('#94a3b8')} to ${hueOf(next)}`)
  assert.match(edit.note, /→ .*passes WCAG AA/)
})

test('Fix the contrast: large headings only need 3:1, and get no darker than that', () => {
  const edit = smartStyleEdit('Fix the contrast', heading({ color: 'rgb(203, 213, 225)' }))
  const next = valueOf(edit, 'color')
  const reached = ratioOf(next, '#ffffff')
  assert.ok(reached >= 3 && reached < 4.5, `a large heading went to ${reached}:1`)
  assert.match(edit.note, /AA for large text/)
})

test('Fix the contrast: already AA goes to AAA; already AAA says so and changes nothing', () => {
  const aa = smartStyleEdit('Fix the contrast', paragraph({ color: 'rgb(100, 116, 139)' }))
  assert.ok(ratioOf(valueOf(aa, 'color'), '#ffffff') >= 7)
  assert.match(aa.note, /AAA/)
  const aaa = smartStyleEdit('Fix the contrast', paragraph({ color: 'rgb(15, 23, 42)' }))
  assert.deepEqual(aaa.changes, [])
  assert.match(aaa.note, /Already easy to read/)
})

test('Fix the contrast: measured against its own fill — dark text on a dark button turns light', () => {
  const edit = smartStyleEdit('Fix the contrast', button({ color: 'rgb(31, 41, 55)' }))
  assert.ok(ratioOf(valueOf(edit, 'color'), '#111827') >= 4.5)
})

test('Fix the contrast: over a photo, a soft shadow behind the letters instead of a guess', () => {
  const edit = smartStyleEdit('Fix the contrast', heading({ color: 'rgb(255, 255, 255)' }, { overImage: true, behind: undefined }))
  assert.deepEqual(edit.changes.map(({ property }) => property), ['textShadow'])
  assert.match(edit.note, /photo/)
})

test('Fix the contrast: over a gradient, it passes against every one of its colours', () => {
  const stops = ['#bfe0f5', '#f6c9a4']
  const edit = smartStyleEdit('Fix the contrast', paragraph({ color: 'rgb(255, 255, 255)' }, { overImage: true, imageKind: 'gradient', behindStops: stops, behind: '#dad5cc' }))
  const next = valueOf(edit, 'color')
  for (const stop of stops) assert.ok(ratioOf(next, stop) >= 4.5, `${next} on ${stop} is ${ratioOf(next, stop).toFixed(2)}:1`)
  assert.match(edit.note, /against every colour of the gradient/)
  const onPhoto = smartStyleEdit('Fix the contrast', paragraph({ color: 'rgb(255, 255, 255)' }, { overImage: true, imageKind: 'photo', behind: undefined }))
  assert.deepEqual(onPhoto.changes.map(({ property }) => property), ['textShadow'])
})

test('Fluid size: exactly its phone size at 375px and its desktop size at 1440px', () => {
  const edit = smartStyleEdit('Make the size fluid', heading())
  const value = valueOf(edit, 'fontSize')
  const match = value.match(/^clamp\(([\d.]+)rem, (-?[\d.]+)rem \+ ([\d.]+)vw, ([\d.]+)rem\)$/)
  assert.ok(match, value)
  const [min, intercept, vw, max] = match.slice(1).map(Number)
  const at = (width) => Math.min(max * 16, Math.max(min * 16, intercept * 16 + (vw / 100) * width))
  assert.equal(max * 16, 48)
  assert.equal(min * 16, 30)
  assert.ok(Math.abs(at(375) - 30) < 0.1, `${at(375)}px on a phone`)
  assert.ok(Math.abs(at(1440) - 48) < 0.1, `${at(1440)}px on a wide screen`)
  assert.ok(at(900) > 30 && at(900) < 48)
})

test('Fluid size: body text is left at one size, and says why', () => {
  const edit = smartStyleEdit('Make the size fluid', paragraph())
  assert.deepEqual(edit.changes, [])
  assert.match(edit.note, /body text/)
})

test('Frosted glass is tuned to what is behind it', () => {
  const onLight = smartStyleEdit('Make it frosted glass', button({ backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '0px' }, { surface: undefined, behind: '#f8fafc', radius: '14px' }))
  const onDark = smartStyleEdit('Make it frosted glass', button({ backgroundColor: 'rgba(0, 0, 0, 0)' }, { surface: undefined, behind: '#0b0f14' }))
  assert.equal(valueOf(onLight, 'backgroundColor'), 'rgba(255, 255, 255, 0.55)')
  assert.equal(valueOf(onDark, 'backgroundColor'), 'rgba(255, 255, 255, 0.08)')
  for (const edit of [onLight, onDark]) {
    assert.match(valueOf(edit, 'backdropFilter'), /blur\(16px\)/)
    assert.equal(valueOf(edit, 'WebkitBackdropFilter'), valueOf(edit, 'backdropFilter'))
  }
  assert.equal(valueOf(onLight, 'borderRadius'), '14px', 'square corners get the site’s radius')
  assert.equal(valueOf(onDark, 'borderRadius'), undefined, 'existing corners are kept')
})

test('Brand gradient on text: the site’s colour, clipped to the letters, readable on the page', () => {
  const edit = smartStyleEdit('Add a gradient in the brand colour', heading())
  assert.equal(valueOf(edit, 'WebkitBackgroundClip'), 'text')
  assert.equal(valueOf(edit, 'backgroundClip'), 'text')
  assert.equal(valueOf(edit, 'WebkitTextFillColor'), 'transparent')
  const stops = valueOf(edit, 'backgroundImage').match(/#[0-9a-f]{6}/g)
  assert.equal(stops[0], '#2563eb')
  for (const stop of stops) assert.ok(ratioOf(stop, '#ffffff') >= 3, `${stop} on white`)
  assert.match(edit.note, /brand colour #2563eb/)
})

test('Brand gradient: a pale brand colour is deepened until it reads', () => {
  const edit = smartStyleEdit('Add a gradient in the brand colour', heading({}, { accent: '#facc15' }))
  for (const stop of valueOf(edit, 'backgroundImage').match(/#[0-9a-f]{6}/g)) assert.ok(ratioOf(stop, '#ffffff') >= 3, `${stop} on white`)
  assert.match(edit.note, /deepened/)
})

test('Brand gradient on a button: a gradient fill with text that reads on it', () => {
  const edit = smartStyleEdit('gradient', button())
  assert.match(valueOf(edit, 'backgroundImage'), /^linear-gradient\(135deg, #2563eb, #[0-9a-f]{6}\)$/)
  assert.equal(valueOf(edit, 'WebkitBackgroundClip'), undefined)
  assert.ok(valueOf(edit, 'color'))
})

test('Brand glow: a text glow on words, a halo on boxes, in the brand colour', () => {
  const text = smartStyleEdit('Make it glow in the brand colour', heading())
  const box = smartStyleEdit('Make it glow in the brand colour', button())
  assert.match(valueOf(text, 'textShadow'), /rgba\(37, 99, 235,/)
  assert.match(valueOf(box, 'boxShadow'), /rgba\(37, 99, 235,/)
  assert.equal(valueOf(text, 'boxShadow'), undefined)
})

test('Balance the lines: headings balance, paragraphs wrap pretty', () => {
  assert.equal(valueOf(smartStyleEdit('Balance the lines', heading()), 'textWrap'), 'balance')
  assert.equal(valueOf(smartStyleEdit('Balance the lines', paragraph()), 'textWrap'), 'pretty')
})

test('Match the others: takes what its look-alikes share, each in its own domain', () => {
  const edit = smartStyleEdit('Match the others like it', button({}, { lookAlikes: { count: 3, noun: 'button', styles: { borderRadius: '999px', padding: '14px 22px', fontWeight: '600' } } }))
  assert.deepEqual(Object.fromEntries(edit.changes.map(({ property, domain }) => [property, domain])), { borderRadius: 'visual', padding: 'spacing', fontWeight: 'typography' })
  assert.match(edit.note, /3 other buttons like it: corners, padding, weight/)
  const alone = smartStyleEdit('Match the others like it', button())
  assert.deepEqual(alone.changes, [])
  assert.match(alone.note, /Nothing else on the page looks like it/)
})

test('Brand colour: text deepened to pass, a button filled with readable ink', () => {
  const text = smartStyleEdit('Use the brand colour', paragraph({}, { accent: '#facc15' }))
  assert.ok(ratioOf(valueOf(text, 'color'), '#ffffff') >= 4.5)
  assert.match(text.note, /deepened to #[0-9a-f]{6}/)
  const filled = smartStyleEdit('Use the brand colour', button())
  assert.equal(valueOf(filled, 'backgroundColor'), '#2563eb')
  assert.ok(ratioOf(valueOf(filled, 'color'), '#2563eb') >= 4.5)
})

test('Make it pop is smart only with a brand colour and a box; otherwise the plain shadow edit does it', () => {
  assert.match(valueOf(smartStyleEdit('Make it pop', button()), 'boxShadow'), /rgba\(37, 99, 235, 0.6\)/)
  assert.equal(smartStyleEdit('Make it pop', heading()), null)
  assert.equal(smartStyleEdit('Make it pop', button({}, { accent: undefined })), null)
})

test('without page context the edits still work, from the element alone', () => {
  const bare = { visual: { color: 'rgb(148, 163, 184)', fontSize: '16px', backgroundColor: 'rgba(0, 0, 0, 0)' }, layout: {}, tag: 'p' }
  assert.ok(ratioOf(valueOf(smartStyleEdit('Fix the contrast', bare), 'color'), '#ffffff') >= 4.5)
  assert.ok(smartStyleEdit('glow', bare).changes.length)
  assert.doesNotMatch(smartStyleEdit('glow', bare).note, /brand colour/, 'no brand colour was read, so none is claimed')
})

test('readableShade stays as close to the original as the target allows', () => {
  const shade = readableShade(color('#94a3b8'), color('#ffffff'), 4.55)
  const one = readableShade(color('#94a3b8'), color('#ffffff'), 4.8)
  assert.ok(ratioOf('#' + [shade.r, shade.g, shade.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''), '#ffffff') < 5.2, 'overshot the target')
  assert.ok(contrast(one, color('#ffffff')) >= 4.8)
})

test('Try again gives a different take each time — and every take still reads well', () => {
  for (const [intent, subject, property] of [
    ['Add a gradient in the brand colour', heading(), 'backgroundImage'],
    ['Make it glow in the brand colour', button(), 'boxShadow'],
    ['Make it frosted glass', button({ backgroundColor: 'rgba(0, 0, 0, 0)' }, { surface: undefined, behind: '#f8fafc' }), 'backdropFilter'],
    ['Make the size fluid', heading(), 'fontSize'],
    ['Make it pop', button(), 'boxShadow'],
  ]) {
    const takes = [1, 2, 3].map((take) => smartStyleEdit(intent, subject, take))
    assert.equal(new Set(takes.map((edit) => valueOf(edit, property))).size, 3, `${intent}: ${takes.map((edit) => valueOf(edit, property)).join(' | ')}`)
    assert.equal(valueOf(smartStyleEdit(intent, subject, 4), property), valueOf(takes[0], property), `${intent}: take 4 comes back round to take 1`)
  }
  for (const take of [1, 2, 3]) for (const stop of valueOf(smartStyleEdit('gradient', heading(), take), 'backgroundImage').match(/#[0-9a-f]{6}/g)) assert.ok(ratioOf(stop, '#ffffff') >= 3, `take ${take}: ${stop}`)
  assert.ok(ratioOf(valueOf(smartStyleEdit('Fix the contrast', paragraph(), 2), 'color'), '#ffffff') >= 7, 'the second take of a contrast fix aims for AAA')
})

test('Quick Edit explains a smart edit that has nothing to do', () => {
  const snapshot = { node: { id: 'h' }, dna: { schemaVersion: 1, nodeId: 'h', capturedAt: 1, visual: { color: 'rgb(15, 23, 42)', fontSize: '16px' }, structure: { tag: 'p' } }, page: { behind: '#ffffff', text: true, tag: 'p' }, routeKey: '/', viewport: 'desktop', path: 'p' }
  assert.match(explainLocalFroamIntent(snapshot, 'Fix the contrast'), /Already easy to read/)
  assert.equal(explainLocalFroamIntent(snapshot, 'Make it bolder'), null)
  assert.equal(explainLocalFroamIntent({ ...snapshot, dna: { ...snapshot.dna, visual: { color: 'rgb(148, 163, 184)', fontSize: '16px' } } }, 'Fix the contrast'), null)
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1 } catch (error) { console.error(`FAIL ${name}\n  ${error.message}`) }
}
console.log(`smart styles: ${passed}/${tests.length} passed`)
if (passed !== tests.length) process.exit(1)
