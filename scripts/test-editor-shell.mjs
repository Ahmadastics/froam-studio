import assert from 'node:assert/strict'
import fs from 'node:fs'

import { defaultFroamLabsFlags } from '../dist/project/experiments.js'
import { archiveItemKind, createArchiveItem, minimalArchiveDna, recordArchiveArtifactUse, searchArchive } from '../dist/project/archive.js'
import { buildIntelligenceMemory } from '../dist/project/intelligence-memory.js'
import { emptyProjectState } from '../dist/project/event-log.js'
import { animationPresetInteraction, FROAM_ANIMATION_PRESETS } from '../dist/editor/FroamAnimationPresets.js'
import { DEFAULT_FROAM_UI_PREFERENCE, froamUIPanelWidth, readFroamUIPreference, sanitizeFroamUIPreference, writeFroamUIPreference } from '../dist/editor/froamUIPreferences.js'
import { FROAM_REFERENCE_ACCEPTED_TYPES, FROAM_REFERENCE_CONSENT_KEY, readReferenceConsent, referenceQualityLabel, suggestReferenceLabel, validateReferenceDimensions, validateReferenceFile, writeReferenceConsent } from '../dist/editor/reference-workspace-model.js'
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

test('Build remains in Create while Reference and Layers are structural Understand surfaces', () => {
  const create = workspaceSections('create', defaultFroamLabsFlags(), true)
  const understand = workspaceSections('understand', defaultFroamLabsFlags(), true)
  assert.equal(create.find(({ id }) => id === 'plan')?.label, 'Build')
  assert.equal(create.some(({ id }) => id === 'layers'), false)
  assert.equal(understand.find(({ id }) => id === 'reference')?.label, 'Reference')
  assert.equal(understand.find(({ id }) => id === 'layers')?.label, 'Layers')
})

test('Blueprint has one canonical workspace home', () => {
  const flags = defaultFroamLabsFlags()
  assert.equal(['create', 'understand', 'experiment'].flatMap((mode) => workspaceSections(mode, flags, true)).filter(({ id }) => id === 'blueprint').length, 1)
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
  const reference = workspaceSections('understand', defaultFroamLabsFlags(), true).find(({ id }) => id === 'reference')
  const layers = workspaceSections('understand', defaultFroamLabsFlags(), true).find(({ id }) => id === 'layers')
  assert.equal(workspaceCommandMatches(breakpoint, 'breakpoint cinema'), true)
  assert.equal(workspaceCommandMatches(breakpoint, 'mutagen'), false)
  assert.equal(workspaceCommandMatches(reference, 'screenshot to ui'), true)
  assert.equal(workspaceCommandMatches(reference, 'reconstruction'), true)
  assert.equal(workspaceCommandMatches(layers, 'outline'), true)
  assert.equal(workspaceCommandMatches(layers, 'dom structure'), true)
})

test('Reference file and viewport validation follows native reconstruction limits', () => {
  assert.deepEqual(FROAM_REFERENCE_ACCEPTED_TYPES, ['image/png', 'image/jpeg', 'image/webp'])
  for (const type of FROAM_REFERENCE_ACCEPTED_TYPES) assert.equal(validateReferenceFile({ type, size: 100 }).valid, true)
  assert.equal(validateReferenceFile({ type: 'image/gif', size: 100 }).valid, false)
  assert.equal(validateReferenceFile({ type: 'image/png', size: 0 }).valid, false)
  assert.equal(validateReferenceDimensions(1440, 1100).valid, true)
  assert.equal(validateReferenceDimensions(6000, 4000).valid, false)
})

test('Reference viewport labels are suggestions and quality labels use deterministic thresholds', () => {
  assert.equal(suggestReferenceLabel(390), 'Mobile')
  assert.equal(suggestReferenceLabel(768), 'Tablet')
  assert.equal(suggestReferenceLabel(1440), 'Desktop')
  assert.equal(referenceQualityLabel(.85).label, 'Strong')
  assert.equal(referenceQualityLabel(.7).label, 'Good')
  assert.equal(referenceQualityLabel(.5).label, 'Moderate')
  assert.equal(referenceQualityLabel(undefined).detail, 'Not measured')
})

test('Reference intelligence consent is versioned, explicit, and storage-safe', () => {
  const values = new Map(); const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.match(FROAM_REFERENCE_CONSENT_KEY, /v1$/)
  assert.equal(readReferenceConsent(storage), 'unknown')
  assert.equal(writeReferenceConsent(storage, 'declined'), true)
  assert.equal(readReferenceConsent(storage), 'declined')
  assert.equal(writeReferenceConsent(storage, 'allowed'), true)
  assert.equal(readReferenceConsent(storage), 'allowed')
  assert.equal(writeReferenceConsent({ setItem: () => { throw new Error('quota') } }, 'allowed'), false)
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
  assert.match(menu, /Add to Archive/)
  assert.match(menu, /archive-pattern/)
  assert.match(customizer, /Make Froam yours/)
  assert.match(customizer, /role="dialog"/)
  assert.match(labs, /previewGravity/)
  assert.match(labs, /gravityStrength/)
  assert.match(labs, /Quick behaviors/)
})

