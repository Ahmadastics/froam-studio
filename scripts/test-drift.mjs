/**
 * Froam — design drift tests.
 *
 * Two things have to hold for `froam check` to be worth running.
 *
 * First, the tree parsed here has to index the same way a browser's does, or a
 * path computed in the editor means something else in CI and every project
 * reports drift it doesn't have. Most of the parser tests are about the places
 * where a naive parser and a browser disagree.
 *
 * Second — and this is the one that matters — the dangerous case is not the
 * path that stops resolving. It's the path that *keeps* resolving after the
 * page changed, and now points at a stranger. A checker that only asks "does
 * this path resolve?" gives a clean bill of health to exactly the failure that
 * silently restyles the wrong element on a live site.
 */
import assert from 'node:assert/strict'

const {
  parseHtml,
  getElementPath,
  findElementByPath,
  resolveFroamRoot,
  textContent,
} = await import('../lib/html-tree.mjs')

const {
  ANCHOR_MATCH_THRESHOLD,
  applyDriftFix,
  checkDesign,
  describeDraft,
  fingerprintNode,
  scoreFingerprint,
} = await import('../lib/drift.mjs')

const tests = []
const test = (name, fn) => tests.push([name, fn])

/* ─── fixtures ─── */

const BEFORE = `<!doctype html>
<html>
  <head><title>Run'Am</title><script>if (a < b) { go() }</script></head>
  <body>
    <div id="root">
      <header class="site-head">
        <nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
      </header>
      <main>
        <section class="hero">
          <h1 class="hero-title">Runners ready in Abuja</h1>
          <p>Fast local delivery.</p>
        </section>
        <section class="pricing">
          <h2>Pricing</h2>
          <ul><li>Basic<li>Pro</ul>
        </section>
      </main>
      <footer><p>&copy; Run'Am</p></footer>
    </div>
  </body>
</html>`

/** A section inserted above pricing — every path below it shifts by one. */
const SECTION_INSERTED = BEFORE.replace(
  '<section class="pricing">',
  '<section class="features"><h2>Features</h2></section>\n        <section class="pricing">',
)

/** The whole pricing section deleted. */
const SECTION_DELETED = BEFORE.replace(
  /<section class="pricing">[\s\S]*?<\/section>/,
  '<section class="features"><h2>Features</h2></section>',
)

/** A layout wrapper introduced inside main — a refactor, not a content change. */
const WRAPPED = BEFORE
  .replace('<main>', '<main><div class="shell">')
  .replace('</main>', '</div></main>')

const HERO_PATH = 'main:1/section:1/h1:1'
const PRICING_PATH = 'main:1/section:2/h2:1'

function rootOf(html) {
  return resolveFroamRoot(parseHtml(html)).element
}

/** Build a design the way the editor would, with fingerprints taken from BEFORE. */
function designFrom(html, paths, { withFingerprints = true } = {}) {
  const root = rootOf(html)
  const store = {}
  for (const path of paths) {
    const element = findElementByPath(root, path)
    assert.ok(element, `fixture path did not resolve: ${path}`)
    store[path] = {
      styles: { color: 'rgb(18, 200, 119)' },
      ...(withFingerprints ? { fingerprint: fingerprintNode(element, root) } : {}),
    }
  }
  return { version: 3, routes: { '/': { desktop: store } } }
}

const only = (report) => {
  assert.equal(report.routes.length, 1)
  return report.routes[0].entries
}

/* ─── the tree indexes like a browser's ─── */

test('paths are computed from the froam root, counting same-tag siblings', () => {
  const root = rootOf(BEFORE)
  const h1 = findElementByPath(root, HERO_PATH)
  assert.equal(h1.tag, 'h1')
  assert.equal(textContent(h1).trim(), 'Runners ready in Abuja')
  assert.equal(getElementPath(h1, root), HERO_PATH)
})

test('every element round-trips path -> element -> path', () => {
  const root = rootOf(BEFORE)
  let visited = 0
  const walk = (node) => {
    for (const child of node.children) {
      const path = getElementPath(child, root)
      assert.equal(findElementByPath(root, path), child, `round-trip failed for ${path}`)
      visited += 1
      walk(child)
    }
  }
  walk(root)
  assert.ok(visited > 10, 'fixture should have a real tree')
})

