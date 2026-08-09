import assert from 'node:assert/strict'
import fs from 'node:fs'

import { defaultFroamLabsFlags } from '../dist/project/experiments.js'
import { animationPresetInteraction, FROAM_ANIMATION_PRESETS } from '../dist/editor/FroamAnimationPresets.js'
import { DEFAULT_FROAM_UI_PREFERENCE, froamUIPanelWidth, readFroamUIPreference, sanitizeFroamUIPreference, writeFroamUIPreference } from '../dist/editor/froamUIPreferences.js'
import {
  FROAM_WORKSPACE_MODES,
  readWorkspacePreference,
  transitionWorkspacePreference,
  workspaceCommandMatches,
  workspacePresenceSummary,
  workspaceProjectLabel,
  workspaceSections,
  workspaceTemporalSurface,
  writeWorkspacePreference,
} from '../dist/editor/workspace-shell-model.js'

let count = 0
const test = (name, run) => { run(); count += 1; console.log(`✓ ${name}`) }

test('mode switching keeps the three user promises and remembered contexts', () => {
  assert.deepEqual(FROAM_WORKSPACE_MODES.map(({ id, promise }) => [id, promise]), [['create', 'Build it'], ['understand', 'Know it'], ['experiment', 'Challenge it']])
  const next = transitionWorkspacePreference(readWorkspacePreference(), 'understand', 'dna')
  assert.equal(next.mode, 'understand')
  assert.equal(next.sections.understand, 'dna')
  assert.equal(next.sections.create, 'design')
})

test('contextual selection tools disable without hiding their meaning', () => {
  const flags = { ...defaultFroamLabsFlags(), interactionLibrary: true }
  assert.equal(workspaceSections('create', flags, false).find(({ id }) => id === 'animator')?.contextual, false)
  assert.equal(workspaceSections('create', flags, true).find(({ id }) => id === 'animator')?.contextual, true)
})

test('Create names the connected structure surfaces consistently', () => {
  const create = workspaceSections('create', defaultFroamLabsFlags(), true)
  assert.equal(create.find(({ id }) => id === 'plan')?.label, 'Build')
  assert.equal(create.find(({ id }) => id === 'layers')?.label, 'Outline')
})

test('Lab flags control tool visibility independently', () => {
  const off = defaultFroamLabsFlags()
  assert.equal(workspaceSections('experiment', off, true).some(({ id }) => id === 'laboratory'), true)
  assert.equal(workspaceSections('experiment', off, true).some(({ id }) => id === 'mutate'), false)
  assert.equal(workspaceSections('experiment', { ...off, mutate: true }, true).some(({ id }) => id === 'mutate'), true)
})

test('project and prototype context remain explicit', () => {
  assert.deepEqual(workspaceProjectLabel('Run’Am', 'Main', 'main'), { projectName: 'Run’Am', branchName: 'Main', prototype: false, label: 'Run’Am / Main' })
  assert.equal(workspaceProjectLabel('Run’Am', 'Checkout idea', 'branch-1').prototype, true)
})

test('native presence is bounded and still fully announced', () => {
  const members = Array.from({ length: 6 }, (_, index) => ({ actor: `${index}`, name: `Person ${index}` }))
  const summary = workspacePresenceSummary(members)
  assert.equal(summary.visible.length, 4)
  assert.equal(summary.overflow, 2)
  assert.match(summary.accessibleLabel, /6 collaborators present/)
})

test('only the current temporal owner receives the shared dock', () => {
  assert.equal(workspaceTemporalSurface(null), null)
  assert.deepEqual(workspaceTemporalSurface('replay'), { owner: 'replay', label: 'Replay timeline' })
  assert.deepEqual(workspaceTemporalSurface('sampling'), { owner: 'sampling', label: 'Sampling timeline' })
})

test('panel preferences persist, recover, and tolerate quota failure', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const preference = transitionWorkspacePreference(readWorkspacePreference(storage), 'experiment', 'laboratory')
  assert.equal(writeWorkspacePreference(storage, { ...preference, advancedOpen: true }), true)
  assert.equal(readWorkspacePreference(storage).advancedOpen, true)
  assert.equal(readWorkspacePreference({ getItem: () => '{broken' }).mode, 'create')
  assert.equal(writeWorkspacePreference({ setItem: () => { throw new Error('quota') } }, preference), false)
})

test('command search understands user-facing aliases', () => {
  const breakpoint = workspaceSections('understand', defaultFroamLabsFlags(), true).find(({ id }) => id === 'responsive')
  assert.equal(workspaceCommandMatches(breakpoint, 'breakpoint cinema'), true)
  assert.equal(workspaceCommandMatches(breakpoint, 'mutagen'), false)
})

