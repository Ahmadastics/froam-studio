import { performance } from 'node:perf_hooks'
import { scanDomTree } from '../dist/project/scan.js'
import { profileIntelligence } from '../dist/project/performance.js'
import { observeResponsiveState } from '../dist/project/responsive.js'

class Element {
  constructor(tag = 'div', index = 0) { this.tagName = tag.toUpperCase(); this.id = ''; this.className = index % 5 === 0 ? 'card' : ''; this.textContent = index % 5 === 0 ? `Card ${index}` : ''; this.parentElement = null; this.children = []; this.dataset = {}; this.attributes = new Map(); this.idIndex = new Map(); this.tabIndex = -1; this.onclick = null; this.style = {}; this.rect = { x: 0, y: index * 48, left: 0, top: index * 48, width: 960, height: 40, right: 960, bottom: index * 48 + 40 }; this.scrollWidth = 960; this.clientWidth = 960; this.scrollHeight = 40; this.clientHeight = 40 }
  append(child) { child.parentElement = this; this.children.push(child) }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'data-froam-id') { this.dataset.froamId = String(value); let root = this; while (root.parentElement) root = root.parentElement; root.idIndex.set(String(value), this) } }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  hasAttribute(name) { return this.attributes.has(name) }
  getBoundingClientRect() { return this.rect }
  matches() { return false }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)) }
  closest(selector) { let node = this; while (node) { if (selector === '[data-chef-editor-root]' && node.hasAttribute('data-chef-editor-root')) return node; node = node.parentElement } return null }
  querySelector(selector) { const match = selector.match(/^\[data-froam-id="(.+)"\]$/); if (match) return this.idIndex.get(match[1]) ?? null; return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector) { const found = []; const visit = (node) => { for (const child of node.children) { if (selector === '*' || selector === child.tagName.toLowerCase() || selector === `[data-froam-id="${child.dataset.froamId}"]`) found.push(child); visit(child) } }; visit(this); return found }
}
globalThis.HTMLElement = Element; globalThis.CSS = { escape: String }; globalThis.window = { getComputedStyle: () => ({ display: 'block', position: 'static', width: '960px', height: '40px', minWidth: '0px', maxWidth: 'none', minHeight: '0px', maxHeight: 'none', flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'normal', alignItems: 'normal', gridTemplateColumns: 'none', gridTemplateRows: 'none', gap: '8px', margin: '0px', padding: '8px', overflow: 'visible', overflowX: 'visible', overflowY: 'visible', color: 'rgb(0,0,0)', backgroundColor: 'rgb(255,255,255)', backgroundImage: 'none', fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', lineHeight: '24px', letterSpacing: '0px', border: '0 none', borderRadius: '0px', boxShadow: 'none', opacity: '1', transition: 'none', animation: 'none', visibility: 'visible', outline: 'none' }) }; globalThis.getComputedStyle = globalThis.window.getComputedStyle

function tree(size) { const root = new Element('main', 0); const queue = [root]; let count = 1; while (count < size) { const parent = queue.shift(); for (let child = 0; child < 8 && count < size; child += 1) { const element = new Element(count % 13 === 0 ? 'button' : 'div', count++); parent.append(element); queue.push(element) } } return root }
function state(bundle) { return { legacyStore: {}, nodes: Object.fromEntries(bundle.nodes.map((item) => [item.id, item])), relations: Object.fromEntries(bundle.relations.map((item) => [item.id, item])), flows: {}, interactions: {}, dna: {}, assets: {}, scans: Object.fromEntries(bundle.records.map((item) => [item.id, item])), archive: {}, analyses: {}, responsive: {} } }

const results = []
for (const size of [500, 1000, 5000]) { const root = tree(size); const start = performance.now(); const bundle = scanDomTree(root, {}, { routeKey: '/', viewport: 'desktop', maxNodes: size, now: 1 }); const scanMs = performance.now() - start; results.push({ ...profileIntelligence({ records: bundle.records, state: state(bundle), scanMs, cinema: () => observeResponsiveState(root, bundle.registry, {}, 960) }), memoryBytes: process.memoryUsage().heapUsed }) }
console.log(JSON.stringify({ environment: { node: process.version, platform: process.platform, architecture: process.arch }, results }, null, 2))
