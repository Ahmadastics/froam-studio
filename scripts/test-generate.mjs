import assert from 'node:assert/strict'
import { generatePageFromProfile, resolveTokens } from '../dist/project/generate.js'
import { profileDistance, sequenceDistance } from '../dist/project/profile-distance.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

function profile(overrides = {}) {
  const base = {
    schemaVersion: 1, origin: 'https://target.test', routeKey: '/', capturedAt: 1, viewport: 'desktop',
    color: {
      palette: [
        { oklch: { l: 0.96, c: 0.01, h: 80 }, hex: '#f4f1ea', areaShare: 0.6, role: 'surface', appearsOn: [], channel: 'background', nodeCount: 6 },
        { oklch: { l: 0.99, c: 0, h: 0 }, hex: '#fffdfa', areaShare: 0.15, role: 'raised', appearsOn: ['card'], channel: 'background', nodeCount: 8 },
        { oklch: { l: 0.15, c: 0, h: 0 }, hex: '#0c0c0b', areaShare: 0.12, role: 'ink', appearsOn: ['paragraph'], channel: 'text', nodeCount: 40 },
        { oklch: { l: 0.5, c: 0, h: 0 }, hex: '#6b6b6b', areaShare: 0.05, role: 'muted', appearsOn: ['paragraph'], channel: 'text', nodeCount: 12 },
        { oklch: { l: 0.62, c: 0.21, h: 28 }, hex: '#ff4138', areaShare: 0.03, role: 'accent', appearsOn: ['cta'], channel: 'background', nodeCount: 3 },
      ],
      accentDiscipline: 1, contrastFloor: 8.2, contrastFailures: [], contrastSamples: 40, contrastUnmeasurable: 0, modeSignal: 'light',
    },
    type: {
      families: [{ stack: 'Satoshi, sans-serif', role: 'display', areaShare: 0.6 }, { stack: 'Inter, sans-serif', role: 'body', areaShare: 0.4 }],
      scale: [13, 16, 20, 25, 31, 48].map((px) => ({ px, weight: 400, lineHeight: px * 1.5, usedBy: ['paragraph'], count: 6 })),
      ratio: 1.25, ratioSpread: 0.02, belowMinimumSizes: 0, measureCh: 68,
    },
    space: { base: 8, scale: [8, 16, 24, 32, 48, 64], adherence: 0.94, sectionGapPx: [64], density: 'balanced' },
    surface: { radii: [8, 16], shadowTiers: 2, borderWeights: [1] },
    interaction: { targetSamples: 12, undersizedTargets: [], smallestTargetPx: 44, exemptInlineTargets: 0, exemptSpacedTargets: 0 },
    flow: {
      sections: ['hero', 'feature-grid', 'content', 'cta', 'footer'].map((archetype, index) => ({
        index, archetype, confidence: 0.7,
        grid: { columns: archetype === 'feature-grid' ? 3 : 1, gapPx: 24, maxWidthPx: 1200 },
        heightRatio: 0.2, childRoles: ['heading', 'paragraph'],
      })),
      signature: 'hero>feature-grid>content>cta>footer',
    },
    components: [], quality: { tokenDrift: 0.02, spacingDrift: 0.06, accessibilityWarnings: 0, uniqueColors: 7, uniqueSizes: 6 },
    provenance: { derivedOnly: true, sourceCaptured: false, copyCaptured: false, assetsCaptured: false, nodesObserved: 620, nodesRendered: 585, coverage: 0.944 },
  }
  return structuredClone({ ...base, ...overrides })
}

test('generated markup uses the measured tokens, not invented ones', () => {
  const html = generatePageFromProfile(profile())
  assert.ok(html.includes('#f4f1ea'), 'surface colour missing')
  assert.ok(html.includes('#ff4138'), 'accent colour missing')
  assert.ok(html.includes('Satoshi'), 'display family missing')
  assert.ok(html.includes('48px'), 'largest type step missing')
  assert.ok(!html.includes('undefined') && !html.includes('NaN'), 'generated markup leaked a placeholder')
})

test('nothing from a scanned page can reach the output', () => {
  // Structural, not a matter of care: a profile holds no copy, markup or assets,
  // so there is nothing to leak even if the generator wanted to.
  const source = profile()
  const serialized = JSON.stringify(source)
  assert.ok(!serialized.includes('<'), 'a profile must not carry markup')
  assert.equal(source.provenance.copyCaptured, false)
  assert.equal(source.provenance.assetsCaptured, false)
})

test('a thin profile produces plain defaults rather than confident nonsense', () => {
  const thin = profile()
  thin.color.palette = []
  thin.type.scale = []
  thin.type.families = []
  thin.space.base = 0
  thin.surface.radii = []
  const tokens = resolveTokens(thin)
  assert.equal(tokens.base, 8)
  assert.ok(tokens.steps.length >= 3)
  assert.ok(tokens.surface.startsWith('#'))
  assert.ok(generatePageFromProfile(thin).includes('<body'))
})

