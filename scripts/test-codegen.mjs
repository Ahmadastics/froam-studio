/**
 * Codegen output must be valid, executable code.
 *
 * `froam.runtime.js` is the file every production page loads, and until now
 * nothing asserted that it parses. A single escaping fault in the template that
 * emits it — `/["\\]/g` collapsing to `/["\]/g`, a character class whose closing
 * bracket was escaped — made the entire file unparseable. The browser refused
 * to execute any of it, so `data-froam-route` was never set, the generated CSS
 * selectors never matched, and *nothing Froam produced reached a live page*.
 *
 * The full suite passed throughout. Every test checked that codegen returned a
 * string containing the right substrings; none checked that the string was
 * JavaScript. These do.
 */
import assert from 'node:assert/strict'
import { designRootScope, generateCss, generateRuntimeJs, mergeSave, migrateDesign } from '../lib/codegen.mjs'

const tests = []
const test = (name, fn) => tests.push([name, fn])

const design = (overrides = {}) => ({
  version: 3,
  updatedAt: '2026-09-23T00:00:00.000Z',
  routes: {
    '/': {
      desktop: {
        'section:1/h1:1': {
          styles: { fontSize: '64px', fontWeight: '600' },
          text: 'Ship a sharper product',
          fingerprint: { tag: 'h1', anchorPath: 'section:1/h1:1', ordinal: 1 },
        },
      },
    },
  },
  ...overrides,
})

/** The assertion that would have caught it. */
const parses = (source, label) => {
  try { new Function(source) } catch (error) {
    assert.fail(`${label} is not valid JavaScript: ${error.message}`)
  }
}

test('the generated runtime parses', () => {
  parses(generateRuntimeJs(design()), 'runtime')
})

test('the generated runtime parses with no design at all', () => {
  parses(generateRuntimeJs({ version: 3, routes: {} }), 'empty runtime')
})

test('the generated runtime parses when ids carry quotes and backslashes', () => {
  // The exact shape that broke it. Node ids reach a querySelector string, so
  // they are escaped on the way in — and the escaping is what was malformed.
  const hostile = design({
    routes: {
      '/': {
        desktop: {
          'section:1/h1:1': {
            styles: { fontSize: '20px' },
            text: 'x',
            fingerprint: { tag: 'h1', anchorPath: 'section:1/h1:1', ordinal: 1 },
          },
        },
      },
    },
  })
  hostile.store = { '__froam_structure__:sections': { text: JSON.stringify({
    version: 1,
    sections: [
      { nodeId: 'id"with"quotes', sourcePath: 'section:1', parentPath: 'root', order: 0 },
      { nodeId: 'id\\with\\backslashes', sourcePath: 'section:2', parentPath: 'root', order: 1 },
      { nodeId: 'id]with]brackets', sourcePath: 'section:3', parentPath: 'root', order: 2 },
    ],
  }) } }
  parses(generateRuntimeJs(hostile), 'runtime with hostile ids')
})