test('implied end tags keep list items siblings, not a nest', () => {
  // `<li>a<li>b` is two siblings in a browser. A parser that nests them shifts
  // every path underneath and reports drift on any page with a plain list.
  const root = rootOf(BEFORE)
  const list = findElementByPath(root, 'main:1/section:2/ul:1')
  assert.equal(list.children.length, 2)
  assert.deepEqual(list.children.map((li) => textContent(li).trim()), ['Basic', 'Pro'])
  assert.equal(findElementByPath(root, 'main:1/section:2/ul:1/li:2').tag, 'li')
})

test('a `<` inside a script is text, not a tag', () => {
  const root = rootOf(BEFORE)
  // If the script body were parsed as markup, `<b>` would open an element and
  // the rest of the document would be indexed inside it.
  assert.equal(findElementByPath(root, HERO_PATH).tag, 'h1')
})

test('a table gets the tbody a browser would have synthesised', () => {
  // Caught by diffing against Chrome: `<table><tr>` is really
  // `<table><tbody><tr>`, and without it every path inside any table is one
  // level short of what the editor recorded.
  const root = rootOf('<body><table><tr><td>a<td>b<tr><td>c<td>d</table></body>')
  assert.deepEqual(root.children[0].children.map((c) => c.tag), ['tbody'])
  assert.equal(findElementByPath(root, 'table:1/tbody:1/tr:2/td:2').tag, 'td')
  assert.equal(textContent(findElementByPath(root, 'table:1/tbody:1/tr:2/td:2')), 'd')
  // An explicit tbody is not doubled up.
  const explicit = rootOf('<body><table><tbody><tr><td>a</td></tr></tbody></table></body>')
  assert.deepEqual(explicit.children[0].children.map((c) => c.tag), ['tbody'])
})

test('void elements do not open a scope', () => {
  const root = rootOf('<body><div><img src="a.png"><hr><span>after</span></div></body>')
  const div = findElementByPath(root, 'div:1')
  assert.deepEqual(div.children.map((c) => c.tag), ['img', 'hr', 'span'])
})

test('self-closing and stray end tags do not unwind the document', () => {
  const root = rootOf('<body><div><br/></div></p><span>still here</span></body>')
  assert.deepEqual(root.children.map((c) => c.tag), ['div', 'span'])
})

test('comments and doctypes are not elements', () => {
  const root = rootOf('<body><!-- note --><div>a</div></body>')
  assert.deepEqual(root.children.map((c) => c.tag), ['div'])
})

test('attributes parse quoted, single-quoted and bare', () => {
  const root = rootOf(`<body><div id=one class='two three' data-x="y" hidden>a</div></body>`)
  const div = root.children[0]
  assert.equal(div.id, 'one')
  assert.equal(div.className, 'two three')
  assert.equal(div.attrs['data-x'], 'y')
  assert.equal(div.attrs.hidden, '')
})

test('character references decode the way textContent does', () => {
  // Caught by diffing this parser against a real Chrome DOM: a footer written
  // `&copy; Run'Am` reads back as `© Run'Am` in a browser. Leave it encoded
  // and every element containing an &nbsp; or an &amp; looks like a different
  // element -- drift reported on a page nobody touched.
  const root = rootOf(`<body><p id="a">&copy; Run'Am &mdash; 50&nbsp;items &amp; caf&eacute;</p>
    <p id="b">&#169; &#x2014; &notarealentity; &bogus</p>
    <style>.x { content: "&amp;" }</style>
    <textarea>&amp;</textarea></body>`)
  // Spelled as escapes on purpose: nbsp is not a space, and the difference is
  // invisible in a source file.
  assert.equal(
    textContent(root.children[0]),
    "© Run'Am — 50 items & café",
  )
  assert.equal(textContent(root.children[1]), '© — &notarealentity; &bogus')
  // Raw text keeps its ampersands; escapable raw text does not.
  assert.equal(textContent(root.children[2]).trim(), '.x { content: "&amp;" }')
  assert.equal(textContent(root.children[3]), '&')
})

