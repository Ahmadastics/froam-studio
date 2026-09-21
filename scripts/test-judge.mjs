import assert from 'node:assert/strict'
import {
  FROAM_JUDGE_EQUIVALENCE_BAND,
  FROAM_JUDGE_VERSION,
  auditProfile,
  compareProfiles,
  confidenceForMargin,
} from '../dist/project/judge-deterministic.js'
import {
  FROAM_DEFAULT_MAGNITUDES,
  degradeContrast,
  degradeSpacingGrid,
  degradeTouchTargets,
  generateGoldSet,
  rotateAccentHue,
  scoreJudge,
} from '../dist/project/degrade.js'
import { formatJudgeReport, judgeChange, judgePage } from '../dist/project/judge.js'
import {
  applyPriors,
  inducePriors,
  profileFeatures,
  splitByOrigin,
} from '../dist/project/judge-priors.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

/** A healthy profile: every check passing, so any movement is attributable. */
function healthyProfile(overrides = {}) {
  const base = {
    schemaVersion: 1,
    origin: 'https://example.test',
    routeKey: '/',
    capturedAt: 1,
    viewport: 'desktop',
    color: {
      palette: [
        { oklch: { l: 1, c: 0, h: 0 }, hex: '#ffffff', areaShare: 0.7, role: 'surface', appearsOn: ['unknown'], channel: 'background', nodeCount: 4 },
        { oklch: { l: 0.2, c: 0, h: 0 }, hex: '#111111', areaShare: 0.2, role: 'ink', appearsOn: ['paragraph'], channel: 'text', nodeCount: 12 },
        { oklch: { l: 0.6, c: 0.19, h: 25 }, hex: '#e63946', areaShare: 0.04, role: 'accent', appearsOn: ['cta'], channel: 'background', nodeCount: 2 },
      ],
      accentDiscipline: 1,
      contrastFloor: 12.4,
      contrastFailures: [],
      contrastSamples: 24,
      modeSignal: 'light',
    },
    type: {
      families: [{ stack: 'Inter', role: 'body', areaShare: 1 }],
      scale: [16, 20, 25, 31].map((px) => ({ px, weight: 400, lineHeight: px * 1.5, usedBy: ['paragraph'], count: 4 })),
      ratio: 1.25,
      ratioSpread: 0.01,
      measureCh: 66,
    },
    space: { base: 8, scale: [8, 16, 24, 32], adherence: 1, sectionGapPx: [64, 64], density: 'balanced' },
    surface: { radii: [4, 8], shadowTiers: 2, borderWeights: [1] },
    interaction: { targetSamples: 12, undersizedTargets: [], smallestTargetPx: 44, exemptInlineTargets: 2 },
    flow: { sections: [{ index: 0, archetype: 'hero', confidence: 0.72, grid: { columns: 1, gapPx: 24, maxWidthPx: 1200 }, heightRatio: 0.3, childRoles: ['heading', 'cta'] }], signature: 'hero>feature-grid:3>footer' },
    components: [{ signature: 'div|card|block', role: 'card', instances: 3, variance: 0 }],
    quality: { tokenDrift: 0, spacingDrift: 0, accessibilityWarnings: 0, uniqueColors: 5, uniqueSizes: 4 },
    provenance: { derivedOnly: true, sourceCaptured: false, copyCaptured: false, assetsCaptured: false, nodesObserved: 120, nodesRendered: 118, coverage: 0.983 },
  }
  return structuredClone({ ...base, ...overrides })
}

// ── Tier 1: audit ───────────────────────────────────────────────────────────

test('a coherent page audits near the ceiling with no findings', () => {
  const audit = auditProfile(healthyProfile())
  assert.equal(audit.judgeVersion, FROAM_JUDGE_VERSION)
  assert.ok(audit.score > 0.98, `expected a near-perfect score, got ${audit.score}`)
  assert.equal(audit.findings.length, 0)
})

test('every finding states its measurement and threshold, and reads as a sentence', () => {
  const audit = auditProfile(degradeSpacingGrid(healthyProfile(), 0.4))
  const finding = audit.findings.find((item) => item.check === 'spacing-grid')
  assert.ok(finding, 'expected a spacing finding')
  assert.equal(typeof finding.measured, 'number')
  assert.equal(typeof finding.threshold, 'number')
  assert.ok(finding.summary.includes('8px grid'), `summary should name the grid: ${finding.summary}`)
  assert.ok(/\d/.test(finding.summary), 'a finding must carry its number')
})

