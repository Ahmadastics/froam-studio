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
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Readable, Writable } from 'node:stream'

import { STARTER_KINDS, STARTER_PAGES, STARTER_STYLES, newSiteId, phoneDigits, renderStarter, renderStarterPage, slugify, starterTheme, titleFromFolder } from '../lib/starters.mjs'
import { NEW_SITE_HINT, isNewSiteAnswer, promptWebsiteUrl } from '../lib/launcher.mjs'
import { writeTextEdits } from '../lib/source-writeback.mjs'
import { artStylesheet, sceneFor, sceneNames } from '../lib/starter-art.mjs'

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

test('every style on every starter: only <head> changes, so element paths and saved edits survive a switch', () => {
  const body = (html) => html.slice(html.indexOf('<body'))
  for (const { id: kind } of STARTER_KINDS) {
    const original = renderStarter({ name: 'Northwind', kind, year: 2026 })
    for (const { id: style, theme } of STARTER_STYLES) {
      const html = renderStarter({ name: 'Northwind', kind, style, year: 2026 })
      assert.equal(body(html), body(original), `${kind} in ${style}: the markup changed`)
      if (!theme) continue
      assert.ok(html.includes(`--accent: ${theme.accent};`), `${kind} in ${style}: accent not applied`)
      assert.ok(html.includes(`family=${theme.heading.replace(/ /g, '+')}:wght@`), `${kind} in ${style}: heading font not loaded`)
    }
  }
  assert.equal(
    renderStarter({ name: 'Northwind', kind: 'event', style: 'no-such-style', year: 2026 }),
    renderStarter({ name: 'Northwind', kind: 'event', year: 2026 }),
    'an unknown style falls back to the kind’s own look',
  )
})

