import assert from 'node:assert/strict'
import {
  detectLeakage,
  generatePretextTasks,
  isCorrect,
  scorePretext,
} from '../dist/project/pretext.js'
import {
  corpusPredictor,
  diagnosePredictor,
  fitCorpusModel,
  fitMajorityBaseline,
  runPredictor,
  uniformBaseline,
} from '../dist/project/predictors.js'
import {
  addToCorpus,
  corpusReadiness,
  corpusStats,
  emptyCorpus,
  learnableProfiles,
  negativeProfiles,
} from '../dist/project/corpus.js'
import { splitByOrigin } from '../dist/project/judge-priors.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

/** Deterministic pseudo-random, so a failing run can be reproduced. */
function rng(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function makeProfile(input) {
  const { origin, routeKey = '/', flow, steps = [16, 20, 25, 31], density = 'balanced', mode = 'light', accentRole = 'cta', measureCh = 66, geometry } = input
  return {
    schemaVersion: 1,
    origin,
    routeKey,
    capturedAt: 1,
    viewport: 'desktop',
    color: {
      palette: [
        { oklch: { l: 1, c: 0, h: 0 }, hex: '#ffffff', areaShare: 0.7, role: 'surface', appearsOn: ['unknown'], channel: 'background', nodeCount: 4 },
        { oklch: { l: 0.2, c: 0, h: 0 }, hex: '#111111', areaShare: 0.2, role: 'ink', appearsOn: ['paragraph'], channel: 'text', nodeCount: 9 },
        { oklch: { l: 0.6, c: 0.19, h: 25 }, hex: '#e63946', areaShare: 0.04, role: 'accent', appearsOn: [accentRole], channel: 'background', nodeCount: 2 },
      ],
      accentDiscipline: 1,
      contrastFloor: 12.4,
      contrastFailures: [],
      contrastSamples: 20,
      modeSignal: mode,
    },
    type: {
      families: [{ stack: 'Inter', role: 'body', areaShare: 1 }],
      scale: steps.map((px) => ({ px, weight: 400, lineHeight: px * 1.5, usedBy: ['paragraph'], count: 3 })),
      ratio: 1.25,
      ratioSpread: 0.02,
      measureCh,
    },
    space: { base: 8, scale: [8, 16, 24, 32], adherence: 1, sectionGapPx: [64], density },
    surface: { radii: [4, 8], shadowTiers: 2, borderWeights: [1] },
    interaction: { targetSamples: 8, undersizedTargets: [], smallestTargetPx: 44, exemptInlineTargets: 1 },
    flow: {
      sections: flow.map((archetype, index) => ({
        index,
        archetype,
        confidence: 0.7,
        // Geometry defaults to being a function of the archetype, which is what
        // makes blind-role learnable. A structureless fixture must override it,
        // or the "random" corpus smuggles a perfect geometry→archetype map in.
        grid: { columns: geometry?.[index]?.columns ?? (archetype === 'feature-grid' ? 3 : 1), gapPx: 24, maxWidthPx: 1200 },
        heightRatio: geometry?.[index]?.heightRatio ?? (archetype === 'hero' ? 0.3 : archetype === 'footer' ? 0.12 : 0.2),
        childRoles: archetype === 'hero' ? ['heading', 'cta'] : ['paragraph'],
      })),
      signature: flow.join('>'),
    },
    components: [{ signature: 'div|card|block', role: 'card', instances: 3, variance: 0 }],
    quality: { tokenDrift: 0, spacingDrift: 0, accessibilityWarnings: 0, uniqueColors: 5, uniqueSizes: steps.length },
    provenance: { derivedOnly: true, sourceCaptured: false, copyCaptured: false, assetsCaptured: false, nodesObserved: 120, nodesRendered: 118, coverage: 0.983 },
  }
}

/** A corpus with a real regularity: proof always follows hero, cta always precedes footer. */
function structuredCorpus(sites = 30) {
  const random = rng(7)
  const profiles = []
  for (let site = 0; site < sites; site += 1) {
    for (let page = 0; page < 2; page += 1) {
      const middle = random() > 0.5 ? ['feature-grid', 'split'] : ['feature-grid']
      profiles.push(makeProfile({
        origin: `https://site-${site}.test`,
        routeKey: `/page-${page}`,
        flow: ['hero', 'proof', ...middle, 'cta', 'footer'],
        density: site % 2 === 0 ? 'airy' : 'tight',
        steps: site % 2 === 0 ? [16, 20, 25, 31, 39] : [14, 17, 20, 24, 29],
        measureCh: site % 2 === 0 ? 72 : 48,
      }))
    }
  }
  return profiles
}

/**
 * The same shape with every learnable relationship destroyed.
 *
 * Getting this right is harder than it looks. A first version randomised only
 * the section flow and still showed a lift of 1.89, because the factory derived
 * geometry from archetype and left the type scale at its default — so the
 * "random" corpus contained a perfect geometry→archetype map and an identical
 * scale on every page. Every axis a task reads from has to be randomised
 * independently, or the negative control quietly certifies a harness that
 * cannot tell learning from its own fixtures.
 */
function shuffledCorpus(sites = 30, seed = 11) {
  const random = rng(seed)
  const pool = ['hero', 'proof', 'feature-grid', 'split', 'cta', 'footer', 'faq', 'pricing']
  const pick = (values) => values[Math.floor(random() * values.length)]
  const profiles = []
  for (let site = 0; site < sites; site += 1) {
    for (let page = 0; page < 2; page += 1) {
      const flow = Array.from({ length: 5 }, () => pick(pool))
      const base = 10 + Math.floor(random() * 10)
      profiles.push(makeProfile({
        origin: `https://noise-${site}.test`,
        routeKey: `/page-${page}`,
        flow,
        // Geometry detached from archetype.
        geometry: flow.map(() => ({ columns: 1 + Math.floor(random() * 4), heightRatio: Math.round(random() * 100) / 200 })),
        // A scale with no consistent progression, so interpolation cannot work.
        steps: [base, base + 1 + Math.floor(random() * 14), base + 6 + Math.floor(random() * 20), base + 14 + Math.floor(random() * 30)].sort((a, b) => a - b),
        density: pick(['tight', 'balanced', 'airy']),
        accentRole: pick(['cta', 'button', 'badge', 'heading', 'card']),
        measureCh: 30 + Math.floor(random() * 90),
      }))
    }
  }
  return profiles
}

// ── leakage: the validity of everything below depends on this ───────────────

test('no generated task contains its own answer', () => {
  const tasks = generatePretextTasks(structuredCorpus(6))
  assert.ok(tasks.length > 50, `expected a useful number of tasks, got ${tasks.length}`)
  const leaked = tasks.flatMap((task) => detectLeakage(task).map((leak) => `${task.kind}: ${leak}`))
  assert.deepEqual(leaked, [], `leakage would make every accuracy below meaningless:\n${leaked.join('\n')}`)
})

test('the leakage detector actually detects leakage', () => {
  // A guard nobody has seen fail is a guard nobody should trust.
  const [task] = generatePretextTasks(structuredCorpus(2), ['section-infill'])
  const leaky = { ...task, input: { ...task.input, signature: 'hero>proof>cta' } }
  assert.ok(detectLeakage(leaky).length > 0, 'signature leak went undetected')

  const [scale] = generatePretextTasks(structuredCorpus(2), ['scale-infill'])
  const leakyScale = { ...scale, input: { ...scale.input, visibleSteps: [...scale.input.visibleSteps, scale.answer] } }
  assert.ok(detectLeakage(leakyScale).length > 0, 'hidden step leak went undetected')

  const [blind] = generatePretextTasks(structuredCorpus(2), ['blind-role'])
  assert.ok(detectLeakage({ ...blind, input: { ...blind.input, childRoles: ['heading'] } }).length > 0, 'role leak went undetected')
})

test('section-infill hides exactly the section it asks about', () => {
  for (const task of generatePretextTasks(structuredCorpus(3), ['section-infill'])) {
    const { visible, hiddenIndex } = task.input
    assert.ok(!visible.some((section) => section.index === hiddenIndex))
    assert.equal(visible.length, task.input.sectionCount - 1)
  }
})

test('next-section shows a prefix and never the total length', () => {
  for (const task of generatePretextTasks(structuredCorpus(3), ['next-section'])) {
    assert.equal(task.input.prefix.length, task.input.atIndex)
    assert.ok(!('sectionCount' in task.input), 'knowing the length gives away the footer')
  }
})

// ── scoring mechanics ───────────────────────────────────────────────────────

test('numeric answers are correct within tolerance, not by luck', () => {
  const task = { kind: 'scale-infill', answer: 25 }
  assert.ok(isCorrect(task, 25))
  assert.ok(isCorrect(task, 26.5), '6% off should pass')
  assert.ok(!isCorrect(task, 31), '24% off should fail')
  assert.ok(!isCorrect(task, null))
  assert.ok(!isCorrect(task, 'twenty-five'))
})

test('categorical answers require an exact match', () => {
  const task = { kind: 'section-infill', answer: 'hero' }
  assert.ok(isCorrect(task, 'hero'))
  assert.ok(!isCorrect(task, 'heroic'))
  assert.ok(!isCorrect(task, null))
})

// ── the measurement that matters ────────────────────────────────────────────

function evaluate(profiles) {
  const { train, holdOut } = splitByOrigin(profiles, 0.3)
  const trainTasks = generatePretextTasks(train)
  const holdOutTasks = generatePretextTasks(holdOut)
  const model = fitCorpusModel(train)
  const learned = corpusPredictor(model)
  const majority = fitMajorityBaseline(trainTasks)
  return {
    model,
    holdOutTasks,
    card: scorePretext(
      holdOutTasks,
      runPredictor(learned, holdOutTasks),
      runPredictor(majority, holdOutTasks),
      { predictor: learned.name, baseline: majority.name },
    ),
    learned,
    majority,
  }
}

test('the corpus predictor beats the majority baseline on structured pages', () => {
  const { card } = evaluate(structuredCorpus())

  console.log(`\n  ── ${card.pretextVersion}: ${card.predictor} vs ${card.baseline} ──────────`)
  console.log(`  ${card.tasks} held-out tasks   accuracy ${(card.accuracy * 100).toFixed(1)}%   baseline ${(card.baselineAccuracy * 100).toFixed(1)}%   lift ${card.lift.toFixed(2)}`)
  for (const kind of card.byKind) {
    console.log(`    ${kind.kind.padEnd(18)} ${String(kind.tasks).padStart(3)} tasks   ` +
      `${(kind.accuracy * 100).toFixed(0).padStart(3)}% vs ${(kind.baselineAccuracy * 100).toFixed(0).padStart(3)}%   ` +
      `lift ${kind.lift === Infinity ? '  ∞' : kind.lift.toFixed(2)}${kind.significant ? '  *' : ''}`)
  }
  console.log('')

  assert.ok(card.tasks > 40, `too few held-out tasks to conclude anything: ${card.tasks}`)
  assert.ok(card.lift > 1, `learned nothing: accuracy ${card.accuracy} vs baseline ${card.baselineAccuracy}`)
  assert.ok(card.byKind.some((kind) => kind.significant), 'no task kind showed a significant margin')
})

test('the corpus predictor does NOT beat the baseline on structureless pages', () => {
  // The negative control. Without it there is no evidence the harness can
  // report failure — and a harness that always finds learning is a harness
  // that has never measured any.
  //
  // Run across several seeds, because a single seed passing proves very little
  // about a statistical guard. This is also what exposed the uncorrected
  // significance test: one seed in five produced z=2.03 on pure noise.
  for (const seed of [11, 12, 13, 14, 15]) {
    const { card } = evaluate(shuffledCorpus(30, seed))
    const significantKinds = card.byKind.filter((kind) => kind.significant && kind.lift > 1)
    assert.deepEqual(
      significantKinds.map((kind) => kind.kind),
      [],
      `seed ${seed}: found "learning" in random data — ${significantKinds.map((kind) => `${kind.kind} z=${kind.z} > ${kind.significanceThreshold}`).join(', ')}`,
    )
  }
  const { card } = evaluate(shuffledCorpus(30, 11))
  console.log(`  negative control (5 seeds): accuracy ${(card.accuracy * 100).toFixed(1)}%  baseline ${(card.baselineAccuracy * 100).toFixed(1)}%  threshold z>${card.byKind[0].significanceThreshold}`)
})

test('the significance threshold is corrected for the number of kinds tested', () => {
  const { card } = evaluate(structuredCorpus())
  assert.equal(card.comparisons, card.byKind.length)
  // Six simultaneous tests at 0.05 each would fire on noise roughly a quarter
  // of the time. The corrected bar must be meaningfully above the naive 1.96.
  assert.ok(card.byKind[0].significanceThreshold > 2.3, `threshold ${card.byKind[0].significanceThreshold} is too permissive for ${card.comparisons} comparisons`)
  for (const kind of card.byKind) {
    assert.equal(kind.significant, kind.z > kind.significanceThreshold)
  }
})

test('interpolation is chosen from the data, not assumed', () => {
  const geometric = fitCorpusModel(structuredCorpus(10))
  assert.equal(geometric.interpolation, 'geometric', 'a 1.25 ratio scale is geometric')
  assert.ok(geometric.interpolationFit.geometric < geometric.interpolationFit.arithmetic)

  // A linear scale must flip the choice. A hardcoded rule could not.
  const linear = fitCorpusModel(Array.from({ length: 10 }, (_, site) => makeProfile({
    origin: `https://linear-${site}.test`,
    flow: ['hero', 'cta', 'footer'],
    steps: [12, 20, 28, 36, 44],
  })))
  assert.equal(linear.interpolation, 'arithmetic', 'an evenly-spaced scale is arithmetic')
})

test('a model fitted on more data changes', () => {
  const small = fitCorpusModel(structuredCorpus(4))
  const large = fitCorpusModel(structuredCorpus(30))
  assert.ok(large.trainedOn > small.trainedOn)
  assert.ok(large.geometry.length > small.geometry.length)
})

test('the uniform baseline is a floor, and majority beats it', () => {
  const profiles = structuredCorpus()
  const { train, holdOut } = splitByOrigin(profiles, 0.3)
  const holdOutTasks = generatePretextTasks(holdOut)
  const majority = fitMajorityBaseline(generatePretextTasks(train))
  const card = scorePretext(
    holdOutTasks,
    runPredictor(majority, holdOutTasks),
    runPredictor(uniformBaseline(), holdOutTasks),
    { predictor: 'majority', baseline: 'uniform' },
  )
  assert.ok(card.accuracy > card.baselineAccuracy, 'majority should beat uniform, or the tasks are broken')
})

test('predictors are deterministic', () => {
  const profiles = structuredCorpus(8)
  const tasks = generatePretextTasks(profiles)
  const model = fitCorpusModel(profiles)
  assert.deepEqual(runPredictor(corpusPredictor(model), tasks), runPredictor(corpusPredictor(model), tasks))
  assert.deepEqual(runPredictor(uniformBaseline(), tasks), runPredictor(uniformBaseline(), tasks))
})

test('a diagnosis says what the predictor confuses, not just how often it fails', () => {
  const { learned, holdOutTasks } = evaluate(shuffledCorpus())
  const diagnosis = diagnosePredictor(learned, holdOutTasks)
  assert.ok(diagnosis.length > 0)
  const withConfusions = diagnosis.find((entry) => entry.confusions.length > 0)
  assert.ok(withConfusions, 'random data should produce confusions to report')
  for (const confusion of withConfusions.confusions) {
    assert.ok(confusion.expected && confusion.predicted && confusion.count > 0)
    assert.notEqual(confusion.expected, confusion.predicted)
  }
})

test('an empty corpus yields no tasks rather than throwing', () => {
  assert.deepEqual(generatePretextTasks([]), [])
  const model = fitCorpusModel([])
  assert.equal(model.trainedOn, 0)
  assert.equal(corpusPredictor(model).predict({ kind: 'blind-role', input: { columns: 1, heightRatio: 0.2, isFirst: true, isLast: false } }), null)
})

// ── corpus store ────────────────────────────────────────────────────────────

test('nothing enters the corpus without a declared quality tier', () => {
  let corpus = emptyCorpus()
  const profile = makeProfile({ origin: 'https://a.test', flow: ['hero', 'cta', 'footer'] })
  corpus = addToCorpus(corpus, profile, { tier: 'reference', tags: ['saas'], note: 'clean' })
  assert.equal(corpus.entries.length, 1)
  assert.equal(corpus.entries[0].tier, 'reference')
  assert.ok(corpus.entries[0].scoreAtIngest > 0, 'ingest records the audit score for later drift checks')
  assert.ok(corpus.entries[0].judgeVersion.length > 0)
})

test('re-adding the same page replaces it rather than double-counting', () => {
  let corpus = emptyCorpus()
  const profile = makeProfile({ origin: 'https://a.test', routeKey: '/', flow: ['hero', 'cta', 'footer'] })
  corpus = addToCorpus(corpus, profile, { tier: 'good' })
  corpus = addToCorpus(corpus, { ...profile, capturedAt: 2 }, { tier: 'reference' })
  assert.equal(corpus.entries.length, 1)
  assert.equal(corpus.entries[0].tier, 'reference')
})

test('induction reads only from vouched tiers', () => {
  let corpus = emptyCorpus()
  corpus = addToCorpus(corpus, makeProfile({ origin: 'https://ref.test', flow: ['hero', 'cta', 'footer'] }), { tier: 'reference' })
  corpus = addToCorpus(corpus, makeProfile({ origin: 'https://good.test', flow: ['hero', 'cta', 'footer'] }), { tier: 'good' })
  corpus = addToCorpus(corpus, makeProfile({ origin: 'https://meh.test', flow: ['hero', 'cta', 'footer'] }), { tier: 'baseline' })
  corpus = addToCorpus(corpus, makeProfile({ origin: 'https://bad.test', flow: ['hero', 'cta', 'footer'] }), { tier: 'negative' })
  assert.equal(learnableProfiles(corpus).length, 2)
  assert.equal(negativeProfiles(corpus).length, 1)
  assert.equal(corpusStats(corpus).learnable, 2)
})

test('a thin corpus reports why it is not ready instead of inducing anyway', () => {
  let corpus = emptyCorpus()
  for (let index = 0; index < 3; index += 1) {
    corpus = addToCorpus(corpus, makeProfile({ origin: `https://s${index}.test`, flow: ['hero', 'cta', 'footer'] }), { tier: 'good' })
  }
  const readiness = corpusReadiness(corpus)
  assert.equal(readiness.ready, false)
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('origins')))
  assert.ok(readiness.warnings.some((warning) => warning.includes('negative-tier')))
})

test('a healthy corpus reports ready', () => {
  let corpus = emptyCorpus()
  for (let index = 0; index < 10; index += 1) {
    corpus = addToCorpus(corpus, makeProfile({ origin: `https://s${index}.test`, routeKey: '/', flow: ['hero', 'cta', 'footer'] }), { tier: index < 3 ? 'reference' : 'good' })
    corpus = addToCorpus(corpus, makeProfile({ origin: `https://s${index}.test`, routeKey: '/about', flow: ['hero', 'faq', 'footer'] }), { tier: 'good' })
  }
  corpus = addToCorpus(corpus, makeProfile({ origin: 'https://bad.test', flow: ['hero', 'cta'] }), { tier: 'negative' })
  const readiness = corpusReadiness(corpus)
  assert.deepEqual(readiness.blockers, [])
  assert.equal(readiness.ready, true)
  assert.ok(corpusStats(corpus).multiPageOrigins === 10)
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
console.log(`\npretext + corpus: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