test('a page with no grid is told it has no grid, not given a fictional one', () => {
  const gridless = healthyProfile()
  gridless.space.adherence = 0.1
  gridless.space.base = 5
  const finding = auditProfile(gridless).findings.find((item) => item.check === 'spacing-grid')
  assert.ok(finding.summary.startsWith('no spacing grid holds'), `misleading summary: ${finding.summary}`)
  assert.equal(finding.evidence.gridHolds, false)
  // A page that does follow a grid should still name it.
  const loose = healthyProfile()
  loose.space.adherence = 0.75
  assert.ok(auditProfile(loose).findings.find((item) => item.check === 'spacing-grid').summary.includes('8px grid'))
})

test('an unclassified element is not reported back as a role', () => {
  const diluted = healthyProfile()
  diluted.color.accentDiscipline = 0.4
  diluted.color.palette.find((entry) => entry.role === 'accent').appearsOn = ['cta', 'unknown']
  const finding = auditProfile(diluted).findings.find((item) => item.check === 'accent-discipline')
  assert.ok(!finding.summary.includes('unknown'), `"unknown" leaked into prose: ${finding.summary}`)
  assert.ok(finding.summary.includes('non-action elements'))
})

test('contrast failures are reported as vetoes with the offending ratio', () => {
  const audit = auditProfile(degradeContrast(healthyProfile(), 0.5))
  const veto = audit.findings.find((item) => item.severity === 'veto')
  assert.ok(veto, 'contrast failures must surface as veto severity')
  assert.ok(veto.summary.includes('WCAG'), 'the standard must be named')
  assert.ok(audit.score < auditProfile(healthyProfile()).score)
})

test('audit is deterministic and free of side effects', () => {
  const profile = healthyProfile()
  const snapshot = JSON.stringify(profile)
  const first = JSON.stringify(auditProfile(profile))
  const second = JSON.stringify(auditProfile(profile))
  assert.equal(first, second)
  assert.equal(JSON.stringify(profile), snapshot, 'auditing must not mutate its input')
})

// ── Tier 1: compare ─────────────────────────────────────────────────────────

test('an unchanged page is equivalent, never better or worse', () => {
  const profile = healthyProfile()
  const verdict = compareProfiles(profile, structuredClone(profile))
  assert.equal(verdict.outcome, 'equivalent')
  assert.equal(verdict.scoreDelta, 0)
  assert.equal(verdict.veto, null)
})

test('a contrast regression vetoes outright, and the veto decides alone', () => {
  const before = healthyProfile()
  const after = degradeContrast(before, 0.3)
  const verdict = compareProfiles(before, after)
  assert.equal(verdict.outcome, 'worse')
  assert.ok(verdict.veto, 'expected a veto')
  assert.equal(verdict.confidence, 1, 'only a normative veto may be certain')
  assert.ok(verdict.explain.some((line) => line.includes('weighted scores were not consulted')))
})

test('undersized touch targets are measured, not inferred from warning counts', () => {
  const audit = auditProfile(degradeTouchTargets(healthyProfile(), 0.6))
  const finding = audit.findings.find((item) => item.check === 'touch-targets')
  assert.ok(finding, 'expected a touch-target finding')
  assert.ok(finding.summary.includes('24px'), 'the standard threshold must be named')
  assert.equal(finding.threshold, 24)
  assert.equal(finding.severity, 'veto')
})

test('shrinking a target below the standard vetoes', () => {
  const verdict = compareProfiles(healthyProfile(), degradeTouchTargets(healthyProfile(), 0.5))
  assert.equal(verdict.outcome, 'worse')
  assert.ok(verdict.veto)
  assert.equal(verdict.veto.check, 'touch-targets')
  assert.equal(verdict.confidence, 1)
})

test('inline links in prose are exempted but still counted', () => {
  const profile = healthyProfile()
  const audit = auditProfile(profile)
  assert.equal(audit.checks.find((check) => check.id === 'touch-targets').score, 1)
  assert.equal(profile.interaction.exemptInlineTargets, 2, 'exemptions must be reported, not silently dropped')
})

