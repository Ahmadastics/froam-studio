import assert from 'node:assert/strict'
import {
  buildPageProfile,
  contrastRatio,
  contrastRequirement,
  oklabToOklch,
  oklabToRgb,
  oklchToHex,
  parseCssColor,
  relativeLuminance,
  rgbToOklab,
} from '../dist/project/page-profile.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

/**
 * Build a scan record directly. The profiler is a pure function over records,
 * so these tests need no DOM — and a handcrafted page has a design whose
 * correct profile is known by construction.
 */
function node(input) {
  const {
    id, tag = 'div', role = 'unknown', text = '', parentId, childIds = [],
    rect = { x: 0, y: 0, width: 100, height: 40 },
    background = 'rgba(0, 0, 0, 0)', color = 'rgb(17, 17, 17)',
    fontSize = '16px', fontWeight = '400', lineHeight = '24px', fontFamily = 'Inter',
    padding = '0px', margin = '0px', gap = 0, display = 'block', position = 'static',
    borderRadius = '0px', boxShadow = 'none', border = '0px none',
    gridTemplateColumns = 'none', visible = true, warnings = [], focusable = false,
  } = input
  return {
    schemaVersion: 1,
    id: `scan:${id}:1`,
    node: { nodeId: id, path: `/${id}`, fingerprint: {} },
    capturedAt: 1,
    childNodeIds: childIds,
    siblingNodeIds: [],
    signals: [
      { kind: 'identity', origin: 'observed', source: 'dom', values: { nodeId: id, path: `/${id}` } },
      { kind: 'structure', origin: 'observed', source: 'dom', values: { parentNodeId: parentId, childNodeIds: childIds, tag, signature: `${tag}|${role}|${display}` } },
      { kind: 'layout', origin: 'observed', source: 'computed-style', values: { display, position, padding, margin, gapPx: gap, gridTemplateColumns, rect } },
      { kind: 'appearance', origin: 'observed', source: 'computed-style', values: { color, backgroundColor: background, fontFamily, fontSize, fontWeight, lineHeight, borderRadius, boxShadow, border } },
      { kind: 'semantics', origin: 'observed', source: 'dom', values: { role, textContent: text } },
      { kind: 'behavior', origin: 'observed', source: 'runtime', values: { focusable } },
      { kind: 'responsive', origin: 'observed', source: 'computed-style', values: { visible } },
      { kind: 'accessibility', origin: 'observed', source: 'dom', values: { warnings } },
    ],
  }
}

/**
 * A deliberately coherent page: white surface, near-black ink, a single accent
 * used only on the CTA, a 1.25 type scale, and every spacing value on an 8px
 * grid. Each assertion below recovers a decision that was made here on purpose.
 */