test('Archive v2 stores multiple artifact kinds and preserves legacy components', () => {
  const dna = minimalArchiveDna('node:button', { role: 'button' })
  const interaction = { id: 'motion:press', name: 'Press', sourceId: 'node:button', targetIds: ['node:button'], trigger: 'click', timeline: [{ at: 0, values: { transform: 'scale(1)' } }, { at: 1, values: { transform: 'scale(.96)' } }] }
  const motion = createArchiveItem({ id: 'archive:motion', nodeId: 'node:button', name: 'Press motion', actorId: 'actor', projectId: 'project', branchId: 'main', dna, kind: 'motion', interaction, interactionIds: [interaction.id], includes: ['motion'] })
  const legacy = { ...motion, id: 'archive:legacy', schemaVersion: 1, kind: undefined, artifact: undefined }
  assert.equal(archiveItemKind(motion), 'motion')
  assert.equal(archiveItemKind(legacy), 'component')
  assert.equal(searchArchive({ [motion.id]: motion }, 'motion').length, 1)
  assert.equal(recordArchiveArtifactUse(motion, 'node:hero', 20).metadata.useCount, 1)
})

test('Intelligence memory reports observed Archive patterns without invented claims', () => {
  const state = emptyProjectState()
  const dna = minimalArchiveDna('node:button', { role: 'button' })
  const interaction = { id: 'motion:hover', name: 'Lift', sourceId: 'node:button', targetIds: ['node:button'], trigger: 'hover', timeline: [] }
  const item = createArchiveItem({ id: 'archive:hover', nodeId: 'node:button', name: 'Hover lift', actorId: 'actor', projectId: 'project', branchId: 'main', dna, kind: 'motion', interaction })
  state.archive[item.id] = recordArchiveArtifactUse(item, 'node:card', 10)
  const memory = buildIntelligenceMemory(state)
  assert.equal(memory.artifactCounts.motion, 1)
  assert.deepEqual(memory.learnedTriggers[0], { trigger: 'hover', count: 1 })
  assert.equal(memory.totalUses, 1)
  assert.ok(memory.insights.some(({ id }) => id === 'trigger-pattern'))
})