test('accessibility warnings are a separate, non-normative check', () => {
  const noisy = healthyProfile()
  noisy.quality.accessibilityWarnings = 14
  const audit = auditProfile(noisy)
  const check = audit.checks.find((item) => item.id === 'accessibility')
  assert.ok(check, 'expected an accessibility check distinct from touch targets')
  assert.equal(check.normative, false, 'a generic warning count must not carry veto authority')
  assert.ok(check.score < 1)
  assert.equal(compareProfiles(healthyProfile(), noisy).veto, null)
})

test('a fix that clears contrast failures reads as better', () => {
  const broken = degradeContrast(healthyProfile(), 0.5)
  const verdict = compareProfiles(broken, healthyProfile())
  assert.equal(verdict.outcome, 'better')
  assert.equal(verdict.veto, null)
})

test('movement inside the noise band is equivalent, not a rollback', () => {
  const before = healthyProfile()
  const after = healthyProfile()
  after.space.adherence = before.space.adherence - 0.004
  const verdict = compareProfiles(before, after)
  assert.ok(Math.abs(verdict.scoreDelta) < FROAM_JUDGE_EQUIVALENCE_BAND)
  assert.equal(verdict.outcome, 'equivalent')
})

test('non-normative checks never veto, however far they fall', () => {
  const before = healthyProfile()
  const after = degradeSpacingGrid(before, 1)
  const verdict = compareProfiles(before, after)
  assert.equal(verdict.outcome, 'worse')
  assert.equal(verdict.veto, null, 'taste-adjacent checks must not claim the authority of a standard')
})

test('confidence scales with margin and is capped below certainty', () => {
  const small = compareProfiles(healthyProfile(), degradeSpacingGrid(healthyProfile(), 0.08))
  const large = compareProfiles(healthyProfile(), degradeSpacingGrid(healthyProfile(), 0.9))
  assert.ok(large.confidence > small.confidence, 'a bigger margin must read as more confident')
  assert.ok(large.confidence <= 0.95, 'non-veto verdicts may never be certain')
})

test('every verdict traces to a per-check delta', () => {
  const verdict = compareProfiles(healthyProfile(), degradeSpacingGrid(healthyProfile(), 0.5))
  const spacing = verdict.deltas.find((delta) => delta.id === 'spacing-grid')
  assert.ok(spacing && spacing.delta < 0)
  assert.ok(verdict.explain.length > 0)
  assert.ok(verdict.explain[0].includes('spacing-grid'))
})

// ── Tier 1: abstention ──────────────────────────────────────────────────────

test('mismatched viewports abstain rather than guess', () => {
  const verdict = compareProfiles(healthyProfile(), healthyProfile({ viewport: 'mobile' }))
  assert.equal(verdict.outcome, 'abstain')
  assert.equal(verdict.confidence, 0)
  assert.ok(verdict.abstainReason.includes('viewport'))
})

test('low coverage abstains, because too little of the page was seen', () => {
  const after = healthyProfile()
  after.provenance.coverage = 0.3
  const verdict = compareProfiles(healthyProfile(), after)
  assert.equal(verdict.outcome, 'abstain')
  assert.ok(verdict.abstainReason.includes('coverage'))
})

test('a page that changed size is a different page, not a revision', () => {
  const after = healthyProfile()
  after.provenance.nodesRendered = 30
  const verdict = compareProfiles(healthyProfile(), after)
  assert.equal(verdict.outcome, 'abstain')
  assert.ok(verdict.abstainReason.includes('different page'))
})

test('abstention is never silently converted into a verdict', () => {
  const verdict = compareProfiles(healthyProfile(), healthyProfile({ viewport: 'tablet' }))
  assert.notEqual(verdict.outcome, 'worse')
  assert.notEqual(verdict.outcome, 'better')
})

// ── Tier 1: gold set ────────────────────────────────────────────────────────

test('a hue rotation reads as equivalent — Tier 1 has no standard for taste', () => {
  const verdict = compareProfiles(healthyProfile(), rotateAccentHue(healthyProfile(), 0.5))
  assert.equal(verdict.outcome, 'equivalent', 'claiming a hue change is worse would be fabricating an opinion')
})

