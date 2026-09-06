/* Look Studio: every recipe must carry a description, and every description
   must belong to a recipe. Parsed from source rather than imported so the
   check costs nothing and doesn't drag React into a node test. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const source = fs.readFileSync(path.join(ROOT, 'src/editor/FroamFloatingBar.tsx'), 'utf8')

const tests = []
const test = (name, fn) => tests.push([name, fn])

function sliceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `could not find ${startMarker}`)
  const end = source.indexOf(endMarker, start)
  assert.notEqual(end, -1, `could not find the end of ${startMarker}`)
  return source.slice(start, end)
}

const looksBlock = sliceBetween('const LOOKS: Look[] = [', '\n]')
const notesBlock = sliceBetween('export const LOOK_NOTES: Record<string, string> = {', '\n}')

const lookNames = [...looksBlock.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1])
const lookGroups = [...looksBlock.matchAll(/group:\s*'([^']+)'/g)].map((match) => match[1])
const declaredGroups = [...sliceBetween('const LOOK_GROUPS = [', '] as const')
  .matchAll(/'([^']+)'/g)].map((match) => match[1])
const noteKeys = [...notesBlock.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z][A-Za-z0-9]*)):\s/gm)]
  .map((match) => match[1] ?? match[2])

test('the recipe list is intact', () => {
  assert.equal(lookNames.length, 105, `expected 105 recipes, found ${lookNames.length}`)
  assert.equal(lookGroups.length, lookNames.length, 'a recipe is missing its group')
  assert.equal(new Set(lookNames).size, lookNames.length, 'two recipes share a name')
})

test('every recipe has a description', () => {
  const missing = lookNames.filter((name) => !noteKeys.includes(name))
  assert.deepEqual(missing, [], `recipes with no note: ${missing.join(', ')}`)
})

test('no description is left behind by a renamed or deleted recipe', () => {
  const orphaned = noteKeys.filter((key) => !lookNames.includes(key))
  assert.deepEqual(orphaned, [], `notes with no recipe: ${orphaned.join(', ')}`)
})

test('descriptions are useful sentences, not restatements of the name', () => {
  for (const name of lookNames) {
    const note = notesBlock.match(
      new RegExp(`(?:'${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'|\\b${name}\\b):\\s*'([^']*)'`),
    )?.[1]
    assert.ok(note, `no note text parsed for ${name}`)
    assert.ok(note.length >= 20, `note for ${name} is too short to help: "${note}"`)
    assert.ok(/[.!]$/.test(note), `note for ${name} should end in a full stop: "${note}"`)
    assert.notEqual(note.toLowerCase().trim(), name.toLowerCase(), `note for ${name} just repeats the name`)
  }
})

test('every recipe sits in a declared group', () => {
  for (const group of new Set(lookGroups)) {
    assert.ok(declaredGroups.includes(group), `"${group}" is used but missing from LOOK_GROUPS`)
  }
})

test('no declared group is empty', () => {
  for (const group of declaredGroups) {
    assert.ok(lookGroups.includes(group), `"${group}" is a tab with no recipes behind it`)
  }
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`) }
  catch (error) { console.error(`✗ ${name}`); throw error }
}
console.log(`\n${passed}/${tests.length} quick-looks tests passed`)