function coherentPage() {
  return [
    node({ id: 'root', tag: 'main', childIds: ['hero', 'features', 'footer'], rect: { x: 0, y: 0, width: 1200, height: 2000 }, background: 'rgb(255, 255, 255)' }),

    node({ id: 'hero', tag: 'section', parentId: 'root', childIds: ['h1', 'sub', 'cta'], rect: { x: 0, y: 0, width: 1200, height: 600 }, padding: '32px', gap: 24 }),
    node({ id: 'h1', tag: 'h1', role: 'heading', parentId: 'hero', text: 'Run errands without the wahala', rect: { x: 0, y: 40, width: 800, height: 60 }, fontSize: '31px', fontWeight: '700', lineHeight: '38px', padding: '0px' }),
    node({ id: 'sub', tag: 'p', role: 'paragraph', parentId: 'hero', text: 'A'.repeat(70), rect: { x: 0, y: 120, width: 560, height: 48 }, fontSize: '16px', lineHeight: '24px', padding: '0px' }),
    node({ id: 'cta', tag: 'button', role: 'cta', parentId: 'hero', text: 'Post a task', rect: { x: 0, y: 200, width: 180, height: 48 }, background: 'rgb(230, 57, 70)', color: 'rgb(255, 255, 255)', fontSize: '16px', fontWeight: '700', padding: '16px', borderRadius: '8px', focusable: true }),

    node({ id: 'features', tag: 'section', parentId: 'root', childIds: ['c1', 'c2', 'c3'], rect: { x: 0, y: 600, width: 1200, height: 800 }, padding: '32px', gap: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }),
    node({ id: 'c1', tag: 'div', role: 'card', parentId: 'features', childIds: ['c1t'], rect: { x: 0, y: 700, width: 360, height: 240 }, padding: '24px', borderRadius: '8px', background: 'rgb(250, 250, 250)' }),
    node({ id: 'c1t', tag: 'h3', role: 'heading', parentId: 'c1', text: 'Verified runners', rect: { x: 0, y: 720, width: 300, height: 30 }, fontSize: '20px', fontWeight: '700', lineHeight: '28px' }),
    node({ id: 'c2', tag: 'div', role: 'card', parentId: 'features', childIds: ['c2t'], rect: { x: 400, y: 700, width: 360, height: 240 }, padding: '24px', borderRadius: '8px', background: 'rgb(250, 250, 250)' }),
    node({ id: 'c2t', tag: 'h3', role: 'heading', parentId: 'c2', text: 'Escrowed payments', rect: { x: 400, y: 720, width: 300, height: 30 }, fontSize: '20px', fontWeight: '700', lineHeight: '28px' }),
    node({ id: 'c3', tag: 'div', role: 'card', parentId: 'features', childIds: ['c3t'], rect: { x: 800, y: 700, width: 360, height: 240 }, padding: '24px', borderRadius: '8px', background: 'rgb(250, 250, 250)' }),
    node({ id: 'c3t', tag: 'h3', role: 'heading', parentId: 'c3', text: 'Live tracking', rect: { x: 800, y: 720, width: 300, height: 30 }, fontSize: '20px', fontWeight: '700', lineHeight: '28px' }),

    node({ id: 'footer', tag: 'footer', role: 'footer', parentId: 'root', childIds: ['fl'], rect: { x: 0, y: 1400, width: 1200, height: 400 }, padding: '32px' }),
    node({ id: 'fl', tag: 'a', role: 'unknown', parentId: 'footer', text: 'Terms', rect: { x: 0, y: 1420, width: 80, height: 20 }, fontSize: '16px', color: 'rgb(102, 102, 102)' }),
  ]
}

const profileOf = (records, overrides = {}) => buildPageProfile({ records, origin: 'https://example.test', routeKey: '/', viewport: 'desktop', ...overrides })

// ── colour primitives ───────────────────────────────────────────────────────

test('parseCssColor handles the forms computed styles emit and rejects the rest', () => {
  assert.deepEqual(parseCssColor('rgb(255, 255, 255)'), { r: 1, g: 1, b: 1, a: 1 })
  assert.deepEqual(parseCssColor('rgba(0, 0, 0, 0)'), { r: 0, g: 0, b: 0, a: 0 })
  assert.equal(parseCssColor('rgba(0, 0, 0, 0.5)').a, 0.5)
  assert.deepEqual(parseCssColor('#fff'), { r: 1, g: 1, b: 1, a: 1 })
  assert.equal(Math.round(parseCssColor('#808080').r * 255), 128)
  assert.equal(parseCssColor('transparent'), null)
  assert.equal(parseCssColor('linear-gradient(red, blue)'), null)
  assert.equal(parseCssColor(undefined), null)
})

test('OKLab matches known anchors and round-trips through sRGB', () => {
  assert.ok(Math.abs(rgbToOklab({ r: 1, g: 1, b: 1 }).L - 1) < 0.001)
  assert.ok(Math.abs(rgbToOklab({ r: 0, g: 0, b: 0 }).L) < 0.001)
  for (const rgb of [{ r: 0.9, g: 0.22, b: 0.27 }, { r: 0.07, g: 0.07, b: 0.07 }, { r: 0.2, g: 0.6, b: 0.86 }]) {
    const back = oklabToRgb(rgbToOklab(rgb))
    for (const channel of ['r', 'g', 'b']) assert.ok(Math.abs(back[channel] - rgb[channel]) < 0.002, `${channel} round-trip drifted`)
  }
})

test('achromatic colours report zero chroma and survive the hex round-trip', () => {
  const grey = oklabToOklch(rgbToOklab({ r: 0.5, g: 0.5, b: 0.5 }))
  assert.ok(grey.c < 0.001)
  // Cube roots cost a fraction of a channel step. A 1/255 drift in a
  // display-only hex is not worth special-casing away; a visible one would be.
  const channels = oklchToHex(grey).slice(1).match(/../g).map((part) => Number.parseInt(part, 16))
  assert.ok(Math.max(...channels) - Math.min(...channels) <= 1, `grey drifted to ${oklchToHex(grey)}`)
  assert.ok(Math.abs(channels[0] - 128) <= 1)
})