test('the judge scores on the gold set with no false positives', () => {
  const goldSet = generateGoldSet([healthyProfile()], FROAM_DEFAULT_MAGNITUDES)
  const card = scoreJudge(goldSet, compareProfiles)

  console.log(`\n  ── ${card.judgeVersion} ─────────────────────────────`)
  console.log(`  pairs ${card.pairs}   material accuracy ${(card.materialAccuracy * 100).toFixed(1)}% (≥${card.materialityFloor})   overall ${(card.accuracy * 100).toFixed(1)}%`)
  console.log(`  false-positive ${(card.falsePositiveRate * 100).toFixed(1)}%   miss ${(card.missRate * 100).toFixed(1)}%   abstain ${(card.abstainRate * 100).toFixed(1)}%`)
  for (const kind of card.byKind) {
    const threshold = kind.detectionThreshold === null ? 'never' : `${(kind.detectionThreshold * 100).toFixed(0)}%`
    console.log(`    ${kind.kind.padEnd(20)} ${String(kind.caught).padStart(2)}/${kind.total}  detects from ${threshold}`)
  }
  console.log('')

  console.log('  calibration')
  for (const bucket of card.calibration.filter((item) => item.pairs > 0)) {
    console.log(`    confidence ${bucket.bucket}  n=${String(bucket.pairs).padStart(2)}  stated ${bucket.meanConfidence.toFixed(2)}  actual ${bucket.accuracy.toFixed(2)}  gap ${bucket.gap.toFixed(2)}`)
  }
  console.log(`    expected calibration error ${card.expectedCalibrationError.toFixed(3)}\n`)

  assert.equal(card.falsePositiveRate, 0, 'a judge that flags unobjectionable changes poisons everything downstream')
  assert.equal(card.missRate, 0, 'a material break must never be missed')
  assert.ok(card.materialAccuracy >= 0.95, `material accuracy ${card.materialAccuracy} is below the 0.95 gate`)
  assert.equal(card.abstainRate, 0, 'gold-set pairs are all comparable; abstaining here is a bug')
  // Overall accuracy is deliberately not gated. It counts sub-threshold pairs
  // the judge correctly declined to call, so driving it to 1 would mean
  // flagging every 5% wobble as a regression.
  assert.ok(card.accuracy < 1, 'a judge with perfect sub-threshold accuracy is one with no restraint')
})

test('detection thresholds are monotonic — a judge must not lose a violation as it worsens', () => {
  const goldSet = generateGoldSet([healthyProfile()], FROAM_DEFAULT_MAGNITUDES)
  const card = scoreJudge(goldSet, compareProfiles)
  for (const kind of card.byKind.filter((item) => item.kind !== 'hue-rotation')) {
    assert.notEqual(kind.detectionThreshold, null, `${kind.kind} is never reliably detected`)
    assert.ok(kind.detectionThreshold <= 0.5, `${kind.kind} needs a ${kind.detectionThreshold} break before it is noticed`)
  }
})

test('standards violations are caught at the smallest magnitude the gold set contains', () => {
  const goldSet = generateGoldSet([healthyProfile()], FROAM_DEFAULT_MAGNITUDES)
  const card = scoreJudge(goldSet, compareProfiles)
  for (const kind of ['contrast', 'touch-targets']) {
    const entry = card.byKind.find((item) => item.kind === kind)
    assert.equal(entry.detectionThreshold, FROAM_DEFAULT_MAGNITUDES[0], `${kind} is normative and must be caught immediately`)
  }
})

test('stated confidence tracks observed accuracy', () => {
  const card = scoreJudge(generateGoldSet([healthyProfile()], FROAM_DEFAULT_MAGNITUDES), compareProfiles)
  // Gate tightened from the 0.118 the invented linear curve produced. If a
  // check or weight changes, this is the assertion that catches the confidence
  // mapping going stale — recalibrate rather than relax it.
  assert.ok(card.expectedCalibrationError <= 0.08, `ECE ${card.expectedCalibrationError} — confidence does not mean what it says`)
  const populated = card.calibration.filter((bucket) => bucket.pairs > 0)
  assert.ok(populated.length >= 2, 'a single confidence bucket makes calibration unmeasurable')
  for (const bucket of populated) assert.ok(bucket.accuracy >= 0 && bucket.accuracy <= 1)
})