test('simple shell, quick chat, mobile, reduced-motion, and advanced surfaces stay reachable', () => {
  const shell = fs.readFileSync(new URL('../src/editor/FroamWorkspaceShell.tsx', import.meta.url), 'utf8')
  const quickChat = fs.readFileSync(new URL('../src/editor/FroamQuickChat.tsx', import.meta.url), 'utf8')
  const toolbar = fs.readFileSync(new URL('../src/editor/FroamToolbar.tsx', import.meta.url), 'utf8')
  const toolbarCss = fs.readFileSync(new URL('../src/editor/styles/toolbar.css', import.meta.url), 'utf8')
  const labs = fs.readFileSync(new URL('../src/editor/FroamLabs.tsx', import.meta.url), 'utf8')
  const editor = fs.readFileSync(new URL('../src/editor/GlobalChefEditor.tsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/editor/styles/workspace-shell.css', import.meta.url), 'utf8')
  assert.match(shell, /label: 'Design'/)
  assert.match(shell, /label: 'Build'/)
  assert.match(shell, /label: 'Reference'/)
  assert.match(shell, /label: 'Layers'/)
  assert.match(shell, /label: 'Animate'/)
  assert.match(shell, /onOpenCommands/)
  assert.match(shell, /onAskFroam/)
  assert.match(quickChat, /What should Froam change or add\?/)
  assert.match(quickChat, /Common edits run locally/)
  assert.match(editor, /role="dialog"/)
  assert.match(editor, /workspacePreference\.advancedOpen/)
  assert.match(editor, /FroamBlueprint/)
  assert.match(toolbar, /className="froam-chrome"/)
  assert.match(toolbar, /froam-tb__mobile-command/)
  assert.match(toolbar, /label="Move"/)
  assert.match(toolbar, /label="Rectangle"/)
  assert.match(toolbar, /label="Frame"/)
  assert.match(toolbar, /label="Text"/)
  assert.match(toolbar, /onAskFroam/)
  assert.doesNotMatch(toolbar, /onToggleTheme|Toggle theme preview/)
  assert.match(toolbarCss, /@media\(max-width:768px\)[\s\S]*?\.froam-tb__center\{display:flex/)
  assert.doesNotMatch(toolbarCss, /@media\(max-width:768px\)[\s\S]*?\.froam-tb__center[^\{]*\{?[^\}]*display\s*:\s*none/)
  assert.match(toolbar, /\{workspace\}/)
  assert.match(editor, /workspace=\{\(/)
  assert.match(editor, /has-context-inspector/)
  assert.match(labs, /'overview', 'Overview'/)
  assert.doesNotMatch(shell, /FROAM_WORKSPACE_MODES|workspaceSections/)
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.match(css, /max-width:768px/)
  assert.match(css, /position:fixed/)
  assert.match(css, /froam-intelligence>nav,.froam-labs>nav\{display:none\}/)
})

test('Build and relocated Layers use the connected project and Reference owns screenshot reconstruction', () => {
  const planner = fs.readFileSync(new URL('../src/editor/FroamSitePlanner.tsx', import.meta.url), 'utf8')
  const layers = fs.readFileSync(new URL('../src/editor/FroamLayersPanel.tsx', import.meta.url), 'utf8')
  const editor = fs.readFileSync(new URL('../src/editor/GlobalChefEditor.tsx', import.meta.url), 'utf8')
  const reference = fs.readFileSync(new URL('../src/editor/FroamReferenceWorkspace.tsx', import.meta.url), 'utf8')
  const intelligence = fs.readFileSync(new URL('../src/editor/FroamIntelligence.tsx', import.meta.url), 'utf8')
  const blueprint = fs.readFileSync(new URL('../src/editor/FroamBlueprint.tsx', import.meta.url), 'utf8')
  assert.match(planner, /Graph synced/)
  assert.match(planner, /onPlanChange\(plan\.pages\)/)
  assert.match(planner, /Saved in this project/)
  assert.match(layers, /role="tree"/)
  assert.match(layers, /role="treeitem"/)
  assert.match(layers, /Stable identity connected/)
  assert.match(layers, /event\.key === 'ArrowDown'/)
  assert.match(editor, /sitePlanGraphRecords\(pages\)/)
  assert.match(editor, /LayoutGrid size=\{13\} \/> Build/)
  assert.match(editor, /FileImage size=\{13\} \/> Reference/)
  assert.doesNotMatch(editor, /Layers size=\{13\} \/> Outline/)
  assert.match(blueprint, /Open Layers and DOM structure/)
  assert.match(reference, /Add screenshot references/)
  assert.match(reference, /multiple/)
  assert.match(reference, /Reading references…/)
  assert.match(reference, /Matching interface structure…/)
  assert.match(reference, /Building responsive understanding…/)
  assert.doesNotMatch(intelligence, /Import screenshot/)
})

test('Reference exposes observed and inferred evidence, separate quality, and bounded status announcements', () => {
  const reference = fs.readFileSync(new URL('../src/editor/FroamReferenceWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(reference, /data-origin="observed"/)
  assert.match(reference, /data-origin="inferred"/)
  assert.match(reference, /Reference understanding/)
  assert.match(reference, /not an exact CSS breakpoint/)
  assert.match(reference, /aria-live="polite"/)
  assert.match(reference, /aria-atomic="true"/)
  assert.match(reference, /Remove \$\{item\.reference\.label/)
})

test('Reference intelligence remains optional, consented, bounded, and non-mutating', () => {
  const reference = fs.readFileSync(new URL('../src/editor/FroamReferenceWorkspace.tsx', import.meta.url), 'utf8')
  assert.match(reference, /createReferenceIntelligenceRequest/)
  assert.match(reference, /createResponsiveIntelligenceRequest/)
  assert.match(reference, /consent !== 'allowed'/)
  assert.match(reference, /Not now/)
  assert.match(reference, /not your source code, credentials or raw screenshots/)
  assert.match(reference, /Deterministic Reference results remain available/)
  assert.doesNotMatch(reference, /purpose:\s*'mutate'/)
  assert.doesNotMatch(reference, /pixelsBase64|sourceCode|apiKey/)
})

test('Task 6 race, focus, reference-limit, and adopted-history guards stay wired', () => {
  const hook = fs.readFileSync(new URL('../src/editor/useFroamIntent.ts', import.meta.url), 'utf8')
  const reference = fs.readFileSync(new URL('../src/editor/FroamReferenceWorkspace.tsx', import.meta.url), 'utf8')
  const referenceModel = fs.readFileSync(new URL('../src/editor/reference-workspace-model.ts', import.meta.url), 'utf8')
  const result = fs.readFileSync(new URL('../src/editor/FroamIntentResult.tsx', import.meta.url), 'utf8')
  const editor = fs.readFileSync(new URL('../src/editor/GlobalChefEditor.tsx', import.meta.url), 'utf8')
  assert.match(hook, /operationRef\.current === token/)
  assert.match(hook, /previewContextIsCurrent/)
  assert.match(hook, /The interface changed while Froam was preparing this\. Try again\./)
  assert.match(hook, /operation\.controller\.signal/)
  assert.match(reference, /insightAbortRef\.current\?\.abort\(\)/)
  assert.match(reference, /onReferencesChanged\?\.\(\)/)
  assert.match(reference, /bitmap\.close\(\)/)
  assert.match(referenceModel, /FROAM_REFERENCE_MAX_REFERENCES = 20/)
  assert.match(result, /data-froam-intent-primary[^\n]+focus\(\)/)
  assert.match(editor, /trapCommandPaletteFocus/)
  assert.match(editor, /opPendingLabelRef\.current = 'Froam experiment'/)
})

console.log(`\n${count} editor-shell tests passed.`)
