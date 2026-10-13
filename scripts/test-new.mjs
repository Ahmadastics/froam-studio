/**
 * `froam new`: a website from nothing. Each starter is a plain page with
 * Froam's two tags already in it, every piece of its text is unique (copy
 * write-back only writes an edit whose text appears once), it never writes
 * over a page that exists, and an empty folder is offered a site instead of
 * a 404 with no editor.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Readable, Writable } from 'node:stream'

import { STARTER_KINDS, renderStarter, slugify, titleFromFolder } from '../lib/starters.mjs'
import { NEW_SITE_HINT, isNewSiteAnswer, promptWebsiteUrl } from '../lib/launcher.mjs'
import { writeTextEdits } from '../lib/source-writeback.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CLI = path.join(ROOT, 'bin', 'froam.mjs')
const base = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'froam-test-new-'))

function froam(args, cwd = base) {
  const res = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', timeout: 60000, input: '', env: { ...process.env, NO_COLOR: '1' } })
  return { code: res.status, out: `${res.stdout}${res.stderr}` }
}

/** The text a person sees on the page, one entry per text node. */
function visibleTexts(html) {
  const body = html.slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  return body.split(/<[^>]+>/).map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

const tests = []
const test = (name, run) => tests.push([name, run])

test('every starter: a page with the two shipping tags, a title and no forms', () => {
  for (const { id } of STARTER_KINDS) {
    const html = renderStarter({ name: 'Ade’s Bakery & Co', kind: id, year: 2026 })
    assert.match(html, /^<!doctype html>/, id)
    assert.match(html, /<link rel="stylesheet" href="froam\/froam.generated.css">/, id)
    assert.match(html, /<script src="froam\/froam.runtime.js" defer><\/script>\n {2}<\/head>/, id)
    assert.match(html, /<title>Ade’s Bakery &amp; Co<\/title>/, `${id}: name escaped`)
    assert.match(html, /<meta name="viewport"/, id)
    assert.doesNotMatch(html, /<form|<input|contenteditable/, `${id}: nothing that needs a backend`)
    assert.match(html, /<header class="site-header">[\s\S]*<a class="logo" href="#top">/, `${id}: a logo the Library's theme sampler finds`)
  }
})

test('every starter: no piece of text appears twice, so each edit can be written back', () => {
  for (const { id } of STARTER_KINDS) {
    const texts = visibleTexts(renderStarter({ name: 'Northwind Studio', kind: id, year: 2026 }))
    const seen = new Set()
    for (const text of texts) {
      assert.ok(!seen.has(text), `${id}: "${text}" appears more than once`)
      seen.add(text)
    }
  }
})

test('names and folders', () => {
  assert.equal(slugify("Ade's Bakery"), 'ades-bakery')
  assert.equal(slugify('Café  Noir!'), 'cafe-noir')
  assert.equal(slugify('***'), 'my-website')
  assert.equal(titleFromFolder('ades-bakery'), 'Ades Bakery')
})

test('froam new <folder>: writes the site and the workspace, then says how to open it', () => {
  const { code, out } = froam(['new', 'northwind', '--kind', 'product', '--no-open'])
  assert.equal(code, 0, out)
  const dir = path.join(base, 'northwind')
  for (const rel of ['index.html', 'README.md', 'froam.config.json', 'froam/froam.design.json', 'froam/froam.generated.css', 'froam/froam.runtime.js']) {
    assert.ok(fs.existsSync(path.join(dir, rel)), rel)
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'froam.config.json'), 'utf8')), { dir: 'froam', framework: 'static' })
  assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /Introducing Northwind/)
  assert.match(out, /made Northwind \(product or startup\)/)
  assert.match(out, /Open it in the editor: npx @ahmadastic\/froam/)
})

test('froam new: an edit to starter text is written into index.html', () => {
  const dir = path.join(base, 'northwind')
  const results = writeTextEdits(dir, [
    { from: 'The simplest way to get your work done.', to: 'Invoices that pay themselves.' },
    { from: 'Set up in minutes', to: 'Send in seconds' },
  ])
  assert.deepEqual(results.map((result) => result.status), ['written', 'written'], JSON.stringify(results))
  assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /<h1>Invoices that pay themselves.<\/h1>/)
})

test('froam new: never writes over a page that is already there', () => {
  const before = fs.readFileSync(path.join(base, 'northwind', 'index.html'), 'utf8')
  const { code, out } = froam(['new', 'northwind', '--no-open'])
  assert.equal(code, 1)
  assert.match(out, /already has an index.html/)
  assert.equal(fs.readFileSync(path.join(base, 'northwind', 'index.html'), 'utf8'), before)
})

test('froam new: no folder named → one named after the site, never one that is taken', () => {
  const first = froam(['new', '--name', 'Kiln and Co', '--kind', 'blank', '--no-open'])
  assert.equal(first.code, 0, first.out)
  const second = froam(['new', '--name', 'Kiln and Co', '--kind', 'blank', '--no-open'])
  assert.equal(second.code, 0, second.out)
  assert.ok(fs.existsSync(path.join(base, 'kiln-and-co', 'index.html')))
  assert.ok(fs.existsSync(path.join(base, 'kiln-and-co-2', 'index.html')))
})

test('froam new inside a code project: the site goes to the Froam folder, not into the project', () => {
  const home = path.join(base, 'home')
  const projectDir = path.join(base, 'some-app')
  fs.mkdirSync(home)
  fs.mkdirSync(projectDir)
  fs.writeFileSync(path.join(projectDir, 'package.json'), '{}')
  const res = spawnSync(process.execPath, [CLI, 'new', '--name', 'Side Project', '--no-open'], {
    cwd: projectDir, encoding: 'utf8', timeout: 60000, input: '',
    env: { ...process.env, NO_COLOR: '1', HOME: home, USERPROFILE: home },
  })
  assert.equal(res.status, 0, `${res.stdout}${res.stderr}`)
  assert.ok(fs.existsSync(path.join(home, 'Froam', 'side-project', 'index.html')))
  assert.ok(!fs.existsSync(path.join(projectDir, 'side-project')))
})

test('froam new: an unknown kind is refused with the list', () => {
  const { code, out } = froam(['new', 'x', '--kind', 'shop', '--no-open'])
  assert.equal(code, 1)
  assert.match(out, /business, portfolio, product, event, blank/)
  assert.ok(!fs.existsSync(path.join(base, 'x', 'index.html')))
})

test('froam <empty folder> without a terminal: says how to start a site instead of serving a 404', () => {
  fs.mkdirSync(path.join(base, 'empty'))
  const { code, out } = froam(['empty'])
  assert.equal(code, 1)
  assert.match(out, /no web page in .*empty.* yet/)
  assert.match(out, /froam new/)
})

test('the first question offers a new site', async () => {
  let shown = ''
  const output = new Writable({ write(chunk, _encoding, callback) { shown += chunk; callback() } })
  const answer = await promptWebsiteUrl({ input: Readable.from(['n\n']), output })
  assert.ok(shown.includes(NEW_SITE_HINT.trim()))
  assert.ok(isNewSiteAnswer(answer))
  assert.ok(isNewSiteAnswer(' New '))
  assert.ok(!isNewSiteAnswer('news.com'))
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
process.stdout.write(`\nfroam new: ${passed}/${tests.length} passed\n`)
if (passed !== tests.length) process.exit(1)