test('the confidence curve is monotonic and never reaches certainty', () => {
  const margins = [0, 0.005, 0.01, 0.015, 0.02, 0.04, 0.1, 1]
  const values = margins.map((margin) => confidenceForMargin(margin))
  // Inside the band, confidence measures how tied the pair is, so it falls.
  assert.equal(confidenceForMargin(0), 1, 'an identical pair is confidently equivalent')
  assert.ok(confidenceForMargin(0.009) < confidenceForMargin(0.001))
  // Outside it, confidence measures margin, so it rises.
  const outside = margins.filter((margin) => margin >= FROAM_JUDGE_EQUIVALENCE_BAND).map((margin) => confidenceForMargin(margin))
  for (let index = 1; index < outside.length; index += 1) {
    assert.ok(outside[index] >= outside[index - 1], `confidence fell from ${outside[index - 1]} to ${outside[index]}`)
  }
  assert.ok(Math.max(...values) <= 1)
  assert.ok(Math.max(...outside) <= 0.95, 'only a normative veto may exceed the ceiling')
  assert.ok(confidenceForMargin(FROAM_JUDGE_EQUIVALENCE_BAND) >= 0.6, 'a margin outside the band is not a coin flip')
})

test('the highest-confidence bucket is the most accurate', () => {
  const card = scoreJudge(generateGoldSet([healthyProfile()], FROAM_DEFAULT_MAGNITUDES), compareProfiles)
  const populated = card.calibration.filter((bucket) => bucket.pairs >= 3)
  const top = populated[populated.length - 1]
  const bottom = populated[0]
  assert.ok(top.accuracy >= bottom.accuracy, `confidence is inverted: ${bottom.bucket} scored ${bottom.accuracy}, ${top.bucket} scored ${top.accuracy}`)
})

// ── composition ─────────────────────────────────────────────────────────────

test('a composed report carries both tiers and scores on Tier 1 alone', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const offender = healthyProfile()
  offender.space.base = 48
  const composed = judgePage(offender, report.priors)
  assert.equal(composed.score, auditProfile(offender).score, 'priors must not move the headline score')
  assert.ok(composed.priorsEvaluated > 0, 'a silent tier must be distinguishable from an absent one')
  assert.ok(composed.findings.length >= composed.deterministic.findings.length)
})

test('an induced prior can advise but never veto', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const offender = healthyProfile()
  offender.color.modeSignal = 'dark'
  offender.space.base = 96
  offender.type.measureCh = 200
  const composed = judgePage(offender, report.priors)
  assert.ok(composed.priorViolations.length > 0, 'expected prior violations on an obvious outlier')
  for (const violation of composed.priorViolations) {
    assert.notEqual(violation.severity, 'veto', 'statistical evidence may not claim the authority of a standard')
  }
})

test('priors annotate a change without bending its verdict', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const before = healthyProfile()
  const after = healthyProfile()
  after.space.base = 48
  const bare = compareProfiles(before, after)
  const composed = judgeChange(before, after, report.priors)
  assert.equal(composed.outcome, bare.outcome, 'the outcome must be Tier 1\'s, unchanged')
  assert.equal(composed.scoreDelta, bare.scoreDelta)
  assert.ok(Array.isArray(composed.priorDelta.introduced))
  assert.ok(Array.isArray(composed.priorDelta.resolved))
})

test('resolving a prior violation is reported as resolved', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const broken = healthyProfile()
  broken.space.base = 48
  const composed = judgeChange(broken, healthyProfile(), report.priors)
  assert.ok(composed.priorDelta.resolved.length > 0, 'a fixed violation must show up as resolved')
  assert.equal(composed.priorDelta.introduced.length, 0)
})

test('a composed judge with no priors behaves exactly like Tier 1', () => {
  const before = healthyProfile()
  const after = degradeSpacingGrid(before, 0.5)
  assert.deepEqual(
    { ...judgeChange(before, after), composedJudgeVersion: undefined, priorDelta: undefined, priorsEvaluated: undefined },
    { ...compareProfiles(before, after), composedJudgeVersion: undefined, priorDelta: undefined, priorsEvaluated: undefined },
  )
})

test('the report renders as checkable prose, not marketing', () => {
  const broken = degradeContrast(degradeSpacingGrid(healthyProfile(), 0.5), 0.4)
  const text = formatJudgeReport(judgePage(broken))
  assert.ok(text.includes('https://example.test'), 'the report must name what it audited')
  assert.ok(text.includes('WCAG'), 'a standards violation must name its standard')
  assert.ok(text.includes('Standards violations'))
  assert.ok(/\d/.test(text), 'every claim carries a number')
  assert.ok(!text.includes('undefined'), `report contains undefined: ${text}`)
})

