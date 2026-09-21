/**
 * End-to-end audit demo: DOM → scan → profile → judge → report.
 *
 * Runs the whole Tier 1 pipeline against a deliberately flawed page so the
 * output has something to say. Not part of `npm test` — this is the surface a
 * reader sees, and it exists to be looked at.
 *
 *   node scripts/demo-audit.mjs
 */
import { scanDomTree } from '../dist/project/scan.js'
import { buildPageProfile } from '../dist/project/page-profile.js'
import { judgePage, formatJudgeReport } from '../dist/project/judge.js'

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
  closest() { return null }
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

/**
 * A page with problems a real audit should find: grey-on-white body copy that
 * fails AA, a 19px off-grid gutter, five one-off type sizes, a tap target under
 * the 24px minimum, and the brand red used as a decorative badge.
 */
function flawedPage() {
  const root = new Element('main', { style: { backgroundColor: 'rgb(255, 255, 255)', padding: '19px' }, rect: { x: 0, y: 0, width: 1200, height: 2400 } })

  const hero = root.append(new Element('section', { style: { padding: '19px', gap: '19px' }, rect: { x: 0, y: 0, width: 1200, height: 700 } }))
  hero.append(new Element('h1', { text: 'Run errands without the wahala', style: { fontSize: '33px', fontWeight: '700', lineHeight: '38px' }, rect: { x: 0, y: 40, width: 1100, height: 60 } }))
  hero.append(new Element('p', {
    text: 'C'.repeat(150),
    // #9a9a9a on white is 2.6:1 — below the 4.5:1 AA floor for body copy.
    style: { fontSize: '15px', lineHeight: '22px', color: 'rgb(154, 154, 154)' },
    rect: { x: 0, y: 130, width: 1100, height: 48 },
  }))
  hero.append(new Element('button', {
    text: 'Post a task', focusable: true,
    style: { backgroundColor: 'rgb(230, 57, 70)', color: 'rgb(255, 255, 255)', fontSize: '17px', fontWeight: '700', padding: '13px', borderRadius: '7px' },
    rect: { x: 0, y: 220, width: 160, height: 40 },
  }))
  // Under the WCAG 2.5.8 minimum.
  hero.append(new Element('a', { text: 'skip', focusable: true, style: { fontSize: '13px' }, rect: { x: 200, y: 230, width: 30, height: 18 } }))

  const features = root.append(new Element('section', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '19px', padding: '23px' }, rect: { x: 0, y: 700, width: 1200, height: 900 } }))
  for (let index = 0; index < 3; index += 1) {
    const card = features.append(new Element('div', {
      className: 'card',
      // Instances of one family disagreeing on padding.
      style: { backgroundColor: 'rgb(250, 250, 250)', padding: `${17 + index * 9}px`, borderRadius: `${5 + index * 4}px` },
      rect: { x: index * 400, y: 800, width: 360, height: 240 },
    }))
    card.append(new Element('h3', { text: `Feature ${index}`, style: { fontSize: `${21 + index * 3}px`, fontWeight: '700', lineHeight: '28px' }, rect: { x: index * 400, y: 820, width: 300, height: 30 } }))
  }

  const footer = root.append(new Element('footer', { style: { padding: '23px' }, rect: { x: 0, y: 1600, width: 1200, height: 700 } }))
  // The action colour used as decoration, which is what dilutes its meaning.
  footer.append(new Element('span', { text: 'New', style: { backgroundColor: 'rgb(230, 57, 70)', fontSize: '11px' }, rect: { x: 0, y: 1620, width: 60, height: 20 } }))
  footer.append(new Element('a', { text: 'Terms', focusable: true, style: { color: 'rgb(102, 102, 102)', fontSize: '14px' }, rect: { x: 100, y: 1620, width: 80, height: 32 } }))
  return root
}

const bundle = scanDomTree(flawedPage(), {}, { routeKey: '/', viewport: 'desktop', now: Date.now() })
const profile = buildPageProfile({ records: bundle.records, origin: 'https://demo.runam.space', routeKey: '/', viewport: 'desktop' })
const report = judgePage(profile)

console.log(formatJudgeReport(report))
console.log('')
console.log('── measured design system ──────────────────────────────')
console.log(`palette      ${profile.color.palette.slice(0, 6).map((entry) => `${entry.hex} ${entry.role}`).join('   ')}`)
console.log(`type scale   ${profile.type.scale.map((step) => step.px).join(', ')}px   ratio ${profile.type.ratio ?? 'none holds'}`)
console.log(`spacing      ${profile.space.base}px grid, ${(profile.space.adherence * 100).toFixed(0)}% adherence`)
console.log(`radii        ${profile.surface.radii.join(', ')}px`)
console.log(`flow         ${profile.flow.signature}`)
console.log(`targets      ${profile.interaction.targetSamples} measured, ${profile.interaction.undersizedTargets.length} undersized, smallest ${profile.interaction.smallestTargetPx}px`)
console.log(`coverage     ${profile.provenance.nodesRendered}/${profile.provenance.nodesObserved} nodes`)