test('dark mode inverts the defaults', () => {
  const dark = profile()
  dark.color.modeSignal = 'dark'
  dark.color.palette = []
  const tokens = resolveTokens(dark)
  assert.equal(tokens.surface, '#111111')
  assert.equal(tokens.ink, '#f2f2f2')
})

test('density reaches the containers density is measured from', () => {
  // Horizontal section padding was once a hardcoded constant, which pinned every
  // generated page to 'balanced' whatever the target said. Both axes now scale.
  const airy = resolveTokens(profile({ space: { ...profile().space, density: 'airy' } }))
  const tight = resolveTokens(profile({ space: { ...profile().space, density: 'tight' } }))
  assert.ok(airy.cardPad > tight.cardPad * 3, `airy ${airy.cardPad} vs tight ${tight.cardPad}`)
  assert.ok(airy.gutter > tight.gutter, 'gutter must scale too, or half the padding votes are constant')
})

test('actions are emitted as buttons, which carry their role by tag', () => {
  // An <a> only registers as an action when its copy matches scan.ts's
  // buy/start/join heuristic, so every generated cta section read as 'content'.
  const html = generatePageFromProfile(profile())
  assert.ok(html.includes('<button'), 'no button element emitted')
})

test('placeholders that stand in for media are media', () => {
  // Plain divs carry no media role, so proof strips scanned as 'unknown' and
  // testimonials as 'feature-grid'.
  const html = generatePageFromProfile(profile({
    flow: { sections: [{ index: 0, archetype: 'proof', confidence: 0.6, grid: { columns: 1, gapPx: 24, maxWidthPx: 1200 }, heightRatio: 0.08, childRoles: [] }], signature: 'proof' },
  }))
  assert.ok(html.includes('<svg'), 'proof strip must emit real media')
})

test('a contrasting raised colour is not painted across whole sections', () => {
  // Several targets use a near-black 'raised' on small cards only. Painting
  // full-bleed sections with it put a second large background on the far side
  // of the lightness line, and the page reported 'mixed' where the target was
  // plainly 'light'.
  const contrasting = profile()
  contrasting.color.palette.find((entry) => entry.role === 'raised').oklch = { l: 0.12, c: 0, h: 0 }
  contrasting.color.palette.find((entry) => entry.role === 'raised').hex = '#171717'
  const tokens = resolveTokens(contrasting)
  assert.equal(tokens.panelTint, '#f4f1ea', 'a near-black raised must not tint whole sections')
  assert.equal(tokens.raised, '#171717', 'cards should still use it')

  const near = resolveTokens(profile())
  assert.equal(near.panelTint, near.raised, 'a raised close to the surface is fine at section scale')
})