test('a clean page reports no findings rather than inventing some', () => {
  const text = formatJudgeReport(judgePage(healthyProfile()))
  assert.ok(text.includes('No findings'))
  assert.ok(!text.includes('Standards violations'))
})

// ── Tier 2: priors ──────────────────────────────────────────────────────────

/**
 * A corpus with one deliberate regularity: dark-mode sites use a 4px base and
 * a tighter measure, light-mode sites use 8px. Nothing else correlates, so a
 * prior scoped to mode must beat the unscoped one, and a prior over the noise
 * feature must not survive.
 */
function syntheticCorpus(siteCount = 24) {
  const profiles = []
  for (let site = 0; site < siteCount; site += 1) {
    const dark = site % 2 === 0
    for (let page = 0; page < 2; page += 1) {
      const profile = healthyProfile({ origin: `https://site-${site}.test`, routeKey: `/page-${page}` })
      profile.color.modeSignal = dark ? 'dark' : 'light'
      profile.space.base = dark ? 4 : 8
      profile.type.measureCh = dark ? 52 + (site % 3) : 70 + (site % 3)
      // Pure noise: deterministic but uncorrelated with anything.
      profile.surface.shadowTiers = (site * 7 + page * 3) % 9
      profiles.push(profile)
    }
  }
  return profiles
}

test('the corpus splits by origin, never by page', () => {
  const corpus = syntheticCorpus()
  const { train, holdOut } = splitByOrigin(corpus, 0.3)
  const trainOrigins = new Set(train.map((profile) => profile.origin))
  const holdOutOrigins = new Set(holdOut.map((profile) => profile.origin))
  for (const origin of holdOutOrigins) {
    assert.ok(!trainOrigins.has(origin), `${origin} leaked across the split — two pages of one site share a design system`)
  }
  assert.ok(holdOut.length > 0, 'an empty hold-out would make every prior unscoreable')
})

test('the split is deterministic across runs', () => {
  const corpus = syntheticCorpus()
  const first = splitByOrigin(corpus, 0.3).holdOutOrigins.join(',')
  const second = splitByOrigin(corpus, 0.3).holdOutOrigins.join(',')
  assert.equal(first, second)
})

test('a real conditional regularity is induced and beats the unscoped baseline', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const scoped = report.priors.find((prior) => prior.feature === 'space.base' && prior.scope.feature === 'color.modeSignal')
  assert.ok(scoped, `expected a mode-scoped prior on space.base; kept ${report.priors.map((p) => p.id).join(', ')}`)
  assert.ok(scoped.lift > 1, `conditioning must earn its keep, lift was ${scoped.lift}`)
  assert.ok(scoped.heldOutAccuracy >= 0.9, `held-out accuracy was ${scoped.heldOutAccuracy}`)
  assert.ok(scoped.support >= 4)
})

test('claims are generated from the data, not selected from a fixed list', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const tighter = inducePriors(syntheticCorpus(40), { minSupport: 4 })
  const claims = new Set(report.priors.map((prior) => prior.claim))
  for (const prior of report.priors) {
    assert.ok(/\d/.test(prior.claim), `a claim must carry its numbers: "${prior.claim}"`)
    assert.ok(prior.claim.includes(prior.feature), 'a claim must name what it measures')
  }
  // Different corpora must produce different sentences. A switch statement would not.
  const changed = tighter.priors.some((prior) => !claims.has(prior.claim))
  assert.ok(changed, 'claim text did not change with the data — that is a hardcoded rule, not a learned one')
})

test('a noise feature does not survive induction', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const noise = report.priors.find((prior) => prior.feature === 'surface.shadowTiers' && prior.scope.feature !== null)
  assert.equal(noise, undefined, 'a scoped prior over uncorrelated noise must be pruned')
  assert.ok(report.pruned.length > 0, 'pruning is evidence and must be reported')
  assert.ok(report.pruned.every((entry) => typeof entry.reason === 'string' && entry.reason.length > 0))
})

