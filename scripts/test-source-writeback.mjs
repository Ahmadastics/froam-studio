/**
 * Copy edits written into the project's source: only where the original
 * words appear exactly once, as a whole text node or string, and always
 * escaped for the spot they land in. Everything else is reported and left
 * alone — a wrong write is worse than none.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { encodeForContext, findTextOccurrences, isInComment, writeTextEdits } from '../lib/source-writeback.mjs'

const tests = []
const test = (name, fn) => tests.push([name, fn])

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-writeback-'))
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
  return { root, read, done: () => fs.rmSync(root, { recursive: true, force: true }) }
}

test('an HTML heading is rewritten in place', () => {
  const p = project({ 'index.html': '<main>\n  <h1 class="hero">Hello world</h1>\n</main>\n' })
  const [result] = writeTextEdits(p.root, [{ from: 'Hello world', to: 'Hello there' }])
  assert.deepEqual(result, { status: 'written', file: 'index.html', line: 2 })
  assert.equal(p.read('index.html'), '<main>\n  <h1 class="hero">Hello there</h1>\n</main>\n')
  p.done()
})

test('entities in the source are matched, and the new text is escaped for HTML', () => {
  const p = project({ 'index.html': '<p>Tom &amp; Jerry</p>' })
  writeTextEdits(p.root, [{ from: 'Tom & Jerry', to: 'Tom & <Friends>' }])
  assert.equal(p.read('index.html'), '<p>Tom &amp; &lt;Friends&gt;</p>')
  p.done()
})

test('a JSX text node across lines is rewritten, braces escaped for JSX', () => {
  const p = project({ 'src/Hero.tsx': 'export const Hero = () => (\n  <h1 className="title">\n    Ship faster\n  </h1>\n)\n' })
  const [result] = writeTextEdits(p.root, [{ from: 'Ship faster', to: 'Ship {braces} faster' }])
  assert.equal(result.status, 'written')
  assert.ok(p.read('src/Hero.tsx').includes("Ship {'{'}braces{'}'} faster"), p.read('src/Hero.tsx'))
  p.done()
})

test('a translation in a JSON file is rewritten with JSON escaping', () => {
  const p = project({ 'src/locales/en.json': '{\n  "hero": { "title": "Welcome back" }\n}\n' })
  writeTextEdits(p.root, [{ from: 'Welcome back', to: 'Say "hi"' }])
  const json = JSON.parse(p.read('src/locales/en.json'))
  assert.equal(json.hero.title, 'Say "hi"')
  p.done()
})

test('a JS string literal keeps its quotes valid', () => {
  const p = project({ 'src/copy.ts': "export const cta = 'Get started'\nexport const other = `Read the docs`\n" })
  writeTextEdits(p.root, [{ from: 'Get started', to: "Let's go" }, { from: 'Read the docs', to: 'Cost: ${0}' }])
  const source = p.read('src/copy.ts')
  assert.ok(source.includes("'Let\\'s go'"), source)
  assert.ok(source.includes('`Cost: \\${0}`'), source)
  p.done()
})

test('text that appears more than once is reported, and nothing changes', () => {
  const p = project({ 'index.html': '<a>Learn more</a>', 'about.html': '<a>Learn more</a>' })
  const [result] = writeTextEdits(p.root, [{ from: 'Learn more', to: 'Read on' }])
  assert.equal(result.status, 'ambiguous')
  assert.equal(result.count, 2)
  assert.equal(p.read('index.html'), '<a>Learn more</a>')
  assert.equal(p.read('about.html'), '<a>Learn more</a>')
  p.done()
})

test('a commented-out copy is not a match; the live one is written', () => {
  const p = project({
    'src/App.tsx': '// <p>Old headline</p>\n{/* <p>Old headline</p> */}\nexport const A = () => <p>Old headline</p>\n',
    'index.html': '<!-- <p>Old headline</p> -->\n<div id="root"></div>',
  })
  const [result] = writeTextEdits(p.root, [{ from: 'Old headline', to: 'New headline' }])
  assert.equal(result.status, 'written')
  const app = p.read('src/App.tsx')
  assert.ok(app.includes('<p>New headline</p>') && app.startsWith('// <p>Old headline</p>'), app)
  assert.ok(p.read('index.html').includes('<!-- <p>Old headline</p> -->'))
  p.done()
})