test('WCAG contrast matches the published anchors', () => {
  assert.equal(Math.round(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 })), 21)
  assert.equal(contrastRatio({ r: 1, g: 1, b: 1 }, { r: 1, g: 1, b: 1 }), 1)
  // #767676 on white is the canonical 4.5:1 boundary case.
  const boundary = contrastRatio({ r: 0x76 / 255, g: 0x76 / 255, b: 0x76 / 255 }, { r: 1, g: 1, b: 1 })
  assert.ok(boundary >= 4.48 && boundary <= 4.6, `expected ~4.54, got ${boundary}`)
  assert.ok(relativeLuminance({ r: 1, g: 1, b: 1 }) > 0.99)
})

test('large text takes the 3:1 threshold, including bold at 18.66px', () => {
  assert.equal(contrastRequirement(16, 400), 4.5)
  assert.equal(contrastRequirement(24, 400), 3)
  assert.equal(contrastRequirement(18.66, 700), 3)
  assert.equal(contrastRequirement(18.66, 400), 4.5)
})

// ── profile extraction ──────────────────────────────────────────────────────

test('palette is area-weighted, so the dominant surface wins over the most repeated node', () => {
  const profile = profileOf(coherentPage())
  const surface = profile.color.palette.find((entry) => entry.role === 'surface')
  assert.ok(surface, 'expected a surface colour')
  assert.equal(surface.hex, '#ffffff', `expected the page surface, got ${surface.hex}`)
  assert.equal(profile.color.modeSignal, 'light')
})

test('a small chromatic background does not flip the mode signal', () => {
  // The CTA here is #e63946: luminance 0.2, well under the light/dark line. A
  // white page with a red button is a light page.
  const profile = profileOf(coherentPage())
  const accent = profile.color.palette.find((entry) => entry.role === 'accent')
  assert.ok(accent.areaShare < 0.15, 'the accent must be small enough for this test to mean anything')
  assert.equal(profile.color.modeSignal, 'light')
})

test('a genuinely two-surface page reports mixed', () => {
  const records = coherentPage()
  // A dark half that carries real area, unlike a button.
  records.push(node({ id: 'darkband', tag: 'section', parentId: 'root', childIds: [], rect: { x: 0, y: 1400, width: 1200, height: 600 }, background: 'rgb(17, 17, 17)' }))
  const root = records.find((record) => record.node.nodeId === 'root')
  root.signals.find((signal) => signal.kind === 'structure').values.childNodeIds = ['hero', 'features', 'footer', 'darkband']
  assert.equal(profileOf(records).color.modeSignal, 'mixed')
})

test('a raised surface is kept distinct from the page surface', () => {
  // #ffffff against #fafafa is ΔE 0.0155 — an elevation step, not noise. A
  // text-grade merge threshold would average them into one off-white and erase
  // the surface/raised distinction the profile is supposed to model.
  const profile = profileOf(coherentPage())
  const backgrounds = profile.color.palette.filter((entry) => entry.channel === 'background')
  assert.ok(backgrounds.some((entry) => entry.hex === '#ffffff'), 'page surface lost')
  assert.ok(backgrounds.some((entry) => entry.hex === '#fafafa'), 'card surface was merged into the page surface')
  assert.equal(backgrounds.find((entry) => entry.hex === '#fafafa').role, 'raised')
})

test('ink is the highest-contrast text colour, not the most-used one', () => {
  const records = coherentPage()
  // A wall of failing grey body copy, heavier than every dark heading combined.
  for (let index = 0; index < 6; index += 1) {
    records.push(node({
      id: `grey${index}`, tag: 'p', role: 'paragraph', parentId: 'footer',
      text: 'G'.repeat(300), color: 'rgb(154, 154, 154)',
      rect: { x: 0, y: 1500 + index * 30, width: 900, height: 28 },
    }))
  }
  const profile = profileOf(records)
  const ink = profile.color.palette.find((entry) => entry.role === 'ink')
  assert.equal(ink.hex, '#111111', `ink went to the most frequent colour, not the strongest: ${ink.hex}`)
  assert.equal(profile.color.palette.find((entry) => entry.hex === '#9a9a9a').role, 'muted')
})

