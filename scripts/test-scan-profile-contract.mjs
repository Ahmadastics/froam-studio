/**
 * Contract test: real scanDomTree output must flow into buildPageProfile.
 *
 * The profiler reads signal values by key — layout.rect, appearance.fontSize,
 * structure.childNodeIds. Nothing in the type system connects those strings to
 * what scan.ts actually emits, so a rename in either file would leave the
 * profiler silently reading undefined and reporting a confident, empty design.
 * That failure is invisible in unit tests on either side.
 *
 * The DOM shim here gives every node its own computed style, unlike the
 * performance benchmark's constant one — a page where every element is 960×40
 * Inter 16px has no design to measure.
 */
import assert from 'node:assert/strict'
import { scanDomTree, dnaFromScan } from '../dist/project/scan.js'
import { buildPageProfile } from '../dist/project/page-profile.js'
import { auditProfile } from '../dist/project/judge-deterministic.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

const DEFAULT_STYLE = {
  display: 'block', position: 'static', width: '100px', height: '40px',
  minWidth: '0px', maxWidth: 'none', minHeight: '0px', maxHeight: 'none',
  flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'normal', alignItems: 'normal',
  gridTemplateColumns: 'none', gridTemplateRows: 'none', gap: '0px',
  margin: '0px', padding: '0px', overflow: 'visible', overflowX: 'visible', overflowY: 'visible',
  color: 'rgb(17, 17, 17)', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none',
  fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', lineHeight: '24px', letterSpacing: '0px',
  border: '0px none', borderRadius: '0px', boxShadow: 'none', opacity: '1',
  transition: 'none', animation: 'none', visibility: 'visible', outline: 'none',
}

class Element {
  constructor(tag, options = {}) {
    this.tagName = tag.toUpperCase()
    this.id = options.id ?? ''
    this.className = options.className ?? ''
    this.textContent = options.text ?? ''
    this.innerText = options.text ?? ''
    this.parentElement = null
    this.children = []
    this.dataset = {}
    this.attributes = new Map()
    this.tabIndex = options.focusable ? 0 : -1
    this.onclick = null
    this.style = {}
    this.computed = { ...DEFAULT_STYLE, ...(options.style ?? {}) }
    const rect = options.rect ?? { x: 0, y: 0, width: 100, height: 40 }
    this.rect = { ...rect, left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height }
    this.scrollWidth = rect.width; this.clientWidth = rect.width
    this.scrollHeight = rect.height; this.clientHeight = rect.height
    this.scrollLeft = 0; this.scrollTop = 0
  }
  append(child) { child.parentElement = this; this.children.push(child); return child }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'data-froam-id') this.dataset.froamId = String(value) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  hasAttribute(name) { return this.attributes.has(name) }
  getBoundingClientRect() { return this.rect }
  matches() { return false }
  getAnimations() { return [] }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)) }
  closest(selector) {
    let node = this
    while (node) { if (selector === '[data-chef-editor-root]' && node.hasAttribute('data-chef-editor-root')) return node; node = node.parentElement }
    return null
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector) {
    const found = []
    const visit = (node) => { for (const child of node.children) { if (selector === '*' || selector === child.tagName.toLowerCase()) found.push(child); visit(child) } }
    visit(this)
    return found
  }
}

globalThis.HTMLElement = Element
globalThis.CSS = { escape: String }
globalThis.window = { getComputedStyle: (element) => element.computed }
globalThis.getComputedStyle = globalThis.window.getComputedStyle

