/**
 * Froam graded degradation — the gold set generator.
 *
 * A judge whose accuracy is unknown cannot validate anything, and hand-labelling
 * thousands of design pairs is not affordable. So instead of collecting labels,
 * we manufacture them: take a profile, break one property by a known amount, and
 * the correct answer is known by construction.
 *
 * This yields more than accuracy. Because each degradation carries a magnitude,
 * it yields the *detection threshold* — the smallest violation the judge
 * reliably catches. "Detects a 4% spacing-grid break at 91%" is a capability
 * claim. "Compare them objectively" is not.
 *
 * Some degradations are deliberately expected to read as 'equivalent'. A hue
 * rotation is a real change that Tier 1 has no standard to judge, so a Tier 1
 * judge calling it 'worse' is fabricating an opinion. Those pairs measure the
 * false-positive rate, which matters as much as detection.
 */
import type { FroamPageProfile, FroamContrastPair } from './page-profile'
import { FROAM_MIN_TARGET_PX, oklchToHex } from './page-profile'
import type { FroamJudgeOutcome, FroamJudgeVerdict } from './judge-deterministic'

export type FroamDegradationKind =
  | 'contrast' | 'touch-targets' | 'spacing-grid' | 'accent-dilution' | 'type-scale'
  | 'token-drift' | 'component-variance' | 'measure' | 'radius' | 'hue-rotation'