test('inverse text on an accent is not reported as muted', () => {
  // White on the red CTA reads louder than ink, not quieter. Classifying it as
  // muted would invert the meaning of the role.
  const profile = profileOf(coherentPage())
  const onAccent = profile.color.palette.find((entry) => entry.channel === 'text' && entry.hex === '#ffffff')
  assert.ok(onAccent, 'expected the button label to register as a text colour')
  assert.notEqual(onAccent.role, 'muted')
  assert.equal(onAccent.role, 'other')
})

test('measure describes running text and ignores short labels', () => {
  const profile = profileOf(coherentPage())
  // The one real paragraph is 560px at 16px ≈ 70ch. Footer links must not drag it down.
  assert.ok(profile.type.measureCh >= 60 && profile.type.measureCh <= 80, `measure was ${profile.type.measureCh}`)
})

test('a page with no running text reports no measure rather than guessing', () => {
  const records = coherentPage().filter((record) => record.node.nodeId !== 'sub')
  assert.equal(profileOf(records).type.measureCh, 0)
})

test('accent is the chromatic colour landing on action roles, not the largest chromatic area', () => {
  const profile = profileOf(coherentPage())
  const accent = profile.color.palette.find((entry) => entry.role === 'accent')
  assert.ok(accent, 'expected an accent colour')
  assert.ok(accent.oklch.c > 0.1, `accent should be chromatic, chroma was ${accent.oklch.c}`)
  assert.ok(accent.appearsOn.includes('cta'))
  assert.equal(profile.color.accentDiscipline, 1)
})

test('accent discipline falls when the accent paints non-action elements', () => {
  const records = coherentPage()
  records.push(node({ id: 'stray', tag: 'span', role: 'badge', parentId: 'footer', text: 'New', rect: { x: 200, y: 1420, width: 60, height: 20 }, background: 'rgb(230, 57, 70)' }))
  records.push(node({ id: 'stray2', tag: 'span', role: 'paragraph', parentId: 'footer', text: 'Sale', rect: { x: 280, y: 1420, width: 60, height: 20 }, background: 'rgb(230, 57, 70)' }))
  const footer = records.find((record) => record.node.nodeId === 'footer')
  footer.signals.find((signal) => signal.kind === 'structure').values.childNodeIds = ['fl', 'stray', 'stray2']
  const profile = profileOf(records)
  assert.ok(profile.color.accentDiscipline < 0.6, `expected diluted accent, got ${profile.color.accentDiscipline}`)
})

test('contrast floor is measured against the inherited background, not assumed white', () => {
  const records = coherentPage()
  // Dark panel with dark text: only correct if the ancestor background is resolved.
  records.push(node({ id: 'panel', tag: 'div', parentId: 'footer', childIds: ['panelText'], rect: { x: 0, y: 1600, width: 1200, height: 200 }, background: 'rgb(17, 17, 17)' }))
  records.push(node({ id: 'panelText', tag: 'p', role: 'paragraph', parentId: 'panel', text: 'Low contrast copy', rect: { x: 0, y: 1620, width: 400, height: 24 }, color: 'rgb(51, 51, 51)' }))
  const footer = records.find((record) => record.node.nodeId === 'footer')
  footer.signals.find((signal) => signal.kind === 'structure').values.childNodeIds = ['fl', 'panel']
  const profile = profileOf(records)
  const failure = profile.color.contrastFailures.find((pair) => pair.nodeId === 'panelText')
  assert.ok(failure, 'expected the dark-on-dark text to fail')
  assert.ok(failure.ratio < 2, `expected a very low ratio, got ${failure.ratio}`)
  assert.ok(profile.color.contrastSamples >= 5, 'contrast failures need an honest denominator')
})

test('type scale is recovered as clustered steps, not raw sizes', () => {
  const profile = profileOf(coherentPage())
  assert.deepEqual(profile.type.scale.map((step) => step.px), [16, 20, 31])
  assert.ok(profile.type.ratio !== null, 'a 1.25/1.55 progression should still register a ratio')
  assert.equal(profile.quality.uniqueSizes, 3)
})