test('the escaped character class survives the template layer intact', () => {
  // Inside the emitting template literal every \\ collapses to \, so the source
  // needs four backslashes to land two in the output. Asserting on the emitted
  // text rather than the source keeps that from silently regressing again.
  const js = generateRuntimeJs(design())
  const line = js.split('\n').find((row) => row.includes('data-froam-id="') && row.includes('replace('))
  assert.ok(line, 'the querySelector escaping line is missing entirely')
  assert.ok(!/\/\["\\\]\//.test(line), `character class lost its closing bracket: ${line.trim()}`)
})

test('the generated runtime carries the design it was given', () => {
  const js = generateRuntimeJs(design())
  assert.ok(js.includes('Ship a sharper product'), 'content change missing from runtime')
  assert.ok(js.includes('data-froam-route'), 'runtime never sets the route attribute the CSS depends on')
})

test('generated CSS carries the declarations and scopes them', () => {
  const css = generateCss(design())
  assert.ok(css.includes('font-size: 64px'), 'declaration missing')
  assert.ok(css.includes('font-weight: 600'), 'declaration missing')
  assert.ok(css.includes('data-froam-route="/"'), 'route scope missing')
  assert.ok(css.includes('min-width'), 'viewport scope missing')
})

test('CSS and runtime agree on the route attribute', () => {
  // The stylesheet selects on an attribute the runtime is responsible for
  // setting. If they ever disagree, every style silently stops applying —
  // which is exactly the failure mode this suite now exists to prevent.
  const css = generateCss(design())
  const js = generateRuntimeJs(design())
  const attribute = 'data-froam-route'
  assert.ok(css.includes(attribute) && js.includes(attribute),
    'the CSS selects on an attribute the runtime does not set')
})

/* Root scope — which element paths are relative to (see designRootScope). */

const runtimeDesign = (js) => {
  const match = js.match(/var DESIGN = (\{.*\})\n/)
  assert.ok(match, 'runtime does not embed its design as `var DESIGN = {...}`')
  return JSON.parse(match[1])
}

test('a design with no rootScope keeps the historic root', () => {
  assert.equal(designRootScope(design()), 'auto')
  const css = generateCss(design())
  assert.ok(css.includes(':where([data-froam-root], #root, #__next) > section:nth-of-type(1)'), 'auto-scope selector changed')
  assert.equal(runtimeDesign(generateRuntimeJs(design())).rootScope, undefined)
})

test('a page-scoped design selects from <body> in CSS and the runtime', () => {
  const page = design({ rootScope: 'page' })
  assert.equal(designRootScope(page), 'page')
  assert.ok(generateCss(page).includes('body > section:nth-of-type(1) > h1:nth-of-type(1)'), 'page-scope selector missing')
  // The production runtime must resolve paths from the same root the CSS does.
  assert.equal(runtimeDesign(generateRuntimeJs(page)).rootScope, 'page')
})

test('migrateDesign keeps rootScope: page and drops anything else', () => {
  assert.equal(migrateDesign(design({ rootScope: 'page' })).rootScope, 'page')
  assert.equal('rootScope' in migrateDesign(design({ rootScope: 'nonsense' })), false)
  assert.equal('rootScope' in migrateDesign(design({ rootScope: 'auto' })), false)
})

test('a fresh design adopts the page scope the editor saved from', () => {
  const store = { 'header:1/a:1': { text: 'About us' } }
  const saved = mergeSave({ version: 3, routes: {} }, { routeKey: '/', viewportMode: 'desktop', store, rootScope: 'page' })
  assert.equal(saved.rootScope, 'page')
  assert.equal(saved.routes['/'].desktop['header:1/a:1'].text, 'About us')
})

test('a design that already has edits never switches scope (its paths would shift)', () => {
  const store = { 'section:1/h1:1': { text: 'New copy' } }
  const saved = mergeSave(design(), { routeKey: '/', viewportMode: 'desktop', store, rootScope: 'page' })
  assert.equal(designRootScope(saved), 'auto')
})

test('once page-scoped, a design stays page-scoped', () => {
  const store = { 'main:1/h1:1': { text: 'Again' } }
  const saved = mergeSave(design({ rootScope: 'page' }), { routeKey: '/', viewportMode: 'desktop', store })
  assert.equal(saved.rootScope, 'page')
})

test('an @body path (content beside the root) selects from <body> in either scope', () => {
  const portal = { routes: { '/': { desktop: { '@body/div:2/h2:1': { styles: { color: 'red' } } } } } }
  assert.ok(generateCss(design(portal)).includes('body > div:nth-of-type(2) > h2:nth-of-type(1)'), 'auto scope')
  assert.ok(generateCss(design({ ...portal, rootScope: 'page' })).includes('body > div:nth-of-type(2) > h2:nth-of-type(1)'), 'page scope')
})

test('the runtime resolves @body paths and watches <body> for them', () => {
  const js = generateRuntimeJs(design())
  parses(js, 'runtime')
  assert.ok(js.includes("var BODY_PREFIX = '@body/'"), 'runtime does not know the @body prefix')
  assert.ok(js.includes('hasBodyPaths() && root !== document.body ? document.body : root'), 'runtime never watches <body> for a portal')
})

test('::before and ::after edits compile to pseudo-element rules', () => {
  const badge = { routes: { '/': { desktop: { 'main:1/span:1': { styles: { '__froamState:before:content': '"NEW "', '__froamState:after:color': '#f00' } } } } } }
  const css = generateCss(design(badge))
  assert.ok(/span:nth-of-type\(1\)::before \{\n\s+content: "NEW " !important;/.test(css), 'no ::before rule')
  assert.ok(/span:nth-of-type\(1\)::after \{\n\s+color: #f00 !important;/.test(css), 'no ::after rule')
})

test('a declaration that could close its rule is dropped, not written', () => {
  const hostile = { routes: { '/': { desktop: { 'main:1/h1:1': { styles: {
    color: 'red} body{display:none',
    'font-size;x': '10px',
    '__froamState:before:content': '"a"}html{display:none}',
    backgroundColor: 'blue',
  } } } } } }
  const css = generateCss(design(hostile))
  assert.ok(!css.includes('display:none'), 'a value broke out of its rule')
  assert.ok(!css.includes('font-size;x'), 'a property name carried a semicolon')
  assert.ok(css.includes('background-color: blue !important;'), 'a safe declaration was lost')
})

test('the runtime ignores its own writes (no repaint loop)', () => {
  // apply() re-injects blocks and rewrites text; if its own mutation records
  // stay queued, the observer schedules the next apply — every frame.
  const js = generateRuntimeJs(design())
  assert.ok(/apply\(\)\s*\n\s*if \(observer\) observer\.takeRecords\(\)/.test(js), 'apply is not followed by observer.takeRecords()')
  assert.ok(js.includes('requestAnimationFrame(applyOwnChanges)'), 'scheduled applies bypass the own-writes filter')
})

test('codegen is deterministic', () => {
  assert.equal(generateRuntimeJs(design()), generateRuntimeJs(design()))
  assert.equal(generateCss(design()), generateCss(design()))
})

let failed = 0
for (const [name, fn] of tests) {
  try { fn(); console.log(`  ok  ${name}`) } catch (error) {
    failed += 1; console.error(`FAIL  ${name}`); console.error(`      ${error.message}`)
  }
}
console.log(`\ncodegen: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