test('attribute values decode too', () => {
  const root = rootOf('<body><div class="a&amp;b" id="x&#45;y">t</div></body>')
  assert.equal(root.children[0].className, 'a&b')
  assert.equal(root.children[0].id, 'x-y')
})

test('the froam root is resolved in the documented order', () => {
  assert.equal(resolveFroamRoot(parseHtml('<body><div data-froam-root><p>a</p></div></body>')).via, 'data-froam-root')
  assert.equal(resolveFroamRoot(parseHtml('<body><div id="root"></div></body>')).via, '#root')
  assert.equal(resolveFroamRoot(parseHtml('<body><div id="__next"></div></body>')).via, '#__next')
  assert.equal(resolveFroamRoot(parseHtml('<body><main></main></body>')).via, 'main')
  assert.equal(resolveFroamRoot(parseHtml('<body><p>a</p></body>')).via, 'body')
})

/* ─── the scoring agrees with the browser implementation ─── */

test('scoreFingerprint matches src/collab/anchor.ts exactly', async () => {
  // The two implementations are a deliberate mirror. If they drift apart, the
  // editor and CI disagree about whether an element is the same element — so
  // this asserts against the compiled bundle rather than trusting a comment.
  let browserScore
  try {
    ;({ scoreFingerprint: browserScore } = await import('../dist/collab/anchor.js'))
  } catch {
    console.log('       (skipped: dist/collab/anchor.js not built)')
    return
  }

  const corpus = [
    [{ tag: 'h1' }, { tag: 'h2' }],
    [{ tag: 'h1' }, { tag: 'h1' }],
    [{ tag: 'h1', id: 'hero' }, { tag: 'h1', id: 'hero', text: 'totally rewritten' }],
    [{ tag: 'h1', id: 'hero' }, { tag: 'h1', id: 'other' }],
    [{ tag: 'p', text: 'Runners ready in Abuja' }, { tag: 'p', text: 'Runners ready in Abuja' }],
    [{ tag: 'p', text: 'Runners ready in Abuja' }, { tag: 'p', text: 'Runners ready' }],
    [{ tag: 'p', text: 'Runners ready in Abuja' }, { tag: 'p', text: 'Something else entirely' }],
    [{ tag: 'p', text: 'a b c' }, { tag: 'p' }],
    [{ tag: 'div', className: 'hero big' }, { tag: 'div', className: 'hero small' }],
    [{ tag: 'div', className: 'hero' }, { tag: 'div' }],
    [{ tag: 'section', anchorId: 'main', anchorPath: 'div:1/section:2', ordinal: 2 },
      { tag: 'section', anchorId: 'main', anchorPath: 'div:1/section:2', ordinal: 2 }],
    [{ tag: 'section', anchorId: 'main', anchorPath: 'div:1/section:2', ordinal: 2 },
      { tag: 'section', anchorId: 'aside', anchorPath: 'div:2/section:1', ordinal: 1 }],
    [{ tag: 'h2', text: 'Pricing', anchorPath: 'main:1/section:2/h2:1', ordinal: 1 },
      { tag: 'h2', text: 'Features', anchorPath: 'main:1/section:2/h2:1', ordinal: 1 }],
  ]

  for (const [want, got] of corpus) {
    assert.equal(
      scoreFingerprint(want, got),
      browserScore(want, got),
      `scores diverged for ${JSON.stringify(want)} vs ${JSON.stringify(got)}`,
    )
  }
})

test('a bare tag with nothing distinguishing never clears the threshold', () => {
  assert.ok(scoreFingerprint({ tag: 'div' }, { tag: 'div' }) < ANCHOR_MATCH_THRESHOLD)
})

/* ─── checking a design ─── */

test('an unchanged page reports every edit anchored and no drift', () => {
  const design = designFrom(BEFORE, [HERO_PATH, PRICING_PATH])
  const report = checkDesign(design, { '/': BEFORE })
  assert.equal(report.drift, false)
  assert.equal(report.counts.anchored, 2)
  assert.deepEqual(only(report).map((e) => e.status), ['anchored', 'anchored'])
})