test('size proliferation shows up as step count, which is a different failure from a broken ratio', () => {
  // Worth stating plainly: ratioSpread does NOT rise when one-off sizes are
  // added. Dense sizes make every consecutive ratio small and similar, so the
  // spread can fall while the type system gets worse. Step count is what
  // detects proliferation; spread detects a scale whose steps disagree. The
  // type-scale check reads both, and conflating them would hide one.
  const noisy = coherentPage()
  for (const [index, size] of ['13px', '17px', '19px', '23px', '29px', '41px'].entries()) {
    noisy.push(node({ id: `noise${index}`, tag: 'p', role: 'paragraph', parentId: 'footer', text: 'x'.repeat(20), rect: { x: index * 60, y: 1500, width: 50, height: 20 }, fontSize: size }))
  }
  const noisyProfile = profileOf(noisy)
  assert.ok(noisyProfile.type.scale.length >= 8, `expected many one-off sizes, got ${noisyProfile.type.scale.length}`)
  assert.ok(noisyProfile.quality.uniqueSizes > profileOf(coherentPage()).quality.uniqueSizes)
})

test('a scale whose steps disagree reports no ratio at all', () => {
  const erratic = coherentPage()
  for (const [index, size] of ['18px', '19px', '96px'].entries()) {
    erratic.push(node({ id: `erratic${index}`, tag: 'p', role: 'paragraph', parentId: 'footer', text: 'x'.repeat(20), rect: { x: index * 60, y: 1500, width: 50, height: 40 }, fontSize: size }))
  }
  const profile = profileOf(erratic)
  assert.ok(profile.type.ratioSpread > 0.25, `expected wild spread, got ${profile.type.ratioSpread}`)
  assert.equal(profile.type.ratio, null, 'a mean of noise must not be reported as a ratio')
})

test('spacing base prefers the coarsest grid that explains the data', () => {
  const profile = profileOf(coherentPage())
  // Every value here is 16/24/32 — a multiple of 4 and of 8. 4 is not wrong, it
  // is just less explanatory, so the coarser base must win.
  assert.equal(profile.space.base, 8)
  assert.equal(profile.space.adherence, 1)
  assert.equal(profile.quality.spacingDrift, 0)
})

test('off-grid spacing lowers adherence proportionally', () => {
  const records = coherentPage()
  for (const [index, padding] of ['7px', '13px', '19px', '23px'].entries()) {
    records.push(node({ id: `odd${index}`, tag: 'div', parentId: 'footer', rect: { x: index * 40, y: 1700, width: 40, height: 40 }, padding }))
  }
  const profile = profileOf(records)
  assert.ok(profile.space.adherence < 1, 'off-grid values must reduce adherence')
  assert.ok(profile.quality.spacingDrift > 0)
})

test('hidden and zero-area nodes never enter the profile', () => {
  const records = coherentPage()
  const baseline = profileOf(records)
  records.push(node({ id: 'closedMenu', tag: 'nav', role: 'navigation', parentId: 'root', childIds: [], rect: { x: 0, y: 0, width: 300, height: 800 }, background: 'rgb(255, 0, 255)', visible: false }))
  records.push(node({ id: 'collapsed', tag: 'div', parentId: 'root', rect: { x: 0, y: 0, width: 0, height: 0 }, background: 'rgb(0, 255, 0)' }))
  const withHidden = profileOf(records)
  const magenta = withHidden.color.palette.find((entry) => entry.hex === '#ff00ff')
  assert.equal(magenta, undefined, 'a closed menu must not colour the palette')
  assert.equal(withHidden.provenance.nodesRendered, baseline.provenance.nodesRendered)
  assert.ok(withHidden.provenance.coverage < 1, 'coverage must report what was excluded')
})

test('component families report spacing variance across their instances', () => {
  const profile = profileOf(coherentPage())
  const cards = profile.components.find((family) => family.role === 'card')
  assert.ok(cards, 'expected the three cards to form a family')
  assert.equal(cards.instances, 3)
  assert.equal(cards.variance, 0, 'identical cards must show zero variance')
})

/**
 * The structure a real SPA actually produces, which is what broke the first two
 * versions of section detection: two framework wrappers, a fixed header, a
 * `<main>` holding the sections, and a `<footer>` that is main's sibling rather
 * than its child.
 */