test('evidence against a prior degrades it, and a quantile range degrades by widening', () => {
  // Worth being precise about how this fails. A quantile-derived range absorbs
  // counter-evidence by getting wider, so held-out *accuracy* can stay at 1.0
  // while the prior becomes worthless. Informativeness is what falls. A system
  // that watched accuracy alone here would report perfect confidence in a claim
  // that had stopped saying anything — which is exactly the failure mode of
  // counting successes without a denominator.
  const clean = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const polluted = syntheticCorpus()
  for (const profile of polluted) {
    const site = Number(profile.origin.match(/site-(\d+)/)[1])
    if (site % 3 === 0) profile.space.base = 12
  }
  const dirty = inducePriors(polluted, { minSupport: 4 })
  const find = (report) => report.priors.find((prior) => prior.feature === 'space.base' && prior.scope.feature === 'color.modeSignal')
  const before = find(clean)
  const after = find(dirty)
  assert.ok(before, 'expected a baseline prior')
  assert.ok(before.informativeness > 0.5, `baseline prior should be sharp, was ${before.informativeness}`)

  if (after) {
    assert.ok(after.informativeness < before.informativeness, `polluted prior should be blunter: ${before.informativeness} → ${after.informativeness}`)
  } else {
    const dropped = dirty.pruned.find((entry) => entry.id.includes('space.base') && entry.id.includes('modeSignal'))
    assert.ok(dropped, 'a prior that stopped generalising must appear in the pruned report with a reason')
    assert.ok(dropped.reason.length > 0)
  }
})

test('counter-examples are retained rather than discarded', () => {
  const polluted = syntheticCorpus()
  for (const profile of polluted) {
    const site = Number(profile.origin.match(/site-(\d+)/)[1])
    if (site % 5 === 0) profile.type.measureCh = 140
  }
  const report = inducePriors(polluted, { minSupport: 4, minHeldOutAccuracy: 0.5 })
  const withCounters = report.priors.filter((prior) => prior.counterExamples.length > 0)
  assert.ok(withCounters.length > 0, 'a prior that has never failed has not been tested')
  for (const prior of withCounters) {
    assert.ok(prior.counterExamples.every((origin) => origin.startsWith('https://')), 'counter-examples are origins, never page content')
  }
})

test('every kept prior carries its own evidence', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  assert.ok(report.priors.length > 0)
  for (const prior of report.priors) {
    assert.ok(prior.support >= 4)
    assert.ok(prior.heldOutAccuracy >= 0 && prior.heldOutAccuracy <= 1)
    assert.ok(Number.isFinite(prior.lift), 'lift must be finite and serialisable')
    assert.ok(prior.informativeness > 0, 'a prior that admits everything is not a prior')
    assert.ok(prior.priorsVersion.length > 0)
  }
})

test('priors flag violations with citable evidence and no hidden authority', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const offender = healthyProfile()
  offender.color.modeSignal = 'dark'
  offender.space.base = 48
  offender.type.measureCh = 190
  const violations = applyPriors(offender, report.priors)
  assert.ok(violations.length > 0, 'an obvious outlier must be flagged')
  for (const violation of violations) {
    assert.ok(violation.support > 0)
    assert.ok(violation.summary.includes('%'), 'a violation must cite how often the prior held')
    assert.ok(['major', 'minor'].includes(violation.severity), 'an induced prior may never claim veto authority')
  }
})

test('priors do not fire outside their scope', () => {
  const report = inducePriors(syntheticCorpus(), { minSupport: 4 })
  const light = healthyProfile()
  light.color.modeSignal = 'light'
  const darkOnly = report.priors.filter((prior) => prior.scope.value === 'dark')
  assert.ok(darkOnly.length > 0, 'expected at least one dark-scoped prior')
  const violations = applyPriors(light, darkOnly)
  assert.equal(violations.length, 0, 'a dark-mode prior must stay silent on a light-mode page')
})

test('an empty or tiny corpus induces nothing rather than inventing rules', () => {
  assert.equal(inducePriors([], { minSupport: 4 }).priors.length, 0)
  assert.equal(inducePriors([healthyProfile()], { minSupport: 4 }).priors.length, 0)
})

test('feature extraction omits unmeasurable axes instead of defaulting them', () => {
  const profile = healthyProfile()
  profile.type.ratio = null
  profile.color.contrastFloor = Infinity
  const features = profileFeatures(profile)
  assert.equal(features.numeric['type.ratio'], undefined, 'a missing ratio must not become 0')
  assert.equal(features.numeric['color.contrastFloor'], undefined, 'Infinity must not become a number')
  assert.equal(features.categorical['color.modeSignal'], 'light')
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
console.log(`\njudge: ${tests.length - failed}/${tests.length} passed`)
if (failed) process.exit(1)