test('an object key is not copy', () => {
  const p = project({ 'src/prices.ts': 'export const plans = { "Starter plan": 0 }\n' })
  const [result] = writeTextEdits(p.root, [{ from: 'Starter plan', to: 'Free plan' }])
  assert.equal(result.status, 'not-found')
  p.done()
})

test('part of a longer string is never rewritten', () => {
  const p = project({ 'index.html': '<p>Hello world, and welcome</p>' })
  const [result] = writeTextEdits(p.root, [{ from: 'Hello world', to: 'Bye' }])
  assert.equal(result.status, 'not-found')
  assert.equal(p.read('index.html'), '<p>Hello world, and welcome</p>')
  p.done()
})

test('dependencies, builds and dotfolders are never searched', () => {
  const p = project({
    'node_modules/pkg/index.js': "module.exports = '<b>Unique phrase here</b>'",
    'dist/index.html': '<b>Unique phrase here</b>',
    '.cache/x.html': '<b>Unique phrase here</b>',
  })
  const [result] = writeTextEdits(p.root, [{ from: 'Unique phrase here', to: 'Changed' }])
  assert.equal(result.status, 'not-found')
  assert.ok(p.read('dist/index.html').includes('Unique phrase here'))
  p.done()
})

test('very short text is skipped rather than guessed at', () => {
  const p = project({ 'index.html': '<b>Hi</b>' })
  const [result] = writeTextEdits(p.root, [{ from: 'Hi', to: 'Hey' }])
  assert.equal(result.status, 'skipped')
  p.done()
})

test('new lines become <br> in markup and \\n in strings', () => {
  assert.equal(encodeForContext('One\nTwo', { kind: 'markup' }, '.html'), 'One<br>Two')
  assert.equal(encodeForContext('One\nTwo', { kind: 'markup' }, '.tsx'), 'One<br />Two')
  assert.equal(encodeForContext('One\nTwo', { kind: 'string', quote: "'" }, '.ts'), 'One\\nTwo')
})

test('two edits in one file both land', () => {
  const p = project({ 'index.html': '<h1>First title</h1>\n<p>Second line of copy</p>' })
  const results = writeTextEdits(p.root, [{ from: 'First title', to: 'Title one' }, { from: 'Second line of copy', to: 'Line two' }])
  assert.deepEqual(results.map((r) => r.status), ['written', 'written'])
  assert.equal(p.read('index.html'), '<h1>Title one</h1>\n<p>Line two</p>')
  p.done()
})

test('a match inside a string inside HTML (a script building markup) is markup there', () => {
  const p = project({ 'index.html': "<script>el.innerHTML = '<h4 id=\"t\">Get 10% off</h4>'</script>" })
  const [result] = writeTextEdits(p.root, [{ from: 'Get 10% off', to: 'Get 15% off now' }])
  assert.equal(result.status, 'written')
  assert.ok(p.read('index.html').includes('<h4 id="t">Get 15% off now</h4>'))
  p.done()
})

test('comment detection ignores URLs', () => {
  assert.equal(isInComment('const u = "https://example.com"; <p>Text</p>', 40), false)
  assert.equal(isInComment('  // <p>Text</p>', 9), true)
  assert.equal(findTextOccurrences('<a href="https://x.y">Visit the site</a>', 'Visit the site').length, 1)
})

let failed = 0
for (const [name, fn] of tests) {
  try { fn(); console.log(`  ok   ${name}`) } catch (error) {
    failed += 1; console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}
console.log(`\nsource write-back: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