function spaPage() {
  const records = [
    node({ id: 'body', tag: 'body', childIds: ['shell'], rect: { x: 0, y: 0, width: 1440, height: 6200 }, background: 'rgb(255, 255, 255)' }),
    node({ id: 'shell', tag: 'div', parentId: 'body', childIds: ['app'], rect: { x: 0, y: 0, width: 1440, height: 6200 } }),
    node({ id: 'app', tag: 'div', parentId: 'shell', childIds: ['lava', 'header', 'main', 'footer'], rect: { x: 0, y: 0, width: 1440, height: 6200 } }),
    // Out of flow: a fixed header and a full-bleed absolute background layer.
    node({ id: 'lava', tag: 'div', parentId: 'app', rect: { x: 0, y: 0, width: 1440, height: 6200 }, position: 'absolute', background: 'rgb(255, 65, 56)' }),
    node({ id: 'header', tag: 'header', parentId: 'app', childIds: [], rect: { x: 0, y: 0, width: 1440, height: 77 }, position: 'fixed' }),
    node({ id: 'main', tag: 'main', parentId: 'app', childIds: ['s0', 's1', 's2', 's3'], rect: { x: 0, y: 0, width: 1440, height: 5800 } }),
    node({ id: 'footer', tag: 'footer', role: 'footer', parentId: 'app', childIds: [], rect: { x: 0, y: 5800, width: 1440, height: 400 }, padding: '32px' }),
  ]
  const heights = [1200, 1500, 1600, 1500]
  let y = 0
  heights.forEach((height, index) => {
    records.push(node({
      id: `s${index}`, tag: 'section', parentId: 'main', childIds: [`h${index}`, `p${index}`],
      rect: { x: 0, y, width: 1440, height }, position: 'relative', padding: '32px',
    }))
    records.push(node({ id: `h${index}`, tag: 'h2', role: 'heading', parentId: `s${index}`, text: `Heading ${index}`, rect: { x: 0, y: y + 40, width: 1100, height: 50 }, fontSize: '31px', fontWeight: '700' }))
    records.push(node({ id: `p${index}`, tag: 'p', role: 'paragraph', parentId: `s${index}`, text: 'P'.repeat(120), rect: { x: 0, y: y + 110, width: 700, height: 60 } }))
    y += height
  })
  return records
}

test('sections are found through framework wrappers at differing depths', () => {
  // Four <section> inside <main>, plus a <footer> that is main's sibling. Reading
  // the direct children of any single parent cannot produce this.
  const profile = profileOf(spaPage())
  assert.equal(profile.flow.sections.length, 5, `expected 4 sections plus the footer, got ${profile.flow.signature}`)
  assert.equal(profile.flow.sections[4].archetype, 'footer')
})

test('<main> is a container of sections, never a section', () => {
  // This exact mistake reported two sections on a real eight-section page: the
  // walk matched <main> as a landmark, stopped, and never looked inside.
  const profile = profileOf(spaPage())
  assert.ok(profile.flow.sections.length > 1, 'main was treated as a single section')
  assert.ok(profile.flow.sections.every((section) => section.heightRatio < 0.9), 'a section covering the whole page is main in disguise')
})

test('out-of-flow layers are neither sections nor evidence against tiling', () => {
  // A position:fixed header and an absolute full-bleed background overlap every
  // section beneath them. Counted, they sink the tiling score and no section is
  // ever found.
  const profile = profileOf(spaPage())
  const withoutLayers = profileOf(spaPage().filter((record) => !['lava', 'header'].includes(record.node.nodeId)))
  assert.equal(profile.flow.sections.length, withoutLayers.flow.sections.length, 'out-of-flow layers changed the section count')
})

test('a real footer is classified from its own tag, not its children', () => {
  // The classifier previously looked for a footer role among a section's
  // children, where it can never appear, so real footers came back as 'proof'.
  const profile = profileOf(spaPage())
  const last = profile.flow.sections[profile.flow.sections.length - 1]
  assert.equal(last.archetype, 'footer')
  assert.ok(last.confidence > 0.9, 'a footer tag is the strongest signal available')
})

test('a heading over prose is content, not unknown', () => {
  const profile = profileOf(spaPage())
  const middle = profile.flow.sections.slice(0, 4)
  assert.ok(middle.every((section) => section.archetype !== 'unknown'), `left sections unlabelled: ${profile.flow.signature}`)
  assert.ok(middle.some((section) => section.archetype === 'content'))
})

