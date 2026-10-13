/**
 * Merging saves from more than one device (lib/draft-merge.mjs, and its twin
 * src/editor/chef/draft-merge.ts — both run on every case here).
 *
 * Before this, a save replaced the page's drafts wholesale: a laptop and a
 * phone open on the same page, each saving, meant the second erased the
 * first's work with no word said.
 */
import assert from 'node:assert/strict'
import * as bridge from '../lib/draft-merge.mjs'
import * as editor from '../dist/editor/chef/draft-merge.js'
import { mergeSaveWithReport } from '../lib/codegen.mjs'
import { createFroamPublishApi } from '../lib/publish-store.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tests = []
const test = (name, fn) => tests.push([name, fn])

const H1 = 'main:1/h1:1'
const P = 'main:1/p:1'
const BTN = 'main:1/button:1'

for (const [side, lib] of [['bridge', bridge], ['editor', editor]]) {
  const merge = (base, ours, theirs) => lib.mergeDrafts({ base: lib.signDrafts(base), ours, theirs })

  test(`${side}: a device that never saw the other's edit doesn't wipe it`, () => {
    const saved = { [H1]: { styles: { fontWeight: '700' } } }
    const phone = { [P]: { styles: { color: 'red' } } }
    const { drafts, conflicts } = merge({}, phone, saved)
    assert.deepEqual(drafts, { [H1]: { styles: { fontWeight: '700' } }, [P]: { styles: { color: 'red' } } })
    assert.deepEqual(conflicts, [])
  })

  test(`${side}: the same element, different properties: both kept`, () => {
    const base = { [H1]: { styles: { fontSize: '40px' } } }
    const laptop = { [H1]: { styles: { fontSize: '40px', color: 'navy' } } }
    const phone = { [H1]: { styles: { fontSize: '40px', fontWeight: '800' } } }
    const { drafts, conflicts } = merge(base, phone, laptop)
    assert.deepEqual(drafts[H1].styles, { fontSize: '40px', color: 'navy', fontWeight: '800' })
    assert.deepEqual(conflicts, [])
  })

  test(`${side}: the same property on both: ours wins, and it is reported`, () => {
    const base = { [H1]: { text: 'Hello' } }
    const { drafts, conflicts } = merge(base, { [H1]: { text: 'Hi there' } }, { [H1]: { text: 'Welcome' } })
    assert.equal(drafts[H1].text, 'Hi there')
    assert.deepEqual(conflicts, [H1])
  })

  test(`${side}: a reset on this device takes the edit away; one elsewhere is respected`, () => {
    const base = { [H1]: { styles: { color: 'red' } }, [P]: { styles: { color: 'blue' } } }
    // This device reset the heading; the other device reset the paragraph.
    const ours = { [P]: { styles: { color: 'blue' } } }
    const theirs = { [H1]: { styles: { color: 'red' } } }
    assert.deepEqual(merge(base, ours, theirs).drafts, {})
  })

  test(`${side}: one style property removed here, another added there`, () => {
    const base = { [BTN]: { styles: { color: 'white', padding: '8px' } } }
    const ours = { [BTN]: { styles: { color: 'white' } } }
    const theirs = { [BTN]: { styles: { color: 'white', padding: '8px', borderRadius: '12px' } } }
    assert.deepEqual(merge(base, ours, theirs).drafts[BTN].styles, { color: 'white', borderRadius: '12px' })
  })

  test(`${side}: fingerprints are bookkeeping, not edits`, () => {
    const base = { [H1]: { text: 'Hi' } }
    const ours = { [H1]: { text: 'Hi', fingerprint: { tag: 'h1', ordinal: 1 } } }
    const theirs = { [H1]: { text: 'Hello' } }
    const { drafts, conflicts } = merge(base, ours, theirs)
    assert.equal(drafts[H1].text, 'Hello')
    assert.deepEqual(conflicts, [])
  })

  test(`${side}: nothing changed anywhere is nothing changed`, () => {
    const page = { [H1]: { text: 'Hi', styles: { color: 'red' } } }
    const result = merge(page, page, page)
    assert.deepEqual(result.drafts, page)
    assert.equal(result.changed, false)
  })
}