test('an accent exists even when the flow contains no call to action', () => {
  // Real pages carry an action in their chrome. Without one, a flow of
  // proof/split/split produced no accent anywhere and the role vanished from
  // the palette entirely.
  const noCta = profile({
    flow: {
      sections: ['proof', 'split', 'split'].map((archetype, index) => ({
        index, archetype, confidence: 0.5,
        grid: { columns: 2, gapPx: 24, maxWidthPx: 1200 }, heightRatio: 0.2, childRoles: [],
      })),
      signature: 'proof>split>split',
    },
  })
  const html = generatePageFromProfile(noCta)
  assert.ok(html.includes('<header'), 'no page chrome emitted')
  assert.ok(html.includes('#ff4138'), 'the accent never appears')
  // Fixed positioning keeps the chrome out of the section flow, so it cannot
  // add a phantom section to the sequence.
  assert.ok(/<header style="position:fixed/.test(html), 'chrome must be out of flow')
})

test('an opening section that is not a hero does not claim the top of the scale', () => {
  const heroFirst = generatePageFromProfile(profile())
  const ctaFirst = generatePageFromProfile(profile({
    flow: {
      sections: ['cta', 'content'].map((archetype, index) => ({
        index, archetype, confidence: 0.5,
        grid: { columns: 1, gapPx: 24, maxWidthPx: 1200 }, heightRatio: 0.3, childRoles: [],
      })),
      signature: 'cta>content',
    },
  }))
  assert.ok(heroFirst.includes('48px'), 'a hero should use the largest step')
  assert.ok(!ctaFirst.includes('font-size:48px'), 'a cta-first page must not own the top step')
})

test('a quoted font stack does not break the style attribute', () => {
  // Real stacks quote any family whose name has a space. A double quote inside
  // a double-quoted attribute terminates it, so every declaration *after*
  // font-family was silently dropped — generated headings fell back to the
  // browser's 2em default and a target's 64px top step came back as 32px. It
  // cost the top of the type scale on most pages in the corpus.
  const quoted = profile()
  quoted.type.families = [
    { stack: '"Inter Variable", "SF Pro Display", -apple-system, sans-serif', role: 'display', areaShare: 0.6 },
    { stack: '"Segoe UI", Roboto, sans-serif', role: 'body', areaShare: 0.4 },
  ]
  const tokens = resolveTokens(quoted)
  assert.ok(!tokens.displayFont.includes('"'), `display stack still carries a double quote: ${tokens.displayFont}`)
  assert.ok(tokens.displayFont.includes("'Inter Variable'"), 'the family name must survive, just requoted')
  assert.ok(!tokens.bodyFont.includes('"'))

  const html = generatePageFromProfile(quoted)
  // Every heading must still carry its size after the font declaration.
  const headings = [...html.matchAll(/<h1[^>]*style="([^"]*)"/g)].map((match) => match[1])
  assert.ok(headings.length > 0, 'no h1 emitted')
  for (const style of headings) {
    assert.ok(/font-size:\s*\d/.test(style), `font-size lost from the attribute: ${style}`)
  }
  assert.ok(html.includes('font-size:48px'), 'the largest step never reaches the markup')
})

test('generation is deterministic', () => {
  assert.equal(generatePageFromProfile(profile(), { seed: 7 }), generatePageFromProfile(profile(), { seed: 7 }))
})

// ── distance ────────────────────────────────────────────────────────────────

test('a profile is zero distance from itself', () => {
  const distance = profileDistance(profile(), profile())
  assert.equal(distance.total, 0)
  for (const axis of distance.axes) assert.equal(axis.distance, 0, `${axis.axis} drifted from itself`)
})

test('every axis is reported, so a total can always be explained', () => {
  const distance = profileDistance(profile(), profile())
  assert.deepEqual(
    distance.axes.map((axis) => axis.axis).sort(),
    ['density', 'flow', 'mode', 'palette', 'space', 'surface', 'type'],
  )
  for (const axis of distance.axes) assert.ok(axis.note.length > 0, `${axis.axis} has no explanation`)
})

test('a different palette moves the palette axis and little else', () => {
  const other = profile()
  for (const entry of other.color.palette) entry.oklch = { ...entry.oklch, h: (entry.oklch.h + 180) % 360, c: 0.3 }
  const distance = profileDistance(profile(), other)
  const palette = distance.axes.find((axis) => axis.axis === 'palette')
  assert.ok(palette.distance > 0.3, `palette barely moved: ${palette.distance}`)
  assert.equal(distance.axes.find((axis) => axis.axis === 'flow').distance, 0)
})

test('flow distance is an edit distance over archetypes', () => {
  assert.equal(sequenceDistance(['hero', 'cta'], ['hero', 'cta']), 0)
  assert.equal(sequenceDistance([], []), 0)
  assert.equal(sequenceDistance(['hero'], []), 1)
  assert.ok(sequenceDistance(['hero', 'cta', 'footer'], ['hero', 'footer']) < 0.5, 'one deletion of three is not a rewrite')
  assert.equal(sequenceDistance(['a', 'b'], ['c', 'd']), 1)
})

test('fewer, cleaner type steps are not punished as infidelity', () => {
  // The round trip exposed this: real pages carry 7–13 sizes, most of them
  // one-off utility values that the judge itself flags as a defect. Scoring a
  // disciplined six-step generation as unfaithful would mean the only way to
  // win is to reproduce the target's clutter. Step count is a quality signal,
  // which the judge owns; this metric measures whether the same scale is in use.
  const target = profile()
  target.type.scale = [10, 11, 12, 13, 14, 16, 18, 20, 25, 31, 48].map((px) => ({ px, weight: 400, lineHeight: px * 1.5, usedBy: [], count: 2 }))
  const disciplined = profile()
  disciplined.type.scale = [13, 16, 20, 31, 48].map((px) => ({ px, weight: 400, lineHeight: px * 1.5, usedBy: [], count: 4 }))
  const offScale = profile()
  offScale.type.scale = [9, 22, 37, 55, 90].map((px) => ({ px, weight: 400, lineHeight: px * 1.5, usedBy: [], count: 4 }))

  const clean = profileDistance(target, disciplined).axes.find((axis) => axis.axis === 'type').distance
  const wrong = profileDistance(target, offScale).axes.find((axis) => axis.axis === 'type').distance
  assert.ok(clean < wrong, `a subset of the target's own scale (${clean}) must beat sizes off it (${wrong})`)
  assert.ok(clean < 0.25, `a disciplined subset should read as close, got ${clean}`)
})

test('distance is symmetric on the axes that should be', () => {
  const other = profile({ space: { ...profile().space, base: 4, density: 'tight' } })
  const forward = profileDistance(profile(), other)
  const backward = profileDistance(other, profile())
  assert.equal(forward.axes.find((a) => a.axis === 'space').distance, backward.axes.find((a) => a.axis === 'space').distance)
  assert.equal(forward.axes.find((a) => a.axis === 'density').distance, backward.axes.find((a) => a.axis === 'density').distance)
})

let failed = 0
for (const [name, fn] of tests) {
  try { fn(); console.log(`  ok  ${name}`) } catch (error) {
    failed += 1; console.error(`FAIL  ${name}`); console.error(`      ${error.message}`)
  }
}
console.log(`\ngenerate + distance: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