test('the same colour used as fill and as text appears once, not twice', () => {
  const records = coherentPage()
  // The accent as link text as well as a button background — one token, two uses.
  records.push(node({ id: 'accentLink', tag: 'a', role: 'unknown', parentId: 'footer', text: 'Learn more', rect: { x: 300, y: 1420, width: 120, height: 32 }, color: 'rgb(230, 57, 70)', focusable: true }))
  const footer = records.find((record) => record.node.nodeId === 'footer')
  footer.signals.find((signal) => signal.kind === 'structure').values.childNodeIds = ['fl', 'accentLink']
  const profile = profileOf(records)
  const accents = profile.color.palette.filter((entry) => entry.role === 'accent')
  assert.equal(accents.length, 1, `the accent was listed ${accents.length} times`)
  assert.ok(accents[0].appearsOn.includes('cta'), 'merging must union the roles it was seen on')
})

test('text stronger than ink is ink, not muted', () => {
  const records = coherentPage()
  // A near-black wordmark on a page whose dominant text is a lighter grey.
  for (let index = 0; index < 8; index += 1) {
    records.push(node({ id: `grey${index}`, tag: 'p', role: 'paragraph', parentId: 'footer', text: 'G'.repeat(400), color: 'rgb(84, 89, 93)', rect: { x: 0, y: 1500 + index * 30, width: 900, height: 28 } }))
  }
  records.push(node({ id: 'wordmark', tag: 'span', role: 'unknown', parentId: 'footer', text: 'Run Am', color: 'rgb(0, 0, 0)', rect: { x: 0, y: 1460, width: 120, height: 24 } }))
  const profile = profileOf(records)
  const black = profile.color.palette.find((entry) => entry.hex === '#000000')
  assert.ok(black, 'the wordmark colour is missing from the palette')
  assert.notEqual(black.role, 'muted', 'the darkest text on the page cannot be the quiet one')
  assert.equal(black.role, 'ink')
})

test('text below 10px is excluded from the scale but reported', () => {
  const records = coherentPage()
  for (const [index, size] of ['6px', '8px', '9px'].entries()) {
    records.push(node({ id: `tiny${index}`, tag: 'span', role: 'unknown', parentId: 'footer', text: 'x', rect: { x: index * 20, y: 1480, width: 12, height: 12 }, fontSize: size }))
  }
  const profile = profileOf(records)
  assert.ok(!profile.type.scale.some((step) => step.px < 10), `sub-10px sizes leaked into the scale: ${profile.type.scale.map((step) => step.px).join(', ')}`)
  assert.equal(profile.type.belowMinimumSizes, 3, 'excluded text must still be counted')
})

test('section flow is ordered by position and ends at the footer', () => {
  const profile = profileOf(coherentPage())
  assert.equal(profile.flow.sections.length, 3)
  assert.equal(profile.flow.sections[0].archetype, 'hero')
  assert.equal(profile.flow.sections[2].archetype, 'footer')
  assert.ok(profile.flow.signature.startsWith('hero>'))
})

test('profile records provenance and never carries source, copy or assets', () => {
  const profile = profileOf(coherentPage())
  assert.equal(profile.provenance.derivedOnly, true)
  assert.equal(profile.provenance.sourceCaptured, false)
  assert.equal(profile.provenance.copyCaptured, false)
  assert.equal(profile.provenance.assetsCaptured, false)
  const serialized = JSON.stringify(profile)
  assert.ok(!serialized.includes('Run errands without the wahala'), 'page copy must not survive into the profile')
  assert.ok(!serialized.includes('<'), 'no markup may survive into the profile')
})

test('an empty scan produces a valid, honest profile rather than throwing', () => {
  const profile = profileOf([])
  assert.equal(profile.provenance.nodesObserved, 0)
  assert.equal(profile.provenance.coverage, 0)
  assert.equal(profile.color.palette.length, 0)
  assert.equal(profile.color.contrastFloor, Infinity)
})

test('profiling is deterministic', () => {
  const first = JSON.stringify(profileOf(coherentPage()))
  const second = JSON.stringify(profileOf(coherentPage()))
  assert.equal(first, second)
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error.message}`)
  }
}
console.log(`\npage-profile: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
