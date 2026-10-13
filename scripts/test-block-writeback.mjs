/**
 * Sections into the source (lib/block-writeback.mjs): a block added in the
 * editor lands in the page's .html file exactly where froam.runtime.js would
 * have put it, clean of editor bookkeeping, and the design forgets it at
 * every size. Plus the brand rename: a page's <title> that matches the edited
 * text is updated with it, not counted as a second candidate.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { cleanBlockHtml, dropWrittenBlocks, htmlFileForRoute, writeBlocks } from '../lib/block-writeback.mjs'
import { findElementByPath, parseHtml, resolveFroamRoot } from '../lib/html-tree.mjs'
import { renderStarter } from '../lib/starters.mjs'
import { writeTextEdits } from '../lib/source-writeback.mjs'

const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'froam-test-blocks-'))
let count = 0
function site(files) {
  const dir = path.join(base, `s${count += 1}`)
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), content)
  }
  fs.mkdirSync(path.join(dir, 'froam'), { recursive: true })
  return dir
}
const read = (dir, rel = 'index.html') => fs.readFileSync(path.join(dir, rel), 'utf8')
const block = (key, html, order, parentPath = '__froam_root__') => ({ key: `__froam_injection__:${key}`, parentPath, order, html })
const FAQ = '<section data-froam-injected="true" data-froam-block="true" data-froam-id="k1" data-froam-component-id="faq-01" data-chef-selected="true" style="padding: 40px;"><h2 data-froam-id="k2">Questions</h2><div data-froam-image-frame="true"></div></section>'
const PAGE = '<!doctype html>\n<html>\n  <head><title>Kiln</title></head>\n  <body>\n    <header><a class="logo">Kiln</a></header>\n    <main>\n      <section id="hero"><h1>Hello</h1></section>\n      <section id="about"><p>About</p></section>\n    </main>\n  </body>\n</html>\n'

/** What the runtime would build: the block inserted as child `order` of its parent. */
function rootChildren(html) {
  const root = resolveFroamRoot(parseHtml(html)).element
  return root.children.map((child) => child.id || child.tag)
}

const tests = []
const test = (name, run) => tests.push([name, run])

test('a section at the end of the page goes before </main>, indented like its siblings', () => {
  const dir = site({ 'index.html': PAGE })
  const [result] = writeBlocks({ serveDir: dir, froamDir: path.join(dir, 'froam'), routeKey: '/', blocks: [block('k1', FAQ, 2)] })
  assert.equal(result.status, 'written', JSON.stringify(result))
  assert.equal(result.file, 'index.html')
  const html = read(dir)
  assert.match(html, /<section id="about"><p>About<\/p><\/section>\n {6}<section data-froam-component-id="faq-01" style="padding: 40px;"><h2>Questions<\/h2><div data-froam-image-frame="true"><\/div><\/section>\n {4}<\/main>/)
  assert.deepEqual(rootChildren(html), ['hero', 'about', 'section'])
})

test('a section between two others lands at the same index the runtime uses', () => {
  const dir = site({ 'index.html': PAGE })
  writeBlocks({ serveDir: dir, froamDir: path.join(dir, 'froam'), routeKey: '/', blocks: [block('k1', FAQ, 1)] })
  assert.deepEqual(rootChildren(read(dir)), ['hero', 'section', 'about'])
})

test('several sections go in in order, each seeing the ones before it', () => {
  const dir = site({ 'index.html': PAGE })
  const one = '<section id="one"></section>'
  const two = '<section id="two"></section>'
  // Given out of order on purpose: the runtime sorts by order.
  const results = writeBlocks({ serveDir: dir, froamDir: path.join(dir, 'froam'), routeKey: '/', blocks: [block('b', two, 3), block('a', one, 0)] })
  assert.deepEqual(results.map((result) => result.status), ['written', 'written'])
  assert.deepEqual(rootChildren(read(dir)), ['one', 'hero', 'about', 'two'])
})

test('inside a nested parent by path', () => {
  const dir = site({ 'index.html': PAGE })
  writeBlocks({ serveDir: dir, froamDir: path.join(dir, 'froam'), routeKey: '/', blocks: [block('k', '<p id="new">Hi</p>', 1, 'section:2')] })
  const root = resolveFroamRoot(parseHtml(read(dir))).element
  assert.equal(findElementByPath(root, 'section:2/p:2').id, 'new')
})

