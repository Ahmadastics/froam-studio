import assert from 'node:assert/strict'
import { generateCss } from '../lib/codegen.mjs'
import {
  createReusableStyle,
  decideLibraryUpdate,
  emptyDesignSystem,
  publishLibraryRelease,
  recordStyleUse,
  resolveDesignVariable,
  saveReusableStyle,
  seedStarterDesignSystem,
  setActiveModes,
  upsertDesignVariable,
} from '../dist/project/design-system.js'
import { applyProjectEvent, createProjectDocument, createProjectEvent, deriveBranchState } from '../dist/project/event-log.js'
import { componentCatalogFamilies } from '../dist/project/component-adapter.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('starter system includes light dark mobile and brand modes', () => {
  const system = seedStarterDesignSystem(emptyDesignSystem(), 1)
  assert.deepEqual(new Set(Object.values(system.modes).map((mode) => mode.kind)), new Set(['base', 'light', 'dark', 'mobile', 'brand']))
  assert.ok(Object.keys(system.variables).length >= 5)
  assert.ok(Object.keys(system.styles).length >= 5)
  assert.equal(Object.keys(system.siteKits).length, 3)
})

test('variables resolve through active mode inheritance and semantic aliases', () => {
  let system = seedStarterDesignSystem(emptyDesignSystem(), 1)
  system = upsertDesignVariable(system, { id: 'var:action', name: 'Action', cssName: '--action', kind: 'color', role: 'semantic', collection: 'Semantic', values: {}, aliasTo: 'var:accent' })
  assert.equal(resolveDesignVariable(setActiveModes(system, ['mode:light']), 'var:action'), '#14b8a6')
  assert.equal(resolveDesignVariable(setActiveModes(system, ['mode:dark']), 'var:action'), '#5eead4')
  assert.equal(resolveDesignVariable(setActiveModes(system, ['mode:brand']), 'var:action'), '#7c3aed')
})

test('mobile mode overrides responsive variables without duplicating the token', () => {
  const system = setActiveModes(seedStarterDesignSystem(emptyDesignSystem(), 1), ['mode:mobile', 'mode:light'])
  assert.equal(resolveDesignVariable(system, 'var:radius'), '14px')
  assert.equal(resolveDesignVariable(system, 'var:space'), '36px')
})

test('reusable looks retain base hover focus and active states and version safely', () => {
  let system = emptyDesignSystem()
  const style = createReusableStyle({ id: 'style:test', name: 'Test', now: 1, states: { base: { color: 'red' }, hover: { color: 'blue' }, focus: { outline: '2px solid' }, active: { transform: 'scale(.98)' } } })
  system = saveReusableStyle(system, style)
  system = saveReusableStyle(system, { ...style, states: { ...style.states, base: { color: 'green' } } })
  system = recordStyleUse(system, style.id, 'node:one')
  assert.equal(system.styles[style.id].version, 2)
  assert.equal(system.styles[style.id].states.hover.color, 'blue')
  assert.deepEqual(system.styles[style.id].usageNodeIds, ['node:one'])
})

test('catalog components become families with props slots and named variants', () => {
  const families = componentCatalogFamilies([
    { id: 'hero-01', title: 'Centered', category: 'Hero', anatomy: ['headline', 'action'] },
    { id: 'hero-02', title: 'Split', category: 'Hero', anatomy: ['copy', 'media'] },
  ], 1)
  assert.equal(families.length, 1)
  assert.equal(families[0].variants.length, 2)
  assert.equal(families[0].slots.length, 2)
  assert.ok(families[0].props.some((prop) => prop.kind === 'boolean'))
})

test('library updates are explicit and can be accepted or postponed', () => {
  let system = seedStarterDesignSystem(emptyDesignSystem(), 1)
  system = publishLibraryRelease(system, 'library:local', 'New components', 2)
  assert.equal(system.libraries['library:local'].status, 'update-available')
  const postponed = decideLibraryUpdate(system, 'library:local', 'postpone', 3)
  assert.equal(postponed.libraries['library:local'].status, 'postponed')
  const accepted = decideLibraryUpdate(system, 'library:local', 'accept', 4)
  assert.equal(accepted.libraries['library:local'].installedVersion, accepted.libraries['library:local'].availableVersion)
})

test('design system travels through project events and branch state', () => {
  const project = createProjectDocument({ id: 'project', name: 'Project', actorId: 'a', now: 1, idFactory: () => 'checkpoint' })
  const system = setActiveModes(deriveBranchState(project).designSystem, ['mode:dark'])
  project.events.push(createProjectEvent({ id: 'design-system-event', projectId: project.id, branchId: 'main', actorId: 'a', clock: 1, createdAt: 2, type: 'design-system.replaced', payload: { designSystem: system } }))
  const state = applyProjectEvent(deriveBranchState({ ...project, events: [] }), project.events[0])
  assert.deepEqual(state.designSystem.activeModeIds, ['mode:dark'])
})

test('codegen emits state selectors and never leaks encoded keys as CSS properties', () => {
  const css = generateCss({ version: 3, routes: { '/': { desktop: { 'button:1': { styles: { color: 'white', '__froamState:hover:color': 'yellow', '__froamState:focus:outline': '2px solid blue', '__froamState:active:transform': 'scale(.98)' } } } } } })
  assert.match(css, /button:nth-of-type\(1\):hover/)
  assert.match(css, /button:nth-of-type\(1\):focus/)
  assert.match(css, /button:nth-of-type\(1\):active/)
  assert.doesNotMatch(css, /__froamState/)
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`) }
  catch (error) { console.error(`✗ ${name}`); throw error }
}
console.log(`\n${passed}/${tests.length} design-system tests passed`)

