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
import { generateCss, generateRuntimeJs } from '../lib/codegen.mjs'

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