/** WCAG contrast between two #rrggbb colours. */
function contrast(a, b) {
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('every style keeps its words readable: 4.5:1 for body, muted and accent text and button labels', () => {
  for (const { id, theme } of STARTER_STYLES) {
    if (!theme) continue
    for (const [what, fg, bg] of [['body text', theme.ink, theme.paper], ['muted text', theme.muted, theme.paper], ['accent text', theme.accent, theme.paper], ['button label', theme.accentInk, theme.accent]]) {
      assert.ok(contrast(fg, bg) >= 4.5, `${id}: ${what} is ${contrast(fg, bg).toFixed(2)}:1`)
    }
  }
})

test('every kind\'s own look keeps its words readable too', () => {
  for (const { id } of STARTER_KINDS) {
    const theme = starterTheme(id)
    for (const [what, fg, bg] of [['body text', theme.ink, theme.paper], ['muted text', theme.muted, theme.paper], ['accent text', theme.accent, theme.paper], ['button label', theme.accentInk, theme.accent]]) {
      assert.ok(contrast(fg, bg) >= 4.5, `${id}: ${what} is ${contrast(fg, bg).toFixed(2)}:1`)
    }
  }
})

test('more pages: every kind with every page, no text twice on a page, each page linking all the others', () => {
  const all = STARTER_PAGES.map((entry) => entry.id)
  for (const { id: kind } of STARTER_KINDS) {
    const home = renderStarter({ name: 'Northwind Studio', kind, year: 2026, pages: all })
    const files = [['index.html', home], ...all.map((page) => [STARTER_PAGES.find((entry) => entry.id === page).file, renderStarterPage({ name: 'Northwind Studio', kind, page, pages: all, year: 2026 })])]
    for (const [file, html] of files) {
      const seen = new Set()
      for (const text of visibleTexts(html)) {
        assert.ok(!seen.has(text), `${kind} ${file}: "${text}" appears more than once`)
        seen.add(text)
      }
      for (const entry of STARTER_PAGES) assert.ok(html.includes(`href="${entry.file}"`), `${kind} ${file} has no link to ${entry.file}`)
      assert.match(html, /<link rel="stylesheet" href="froam\/froam.generated.css">/, `${kind} ${file}: shipping tags`)
    }
  }
})

test('more pages are links added at the end of the nav: nothing already on index.html moves', () => {
  for (const { id: kind } of STARTER_KINDS) {
    const plain = renderStarter({ name: 'Northwind', kind, year: 2026 })
    const grown = renderStarter({ name: 'Northwind', kind, year: 2026, pages: ['about', 'contact'] })
    const added = grown.replace(/\n {10}<a href="(about|contact)\.html">[^<]+<\/a>/g, '')
    assert.equal(added, plain, `${kind}: adding pages changed more than the nav's end`)
  }
})

test('contact details replace the placeholders; WhatsApp is a button at the very end of <body>', () => {
  const contact = { email: 'ade@bakery.ng', phone: '+234 906 585 7458', whatsapp: '+234 906 585 7458' }
  for (const { id: kind } of STARTER_KINDS) {
    const html = renderStarter({ name: 'Ade’s Bakery', kind, year: 2026, contact })
    assert.doesNotMatch(html, /example\.com|555 0100|5550100/, `${kind}: a placeholder survived`)
    assert.match(html, /<a class="whatsapp" href="https:\/\/wa\.me\/2349065857458\?text=Hello%20Ade%E2%80%99s%20Bakery!"/, `${kind}: no WhatsApp button`)
    assert.match(html, /<span>Chat with us<\/span>\n {4}<\/a>\n {2}<\/body>/, `${kind}: the button is not the last thing in <body>`)
    const without = renderStarter({ name: 'Ade’s Bakery', kind, year: 2026, contact: { email: contact.email, phone: contact.phone } })
    assert.equal(html.slice(0, html.indexOf('<a class="whatsapp"')).trimEnd(), without.slice(0, without.indexOf('</body>')).trimEnd(), `${kind}: WhatsApp moved something`)
  }
  assert.doesNotMatch(renderStarter({ name: 'X', kind: 'shop', contact: { whatsapp: 'not a number' } }), /wa\.me/, 'a bad number made a button')
  assert.equal(phoneDigits('+234 906 585 7458'), '2349065857458')
  assert.equal(phoneDigits('12'), '')
  // A Nigerian mobile number written the local way gets its country code.
  assert.equal(phoneDigits('0803 555 0101'), '2348035550101')
  assert.equal(phoneDigits('08035550101'), '2348035550101')
  assert.equal(phoneDigits('0701-234-5678'), '2347012345678')
  assert.equal(phoneDigits('0906 585 7458'), '2349065857458')
  assert.equal(phoneDigits('00234 906 585 7458'), '2349065857458')
  // Anything else stays as typed: another country's local number, a short landline, a number already international.
  assert.equal(phoneDigits('07911 123456'), '07911123456')
  assert.equal(phoneDigits('+44 7911 123456'), '447911123456')
  assert.equal(phoneDigits('09 2345678'), '092345678')
  const local = renderStarter({ name: 'Zainab Hair Studio', kind: 'business', contact: { whatsapp: '0803 555 0101', phone: '0803 555 0101' } })
  assert.match(local, /href="https:\/\/wa\.me\/2348035550101\?text=/, 'a local number made a WhatsApp link with no country code')
  assert.match(local, /href="tel:\+2348035550101"/, 'a local number made a phone link with no country code')
  assert.match(local, />0803 555 0101</, 'the number is no longer shown the way it was typed')
})

test('made with Froam: every page carries the generator tag, its site id and a faint credit under the footer', () => {
  const siteId = newSiteId()
  assert.match(siteId, /^[0-9a-f]{12}$/)
  assert.notEqual(newSiteId(), siteId, 'two sites got the same id')
  for (const { id: kind } of STARTER_KINDS) {
    const pages = [renderStarter({ name: 'Mark Test', kind, siteId }), ...STARTER_PAGES.map((page) => renderStarterPage({ name: 'Mark Test', kind, page: page.id, siteId }))]
    for (const html of pages) {
      assert.ok(html.includes('<meta name="generator" content="Froam">'), `${kind}: no generator tag`)
      assert.ok(html.includes(`<!-- Made with Froam · https://froam.vercel.app · site ${siteId} -->`), `${kind}: no site mark`)
      // The credit is the footer's last element, after the row that was always there: no path in the page moves.
      const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>') + 9)
      assert.match(footer, /<\/div>\s*<p class="made-with"><a href="https:\/\/froam\.vercel\.app" rel="noopener">Made with Froam<\/a><\/p>\s*<\/footer>$/, `${kind}: the credit is not last in the footer`)
    }
  }
  // An id that could close the comment is left out, not written.
  const hostile = renderStarter({ name: 'Mark Test', siteId: 'x --><script>alert(1)</script>' })
  assert.ok(!hostile.includes('<script>alert(1)'), 'an id broke out of the comment')
  assert.ok(hostile.includes('<!-- Made with Froam · https://froam.vercel.app -->'))
})

test('made with Froam: froam new gives one site one id, the same on every page', () => {
  const made = froam(['new', 'marked-site', '--pages', 'about,gallery', '--no-open'])
  assert.equal(made.code, 0, made.out)
  const ids = ['index.html', 'about.html', 'gallery.html'].map((name) => fs.readFileSync(path.join(base, 'marked-site', name), 'utf8').match(/<!-- Made with Froam · https:\/\/froam\.vercel\.app · site ([0-9a-f]{12}) -->/)?.[1])
  assert.ok(ids[0], 'index.html has no site id')
  assert.deepEqual(ids, [ids[0], ids[0], ids[0]], 'the pages of one site have different ids')
})

test('starter pictures: every frame shows a drawing in the site\'s colours, which marks itself as not a photo', () => {
  for (const { id: kind } of STARTER_KINDS) {
    for (const { id: style } of STARTER_STYLES) {
      const pages = [renderStarter({ name: 'Art', kind, style }), ...STARTER_PAGES.map((page) => renderStarterPage({ name: 'Art', kind, style, page: page.id }))]
      for (const html of pages) {
        const body = html.slice(html.indexOf('<body'))
        const frames = [...body.matchAll(/<div class="photo[^"]*" data-froam-image-frame="true"( data-scene="([a-z0-9-]+)")?/g)]
        for (const frame of frames) {
          assert.ok(frame[2], `${kind}/${style}: a picture frame has no scene`)
          const rule = html.match(new RegExp(`\\.photo\\[data-scene="${frame[2]}"\\] \\{ background-image: url\\("data:image/svg\\+xml,([^"]+)"\\); \\}`))
          assert.ok(rule, `${kind}/${style}: no drawing for ${frame[2]}`)
          assert.ok(rule[1].includes("data-froam-art='"), 'a drawing does not mark itself as a drawing')
          assert.ok(!/[<>#"]/.test(rule[1]), 'a drawing is not escaped for a data URI')
        }
      }
    }
  }
})

test('starter pictures: every scene draws, numbered things take turns, and the colours follow the style', () => {
  const theme = starterTheme('restaurant', 'original')
  for (const scene of sceneNames()) assert.ok(artStylesheet(theme, [scene]).includes(`data-froam-art='${scene}'`), `${scene} draws nothing`)
  assert.equal(artStylesheet(theme, ['nonsense']), '', 'an unknown scene is skipped')
  assert.deepEqual(['first', 'second', 'third', 'fourth'].map((n) => sceneFor(`A photo of the ${n} product`)), ['product-1', 'product-2', 'product-3', 'product-1'])
  assert.equal(sceneFor('A photo of your best dish'), 'dish')
  assert.equal(sceneFor('A photo of your school grounds'), 'building')
  const light = artStylesheet(starterTheme('restaurant', 'original'), ['dish'])
  const dark = artStylesheet(starterTheme('event', 'original'), ['dish'])
  assert.notEqual(light, dark, 'the drawing ignores the style')
  assert.ok(light.includes(starterTheme('restaurant', 'original').accent.replace('#', '%23')), 'the drawing does not use the accent')
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
  // Review-room invite links are keys; the record is meant to be committed.
  const ignored = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')
  assert.match(ignored, /^froam\/froam\.rooms\.json$/m)
  assert.doesNotMatch(ignored, /record/)
  assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /Introducing Northwind/)
  assert.match(out, /made Northwind \(product or startup\)/)
  assert.match(out, /Open it in the editor: npx @ahmadastic\/froam/)
})

test('the command froam new prints opens the site\'s own froam/ folder, from any folder', async () => {
  const { code, out } = froam(['new', 'harbour', '--kind', 'business', '--no-open'])
  assert.equal(code, 0, out)
  const site = path.join(base, 'harbour')
  const elsewhere = path.join(base, 'somewhere-else')
  fs.mkdirSync(elsewhere)
  // The printed command serves the site by its full path; started from another folder, it must not save there.
  const child = spawn(process.execPath, [CLI, 'dev', '--serve', site, '--port', '0'], { cwd: elsewhere, env: { ...process.env, NO_COLOR: '1', FROAM_SHARE: 'off' } })
  let said = ''
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`froam dev said: ${said}`)), 20000)
      const listen = (chunk) => { said += chunk; if (/Ctrl\+C to stop/.test(said)) { clearTimeout(timer); resolve() } }
      child.stdout.on('data', listen)
      child.stderr.on('data', listen)
      child.on('exit', () => { clearTimeout(timer); reject(new Error(`froam dev stopped: ${said}`)) })
    })
  } finally {
    child.kill()
  }
  const repoLine = said.split('\n').find((line) => line.includes('repo')) ?? ''
  assert.ok(repoLine.includes(path.join(site, 'froam')), repoLine)
  assert.deepEqual(fs.readdirSync(elsewhere), [], 'a froam/ folder was made where the terminal was')
})