test('a path that still resolves but points at a stranger is NOT anchored', () => {
  // The whole reason this module exists. A section inserted above pricing means
  // `main:1/section:2/h2:1` resolves fine — to "Features". A path-only check
  // calls that healthy and the site silently restyles the wrong heading.
  const design = designFrom(BEFORE, [PRICING_PATH])
  const stillResolves = findElementByPath(rootOf(SECTION_INSERTED), PRICING_PATH)
  assert.equal(textContent(stillResolves).trim(), 'Features', 'fixture must keep the old path resolvable')

  const entry = only(checkDesign(design, { '/': SECTION_INSERTED }))[0]
  assert.equal(entry.status, 'moved')
  assert.equal(entry.newPath, 'main:1/section:3/h2:1')
  assert.ok(entry.score >= ANCHOR_MATCH_THRESHOLD)
})

test('a refactor that only adds a wrapper recovers every edit', () => {
  const design = designFrom(BEFORE, [HERO_PATH, PRICING_PATH])
  const entries = only(checkDesign(design, { '/': WRAPPED }))
  assert.deepEqual(entries.map((e) => e.status), ['moved', 'moved'])
  assert.deepEqual(entries.map((e) => e.newPath), [
    'main:1/div:1/section:1/h1:1',
    'main:1/div:1/section:2/h2:1',
  ])
})

test('a deleted element is orphaned, not quietly reassigned', () => {
  const design = designFrom(BEFORE, [PRICING_PATH])
  // The old path still resolves here too — to the Features heading.
  assert.ok(findElementByPath(rootOf(SECTION_DELETED), PRICING_PATH))
  const entry = only(checkDesign(design, { '/': SECTION_DELETED }))[0]
  assert.equal(entry.status, 'orphaned')
  assert.equal(entry.label, 'h2 "Pricing"')
})

test('edits saved before fingerprints are reported as unverified, not anchored', () => {
  const design = designFrom(BEFORE, [HERO_PATH], { withFingerprints: false })
  const report = checkDesign(design, { '/': BEFORE })
  assert.equal(only(report)[0].status, 'unverified')
  assert.equal(report.counts.anchored, 0)
  assert.equal(report.drift, false, 'unverified is unknown, not drift')
})

test('a legacy edit whose path stops resolving is missing', () => {
  const design = designFrom(BEFORE, [HERO_PATH], { withFingerprints: false })
  const report = checkDesign(design, { '/': WRAPPED })
  assert.equal(only(report)[0].status, 'missing')
  assert.equal(report.drift, true)
})

/* ─── scope: the whole page, and content beside the root ─── */

const APP_WITH_DIALOG = BEFORE.replace('</body>', '<div class="dialog"><h2>Invite your team</h2></div></body>')

test('a page-scoped design resolves its paths from <body>', () => {
  const design = { version: 3, rootScope: 'page', routes: { '/': { desktop: { 'div:1/header:1/nav:1/a:2': { styles: { color: 'red' } } } } } }
  const report = checkDesign(design, { '/': BEFORE })
  assert.equal(only(report)[0].status, 'unverified', 'page-scoped path did not resolve from <body>')
  assert.equal(report.routes[0].rootVia, 'page')
})

test('an @body path resolves beside the root (a portal on <body>)', () => {
  const design = { version: 3, routes: { '/': { desktop: { '@body/div:2/h2:1': { styles: { color: 'red' } } } } } }
  assert.equal(only(checkDesign(design, { '/': APP_WITH_DIALOG }))[0].status, 'unverified')
  assert.equal(only(checkDesign(design, { '/': BEFORE }))[0].status, 'missing', 'resolved with no dialog on the page')
})

test('an element beside the root gets an @body path that round-trips', () => {
  const document = parseHtml(APP_WITH_DIALOG)
  const root = resolveFroamRoot(document).element
  const dialogTitle = findElementByPath(root, '@body/div:2/h2:1')
  assert.ok(dialogTitle, '@body path did not resolve')
  assert.equal(textContent(dialogTitle), 'Invite your team')
  assert.equal(getElementPath(dialogTitle, root), '@body/div:2/h2:1')
})

test('a route with no page supplied is unchecked, not assumed healthy', () => {
  const design = designFrom(BEFORE, [HERO_PATH])
  const report = checkDesign(design, {})
  assert.equal(report.routes[0].checked, false)
  assert.equal(report.drift, false)
  assert.match(report.routes[0].reason, /no page/)
})