test('editor and bridge sign identically (the bridge reads what the editor sends)', () => {
  const page = { [H1]: { text: 'Ünïcode ✓ — "quotes"', styles: { color: 'red', fontSize: '2rem' }, fingerprint: { tag: 'h1' } }, [P]: { imageUrl: 'data:image/png;base64,AAAA', media: '{"fit":"cover"}' } }
  assert.deepEqual(editor.signDrafts(page), bridge.signDrafts(page))
  assert.equal(editor.hashValue([{ family: 'Inter' }]), bridge.hashValue([{ family: 'Inter' }]))
})

test('save: with a base, a stale device keeps what another device saved', () => {
  const design = { version: 3, routes: { '/': { desktop: { [H1]: { styles: { fontWeight: '700' } } } } } }
  const saved = mergeSaveWithReport(design, { routeKey: '/', viewportMode: 'desktop', store: { [P]: { styles: { color: 'red' } } }, base: {} })
  assert.deepEqual(Object.keys(saved.store).sort(), [H1, P].sort())
})

test('save: without a base (an older editor) the device\'s drafts still replace the page\'s', () => {
  const design = { version: 3, routes: { '/': { desktop: { [H1]: { styles: { fontWeight: '700' } } } } } }
  const saved = mergeSaveWithReport(design, { routeKey: '/', viewportMode: 'desktop', store: { [P]: { styles: { color: 'red' } } } })
  assert.deepEqual(Object.keys(saved.store), [P])
})

test('save: a base that isn\'t one is ignored, not trusted', () => {
  const design = { version: 3, routes: { '/': { desktop: { [H1]: { text: 'Hi' } } } } }
  for (const base of [[], 'x', { [H1]: 'nope' }, { [H1]: { styles: ['a'] } }]) {
    const saved = mergeSaveWithReport(design, { routeKey: '/', viewportMode: 'desktop', store: { [P]: { text: 'P' } }, base })
    assert.deepEqual(Object.keys(saved.store), [P], `base ${JSON.stringify(base)} was trusted`)
  }
})

test('save: brand fonts this device never changed are not cleared by it', () => {
  const fonts = [{ family: 'Client Sans', faces: [{ weight: 400, style: 'normal', src: 'data:font/woff2;base64,AAAA' }] }]
  const design = { version: 3, routes: {}, brandFonts: fonts }
  const untouched = mergeSaveWithReport(design, { routeKey: '/', viewportMode: 'desktop', store: {}, brandFonts: [], brandFontsBase: bridge.hashValue([]) })
  assert.equal(untouched.design.brandFonts?.[0]?.family, 'Client Sans')
  const cleared = mergeSaveWithReport(design, { routeKey: '/', viewportMode: 'desktop', store: {}, brandFonts: [], brandFontsBase: bridge.hashValue(fonts) })
  assert.equal(cleared.design.brandFonts, undefined)
})

test('Save (the publish store): two devices pressing Save on one page keep each other\'s edits', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'froam-merge-publish-'))
  const api = createFroamPublishApi({ file: path.join(dir, 'froam.published.json') })
  const post = async (body) => {
    const res = { statusCode: 0, headers: {}, body: '', setHeader(key, value) { this.headers[key] = value }, end(value) { this.body = value } }
    const req = { method: 'POST', url: '/api/froam/published', body, headers: {} }
    await api(req, res)
    return { status: res.statusCode, ...JSON.parse(res.body) }
  }
  const laptop = await post({ routeKey: '/', viewportMode: 'desktop', store: { [H1]: { styles: { color: 'navy' } } }, base: {} })
  assert.equal(laptop.status, 200)
  // The phone never saw the laptop's Save.
  const phone = await post({ routeKey: '/', viewportMode: 'desktop', store: { [P]: { text: 'From the bus' } }, base: {} })
  assert.deepEqual(Object.keys(phone.design.store).sort(), [H1, P].sort())
  // An older editor, with no base, still replaces — as it always did.
  const old = await post({ routeKey: '/', viewportMode: 'desktop', store: { [P]: { text: 'Old editor' } } })
  assert.deepEqual(Object.keys(old.design.store), [P])
  fs.rmSync(dir, { recursive: true, force: true })
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}
console.log(`draft merge: ${tests.length - failed}/${tests.length} passed`)
process.exitCode = failed ? 1 : 0