test('froam new --style: the site wears it; a style that does not exist is refused, nothing written', () => {
  const made = froam(['new', 'northwind-noir', '--kind', 'event', '--style', 'noir', '--no-open'])
  assert.equal(made.code, 0, made.out)
  const html = fs.readFileSync(path.join(base, 'northwind-noir', 'index.html'), 'utf8')
  assert.ok(html.includes('--accent: #f97316;') && html.includes('family=Syne:wght@'), 'noir not applied')
  const refused = froam(['new', 'northwind-plaid', '--style', 'plaid', '--no-open'])
  assert.notEqual(refused.code, 0)
  assert.match(refused.out, /there is no "plaid" style — use one of: original, monochrome/)
  assert.ok(!fs.existsSync(path.join(base, 'northwind-plaid')), 'a refused style still made a folder')
})

test('froam new --pages --whatsapp --email: the pages are written, linked, and carry the real details', () => {
  const made = froam(['new', 'northwind-salon', '--kind', 'salon', '--pages', 'about,contact', '--whatsapp', '+234 906 585 7458', '--email', 'book@northwind.ng', '--no-open'])
  assert.equal(made.code, 0, made.out)
  const dir = path.join(base, 'northwind-salon')
  for (const file of ['index.html', 'about.html', 'contact.html']) {
    const html = fs.readFileSync(path.join(dir, file), 'utf8')
    assert.ok(html.includes('wa.me/2349065857458'), `${file}: no WhatsApp button`)
    assert.ok(html.includes('href="contact.html"'), `${file}: no link to the contact page`)
  }
  assert.ok(fs.readFileSync(path.join(dir, 'contact.html'), 'utf8').includes('mailto:book@northwind.ng'), 'contact page kept the placeholder email')
  const refused = froam(['new', 'northwind-blog', '--pages', 'blog', '--no-open'])
  assert.notEqual(refused.code, 0)
  assert.match(refused.out, /there is no "blog" page — use any of: about, services, gallery, contact/)
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
  const { code, out } = froam(['new', 'x', '--kind', 'spaceship', '--no-open'])
  assert.equal(code, 1)
  assert.match(out, /business, restaurant, salon, shop, school, community, portfolio, product, event, blank/)
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