test('canvas, injection and structure keys are not treated as elements', () => {
  const design = {
    version: 3,
    routes: {
      '/': {
        desktop: {
          __froam_canvas__: { styles: { background: 'red' } },
          '__froam_injection__:abc': { styles: {} },
          '__froam_structure__:sections': { styles: {} },
        },
      },
    },
  }
  assert.deepEqual(only(checkDesign(design, { '/': BEFORE })), [])
})

test('an empty draft is not reported as an edit', () => {
  const design = { version: 3, routes: { '/': { desktop: { [HERO_PATH]: { styles: {} } } } } }
  assert.deepEqual(only(checkDesign(design, { '/': BEFORE })), [])
})

test('CSS scoped to a root the page never stamps is warned about', () => {
  // generateCss scopes to [data-froam-root]/#root/#__next. A static page whose
  // root falls through to <main> only works because froam.runtime.js stamps the
  // attribute — ship the CSS alone and nothing applies.
  const plain = `<body><main><h1 class="t">Hello</h1></main></body>`
  const design = designFrom(plain, ['h1:1'])
  const report = checkDesign(design, { '/': plain })
  assert.equal(report.warnings.length, 1)
  assert.equal(report.warnings[0].kind, 'css-root-unstamped')

  const withRuntime = plain.replace('</body>', '<script src="/froam/froam.runtime.js"></script></body>')
  assert.deepEqual(checkDesign(design, { '/': withRuntime }).warnings, [])
})

/* ─── fixing ─── */

test('--fix re-keys moved edits and refreshes their fingerprint', () => {
  const design = designFrom(BEFORE, [HERO_PATH, PRICING_PATH])
  const report = checkDesign(design, { '/': WRAPPED })
  const { design: fixed, applied, refused } = applyDriftFix(design, report)

  assert.equal(applied.length, 2)
  assert.equal(refused.length, 0)
  const store = fixed.routes['/'].desktop
  assert.deepEqual(Object.keys(store).sort(), [
    'main:1/div:1/section:1/h1:1',
    'main:1/div:1/section:2/h2:1',
  ])
  assert.deepEqual(store['main:1/div:1/section:1/h1:1'].styles, { color: 'rgb(18, 200, 119)' })

  // The refreshed fingerprint must describe where the element landed, or the
  // anchor decays a little with every refactor until it stops recovering.
  assert.equal(store['main:1/div:1/section:1/h1:1'].fingerprint.anchorPath, 'main:1/div:1/section:1/h1:1')
  assert.equal(checkDesign(fixed, { '/': WRAPPED }).drift, false)
})

test('--fix never merges two edits onto one element', () => {
  const design = designFrom(BEFORE, [HERO_PATH])
  const report = checkDesign(design, { '/': WRAPPED })
  // Something already occupies the path this edit wants to move to.
  design.routes['/'].desktop['main:1/div:1/section:1/h1:1'] = { styles: { color: 'red' } }

  const { applied, refused } = applyDriftFix(design, report)
  assert.equal(applied.length, 0)
  assert.equal(refused.length, 1)
  assert.match(refused[0].reason, /already owns/)
})

test('--fix leaves the original design untouched', () => {
  const design = designFrom(BEFORE, [HERO_PATH])
  const before = JSON.stringify(design)
  applyDriftFix(design, checkDesign(design, { '/': WRAPPED }))
  assert.equal(JSON.stringify(design), before)
})

test('an edit is described by what it is, not by its path', () => {
  assert.equal(describeDraft(HERO_PATH, { fingerprint: { tag: 'h1', text: 'Runners ready in Abuja' } }), 'h1 "Runners ready in Abuja"')
  assert.equal(describeDraft(HERO_PATH, { fingerprint: { tag: 'div', id: 'cta' } }), 'div#cta')
  assert.equal(describeDraft(HERO_PATH, { fingerprint: { tag: 'div', className: 'card wide' } }), 'div.card')
  assert.equal(describeDraft(HERO_PATH, {}), 'h1')
})

/* ─── run ─── */

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}`)
    console.log(`       ${error.message.split('\n').join('\n       ')}`)
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`)
process.exit(failed ? 1 : 0)
