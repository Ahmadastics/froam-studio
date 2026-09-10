import assert from 'node:assert/strict'

import { createOpLogSession } from '../dist/collab/session.js'
import {
  SECTION_STRUCTURE_KEY,
  assignFreshFroamNodeIds,
  readSectionStructureDraft,
  writeSectionStructureDraft,
} from '../dist/editor/section-structure.js'
import { buildDesignArtifacts } from '../lib/codegen.mjs'

let count = 0
const test = (name, run) => { run(); count += 1; console.log(`✓ ${name}`) }

class FakeElement {
  constructor(id = '') {
    this.id = id
    this.dataset = {}
    this.attributes = new Map()
    this.children = []
  }
  append(...children) { this.children.push(...children) }
  querySelectorAll() { return this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]) }
  hasAttribute(name) { return this.attributes.has(name) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  setAttribute(name, value) {
    const text = String(value)
    this.attributes.set(name, text)
    if (name === 'data-froam-id') this.dataset.froamId = text
    if (name === 'data-froam-section-id') this.dataset.froamSectionId = text
  }
}

test('duplicate regeneration gives every cloned Froam marker a new identity and repairs local references', () => {
  const section = new FakeElement('pricing')
  section.setAttribute('data-froam-id', 'section-original')
  section.setAttribute('data-froam-section-id', 'pricing-section')
  const label = new FakeElement('plan-label')
  label.setAttribute('data-froam-id', 'label-original')
  const input = new FakeElement('plan-input')
  input.setAttribute('aria-labelledby', 'plan-label')
  const anchor = new FakeElement()
  anchor.setAttribute('href', '#plan-input')
  section.append(label, input, anchor)

  assignFreshFroamNodeIds(section, (index) => `copy-a-${index}`)

  assert.equal(section.dataset.froamId, 'copy-a-0')
  assert.equal(label.dataset.froamId, 'copy-a-1')
  assert.notEqual(section.id, 'pricing')
  assert.notEqual(label.id, 'plan-label')
  assert.equal(input.getAttribute('aria-labelledby'), label.id)
  assert.equal(anchor.getAttribute('href'), `#${input.id}`)
  assert.notEqual(section.dataset.froamSectionId, 'pricing-section')
})

test('two identical duplicates survive serialization with independent roots and nested identities', () => {
  const firstHtml = '<section data-froam-injected="true" data-froam-block="true" data-froam-id="copy-a"><h2 data-froam-id="copy-a-title" style="color:red">Pricing A</h2></section>'
  const secondHtml = '<section data-froam-injected="true" data-froam-block="true" data-froam-id="copy-b"><h2 data-froam-id="copy-b-title" style="color:blue">Pricing B</h2></section>'
  const manifest = { version: 1, sections: [{ nodeId: 'original', sourcePath: 'section:1', parentPath: '__froam_root__', order: 2 }] }
  const store = {
    '/@@desktop': {
      [SECTION_STRUCTURE_KEY]: writeSectionStructureDraft(manifest),
      '__froam_injection__:copy-a': { text: JSON.stringify({ parentPath: '__froam_root__', order: 0, html: firstHtml }) },
      '__froam_injection__:copy-b': { text: JSON.stringify({ parentPath: '__froam_root__', order: 3, html: secondHtml }) },
    },
  }
  const restored = JSON.parse(JSON.stringify(store))

  assert.deepEqual(readSectionStructureDraft(restored['/@@desktop'][SECTION_STRUCTURE_KEY]), manifest)
  const serialized = JSON.stringify(restored)
  for (const id of ['copy-a', 'copy-a-title', 'copy-b', 'copy-b-title']) assert.match(serialized, new RegExp(id))
  assert.notEqual(restored['/@@desktop']['__froam_injection__:copy-a'].text, restored['/@@desktop']['__froam_injection__:copy-b'].text)
})

test('move, independent edits, delete, undo, and redo remain one canonical operation log', () => {
  const base = { '/@@desktop': { 'section:1/h2:1': { text: 'Original' }, 'section:2/h2:1': { text: 'Unrelated' } } }
  const history = createOpLogSession({ actor: 'tester' })
  history.seed(base)
  const arranged = {
    '/@@desktop': {
      'section:1/h2:1': { text: 'Unrelated' },
      'section:2/h2:1': { text: 'Original edited' },
      '__froam_injection__:copy-a': { text: JSON.stringify({ parentPath: '__froam_root__', order: 0, html: '<section data-froam-id="copy-a"><h2 data-froam-id="copy-a-title">Copy A edited</h2></section>' }) },
      '__froam_injection__:copy-b': { text: JSON.stringify({ parentPath: '__froam_root__', order: 3, html: '<section data-froam-id="copy-b"><h2 data-froam-id="copy-b-title">Copy B edited</h2></section>' }) },
      [SECTION_STRUCTURE_KEY]: writeSectionStructureDraft({ version: 1, sections: [{ nodeId: 'original', sourcePath: 'section:1', parentPath: '__froam_root__', order: 1 }] }),
    },
  }
  history.reconcile(arranged, 'Arrange sections')
  const deleted = JSON.parse(JSON.stringify(arranged))
  deleted['/@@desktop'][SECTION_STRUCTURE_KEY] = writeSectionStructureDraft({ version: 1, sections: [{ nodeId: 'original', sourcePath: 'section:1', parentPath: '__froam_root__', order: 1, deleted: true }] })
  history.reconcile(deleted, 'Deleted section')

  assert.match(history.store()['/@@desktop'][SECTION_STRUCTURE_KEY].text, /"deleted":true/)
  history.undo()
  assert.doesNotMatch(history.store()['/@@desktop'][SECTION_STRUCTURE_KEY].text, /"deleted":true/)
  assert.match(history.store()['/@@desktop']['__froam_injection__:copy-a'].text, /Copy A edited/)
  assert.match(history.store()['/@@desktop']['__froam_injection__:copy-b'].text, /Copy B edited/)
  history.redo()
  assert.match(history.store()['/@@desktop'][SECTION_STRUCTURE_KEY].text, /"deleted":true/)
})

test('repo artifacts carry structural order, duplicate HTML, and export-only visibility', () => {
  const structure = writeSectionStructureDraft({ version: 1, sections: [{ nodeId: 'original', sourcePath: 'section:1', parentPath: '__froam_root__', order: 2, exportHidden: true }] })
  const design = { version: 3, routes: { '/': { desktop: { [SECTION_STRUCTURE_KEY]: structure, '__froam_injection__:copy-a': { text: JSON.stringify({ parentPath: '__froam_root__', order: 1, html: '<section data-froam-id="copy-a">Copy</section>' }) } } } } }
  const artifacts = buildDesignArtifacts(design)

  assert.match(artifacts.css, /data-froam-export-hidden/)
  assert.match(artifacts.runtime, /applySectionStructure/)
  assert.match(artifacts.runtime, /parent\.insertBefore\(node, parent\.children\.item/)
  assert.match(artifacts.runtime, /copy-a/)
  assert.match(artifacts.runtime, /__froam_structure__:sections/)
  assert.match(artifacts.runtime, /froam-runtime-visibility/)
  assert.match(artifacts.runtime, /data-froam-export-hidden/)
})

console.log(`\n${count} section-manipulation tests passed`)