test('Froam UI preferences are versioned, recoverable, and quota tolerant', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const custom = sanitizeFroamUIPreference({ toolbar: 'bottom', workspace: 'floating-bottom', panels: 'mirrored', accent: 'violet', scale: 1.1, labels: false })
  assert.equal(writeFroamUIPreference(storage, custom), true)
  assert.deepEqual(readFroamUIPreference(storage), custom)
  assert.equal(sanitizeFroamUIPreference({ toolbar: 'sideways' }).toolbar, DEFAULT_FROAM_UI_PREFERENCE.toolbar)
  assert.equal(froamUIPanelWidth('wide', 'inspector'), 380)
  assert.equal(writeFroamUIPreference({ setItem: () => { throw new Error('quota') } }, custom), false)
})

test('quick motion catalog covers reusable motion families', () => {
  assert.ok(FROAM_ANIMATION_PRESETS.length >= 25)
  assert.deepEqual(new Set(FROAM_ANIMATION_PRESETS.map(({ category }) => category)), new Set(['Entrance', 'Reveal', 'Emphasis', 'Motion', 'Exit']))
  const interaction = animationPresetInteraction(FROAM_ANIMATION_PRESETS.find(({ id }) => id === 'button-press'), 'node:button')
  assert.equal(interaction.sourceId, 'node:button')
  assert.deepEqual(interaction.targetIds, ['node:button'])
  assert.equal(interaction.trigger, 'click')
  assert.ok(interaction.timeline.length >= 2)
})

test('right click exposes UI customization and labs expose force preview', () => {
  const menu = fs.readFileSync(new URL('../src/editor/FroamContextMenu.tsx', import.meta.url), 'utf8')
  const customizer = fs.readFileSync(new URL('../src/editor/FroamUICustomizer.tsx', import.meta.url), 'utf8')
  const labs = fs.readFileSync(new URL('../src/editor/FroamLabs.tsx', import.meta.url), 'utf8')
  assert.match(menu, /Customize Froam UI/)
  assert.match(customizer, /Make Froam yours/)
  assert.match(customizer, /role="dialog"/)
  assert.match(labs, /previewGravity/)
  assert.match(labs, /gravityStrength/)
  assert.match(labs, /Quick behaviors/)
})

test('keyboard, mobile, reduced-motion, and legacy surfaces stay reachable', () => {
  const shell = fs.readFileSync(new URL('../src/editor/FroamWorkspaceShell.tsx', import.meta.url), 'utf8')
  const toolbar = fs.readFileSync(new URL('../src/editor/FroamToolbar.tsx', import.meta.url), 'utf8')
  const labs = fs.readFileSync(new URL('../src/editor/FroamLabs.tsx', import.meta.url), 'utf8')
  const editor = fs.readFileSync(new URL('../src/editor/GlobalChefEditor.tsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/editor/styles/workspace-shell.css', import.meta.url), 'utf8')
  assert.match(shell, /ArrowLeft/)
  assert.match(shell, /role="tablist"/)
  assert.match(editor, /role="dialog"/)
  assert.match(editor, /workspacePreference\.advancedOpen/)
  assert.match(editor, /FroamBlueprint/)
  assert.match(toolbar, /className="froam-chrome"/)
  assert.match(toolbar, /\{workspace\}/)
  assert.match(editor, /workspace=\{\(/)
  assert.match(editor, /has-context-inspector/)
  assert.match(labs, /'overview', 'Laboratory'/)
  assert.doesNotMatch(shell, /onOpenCommands|onOpenProfile/)
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.match(css, /max-width:768px/)
  assert.match(css, /position:fixed/)
  assert.match(css, /froam-intelligence>nav,.froam-labs>nav\{display:none\}/)
})

test('Build and Outline use the connected project and accessible live structure', () => {
  const planner = fs.readFileSync(new URL('../src/editor/FroamSitePlanner.tsx', import.meta.url), 'utf8')
  const layers = fs.readFileSync(new URL('../src/editor/FroamLayersPanel.tsx', import.meta.url), 'utf8')
  const editor = fs.readFileSync(new URL('../src/editor/GlobalChefEditor.tsx', import.meta.url), 'utf8')
  assert.match(planner, /Graph synced/)
  assert.match(planner, /onPlanChange\(plan\.pages\)/)
  assert.match(planner, /Saved in this project/)
  assert.match(layers, /role="tree"/)
  assert.match(layers, /role="treeitem"/)
  assert.match(layers, /Stable identity connected/)
  assert.match(layers, /event\.key === 'ArrowDown'/)
  assert.match(editor, /sitePlanGraphRecords\(pages\)/)
  assert.match(editor, /LayoutGrid size=\{13\} \/> Build/)
  assert.match(editor, /Layers size=\{13\} \/> Outline/)
})

console.log(`\n${count} editor-shell tests passed.`)
