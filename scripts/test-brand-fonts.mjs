/* Brand fonts (uploaded/self-hosted faces) plus the font catalog and the
   TS↔mjs mirror that keeps the picker and production codegen agreeing. */
import assert from 'node:assert/strict'
import { brandFontFaceCss, generateCss, isSafeFontSrc, fontStylesheetUrls } from '../lib/codegen.mjs'
import { FONT_CATALOG, FONTSHARE_FONTS, GOOGLE_FONTS, fontsByRole } from '../dist/editor/fontSources.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

const WOFF2 = 'data:font/woff2;base64,d09GMgABAAAAAAZ0'

test('an uploaded face compiles to a usable @font-face', () => {
  const css = brandFontFaceCss([{ family: 'Acme Grotesk', faces: [{ weight: 500, src: WOFF2 }] }]).join('\n')
  assert.match(css, /font-family: "Acme Grotesk";/)
  assert.match(css, /src: url\("data:font\/woff2;base64,d09GMgABAAAAAAZ0"\) format\("woff2"\);/)
  assert.match(css, /font-weight: 500;/)
  assert.match(css, /font-style: normal;/)
  assert.match(css, /font-display: swap;/)
})

test('format is inferred from an https URL extension', () => {
  const css = brandFontFaceCss([{ family: 'Client Sans', faces: [{ src: 'https://cdn.example.com/cs.woff?v=2' }] }]).join('\n')
  assert.match(css, /format\("woff"\)/)
})

test('a variable weight range survives, a nonsense weight falls back to 400', () => {
  const range = brandFontFaceCss([{ family: 'Var', faces: [{ weight: '400 700', src: WOFF2 }] }]).join('\n')
  assert.match(range, /font-weight: 400 700;/)
  const junk = brandFontFaceCss([{ family: 'Var', faces: [{ weight: 'heavy; }', src: WOFF2 }] }]).join('\n')
  assert.match(junk, /font-weight: 400;/)
})

test('weights are clamped into the legal range', () => {
  const css = brandFontFaceCss([{ family: 'Clamp', faces: [{ weight: 9999, src: WOFF2 }] }]).join('\n')
  assert.match(css, /font-weight: 1000;/)
})

/* The src and family reach production CSS verbatim, so the generator —
   not the caller — is responsible for anything that could break out. */
test('unsafe sources never reach generated CSS', () => {
  for (const src of [
    'javascript:alert(1)',
    'http://cdn.example.com/insecure.woff2',
    'data:text/html;base64,PHNjcmlwdD4=',
    'url(x); } body { display: none } @font-face { src: url(y)',
    '',
    null,
  ]) {
    assert.equal(isSafeFontSrc(src), false, `expected ${JSON.stringify(src)} to be refused`)
    assert.deepEqual(brandFontFaceCss([{ family: 'Bad', faces: [{ src }] }]), [])
  }
})

test('a quote in the family name cannot escape the CSS string', () => {
  const css = brandFontFaceCss([{ family: 'Evil"; } body { display: none } @font-face { font-family: "x', faces: [{ src: WOFF2 }] }]).join('\n')
  // The payload survives as inert text inside the quoted family name; what
  // matters is that its quotes are escaped, so it cannot close the string
  // and open a second rule. Count rule openings, not the literal substring —
  // the payload contains the text "@font-face" itself.
  assert.equal(css.split('\n').filter((line) => line === '@font-face {').length, 1, 'payload opened a second rule')
  assert.match(css, /font-family: "Evil\\"; \} body \{ display: none \} @font-face \{ font-family: \\"x";/)
  assert.doesNotMatch(css, /[^\\]"; \}/)
})

test('a face with no family and a family with no valid face are both dropped', () => {
  assert.deepEqual(brandFontFaceCss([{ family: '   ', faces: [{ src: WOFF2 }] }]), [])
  assert.deepEqual(brandFontFaceCss([{ family: 'Orphan', faces: [] }]), [])
  assert.deepEqual(brandFontFaceCss(null), [])
  assert.deepEqual(brandFontFaceCss(undefined), [])
})

test('brand faces land in generated CSS after @import and before any rule', () => {
  const css = generateCss({
    version: 3,
    brandFonts: [{ family: 'Acme Grotesk', faces: [{ weight: 700, src: WOFF2 }] }],
    routes: { '/': { desktop: { 'h1:1': { styles: { fontFamily: 'Inter, sans-serif', color: 'red' } } } } },
  })
  const importAt = css.indexOf('@import')
  const faceAt = css.indexOf('@font-face')
  const ruleAt = css.indexOf('html[data-froam-route=')
  assert.ok(importAt !== -1 && faceAt !== -1 && ruleAt !== -1, 'expected all three sections')
  assert.ok(importAt < faceAt, '@import must precede @font-face')
  assert.ok(faceAt < ruleAt, '@font-face must precede the first rule')
})

test('a design with no brand fonts generates no @font-face section', () => {
  const css = generateCss({ version: 3, routes: { '/': { desktop: { 'h1:1': { styles: { color: 'red' } } } } } })
  assert.doesNotMatch(css, /@font-face/)
  assert.doesNotMatch(css, /brand fonts/)
})

/* ── font catalog + TS↔mjs mirror ───────────────────────────────
   Drift here is silent and expensive: the family loads in the editor,
   then falls back to Times on the deployed site because codegen never
   emitted its @import. Enforce it instead of trusting the comment. */

test('every catalog family is a family the editor can actually load', () => {
  for (const entry of FONT_CATALOG) {
    assert.ok(
      GOOGLE_FONTS[entry.family] || FONTSHARE_FONTS[entry.family],
      `${entry.family} is in FONT_CATALOG but in neither font source`,
    )
  }
})

test('codegen knows every family the picker offers', () => {
  for (const family of [...Object.keys(GOOGLE_FONTS), ...Object.keys(FONTSHARE_FONTS)]) {
    const urls = fontStylesheetUrls([family])
    assert.equal(urls.length, 1, `codegen emits no stylesheet for "${family}" — the mjs mirror has drifted`)
  }
})

test('weight specs are well formed, so the css2 request cannot fail', () => {
  for (const [family, weights] of Object.entries(GOOGLE_FONTS)) {
    assert.match(weights, /^\d{3}(;\d{3})*$/, `${family} has a malformed weight list: ${weights}`)
    const list = weights.split(';').map(Number)
    assert.deepEqual(list, [...list].sort((a, b) => a - b), `${family} weights are not ascending`)
    assert.equal(new Set(list).size, list.length, `${family} repeats a weight`)
  }
})

test('the catalog covers every role and has no duplicate families', () => {
  const families = FONT_CATALOG.map((entry) => entry.family)
  assert.equal(new Set(families).size, families.length, 'a family appears twice in the catalog')
  for (const role of ['display', 'sans', 'humanist', 'condensed', 'serif', 'slab', 'mono', 'hand']) {
    assert.ok(fontsByRole(role).length > 0, `no font offered for the "${role}" role`)
  }
})

test('suggested pairings point at families that exist', () => {
  const known = new Set(FONT_CATALOG.map((entry) => entry.family))
  for (const entry of FONT_CATALOG) {
    for (const pair of entry.pairsWith ?? []) {
      assert.ok(known.has(pair), `${entry.family} pairs with "${pair}", which is not in the catalog`)
    }
  }
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`) }
  catch (error) { console.error(`✗ ${name}`); throw error }
}
console.log(`\n${passed}/${tests.length} brand-font tests passed`)