/** A page with an actual design: 8px grid, 1.25 type scale, one accent on the CTA. */
function buildDom() {
  const root = new Element('main', { style: { backgroundColor: 'rgb(255, 255, 255)', padding: '32px' }, rect: { x: 0, y: 0, width: 1200, height: 2400 } })

  const hero = root.append(new Element('section', { style: { padding: '32px', gap: '24px', display: 'flex', flexDirection: 'column' }, rect: { x: 0, y: 0, width: 1200, height: 700 } }))
  hero.append(new Element('h1', { text: 'Run errands without the wahala', style: { fontSize: '31px', fontWeight: '700', lineHeight: '38px' }, rect: { x: 0, y: 40, width: 800, height: 60 } }))
  hero.append(new Element('p', { text: 'B'.repeat(80), style: { fontSize: '16px', lineHeight: '24px' }, rect: { x: 0, y: 130, width: 560, height: 48 } }))
  hero.append(new Element('button', {
    text: 'Post a task', focusable: true,
    style: { backgroundColor: 'rgb(230, 57, 70)', color: 'rgb(255, 255, 255)', fontSize: '16px', fontWeight: '700', padding: '16px', borderRadius: '8px' },
    rect: { x: 0, y: 220, width: 180, height: 48 },
  }))

  const features = root.append(new Element('section', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', padding: '32px' }, rect: { x: 0, y: 700, width: 1200, height: 900 } }))
  for (let index = 0; index < 3; index += 1) {
    const card = features.append(new Element('div', {
      className: 'card',
      style: { backgroundColor: 'rgb(250, 250, 250)', padding: '24px', borderRadius: '8px' },
      rect: { x: index * 400, y: 800, width: 360, height: 240 },
    }))
    card.append(new Element('h3', { text: `Feature ${index}`, style: { fontSize: '20px', fontWeight: '700', lineHeight: '28px' }, rect: { x: index * 400, y: 820, width: 300, height: 30 } }))
  }

  const footer = root.append(new Element('footer', { style: { padding: '32px' }, rect: { x: 0, y: 1600, width: 1200, height: 700 } }))
  footer.append(new Element('a', { text: 'Terms', focusable: true, style: { color: 'rgb(102, 102, 102)' }, rect: { x: 0, y: 1620, width: 80, height: 32 } }))
  return root
}

const scanned = () => {
  const root = buildDom()
  const bundle = scanDomTree(root, {}, { routeKey: '/', viewport: 'desktop', now: 1 })
  return { root, bundle, profile: buildPageProfile({ records: bundle.records, origin: 'https://contract.test', routeKey: '/', viewport: 'desktop' }) }
}

test('every scan record yields the signal kinds the profiler reads', () => {
  const { bundle } = scanned()
  const required = ['identity', 'structure', 'layout', 'appearance', 'semantics', 'behavior', 'responsive', 'accessibility']
  for (const record of bundle.records) {
    const kinds = new Set(record.signals.map((signal) => signal.kind))
    for (const kind of required) assert.ok(kinds.has(kind), `record ${record.node.nodeId} is missing the ${kind} signal`)
  }
})

test('the value keys the profiler reads are the ones scan emits', () => {
  const { bundle } = scanned()
  const record = bundle.records.find((item) => item.signals.find((signal) => signal.kind === 'semantics')?.values.role === 'cta')
    ?? bundle.records[0]
  const values = (kind) => record.signals.find((signal) => signal.kind === kind).values
  // Each assertion here is a key the profiler dereferences by name. A rename on
  // either side silently turns the corresponding profile axis into a default.
  assert.ok(values('layout').rect, 'layout.rect')
  assert.equal(typeof values('layout').padding, 'string', 'layout.padding')
  assert.equal(typeof values('layout').display, 'string', 'layout.display')
  assert.ok('gapPx' in values('layout'), 'layout.gapPx')
  assert.equal(typeof values('appearance').backgroundColor, 'string', 'appearance.backgroundColor')
  assert.equal(typeof values('appearance').fontSize, 'string', 'appearance.fontSize')
  assert.equal(typeof values('appearance').borderRadius, 'string', 'appearance.borderRadius')
  assert.ok('role' in values('semantics'), 'semantics.role')
  assert.ok('childNodeIds' in values('structure'), 'structure.childNodeIds')
  assert.ok('signature' in values('structure'), 'structure.signature')
  assert.ok('visible' in values('responsive'), 'responsive.visible')
  assert.ok(Array.isArray(values('accessibility').warnings), 'accessibility.warnings')
})

test('an end-to-end scan produces a populated profile, not a hollow one', () => {
  const { profile } = scanned()
  assert.ok(profile.provenance.nodesRendered > 8, `only ${profile.provenance.nodesRendered} nodes rendered`)
  assert.ok(profile.color.palette.length >= 3, 'palette came back empty — signals are not reaching the profiler')
  assert.ok(profile.type.scale.length >= 3, 'type scale came back empty')
  assert.ok(profile.space.scale.length > 0, 'spacing scale came back empty')
  assert.ok(profile.color.contrastSamples > 0, 'no text was evaluated for contrast')
  assert.ok(profile.components.length > 0, 'component families were not detected')
})

test('the design put into the DOM is the design that comes out', () => {
  const { profile } = scanned()
  assert.equal(profile.space.base, 8)
  assert.equal(profile.space.adherence, 1)
  assert.equal(profile.color.modeSignal, 'light')
  assert.equal(profile.color.palette.find((entry) => entry.role === 'surface').hex, '#ffffff')
  const accent = profile.color.palette.find((entry) => entry.role === 'accent')
  assert.ok(accent && accent.oklch.c > 0.1, 'the red CTA should surface as the accent')
  assert.deepEqual(profile.type.scale.map((step) => step.px), [16, 20, 31])
})

test('semantic roles survive the trip from scan heuristics into the profile', () => {
  const { profile } = scanned()
  const roles = new Set(profile.color.palette.flatMap((entry) => entry.appearsOn))
  assert.ok(roles.has('cta') || roles.has('button'), 'the button lost its role between scan and profile')
  assert.ok(profile.flow.sections.length >= 2, 'sections were not recovered from the DOM')
})

test('interactive targets are measured from real geometry', () => {
  const { profile } = scanned()
  assert.ok(profile.interaction.targetSamples >= 2, `expected the button and link, got ${profile.interaction.targetSamples}`)
  // 180×48 and 80×32 both clear the 24px minimum.
  assert.equal(profile.interaction.undersizedTargets.length, 0)
  assert.equal(profile.interaction.smallestTargetPx, 32)
})

test('a scanned page flows through to an audit without hitting a default path', () => {
  const { profile } = scanned()
  const audit = auditProfile(profile)
  assert.ok(audit.score > 0.5, `a coherent page should not audit at ${audit.score}`)
  for (const check of audit.checks) {
    assert.ok(Number.isFinite(check.score), `${check.id} produced a non-finite score`)
    assert.ok(check.score >= 0 && check.score <= 1, `${check.id} scored outside 0–1`)
  }
})

test('DNA projection still works alongside the profile', () => {
  const { bundle } = scanned()
  const dna = dnaFromScan(bundle.records[0])
  assert.equal(dna.nodeId, bundle.records[0].node.nodeId)
  assert.ok(dna.provenance._froamProjection, 'DNA provenance marker is missing')
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error.message}`)
  }
}
console.log(`\nscan→profile contract: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
