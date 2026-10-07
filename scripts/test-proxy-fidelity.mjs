/**
 * A live site through `froam dev --app` should load as it does on its own
 * domain. Each case here is one way a real site broke (scripts/qa/live-sites.mjs
 * found them): the fix, as a contract.
 */
import assert from 'node:assert/strict'
import {
  editorLoader, injectNavigationGuard, isBotChallenge, keepAssetsInside, keepCssInside,
  navigationGuard, withoutCookieDomain, withoutMetaCsp,
} from '../lib/dev-server.mjs'

const tests = []
const test = (name, run) => tests.push([name, run])
const site = new Set(['https://www.shop.com'])

test('the editor loader is written into the page, so a framework rebuilding <body> cannot drop it first', () => {
  const tag = editorLoader('bridge-abc')
  assert.match(tag, /^<script data-froam-loader data-froam-project="bridge-abc">/)
  assert.match(tag, /import\(location\.origin\+'\/froam-modules\/froam-editor\.mjs'\)/)
  assert.match(tag, /\/\* \/froam\.js \*\//, 'an older share service sees the page already has the editor')
  assert.doesNotMatch(editorLoader('"><script>alert(1)</script>'), /<script>alert/)
})

test('a security policy in a <meta> tag goes, like the header (paystack.com)', () => {
  const html = '<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src \'nonce-x\'"><META HTTP-EQUIV=content-security-policy-report-only content="x"></head>'
  assert.equal(withoutMetaCsp(html), '<head><meta charset="utf-8"></head>')
})

test('the site’s own CORS-mode files load through Froam; pictures and plain scripts don’t (wordpress.org, allbirds.com)', () => {
  const out = keepAssetsInside([
    '<link rel="stylesheet" href="https://www.shop.com/a.css">',
    '<link rel=preload as=font href=//shop.com/f.woff2 crossorigin>',
    '<script type="module" src="http://www.shop.com/m.js"></script>',
    '<link rel="modulepreload" href="https://www.shop.com/n.js">',
    '<script src="https://www.shop.com/plain.js"></script>',
    '<img src="https://www.shop.com/p.jpg">',
    '<img crossorigin="anonymous" src="https://www.shop.com/c.jpg">',
    '<script type="module" src="https://cdn.other.com/x.js"></script>',
    '<script type="importmap">{"imports":{"a":"https://www.shop.com/a.js"}}</script>',
    '<style>@font-face{src:url(https://shop.com/f2.woff2)}</style>',
  ].join(''), site)
  assert.equal(out, [
    '<link rel="stylesheet" href="/a.css">',
    '<link rel=preload as=font href=/f.woff2 crossorigin>',
    '<script type="module" src="/m.js"></script>',
    '<link rel="modulepreload" href="/n.js">',
    '<script src="https://www.shop.com/plain.js"></script>',
    '<img src="https://www.shop.com/p.jpg">',
    '<img crossorigin="anonymous" src="/c.jpg">',
    '<script type="module" src="https://cdn.other.com/x.js"></script>',
    '<script type="importmap">{"imports":{"a":"/a.js"}}</script>',
    '<style>@font-face{src:url(/f2.woff2)}</style>',
  ].join(''))
  // A host that only starts like the site is another site.
  assert.equal(keepAssetsInside('<link rel="stylesheet" href="https://www.shop.com.evil.org/a.css">', site), '<link rel="stylesheet" href="https://www.shop.com.evil.org/a.css">')
})

test('a stylesheet’s own fonts and @imports by full URL load through Froam', () => {
  assert.equal(
    keepCssInside('@import "//shop.com/b.css";@font-face{src:url("https://www.shop.com/f.woff2")}.x{background:url(https://cdn.other.com/i.png)}', site),
    '@import "/b.css";@font-face{src:url("/f.woff2")}.x{background:url(https://cdn.other.com/i.png)}',
  )
})

test('a site sending itself to its own domain stays in Froam (vercel.com, linear.app)', () => {
  const guard = navigationGuard(site)
  assert.match(guard, /^<script data-froam-guard>/)
  assert.match(guard, /\["shop\.com","www\.shop\.com"\]/)
  const html = injectNavigationGuard('<html><head><title>x</title><script src="/app.js"></script></head></html>', site)
  assert.ok(html.indexOf('data-froam-guard') < html.indexOf('/app.js'), 'the guard runs before the site’s scripts')
  assert.equal(injectNavigationGuard(html, site), html, 'once')
})

test('cookies for the site’s domain stick through Froam', () => {
  assert.deepEqual(withoutCookieDomain(['a=1; Domain=.shop.com; Path=/; Secure', 'b=2; path=/; domain=shop.com']), ['a=1; Path=/; Secure', 'b=2; path=/'])
})

test('a bot check is recognised, so froam dev can say why the page is wrong', () => {
  assert.equal(isBotChallenge(403, {}, '<title>Just a moment...</title><script src="https://challenges.cloudflare.com/x"></script>'), true)
  assert.equal(isBotChallenge(200, { 'cf-mitigated': 'challenge' }), true)
  assert.equal(isBotChallenge(200, {}, '<title>Just a moment...</title>'), false, 'a page that says it is not a block')
  assert.equal(isBotChallenge(404, {}, 'Not found'), false)
})

let passed = 0
for (const [name, run] of tests) {
  try {
    await run()
    passed += 1
    process.stdout.write(`  ok   ${name}\n`)
  } catch (error) {
    process.stderr.write(`  FAIL ${name}\n${error.stack}\n`)
    process.exit(1)
  }
}
process.stdout.write(`\n${passed}/${tests.length} proxy fidelity tests passed\n`)