test('never writes a block with a handler or a script, and keeps the ones after it in the same place', () => {
  const dir = site({ 'index.html': PAGE })
  const before = read(dir)
  const results = writeBlocks({ serveDir: dir, froamDir: path.join(dir, 'froam'), routeKey: '/', blocks: [
    block('handler', '<section><button onclick="go()">Go</button></section>', 0),
    block('later', '<section id="later"></section>', 1),
  ] })
  assert.deepEqual(results.map((result) => result.status), ['skipped', 'skipped'])
  assert.equal(read(dir), before)
  assert.equal(cleanBlockHtml('<div><script src="app.js"></script></div>', 'froam/media/'), null)
  assert.equal(cleanBlockHtml('<a href="javascript:void(0)">x</a>', 'froam/media/'), null)
  assert.equal(cleanBlockHtml('<p>one</p><p>two</p>', 'froam/media/'), null)
})

test('placed media points at the workspace media folder, relative to the page', () => {
  const name = `${'a'.repeat(32)}.webp`
  assert.equal(cleanBlockHtml(`<div style="background-image: url(&quot;froam-media:${name}&quot;)"></div>`, 'froam/media/'), `<div style="background-image: url(&quot;froam/media/${name}&quot;)"></div>`)
  const dir = site({ 'about/index.html': PAGE })
  writeBlocks({ serveDir: dir, froamDir: path.join(dir, 'froam'), routeKey: '/about', blocks: [block('m', `<figure><img src="froam-media:${name}"></figure>`, 0)] })
  assert.match(read(dir, 'about/index.html'), new RegExp(`<img src="\\.\\./froam/media/${name}">`))
})

test('routes map to the files the static server serves, never outside the folder', () => {
  const dir = site({ 'index.html': PAGE, 'pricing.html': PAGE, 'blog/index.html': PAGE })
  assert.equal(path.relative(dir, htmlFileForRoute(dir, '/')), 'index.html')
  assert.equal(path.relative(dir, htmlFileForRoute(dir, '/pricing')), 'pricing.html')
  assert.equal(path.relative(dir, htmlFileForRoute(dir, '/blog/')), path.join('blog', 'index.html'))
  assert.equal(htmlFileForRoute(dir, '/missing'), null)
  assert.equal(htmlFileForRoute(path.join(dir, 'blog'), '/../pricing'), null)
})

test('the design forgets written blocks at every size', () => {
  const design = { version: 3, routes: { '/': {
    desktop: { '__froam_injection__:a': { text: '{}' }, 'h1:1': { text: 'Hi' } },
    mobile: { '__froam_injection__:a': { text: '{}' } },
  }, '/other': { desktop: { '__froam_injection__:a': { text: '{}' } } } } }
  const next = dropWrittenBlocks(design, '/', ['__froam_injection__:a'])
  assert.deepEqual(Object.keys(next.routes['/'].desktop), ['h1:1'])
  assert.deepEqual(Object.keys(next.routes['/'].mobile), [])
  assert.ok(next.routes['/other'].desktop['__froam_injection__:a'], 'other routes untouched')
})

test('a starter page takes a Library section in <main>', () => {
  const dir = site({ 'index.html': renderStarter({ name: 'Kiln', kind: 'business' }) })
  const [result] = writeBlocks({ serveDir: dir, froamDir: path.join(dir, 'froam'), routeKey: '/', blocks: [block('k1', FAQ, 5)] })
  assert.equal(result.status, 'written')
  assert.deepEqual(rootChildren(read(dir)), ['section', 'services', 'about', 'reviews', 'contact', 'section'])
})

test('renaming the brand renames the page title with it', () => {
  const dir = site({ 'index.html': PAGE })
  const [result] = writeTextEdits(dir, [{ from: 'Kiln', to: 'Kiln & Co' }])
  assert.equal(result.status, 'written', JSON.stringify(result))
  const html = read(dir)
  assert.match(html, /<title>Kiln &amp; Co<\/title>/)
  assert.match(html, /<a class="logo">Kiln &amp; Co<\/a>/)
})

test('a title alone is not the page text, and two visible copies are still ambiguous', () => {
  const dir = site({ 'index.html': '<html><head><title>Only here</title></head><body><h1>Twice</h1><p>Twice</p></body></html>' })
  const results = writeTextEdits(dir, [{ from: 'Only here', to: 'x y z' }, { from: 'Twice', to: 'Once' }])
  assert.deepEqual(results.map((result) => result.status), ['not-found', 'ambiguous'])
})

let passed = 0
for (const [name, run] of tests) {
  try {
    await run()
    passed += 1
    process.stdout.write(`  ok   ${name}\n`)
  } catch (error) {
    process.stderr.write(`  FAIL ${name}\n${error.stack}\n`)
  }
}
fs.rmSync(base, { recursive: true, force: true })
process.stdout.write(`\nblock write-back: ${passed}/${tests.length} passed\n`)
if (passed !== tests.length) process.exit(1)