export type FroamDegradedPair = {
  kind: FroamDegradationKind
  /** 0–1. Larger is a more severe break. */
  magnitude: number
  expected: 'worse' | 'equivalent'
  /** The Tier 1 check that should catch this, or null when none should. */
  targetCheck: string | null
  before: FroamPageProfile
  after: FroamPageProfile
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const clone = (profile: FroamPageProfile): FroamPageProfile => structuredClone(profile)

// ── degradations ────────────────────────────────────────────────────────────

/** Push text under the WCAG AA floor. Should always trip the normative veto. */
export function degradeContrast(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  const samples = Math.max(next.color.contrastSamples, 20)
  const failureCount = Math.max(1, Math.ceil(samples * magnitude * 0.5))
  const floor = Math.max(1.05, 4.5 - magnitude * 3.2)
  const failures: FroamContrastPair[] = Array.from({ length: failureCount }, (_, index) => ({
    nodeId: `degraded:contrast:${index}`,
    ratio: Math.round((floor + index * 0.05) * 100) / 100,
    required: 4.5,
    largeText: false,
    role: 'paragraph',
  }))
  next.color.contrastSamples = samples
  next.color.contrastFailures = failures
  next.color.contrastFloor = Math.round(floor * 100) / 100
  return next
}

/** Shrink interactive targets under the WCAG 2.5.8 minimum. Should trip the normative veto. */
export function degradeTouchTargets(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  const samples = Math.max(next.interaction.targetSamples, 10)
  const count = Math.max(1, Math.ceil(samples * magnitude * 0.5))
  const side = Math.max(4, Math.round(FROAM_MIN_TARGET_PX * (1 - magnitude * 0.8)))
  next.interaction.targetSamples = samples
  next.interaction.undersizedTargets = Array.from({ length: count }, (_, index) => ({
    nodeId: `degraded:target:${index}`,
    role: 'button',
    tag: 'button',
    width: side + index,
    height: side,
    shortestSide: side,
  }))
  next.interaction.smallestTargetPx = side
  return next
}

/** Knock spacing values off the base grid. */
export function degradeSpacingGrid(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  const adherence = clamp01(profile.space.adherence * (1 - magnitude))
  next.space.adherence = Math.round(adherence * 1000) / 1000
  next.quality.spacingDrift = Math.round((1 - adherence) * 1000) / 1000
  next.space.scale = [...profile.space.scale, Math.round((profile.space.base + 1) * (1 + magnitude) * 10) / 10]
  return next
}

/** Spread the accent onto elements that carry no action meaning. */
export function degradeAccentDiscipline(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  next.color.accentDiscipline = Math.round(clamp01(profile.color.accentDiscipline * (1 - magnitude)) * 1000) / 1000
  const accent = next.color.palette.find((entry) => entry.role === 'accent')
  if (accent) {
    const strays = ['paragraph', 'heading', 'card', 'badge'] as const
    accent.appearsOn = [...new Set([...accent.appearsOn, ...strays.slice(0, Math.max(1, Math.ceil(magnitude * strays.length)))])]
  }
  return next
}

/** Add off-scale type sizes until the steps stop agreeing with each other. */
export function degradeTypeScale(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  const extra = Math.max(1, Math.ceil(magnitude * 6))
  const largest = profile.type.scale.length ? profile.type.scale[profile.type.scale.length - 1].px : 16
  for (let index = 0; index < extra; index += 1) {
    next.type.scale.push({
      px: Math.round((largest + 3 + index * 2.5) * 100) / 100,
      weight: 400,
      lineHeight: Math.round((largest + 3 + index * 2.5) * 1.3 * 100) / 100,
      usedBy: ['unknown'],
      count: 1,
    })
  }
  next.type.ratioSpread = Math.round((profile.type.ratioSpread + magnitude * 0.4) * 1000) / 1000
  if (next.type.ratioSpread > 0.25) next.type.ratio = null
  next.quality.uniqueSizes = next.type.scale.length
  return next
}

/** Paint area with colours that fall outside the resolved palette. */
export function degradeTokenDrift(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  next.quality.tokenDrift = Math.round(clamp01(profile.quality.tokenDrift + magnitude * 0.5) * 1000) / 1000
  next.quality.uniqueColors = profile.quality.uniqueColors + Math.ceil(magnitude * 24)
  return next
}

/** Make repeated components disagree with each other about spacing. */
export function degradeComponentVariance(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  if (!next.components.length) {
    next.components.push({ signature: 'degraded|card|block|div', role: 'card', instances: 4, variance: 0 })
  }
  for (const family of next.components) family.variance = Math.round(clamp01(family.variance + magnitude * 0.7) * 1000) / 1000
  return next
}

/** Stretch body text past a comfortable line length. */
export function degradeMeasure(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  next.type.measureCh = Math.round(85 + magnitude * 70)
  return next
}

/** Multiply distinct corner radii. */
export function degradeRadius(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  const extra = Math.max(1, Math.ceil(magnitude * 7))
  const base = profile.surface.radii.length ? Math.max(...profile.surface.radii) : 4
  for (let index = 0; index < extra; index += 1) next.surface.radii.push(Math.round((base + 3 + index * 2.5) * 10) / 10)
  next.surface.radii.sort((a, b) => a - b)
  return next
}

/**
 * Rotate the accent hue while holding lightness, chroma and every usage rule.
 *
 * This is a real visual change with no standard behind it — whether teal beats
 * violet is a Tier 3 question. A Tier 1 judge must report 'equivalent' here; if
 * it reports 'worse' it is inventing an opinion it has no basis for.
 */
export function rotateAccentHue(profile: FroamPageProfile, magnitude: number): FroamPageProfile {
  const next = clone(profile)
  const accent = next.color.palette.find((entry) => entry.role === 'accent')
  if (accent) {
    accent.oklch = { ...accent.oklch, h: (accent.oklch.h + magnitude * 180) % 360 }
    accent.hex = oklchToHex(accent.oklch)
  }
  return next
}

const DEGRADATIONS: Array<{
  kind: FroamDegradationKind
  expected: 'worse' | 'equivalent'
  targetCheck: string | null
  apply: (profile: FroamPageProfile, magnitude: number) => FroamPageProfile
}> = [
  { kind: 'contrast', expected: 'worse', targetCheck: 'contrast', apply: degradeContrast },
  { kind: 'touch-targets', expected: 'worse', targetCheck: 'touch-targets', apply: degradeTouchTargets },
  { kind: 'spacing-grid', expected: 'worse', targetCheck: 'spacing-grid', apply: degradeSpacingGrid },
  { kind: 'accent-dilution', expected: 'worse', targetCheck: 'accent-discipline', apply: degradeAccentDiscipline },
  { kind: 'type-scale', expected: 'worse', targetCheck: 'type-scale', apply: degradeTypeScale },
  { kind: 'token-drift', expected: 'worse', targetCheck: 'token-drift', apply: degradeTokenDrift },
  { kind: 'component-variance', expected: 'worse', targetCheck: 'component-variance', apply: degradeComponentVariance },
  { kind: 'measure', expected: 'worse', targetCheck: 'measure', apply: degradeMeasure },
  { kind: 'radius', expected: 'worse', targetCheck: 'radius-consistency', apply: degradeRadius },
  { kind: 'hue-rotation', expected: 'equivalent', targetCheck: null, apply: rotateAccentHue },
]

export const FROAM_DEFAULT_MAGNITUDES = [0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1] as const

/**
 * Produce a labelled gold set from one or more source profiles.
 *
 * Every pair carries its own known answer, so the judge can be scored without
 * a single human annotation.
 */
export function generateGoldSet(
  profiles: readonly FroamPageProfile[],
  magnitudes: readonly number[] = FROAM_DEFAULT_MAGNITUDES,
): FroamDegradedPair[] {
  const pairs: FroamDegradedPair[] = []
  for (const profile of profiles) {
    // An unchanged profile must read as equivalent. If this fails, nothing else matters.
    pairs.push({ kind: 'hue-rotation', magnitude: 0, expected: 'equivalent', targetCheck: null, before: profile, after: clone(profile) })
    for (const degradation of DEGRADATIONS) {
      for (const magnitude of magnitudes) {
        pairs.push({
          kind: degradation.kind,
          magnitude,
          expected: degradation.expected,
          targetCheck: degradation.targetCheck,
          before: profile,
          after: degradation.apply(profile, magnitude),
        })
      }
    }
  }
  return pairs
}

// ── scoring ─────────────────────────────────────────────────────────────────

/**
 * The magnitude at or above which a break should be unmissable.
 *
 * Below it, failing to call a change 'worse' is not an error — it is the judge
 * declining to treat a 5% wobble as a regression, which is a property worth
 * having. Counting those as misses would reward a judge that flags everything,
 * and a judge that flags everything is the one that poisons induction. The
 * sensitivity below this line is reported as detectionThreshold, not as failure.
 */
export const FROAM_MATERIALITY_FLOOR = 0.35

export type FroamJudgeScorecard = {
  judgeVersion: string
  pairs: number
  /** Fraction of all pairs matching the known answer, sub-threshold included. Reported, never gated. */
  accuracy: number
  /** Accuracy restricted to material breaks and to 'equivalent' pairs. This is the number to gate on. */
  materialAccuracy: number
  materialityFloor: number
  /**
   * Fraction of 'equivalent' pairs the judge wrongly called better or worse.
   * A judge that flags everything scores perfectly on detection and is useless.
   */
  falsePositiveRate: number
  /** Fraction of *material* 'worse' pairs the judge failed to catch. */
  missRate: number
  /** Fraction of pairs the judge declined to call. */
  abstainRate: number
  /**
   * Expected calibration error: the average gap between stated confidence and
   * observed accuracy, weighted by bucket size. 0 is perfect.
   *
   * An uncalibrated confidence is worse than none, because downstream code
   * multiplies by it. A judge that says 0.9 and is right 0.6 of the time
   * silently inflates every score derived from it.
   */
  expectedCalibrationError: number
  /** Per-bucket reliability, so miscalibration can be located rather than just reported. */
  calibration: Array<{ bucket: string; pairs: number; meanConfidence: number; accuracy: number; gap: number }>
  byKind: Array<{
    kind: FroamDegradationKind
    accuracy: number
    /** Smallest magnitude caught, and caught at every larger magnitude too. Null when never reliably caught. */
    detectionThreshold: number | null
    caught: number
    total: number
  }>
}

const matches = (outcome: FroamJudgeOutcome, expected: 'worse' | 'equivalent') =>
  expected === 'worse' ? outcome === 'worse' : outcome === 'equivalent'

/**
 * Score a judge against a gold set.
 *
 * `detectionThreshold` is the headline number: the smallest break the judge
 * catches *and keeps catching* as severity rises. A judge that catches 0.2 but
 * misses 0.35 has not detected anything — it got lucky, and the threshold is
 * reported as the point from which it is monotonically correct.
 */
export function scoreJudge(
  pairs: readonly FroamDegradedPair[],
  compare: (before: FroamPageProfile, after: FroamPageProfile) => FroamJudgeVerdict,
  materialityFloor: number = FROAM_MATERIALITY_FLOOR,
): FroamJudgeScorecard {
  const results = pairs.map((pair) => ({ pair, verdict: compare(pair.before, pair.after) }))
  const correct = results.filter((result) => matches(result.verdict.outcome, result.pair.expected)).length
  const equivalentPairs = results.filter((result) => result.pair.expected === 'equivalent')
  const worsePairs = results.filter((result) => result.pair.expected === 'worse')
  const materialPairs = results.filter((result) => result.pair.expected === 'equivalent' || result.pair.magnitude >= materialityFloor)
  const materialWorse = worsePairs.filter((result) => result.pair.magnitude >= materialityFloor)

  // Calibration uses the same definition of "correct" as materialAccuracy.
  // Scoring it against sub-threshold labels would measure the judge's
  // confidence against a standard of correctness this file has already
  // rejected — it would report the judge as badly calibrated for declining to
  // call a 5% wobble, which is behaviour worth keeping.
  //
  // Abstentions are excluded: they carry confidence 0 by construction, so
  // including them would drag the curve toward a number that says nothing
  // about the decisions actually made.
  const called = materialPairs.filter((result) => result.verdict.outcome !== 'abstain')
  const buckets = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.001]] as const
  const calibration = buckets.map(([low, high]) => {
    const inBucket = called.filter((result) => result.verdict.confidence >= low && result.verdict.confidence < high)
    const accuracy = inBucket.length ? inBucket.filter((result) => matches(result.verdict.outcome, result.pair.expected)).length / inBucket.length : 0
    const meanConfidence = inBucket.length ? inBucket.reduce((sum, result) => sum + result.verdict.confidence, 0) / inBucket.length : 0
    return {
      bucket: `${low.toFixed(1)}–${Math.min(1, high).toFixed(1)}`,
      pairs: inBucket.length,
      meanConfidence: Math.round(meanConfidence * 1000) / 1000,
      accuracy: Math.round(accuracy * 1000) / 1000,
      gap: Math.round(Math.abs(meanConfidence - accuracy) * 1000) / 1000,
    }
  })
  const expectedCalibrationError = called.length
    ? Math.round(calibration.reduce((sum, bucket) => sum + bucket.gap * bucket.pairs, 0) / called.length * 1000) / 1000
    : 0

  const kinds = [...new Set(pairs.map((pair) => pair.kind))]
  const byKind = kinds.map((kind) => {
    const forKind = results.filter((result) => result.pair.kind === kind)
    const caught = forKind.filter((result) => matches(result.verdict.outcome, result.pair.expected)).length
    const worseForKind = forKind
      .filter((result) => result.pair.expected === 'worse')
      .sort((a, b) => a.pair.magnitude - b.pair.magnitude)
    let detectionThreshold: number | null = null
    for (let index = 0; index < worseForKind.length; index += 1) {
      if (worseForKind.slice(index).every((result) => result.verdict.outcome === 'worse')) {
        detectionThreshold = worseForKind[index].pair.magnitude
        break
      }
    }
    return { kind, accuracy: forKind.length ? caught / forKind.length : 0, detectionThreshold, caught, total: forKind.length }
  })

  return {
    judgeVersion: results[0]?.verdict.judgeVersion ?? 'unknown',
    pairs: results.length,
    accuracy: results.length ? correct / results.length : 0,
    materialAccuracy: materialPairs.length
      ? materialPairs.filter((result) => matches(result.verdict.outcome, result.pair.expected)).length / materialPairs.length
      : 0,
    materialityFloor,
    falsePositiveRate: equivalentPairs.length
      ? equivalentPairs.filter((result) => result.verdict.outcome === 'worse' || result.verdict.outcome === 'better').length / equivalentPairs.length
      : 0,
    missRate: materialWorse.length ? materialWorse.filter((result) => result.verdict.outcome !== 'worse').length / materialWorse.length : 0,
    abstainRate: results.length ? results.filter((result) => result.verdict.outcome === 'abstain').length / results.length : 0,
    expectedCalibrationError,
    calibration,
    byKind,
  }
}
